import * as cheerio from 'cheerio';
import type { Source } from '../config/schema';
import { DEFAULT_HEADERS, type CollectorAdapter, type RawJob } from './types';

// 알려진 RawJob 필드명. source.select.fields의 키 중 이 목록만 매핑한다.
const KNOWN_FIELDS = [
  'title',
  'company',
  'url',
  'location',
  'employmentType',
  'description',
  'postedAt',
] as const;
type KnownField = (typeof KNOWN_FIELDS)[number];

// 필드 스펙: "selector" → 텍스트, "selector@attr" → 속성값, "@attr" → 항목 자신의 속성.
function extractField(
  $: cheerio.CheerioAPI,
  item: cheerio.Cheerio<any>,
  spec: string,
): string {
  const atIdx = spec.indexOf('@');
  const selector = atIdx === -1 ? spec : spec.slice(0, atIdx).trim();
  const attr = atIdx === -1 ? null : spec.slice(atIdx + 1).trim();
  const node = selector ? item.find(selector).first() : item;
  if (node.length === 0) return '';
  const raw = attr ? node.attr(attr) ?? '' : node.text();
  return raw.replace(/\s+/g, ' ').trim();
}

// HTML 스크래핑 어댑터: source.request로 fetch → cheerio → source.select로 추출.
export const htmlAdapter: CollectorAdapter = {
  async collect(source: Source): Promise<RawJob[]> {
    const { request, select } = source;
    const res = await fetch(request.url, {
      method: request.method,
      headers: { ...DEFAULT_HEADERS, ...(request.headers ?? {}) },
      body: request.method === 'POST' ? request.body : undefined,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${source.id}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const base = new URL(request.url).origin;

    const items = $(select.list);
    const jobs: RawJob[] = [];

    items.each((_, el) => {
      const item = $(el);
      const fields: Partial<Record<KnownField, string>> = {};
      for (const key of KNOWN_FIELDS) {
        const spec = select.fields[key];
        if (spec) {
          const val = extractField($, item, spec);
          if (val) fields[key] = val;
        }
      }
      if (!fields.title || !fields.url) return; // 제목/링크 없으면 스킵

      // 상대 URL → 절대 URL
      let url = fields.url;
      try {
        url = new URL(url, base).href;
      } catch {
        return;
      }

      jobs.push({
        source: source.id,
        title: fields.title,
        company: fields.company ?? '',
        url,
        location: fields.location,
        employmentType: fields.employmentType,
        description: fields.description,
        postedAt: fields.postedAt,
      });
    });

    return jobs;
  },
};

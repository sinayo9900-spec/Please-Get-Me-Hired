import type { Source } from '../config/schema';
import { DEFAULT_HEADERS, type CollectorAdapter, type RawJob } from './types';

// "a.b.c" 또는 "a.0.b" 형태의 점 경로로 중첩 값을 읽는다.
function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function asString(v: unknown): string {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

// JSON API 어댑터: source.select.list 경로의 배열을 순회하며 fields 경로로 추출.
export const apiAdapter: CollectorAdapter = {
  async collect(source: Source): Promise<RawJob[]> {
    const { request, select } = source;
    const res = await fetch(request.url, {
      method: request.method,
      headers: { Accept: 'application/json', ...DEFAULT_HEADERS, ...(request.headers ?? {}) },
      body: request.method === 'POST' ? request.body : undefined,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${source.id}`);
    }
    const data = await res.json();
    const list = getPath(data, select.list);
    if (!Array.isArray(list)) {
      throw new Error(`select.list "${select.list}" did not resolve to an array for ${source.id}`);
    }
    const base = new URL(request.url).origin;

    const jobs: RawJob[] = [];
    for (const entry of list) {
      const title = asString(getPath(entry, select.fields.title));
      let url = asString(getPath(entry, select.fields.url));
      if (!title || !url) continue;
      try {
        url = new URL(url, base).href;
      } catch {
        continue;
      }
      jobs.push({
        source: source.id,
        title,
        company: asString(getPath(entry, select.fields.company ?? '')),
        url,
        location: select.fields.location ? asString(getPath(entry, select.fields.location)) : undefined,
        employmentType: select.fields.employmentType
          ? asString(getPath(entry, select.fields.employmentType))
          : undefined,
        description: select.fields.description
          ? asString(getPath(entry, select.fields.description))
          : undefined,
        postedAt: select.fields.postedAt ? asString(getPath(entry, select.fields.postedAt)) : undefined,
      });
    }
    return jobs;
  },
};

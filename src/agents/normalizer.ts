import { JobPostingSchema, type JobPosting } from '../config/schema';
import { findExistingJobIds } from '../db/repository';
import type { RawJob } from '../collectors/types';

// RawJob[] → JobPosting[]: 필드 표준화 + 멱등 키 부여 + 배치 내 중복 제거.
// "신규만 필터"는 DB 조회가 필요하므로 selectNew()로 분리(순수 변환과 분리).

// URL에서 안정적인 외부 식별자를 뽑는다.
// 사이트마다 식별자 위치가 달라(경로 vs 쿼리) URL 전체에서 4자리 이상 숫자 중
// 가장 긴 것을 쓴다. 예) peoplenjob /jobs/6224308, saramin rec_idx=54206267,
// inthiswork /archives/359256. (page=1 등 짧은 숫자는 제외됨)
function externalId(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const digits = `${u.pathname}${u.search}`.match(/\d{4,}/g);
    if (digits && digits.length) {
      return digits.sort((a, b) => b.length - a.length)[0];
    }
    return u.pathname;
  } catch {
    return rawUrl;
  }
}

// 제목이 "회사명｜직무"(인디스워크) 형태면 분리한다.
// company가 비었거나 title과 동일할 때만 적용해 정상 분리된 사이트는 건드리지 않는다.
function splitCompanyTitle(title: string, company: string): { title: string; company: string } {
  const hasSep = /[｜|]/.test(title);
  const needSplit = hasSep && (!company || company === title);
  if (!needSplit) return { title, company };
  const parts = title.split(/[｜|]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { title, company };
  return { company: parts[0], title: parts.slice(1).join(' | ') };
}

export function toJobPosting(raw: RawJob, collectedAt: string): JobPosting {
  const { title, company } = splitCompanyTitle(raw.title, raw.company);
  return JobPostingSchema.parse({
    id: `${raw.source}:${externalId(raw.url)}`,
    source: raw.source,
    title,
    company,
    url: raw.url,
    location: raw.location,
    employmentType: raw.employmentType,
    description: raw.description || title, // 목록 페이지엔 본문이 없어 제목으로 대체
    postedAt: raw.postedAt,
    collectedAt,
  });
}

// 순수 변환: 표준화 + 멱등 키 + 배치 내 중복 제거(같은 id는 첫 항목 유지).
export function normalize(raws: RawJob[], collectedAt = new Date().toISOString()): JobPosting[] {
  const byId = new Map<string, JobPosting>();
  for (const raw of raws) {
    const job = toJobPosting(raw, collectedAt);
    if (!byId.has(job.id)) byId.set(job.id, job);
  }
  return [...byId.values()];
}

// DB에 이미 있는 공고를 제외하고 신규만 반환.
export async function selectNew(postings: JobPosting[]): Promise<JobPosting[]> {
  const existing = await findExistingJobIds(postings.map((p) => p.id));
  return postings.filter((p) => !existing.has(p.id));
}

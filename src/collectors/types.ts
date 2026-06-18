import type { Source } from '../config/schema';

// 수집기가 사이트에서 뽑아낸 1차 결과(정규화 전).
// id/collectedAt 등 멱등 키 부여와 JobPosting 변환은 normalizer(M2) 담당.
export interface RawJob {
  source: string;
  title: string;
  company: string;
  url: string;
  location?: string;
  employmentType?: string;
  description?: string;
  postedAt?: string;
}

export interface CollectorAdapter {
  // 단일 source에서 공고를 수집한다. 실패 시 throw(상위에서 failedSources로 분류).
  collect(source: Source): Promise<RawJob[]>;
}

// 수집 결과(소스별 성공/실패 분리용).
export interface CollectResult {
  source: string;
  jobs: RawJob[];
  ok: boolean;
  error?: string;
}

// 브라우저 위장 기본 헤더(일부 사이트는 기본 UA를 차단).
export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

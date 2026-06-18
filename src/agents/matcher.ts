import { z } from 'zod';
import { ENV } from '../config/constant';
import { getProvider, type LLMProvider } from '../config/llm_provider';
import type { JobPosting, Profile } from '../config/schema';
import { matcherPrompt } from '../prompts/matcher';
import { mapLimit } from '../util/pool';

const MatchResultSchema = z.object({
  score: z.number().min(0).max(1),
  reason: z.string().default(''),
});

// 모델 출력에서 첫 JSON 객체를 추출(래핑 텍스트·코드펜스 방어).
function extractJsonObject(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('출력에서 JSON 객체를 찾지 못함');
  return JSON.parse(m[0]);
}

async function scoreOne(
  provider: LLMProvider,
  profile: Profile,
  job: JobPosting,
): Promise<{ score: number; reason: string }> {
  const prompt = matcherPrompt(profile, job);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await provider.complete(prompt);
      return MatchResultSchema.parse(extractJsonObject(out));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface MatchOutcome {
  scored: JobPosting[]; // matchScore/matchReason가 채워진 공고(실패 시 미채움)
  errors: string[];
}

// 각 공고에 matchScore/matchReason를 부여한다.
// 1차로 기피 키워드 룰 필터(LLM 호출 절약), 나머지는 동시성 제한하에 LLM 채점.
export async function matchPostings(
  profile: Profile,
  postings: JobPosting[],
  provider: LLMProvider = getProvider(),
): Promise<MatchOutcome> {
  const errors: string[] = [];
  const exclude = profile.keywords.exclude.filter(Boolean).map((k) => k.toLowerCase());

  const scored = await mapLimit(postings, ENV.LLM_CONCURRENCY, async (job) => {
    const haystack = `${job.title} ${job.company}`.toLowerCase();
    if (exclude.some((k) => haystack.includes(k))) {
      return { ...job, matchScore: 0, matchReason: '기피 키워드 포함' };
    }
    try {
      const r = await scoreOne(provider, profile, job);
      return { ...job, matchScore: r.score, matchReason: r.reason };
    } catch (err) {
      errors.push(`${job.id}: ${(err as Error).message}`);
      return { ...job }; // 미채점(matchScore undefined) — threshold에서 자동 제외
    }
  });

  return { scored, errors };
}

// matchScore가 임계값 이상인 공고만 통과시킨다.
export function filterByThreshold(profile: Profile, postings: JobPosting[]): JobPosting[] {
  return postings.filter((p) => (p.matchScore ?? 0) >= profile.matchThreshold);
}

import { ENV } from '../config/constant';
import { getProvider, type LLMProvider } from '../config/llm_provider';
import type { JobPosting } from '../config/schema';
import { summarizerPrompt } from '../prompts/summarizer';
import { mapLimit } from '../util/pool';

export interface SummarizeOutcome {
  summarized: JobPosting[]; // summary가 채워진 공고(실패 시 미채움)
  errors: string[];
}

// 통과한 공고만 요약한다(비용 절감). 동시성 제한, 실패 시 해당 건만 skip.
export async function summarizePostings(
  postings: JobPosting[],
  provider: LLMProvider = getProvider(),
): Promise<SummarizeOutcome> {
  const errors: string[] = [];
  const summarized = await mapLimit(postings, ENV.LLM_CONCURRENCY, async (job) => {
    try {
      const out = await provider.complete(summarizerPrompt(job));
      const summary = out.trim();
      return summary ? { ...job, summary } : { ...job };
    } catch (err) {
      errors.push(`${job.id}: ${(err as Error).message}`);
      return { ...job };
    }
  });
  return { summarized, errors };
}

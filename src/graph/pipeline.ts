import { END, START, StateGraph } from '@langchain/langgraph';
import { collectAll } from '../collectors';
import { filterByThreshold, matchPostings } from '../agents/matcher';
import { normalize, selectNew } from '../agents/normalizer';
import { summarizePostings } from '../agents/summarizer';
import { upsertJobPosting } from '../db/repository';
import { PipelineState, type PipelineStateType } from './state';

// collector: enabled 소스 병렬 수집. 성공분은 raw, 실패분은 failedSources로 분리.
async function collectorNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const results = await collectAll(state.sources);
  const raw = results.filter((r) => r.ok).flatMap((r) => r.jobs);
  const failedIds = new Set(results.filter((r) => !r.ok).map((r) => r.source));
  const failedSources = state.sources.filter((s) => failedIds.has(s.id));
  const errors = results.filter((r) => !r.ok).map((r) => `collect ${r.source}: ${r.error}`);
  return { raw, failedSources, errors };
}

// playwright fallback (M1.5 예정). 현재는 미구현 — 실패 소스를 오류로만 기록하고 통과.
async function fallbackNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const ids = state.failedSources.map((s) => s.id).join(', ');
  return { errors: [`playwright fallback 미구현 — 실패 소스 건너뜀: ${ids}`] };
}

// normalizer: 표준화 + 멱등 키 + 중복 제거 후 DB 신규만. limit가 있으면 상한 적용(테스트/드라이런).
async function normalizerNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const normalizedAll = normalize(state.raw);
  let fresh = await selectNew(normalizedAll);
  if (state.limit != null) fresh = fresh.slice(0, state.limit);
  return { normalized: fresh };
}

// matcher: 직무 연관도 채점 후 임계값 통과분만 남긴다.
async function matcherNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const { scored, errors } = await matchPostings(state.profile, state.normalized);
  const matched = filterByThreshold(state.profile, scored);
  return { matched, errors };
}

// summarizer: 통과 공고만 요약.
async function summarizerNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const { summarized, errors } = await summarizePostings(state.matched);
  return { summarized, errors };
}

// persist: 가공된 공고를 DB에 upsert.
async function persistNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  for (const job of state.summarized) await upsertJobPosting(job);
  return { persistedCount: state.summarized.length };
}

// collector 후 분기: 실패 소스가 있으면 fallback, 없으면 바로 normalizer (PLAN §6.2).
function routeAfterCollect(state: PipelineStateType): 'fallback' | 'normalizer' {
  return state.failedSources.length > 0 ? 'fallback' : 'normalizer';
}

export function buildPipeline() {
  return new StateGraph(PipelineState)
    .addNode('collector', collectorNode)
    .addNode('fallback', fallbackNode)
    .addNode('normalizer', normalizerNode)
    .addNode('matcher', matcherNode)
    .addNode('summarizer', summarizerNode)
    .addNode('persist', persistNode)
    .addEdge(START, 'collector')
    .addConditionalEdges('collector', routeAfterCollect, {
      fallback: 'fallback',
      normalizer: 'normalizer',
    })
    .addEdge('fallback', 'normalizer')
    .addEdge('normalizer', 'matcher')
    .addEdge('matcher', 'summarizer')
    .addEdge('summarizer', 'persist')
    .addEdge('persist', END)
    .compile();
}

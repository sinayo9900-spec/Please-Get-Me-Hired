import { Annotation } from '@langchain/langgraph';
import type { JobPosting, Profile, Source } from '../config/schema';
import type { RawJob } from '../collectors/types';

const appendReducer = <T>(a: T[], b: T[]): T[] => a.concat(b);
const replaceReducer = <T>(_a: T, b: T): T => b;

// 파이프라인 노드들이 공유하는 상태(PLAN §6.1).
export const PipelineState = Annotation.Root({
  // 입력
  profile: Annotation<Profile>(),
  sources: Annotation<Source[]>(),
  limit: Annotation<number | undefined>({ reducer: replaceReducer, default: () => undefined }),

  // collector 산출
  raw: Annotation<RawJob[]>({ reducer: appendReducer, default: () => [] }),
  failedSources: Annotation<Source[]>({ reducer: appendReducer, default: () => [] }),

  // 이후 단계 산출(각 단계가 통째로 교체)
  normalized: Annotation<JobPosting[]>({ reducer: replaceReducer, default: () => [] }),
  matched: Annotation<JobPosting[]>({ reducer: replaceReducer, default: () => [] }),
  summarized: Annotation<JobPosting[]>({ reducer: replaceReducer, default: () => [] }),
  persistedCount: Annotation<number>({ reducer: replaceReducer, default: () => 0 }),
  emailResult: Annotation<{ sent: boolean; count: number; error?: string } | undefined>({
    reducer: replaceReducer,
    default: () => undefined,
  }),

  // 비치명적 오류 누적
  errors: Annotation<string[]>({ reducer: appendReducer, default: () => [] }),
});

export type PipelineStateType = typeof PipelineState.State;

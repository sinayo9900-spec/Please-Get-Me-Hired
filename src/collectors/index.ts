import type { Source } from '../config/schema';
import { apiAdapter } from './apiAdapter';
import { htmlAdapter } from './htmlAdapter';
import type { CollectResult, CollectorAdapter } from './types';

export * from './types';

function adapterFor(source: Source): CollectorAdapter {
  return source.type === 'api' ? apiAdapter : htmlAdapter;
}

// 단일 소스 수집(예외를 CollectResult로 감싼다).
export async function collect(source: Source): Promise<CollectResult> {
  try {
    const jobs = await adapterFor(source).collect(source);
    return { source: source.id, jobs, ok: true };
  } catch (err) {
    return { source: source.id, jobs: [], ok: false, error: (err as Error).message };
  }
}

// 여러 소스를 병렬 수집. 일부 실패해도 전체는 중단하지 않는다(PLAN §6.2).
export async function collectAll(sources: Source[]): Promise<CollectResult[]> {
  return Promise.all(sources.map(collect));
}

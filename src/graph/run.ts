import { getProfile, listSources } from '../db/repository';
import { buildPipeline } from './pipeline';
import type { PipelineStateType } from './state';

// 파이프라인 1회 실행. cron·CLI·대시보드가 공유하는 진입 함수.
export async function runPipeline(opts: { limit?: number } = {}): Promise<PipelineStateType | null> {
  const profile = await getProfile();
  if (!profile) {
    console.log('profile이 없습니다. `npm run seed`를 먼저 실행하세요.');
    return null;
  }
  const sources = await listSources(true);
  if (sources.length === 0) {
    console.log('enabled 소스가 없습니다. `npm run seed:sources`를 먼저 실행하세요.');
    return null;
  }

  console.log(
    `[${new Date().toISOString()}] 파이프라인 시작 — 소스 ${sources.length}개` +
      (opts.limit != null ? `, limit ${opts.limit}` : ''),
  );

  const pipeline = buildPipeline();
  const final = await pipeline.invoke({ profile, sources, limit: opts.limit });

  console.log('=== 결과 ===');
  console.log(`수집(raw): ${final.raw.length}`);
  console.log(`정규화·신규: ${final.normalized.length}`);
  console.log(`임계값 통과(matched): ${final.matched.length}`);
  console.log(`요약·저장: ${final.persistedCount}`);
  if (final.emailResult) {
    const e = final.emailResult;
    console.log(`메일: ${e.sent ? `발송 ${e.count}건` : e.error ? `실패(${e.error})` : '발송 안 함(0건)'}`);
  }
  if (final.failedSources.length) {
    console.log(`실패 소스: ${final.failedSources.map((s) => s.id).join(', ')}`);
  }
  if (final.errors.length) {
    console.log(`오류 ${final.errors.length}건:`);
    final.errors.forEach((e) => console.log(`  - ${e}`));
  }
  return final;
}

function parseLimit(argv: string[]): number | undefined {
  const i = argv.indexOf('--limit');
  if (i === -1) return undefined;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) ? n : undefined;
}

// CLI 직접 실행 시에만 동작(스케줄러에서 import할 땐 실행 안 됨).
if (require.main === module) {
  runPipeline({ limit: parseLimit(process.argv.slice(2)) })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('파이프라인 실패:', err);
      process.exit(1);
    });
}

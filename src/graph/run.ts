import { getProfile, listSources } from '../db/repository';
import { buildPipeline } from './pipeline';

// 파이프라인 단일 엔트리(cron·수동·대시보드가 공유). `npm run pipeline -- --limit 3`.
function parseLimit(argv: string[]): number | undefined {
  const i = argv.indexOf('--limit');
  if (i === -1) return undefined;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) ? n : undefined;
}

async function main(): Promise<void> {
  const profile = await getProfile();
  if (!profile) {
    console.log('profile이 없습니다. `npm run seed`를 먼저 실행하세요.');
    return;
  }
  const sources = await listSources(true);
  if (sources.length === 0) {
    console.log('enabled 소스가 없습니다. `npm run seed:sources`를 먼저 실행하세요.');
    return;
  }

  const limit = parseLimit(process.argv.slice(2));
  console.log(`파이프라인 시작 — 소스 ${sources.length}개${limit != null ? `, limit ${limit}` : ''}`);

  const pipeline = buildPipeline();
  const final = await pipeline.invoke({ profile, sources, limit });

  console.log('\n=== 결과 ===');
  console.log(`수집(raw): ${final.raw.length}`);
  console.log(`정규화·신규: ${final.normalized.length}`);
  console.log(`임계값 통과(matched): ${final.matched.length}`);
  console.log(`요약·저장: ${final.persistedCount}`);
  if (final.failedSources.length) {
    console.log(`실패 소스: ${final.failedSources.map((s) => s.id).join(', ')}`);
  }
  if (final.errors.length) {
    console.log(`오류 ${final.errors.length}건:`);
    final.errors.forEach((e) => console.log(`  - ${e}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('파이프라인 실패:', err);
    process.exit(1);
  });

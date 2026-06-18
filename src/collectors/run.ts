import { listSources } from '../db/repository';
import { collectAll } from './index';

// DB의 enabled 소스를 읽어 수집하고 결과 요약을 출력한다(M1 동작 확인용).
async function main(): Promise<void> {
  const sources = await listSources(true);
  if (sources.length === 0) {
    console.log('enabled 소스가 없습니다. `npm run seed:sources`를 먼저 실행하세요.');
    return;
  }
  console.log(`수집 대상 ${sources.length}개: ${sources.map((s) => s.id).join(', ')}\n`);

  const results = await collectAll(sources);
  for (const r of results) {
    if (!r.ok) {
      console.log(`✗ ${r.source}: 실패 — ${r.error}`);
      continue;
    }
    console.log(`✓ ${r.source}: ${r.jobs.length}건`);
    r.jobs.slice(0, 2).forEach((j) => {
      console.log(`   · [${j.company || '?'}] ${j.title}`);
      console.log(`     ${j.url}${j.location ? ` | ${j.location}` : ''}`);
    });
  }

  const total = results.reduce((n, r) => n + r.jobs.length, 0);
  const failed = results.filter((r) => !r.ok).map((r) => r.source);
  console.log(`\n총 ${total}건 수집. 실패 소스: ${failed.length ? failed.join(', ') : '없음'}`);
}

main().catch((err) => {
  console.error('수집 실행 실패:', err);
  process.exitCode = 1;
});

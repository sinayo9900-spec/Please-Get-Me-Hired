import cron from 'node-cron';
import { ENV } from '../config/constant';
import { runPipeline } from '../graph/run';

// 상주 스케줄러: ENV.SCHEDULE_CRON(기본 매일 08:00 KST)마다 파이프라인을 실행한다.
// CLI 구독 LLM을 쓰므로 해당 CLI가 로그인된 로컬/상주 머신에서 띄워야 한다(PLAN §8).
// 일회성 OS 스케줄링이 필요하면 Windows 작업 스케줄러로 `npm run pipeline`을 거는 방법도 있다.

let running = false; // 동시 실행 방지(이전 실행이 안 끝났으면 건너뜀)

async function tick(): Promise<void> {
  if (running) {
    console.log(`[${new Date().toISOString()}] 이전 실행이 진행 중 — 이번 주기 건너뜀`);
    return;
  }
  running = true;
  try {
    await runPipeline();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] 파이프라인 오류:`, err);
  } finally {
    running = false;
  }
}

function main(): void {
  if (!cron.validate(ENV.SCHEDULE_CRON)) {
    console.error(`잘못된 SCHEDULE_CRON: "${ENV.SCHEDULE_CRON}"`);
    process.exit(1);
  }

  cron.schedule(ENV.SCHEDULE_CRON, tick, { timezone: ENV.SCHEDULE_TZ });
  console.log(`스케줄러 시작 — "${ENV.SCHEDULE_CRON}" (${ENV.SCHEDULE_TZ}). 종료: Ctrl+C`);

  // --run-now: 시작 즉시 1회 실행(수동 트리거/점검용)
  if (process.argv.includes('--run-now')) {
    console.log('--run-now: 즉시 1회 실행');
    void tick();
  }
}

main();

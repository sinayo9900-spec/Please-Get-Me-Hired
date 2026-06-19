// 개발 서버 종료 — 백엔드(3000)·프론트(5173) 포트를 점유한 프로세스를 강제 종료한다.
// 어떻게 띄웠든(npm/preview) 포트 기준이라 동작한다. 크로스 플랫폼(win/posix).
import { execSync } from 'node:child_process';

const ports = [3000, 5173];
const isWin = process.platform === 'win32';

function killPort(port) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        const m = line.trim().match(/LISTENING\s+(\d+)/);
        if (m) pids.add(m[1]);
      }
      if (pids.size === 0) return console.log(`포트 ${port}: 실행 중 아님`);
      for (const pid of pids) {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(`포트 ${port}: pid ${pid} 종료`);
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
      const pids = out.split('\n').filter(Boolean);
      if (pids.length === 0) return console.log(`포트 ${port}: 실행 중 아님`);
      for (const pid of pids) {
        execSync(`kill -9 ${pid}`);
        console.log(`포트 ${port}: pid ${pid} 종료`);
      }
    }
  } catch {
    // findstr/lsof가 매치 없으면 비정상 종료코드 → 실행 중 아님으로 간주
    console.log(`포트 ${port}: 실행 중 아님`);
  }
}

for (const port of ports) killPort(port);
console.log('개발 서버 종료 완료.');

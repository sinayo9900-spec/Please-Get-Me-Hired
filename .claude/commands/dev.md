---
description: 백엔드 API + 프론트 대시보드 개발 서버 실행
allowed-tools: Bash, mcp__Claude_Preview__preview_start, mcp__Claude_Preview__preview_screenshot
---

이 프로젝트(Please-Get-Me-Hired)의 개발 서버를 실행한다. 순서대로 수행할 것:

1. **사전 점검**
   - `web/node_modules`가 없으면 `cd web && npm install` 먼저 실행.
   - 루트에 `.env`가 없으면 "`.env.example`을 복사해 SMTP 값을 채우라"고 안내(없어도 서버는 뜨지만 실제 메일은 안 감).

2. **백엔드 API** — 백그라운드로 실행하고 기동 확인
   - `npm run serve` (포트 3000)를 백그라운드(run_in_background)로 실행.
   - 2~4초 후 `curl -s http://localhost:3000/api/health`로 `{"ok":true}` 확인.

3. **프론트 대시보드** — preview로 실행
   - `mcp__Claude_Preview__preview_start`를 name `web`으로 호출(포트 5173, `/api`는 3000으로 프록시).
   - 필요하면 `preview_screenshot`으로 렌더 확인.

4. **보고**
   - API: http://localhost:3000  (헬스: /api/health)
   - 대시보드: http://localhost:5173
   - 종료 방법 안내: 백엔드는 해당 백그라운드 작업 종료, 프론트는 preview_stop.

주의:
- Bash 도구는 Git Bash(POSIX). 포트 충돌 시 기존 node 프로세스를 정리한 뒤 재시도.
- 실제 파이프라인 실행/메일 발송은 대시보드의 "지금 실행" 또는 `npm run pipeline`.

---
description: 백엔드 API + 프론트 대시보드 개발 서버 종료
allowed-tools: Bash, mcp__Claude_Preview__preview_stop
---

이 프로젝트의 개발 서버를 종료한다.

1. `npm run stop:dev` 실행 — 포트 3000(백엔드)·5173(프론트)을 점유한 프로세스를 강제 종료한다(어떻게 띄웠든 포트 기준이라 동작).
2. preview로 띄운 프론트가 추적되고 있으면 `preview_stop`도 호출(이미 종료됐으면 무시).
3. 종료 결과를 보고한다.

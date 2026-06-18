# Please-Get-Me-Hired — 설계 계획서 (PLAN)

## 1. 목표

사용자가 설정한 **채용 페이지(채용 사이트)** 에서, 설정한 **직무 키워드**와 연관된 채용 공고를 매일 자동으로 수집하고, 필터링·요약하여 **이메일로 일괄 전송**한다.
또한 **웹 대시보드**를 통해 매일 수집된 공고와 **지원 현황(Application Tracking)** 을 관리한다.

핵심 구성 요소:

1. **LangGraph 멀티 에이전트 파이프라인** (TypeScript) — 수집 → 정규화 → 필터/매칭 → 요약 → 메일 발송
2. **데이터 저장소** — 공고/지원 현황 영속화
3. **스케줄러** — 매일 정해진 시각에 파이프라인 실행
4. **웹 대시보드** — 수집 공고 열람 + 지원 현황 CRUD

---

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|------|------|------|
| 언어 | TypeScript (ES2022, strict) | 기존 `tsconfig.json` 계승 |
| 에이전트 오케스트레이션 | `@langchain/langgraph` + `@langchain/core` | 상태 기반 그래프 |
| LLM | Anthropic Claude (`@langchain/anthropic`, 기본 `claude-opus-4-8` / 비용 절약 시 `claude-haiku-4-5`) | 매칭·요약 담당 |
| HTTP 수집 | 기존 `fetch` 래퍼(`script/apiClient.ts`) 재사용 + `cheerio`(HTML 파싱) | API/스크래핑 양쪽 지원 |
| 동적 페이지 | `playwright` | collector 실패 시 fallback으로 사용 |
| 저장소 | SQLite + `better-sqlite3` (또는 `prisma`) | 단일 사용자 → 경량 DB로 충분 |
| 메일 발송 | `nodemailer` (SMTP) 또는 Gmail API | 1차로 SMTP |
| 스케줄러 | `node-cron` (로컬) / OS 스케줄러 / GitHub Actions | 매일 실행 |
| 웹 백엔드 | `express` (또는 `fastify`) REST API | DB 노출 |
| 웹 프런트 | `Next.js` 또는 `Vite + React` | 대시보드 UI |
| 설정 | `.env` + `config/*.json` (Zod 스키마 검증) | 사이트/직무/메일 설정 |

> 단일 사용자용이므로 인프라는 최대한 경량으로 유지하고, 필요 시 PostgreSQL로 마이그레이션.

---

## 3. 디렉터리 구조 (제안)

```
Please-Get-Me-Hired/
├─ docs/
│  └─ PLAN.md
├─ config/
│  └─ schema.ts           # Zod 스키마 (profile/source는 DB로 관리, 시크릿은 .env)
├─ src/
│  ├─ agents/             # LangGraph 노드(에이전트)
│  │  ├─ collector.ts     # 공고 수집
│  │  ├─ normalizer.ts    # 정규화/중복 제거
│  │  ├─ matcher.ts       # 직무 연관성 판단 (LLM)
│  │  ├─ summarizer.ts    # 공고 요약 (LLM)
│  │  └─ mailer.ts        # 메일 일괄 발송
│  ├─ graph/
│  │  ├─ state.ts         # 그래프 공유 State 정의
│  │  └─ pipeline.ts      # StateGraph 조립/엣지
│  ├─ collectors/         # 사이트별 수집 어댑터(전략 패턴)
│  │  ├─ types.ts         # JobPosting, CollectorAdapter 인터페이스
│  │  ├─ apiAdapter.ts    # JSON API 기반 사이트
│  │  ├─ htmlAdapter.ts   # HTML 스크래핑 기반 사이트
│  │  └─ playwrightAdapter.ts # 실패 시 fallback (JS 렌더링)
│  ├─ db/
│  │  ├─ schema.sql       # 테이블 정의
│  │  └─ repository.ts    # CRUD 함수
│  ├─ mail/
│  │  └─ transport.ts     # nodemailer 설정 + 템플릿
│  ├─ scheduler/
│  │  └─ cron.ts          # 매일 실행 트리거
│  └─ server/             # 대시보드 백엔드 API
│     └─ index.ts
├─ web/                   # 대시보드 프런트 (Next.js/Vite)
├─ script/
│  └─ apiClient.ts        # 기존 자산(수집 어댑터에서 재사용)
└─ .env.example
```

---

## 4. 데이터 모델

### 4.1 JobPosting (수집 공고)
```ts
interface JobPosting {
  id: string;            // sourceId + 원본ID 해시 (멱등 키)
  source: string;        // 채용 페이지 식별자
  title: string;
  company: string;
  url: string;
  location?: string;
  employmentType?: string;
  description: string;    // 원문(또는 요약 전 본문)
  postedAt?: string;      // ISO
  collectedAt: string;    // ISO
  // 에이전트 가공 결과
  matchScore?: number;    // 0~1 직무 연관도
  matchReason?: string;
  summary?: string;       // LLM 요약
  tags?: string[];
}
```

### 4.2 Application (지원 현황)
```ts
type ApplicationStatus =
  | 'bookmarked'   // 관심
  | 'applied'      // 지원함
  | 'assignment'   // 과제
  | 'interview'    // 면접
  | 'offer'        // 합격/오퍼
  | 'rejected'     // 불합격
  | 'closed';      // 종료

interface Application {
  id: string;
  jobId: string;          // JobPosting.id FK
  status: ApplicationStatus;
  appliedAt?: string;
  nextActionAt?: string;  // 다음 일정 (면접 등)
  notes?: string;
  updatedAt: string;
}
```

### 4.3 Source (수집 대상 채용 페이지) — DB로 관리
```ts
interface Source {
  id: string;            // 식별자 (예: "wanted")
  name: string;          // 표시명
  type: 'api' | 'html';  // 1차 수집 방식
  request: {             // 요청 정의 (URL에 {query} 치환)
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  };
  select: {              // 응답에서 필드 추출 (api: JSON 경로 / html: cheerio 셀렉터)
    list: string;
    fields: Record<string, string>;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```
> `request`/`select`는 구조가 가변적이므로 DB에는 JSON 컬럼(TEXT)으로 저장하고, 로드 시 Zod로 파싱·검증한다.

### 4.4 Profile (사용자 직무/필터 설정) — DB로 관리
```ts
interface Profile {
  id: string;              // 단일 사용자 → 고정 키(예: "default")
  roles: string[];         // 직무/키워드
  keywords: { include: string[]; exclude: string[] };
  locations: string[];
  matchThreshold: number;  // 이 점수 이상만 메일 발송
  email: { to: string; maxItems: number };
  updatedAt: string;
}
```
> 단일 행(single-row) 테이블 또는 key-value `settings` 테이블로 저장. 배열/객체 필드는 JSON 컬럼(TEXT)에 담고 로드 시 Zod로 검증한다.

### 4.5 테이블
- `profile`(사용자 설정), `sources`(수집 대상), `job_postings`, `applications`, `email_runs`(발송 로그: 날짜·공고 수·성공 여부)
- 대시보드/시드 스크립트로 `profile`·`sources`를 CRUD하며, 파이프라인은 `profile`을 읽고 `enabled = true`인 소스만 처리한다.

---

## 5. 설정 관리

수집 대상(`Source`, §4.3)과 사용자 직무/필터(`Profile`, §4.4)는 모두 **DB로 관리**한다. 대시보드나 시드 스크립트로 CRUD하며, 별도 설정 파일을 두지 않는다.

- **DB에서 로드**: `profile`, `sources` → 로드 시 `config/schema.ts`의 Zod 스키마로 검증.
- **`.env`**: 시크릿(SMTP 비밀번호, ANTHROPIC_API_KEY 등 §11)만.
- **시드**: 최초 1회 기본 `profile`/`sources`를 넣는 `seed` 스크립트 제공.

---

## 6. LangGraph 파이프라인 설계

### 6.1 공유 State
```ts
interface PipelineState {
  profile: Profile;       // DB에서 로드
  sources: Source[];      // DB에서 로드 (enabled=true)
  raw: RawJob[];          // collector 산출
  failedSources: Source[];// 1차 수집 실패 → playwright fallback 대상
  normalized: JobPosting[]; // normalizer 산출 (중복 제거 후)
  matched: JobPosting[];    // matchScore >= threshold
  summarized: JobPosting[]; // summary 포함
  emailResult?: { sent: boolean; count: number; error?: string };
  errors: string[];       // 노드별 비치명적 오류 누적
}
```

### 6.2 그래프 흐름
```
        ┌─────────────┐
START ─▶│  collector  │  DB의 source(enabled)별 api/html 어댑터로 수집 (병렬)
        └──────┬──────┘
               │  실패한 source는 state.failedSources에 누적
               ▼
        (failedSources 있음?) ──예──▶ ┌─────────────────────┐
               │아니오                │ playwrightFallback  │ 헤드리스 브라우저로
               │              ◀───────│ (실패분만 재수집)    │ 링크/공고 재수집
               ▼                      └─────────────────────┘
        ┌─────────────┐
        │ normalizer  │  필드 표준화 + 멱등 키 + DB 기존분 대비 신규만 필터
        └──────┬──────┘
               ▼
        ┌─────────────┐
        │   matcher   │  LLM으로 직무 연관도 채점 (matchScore/reason)
        └──────┬──────┘
               ▼ (threshold 미달 → drop)
        ┌─────────────┐
        │ summarizer  │  통과 공고만 LLM 요약 (비용 절감)
        └──────┬──────┘
               ▼
        ┌─────────────┐
        │   persist   │  job_postings/applications upsert
        └──────┬──────┘
               ▼
        ┌─────────────┐
        │   mailer    │  신규 공고 0건이면 skip, 아니면 일괄 메일
        └──────┬──────┘
               ▼
              END
```

- **에이전트 = 노드**: 각 노드는 순수 함수에 가깝게 `(state) => Partial<state>` 반환.
- **병렬 수집**: collector 내부에서 source별 `Promise.allSettled` → 일부 사이트 실패해도 전체 중단 없음. 성공분은 `raw`에, 실패분(예외·빈 결과·셀렉터 미스)은 `failedSources`에 기록.
- **Playwright fallback (조건부 엣지)**: collector 후 `failedSources.length > 0`이면 `playwrightFallback` 노드로, 아니면 바로 `normalizer`로 라우팅(`addConditionalEdges`). fallback은 정적 수집이 막힌(JS 렌더링·동적 로딩) 사이트만 헤드리스 브라우저로 재수집해 `raw`에 합치고, 그래도 실패하면 `errors`에 남기고 진행.
- **비용 최적화**: matcher에서 1차 키워드 룰 필터 후 LLM 호출, summarizer는 통과분만.
- **멱등성**: 이미 DB에 있는 공고는 재발송하지 않음(`email_runs`/`collectedAt` 기준).

---

## 7. 메일 발송

- `nodemailer` SMTP (Gmail의 경우 앱 비밀번호 사용, `.env`).
- HTML 템플릿: 날짜 헤더 + 공고 카드 목록(회사·제목·요약·매칭사유·지원 링크) + 대시보드 바로가기.
- `email.maxItems` 초과 시 상위 점수순 N개만, 나머지는 "대시보드에서 더 보기".
- 발송 결과를 `email_runs`에 로깅.

---

## 8. 스케줄링

- **로컬 우선**: `node-cron`으로 매일 08:00 KST 파이프라인 실행 (`src/scheduler/cron.ts`).
- **대안**: GitHub Actions `schedule` (cron) — 서버 상시 구동 불필요. DB는 리포지토리/외부 스토리지 또는 Actions 아티팩트 한계 고려 시 호스팅 DB 권장.
- 실행은 `npm run pipeline` 단일 엔트리로 트리거 가능하게(스케줄러와 분리).

---

## 9. 웹 대시보드

### 9.1 백엔드 API (express)
- `GET /api/jobs?date=&minScore=` — 수집 공고 목록/필터
- `GET /api/jobs/:id`
- `GET /api/applications` / `POST` / `PATCH /:id` — 지원 현황 CRUD
- `GET /api/profile` / `PUT /api/profile` — 직무/키워드/필터·메일 설정 조회·수정
- `GET /api/sources` / `POST` / `PATCH /:id` / `DELETE /:id` — 수집 대상 채용 페이지 관리(활성/비활성 토글 포함)
- `POST /api/run` — 파이프라인 수동 실행(개발/테스트용)
- `GET /api/runs` — 발송 이력

### 9.2 프런트 화면
1. **오늘의 공고** — 날짜별 수집 공고, 매칭 점수/요약, "지원으로 추가" 버튼
2. **지원 현황 보드** — 칸반(관심→지원→과제→면접→오퍼/불합격), 드래그로 상태 변경, 다음 일정 표시
3. **통계** — 일자별 수집 수, 지원 전환율, 소스별 분포
4. **설정** — profile(직무/필터)·sources(수집 대상) 편집 UI (선택, 2차)

---

## 10. 개발 단계 (마일스톤)

| 단계 | 내용 | 산출물 |
|------|------|--------|
| **M0** | 의존성 설치, Zod 스키마, DB 스키마(`profile`+`sources` 포함) + 시드 | `config/`, `src/db/` |
| **M1** | Collector 어댑터(api/html) + DB 소스 1개 연동 | `src/collectors/` |
| **M1.5** | Playwright fallback 어댑터 + 조건부 엣지 | `src/collectors/playwrightAdapter.ts` |
| **M2** | LangGraph 파이프라인(normalizer→matcher→summarizer) | `src/graph/`, `src/agents/` |
| **M3** | 메일 발송 + 멱등성/로그 | `src/mail/`, `email_runs` |
| **M4** | 스케줄러 + `npm run pipeline` | `src/scheduler/` |
| **M5** | 대시보드 백엔드 API | `src/server/` |
| **M6** | 대시보드 프런트(공고/지원 보드) | `web/` |
| **M7** | 멀티 소스 확장, 통계, 설정 UI | — |

---

## 11. 환경 변수 (`.env.example`)

```
ANTHROPIC_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=shinjw0131@gmail.com
SMTP_PASS=            # Gmail 앱 비밀번호
MAIL_FROM="Please-Get-Me-Hired <shinjw0131@gmail.com>"
DATABASE_URL=./data/app.db
DASHBOARD_PORT=3000
```

---

## 12. 추가 고려사항 / 리스크

- **스크래핑 합법성·robots.txt**: 사이트별 약관 확인, 공식 API 우선. 요청 간 rate limit/지연 적용.
- **HTML 구조 변경 취약성**: 어댑터를 설정(JSON 셀렉터) 기반으로 분리해 코드 수정 최소화.
- **LLM 비용**: 룰 기반 1차 필터로 호출량 절감, Haiku 등 저비용 모델 옵션.
- **중복/노이즈**: 멱등 키 + 회사명·제목 유사도로 중복 제거.
- **시크릿 관리**: `.env`는 `.gitignore`에 포함(이미 `.gitignore` 존재 — 확인 필요).
- **에러 내성**: 한 소스 실패가 전체 파이프라인/메일을 막지 않도록 부분 실패 허용.

---

## 13. 의존성 설치 명령 (참고)

```bash
npm i @langchain/langgraph @langchain/core @langchain/anthropic \
      better-sqlite3 cheerio nodemailer node-cron express zod
npm i -D @types/better-sqlite3 @types/nodemailer @types/express
# 프런트는 web/ 디렉터리에서 별도(Next.js/Vite) 초기화
```

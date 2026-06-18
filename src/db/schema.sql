-- 단일 사용자용 경량 스키마. 가변 구조(request/select, keywords 등)는 JSON(TEXT) 컬럼에 저장하고
-- 애플리케이션에서 Zod로 검증한다. 불리언은 0/1 정수로 저장한다.

-- 사용자 직무/필터 설정 (단일 행: id='default')
CREATE TABLE IF NOT EXISTS profile (
  id              TEXT PRIMARY KEY,
  roles           TEXT NOT NULL,          -- JSON string[]
  keywords        TEXT NOT NULL,          -- JSON { include: string[], exclude: string[] }
  locations       TEXT NOT NULL,          -- JSON string[]
  match_threshold REAL NOT NULL DEFAULT 0.6,
  email           TEXT NOT NULL,          -- JSON { to: string, maxItems: number }
  updated_at      TEXT NOT NULL
);

-- 수집 대상 채용 페이지
CREATE TABLE IF NOT EXISTS sources (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('api', 'html')),
  request    TEXT NOT NULL,               -- JSON SourceRequest
  "select"   TEXT NOT NULL,               -- JSON SourceSelect
  enabled    INTEGER NOT NULL DEFAULT 1,  -- 0/1
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 수집 공고
CREATE TABLE IF NOT EXISTS job_postings (
  id              TEXT PRIMARY KEY,       -- 멱등 키
  source          TEXT NOT NULL,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  url             TEXT NOT NULL,
  location        TEXT,
  employment_type TEXT,
  description     TEXT NOT NULL,
  posted_at       TEXT,
  collected_at    TEXT NOT NULL,
  match_score     REAL,
  match_reason    TEXT,
  summary         TEXT,
  tags            TEXT                    -- JSON string[]
);

CREATE INDEX IF NOT EXISTS idx_job_postings_collected_at ON job_postings (collected_at);
CREATE INDEX IF NOT EXISTS idx_job_postings_source ON job_postings (source);

-- 지원 현황
CREATE TABLE IF NOT EXISTS applications (
  id             TEXT PRIMARY KEY,
  job_id         TEXT NOT NULL REFERENCES job_postings (id),
  status         TEXT NOT NULL,
  applied_at     TEXT,
  next_action_at TEXT,
  notes          TEXT,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications (job_id);

-- 발송 로그
CREATE TABLE IF NOT EXISTS email_runs (
  id         TEXT PRIMARY KEY,
  run_date   TEXT NOT NULL,
  job_count  INTEGER NOT NULL,
  success    INTEGER NOT NULL,            -- 0/1
  error      TEXT,
  created_at TEXT NOT NULL
);

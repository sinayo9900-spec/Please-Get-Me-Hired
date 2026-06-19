import type { InValue, Row } from '@libsql/client';
import { db } from './client';
import {
  ApplicationSchema,
  EmailRunSchema,
  JobPostingSchema,
  ProfileSchema,
  SourceSchema,
  type Application,
  type ApplicationStatus,
  type EmailRun,
  type JobPosting,
  type Profile,
  type Source,
} from '../config/schema';

// ── 헬퍼 ───────────────────────────────────────────────────────

const str = (v: InValue | undefined): string => String(v);
const optStr = (v: InValue): string | undefined => (v == null ? undefined : String(v));
const bool = (v: InValue): boolean => Number(v) === 1;
const num = (v: InValue): number => Number(v);
const optNum = (v: InValue): number | undefined => (v == null ? undefined : Number(v));
const json = <T>(v: InValue): T => JSON.parse(String(v)) as T;
const optJson = <T>(v: InValue): T | undefined => (v == null ? undefined : (JSON.parse(String(v)) as T));

// ── Profile ────────────────────────────────────────────────────

function rowToProfile(r: Row): Profile {
  return ProfileSchema.parse({
    id: str(r.id),
    roles: json<string[]>(r.roles),
    keywords: json(r.keywords),
    locations: json<string[]>(r.locations),
    matchThreshold: num(r.match_threshold),
    email: json(r.email),
    updatedAt: str(r.updated_at),
  });
}

export async function getProfile(id = 'default'): Promise<Profile | null> {
  const res = await db.execute({ sql: 'SELECT * FROM profile WHERE id = ?', args: [id] });
  return res.rows[0] ? rowToProfile(res.rows[0]) : null;
}

export async function upsertProfile(profile: Profile): Promise<void> {
  const p = ProfileSchema.parse(profile);
  await db.execute({
    sql: `INSERT INTO profile (id, roles, keywords, locations, match_threshold, email, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            roles = excluded.roles,
            keywords = excluded.keywords,
            locations = excluded.locations,
            match_threshold = excluded.match_threshold,
            email = excluded.email,
            updated_at = excluded.updated_at`,
    args: [
      p.id,
      JSON.stringify(p.roles),
      JSON.stringify(p.keywords),
      JSON.stringify(p.locations),
      p.matchThreshold,
      JSON.stringify(p.email),
      p.updatedAt,
    ],
  });
}

// ── Sources ────────────────────────────────────────────────────

function rowToSource(r: Row): Source {
  return SourceSchema.parse({
    id: str(r.id),
    name: str(r.name),
    type: str(r.type),
    request: json(r.request),
    select: json(r.select),
    enabled: bool(r.enabled),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  });
}

export async function listSources(enabledOnly = false): Promise<Source[]> {
  const sql = enabledOnly
    ? 'SELECT * FROM sources WHERE enabled = 1 ORDER BY id'
    : 'SELECT * FROM sources ORDER BY id';
  const res = await db.execute(sql);
  return res.rows.map(rowToSource);
}

export async function getSource(id: string): Promise<Source | null> {
  const res = await db.execute({ sql: 'SELECT * FROM sources WHERE id = ?', args: [id] });
  return res.rows[0] ? rowToSource(res.rows[0]) : null;
}

export async function upsertSource(source: Source): Promise<void> {
  const s = SourceSchema.parse(source);
  await db.execute({
    sql: `INSERT INTO sources (id, name, type, request, "select", enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            request = excluded.request,
            "select" = excluded."select",
            enabled = excluded.enabled,
            updated_at = excluded.updated_at`,
    args: [
      s.id,
      s.name,
      s.type,
      JSON.stringify(s.request),
      JSON.stringify(s.select),
      s.enabled ? 1 : 0,
      s.createdAt,
      s.updatedAt,
    ],
  });
}

export async function deleteSource(id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM sources WHERE id = ?', args: [id] });
}

// ── JobPostings ────────────────────────────────────────────────

function rowToJobPosting(r: Row): JobPosting {
  return JobPostingSchema.parse({
    id: str(r.id),
    source: str(r.source),
    title: str(r.title),
    company: str(r.company),
    url: str(r.url),
    location: optStr(r.location),
    employmentType: optStr(r.employment_type),
    description: str(r.description),
    postedAt: optStr(r.posted_at),
    collectedAt: str(r.collected_at),
    matchScore: optNum(r.match_score),
    matchReason: optStr(r.match_reason),
    summary: optStr(r.summary),
    tags: optJson<string[]>(r.tags),
  });
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
  const res = await db.execute({ sql: 'SELECT * FROM job_postings WHERE id = ?', args: [id] });
  return res.rows[0] ? rowToJobPosting(res.rows[0]) : null;
}

export interface JobPostingFilter {
  collectedOn?: string; // YYYY-MM-DD (collected_at prefix)
  minScore?: number;
  source?: string;
}

export async function listJobPostings(filter: JobPostingFilter = {}): Promise<JobPosting[]> {
  const where: string[] = [];
  const args: InValue[] = [];
  if (filter.collectedOn) {
    where.push('collected_at LIKE ?');
    args.push(`${filter.collectedOn}%`);
  }
  if (filter.minScore != null) {
    where.push('match_score >= ?');
    args.push(filter.minScore);
  }
  if (filter.source) {
    where.push('source = ?');
    args.push(filter.source);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = await db.execute({
    sql: `SELECT * FROM job_postings ${clause} ORDER BY collected_at DESC, match_score DESC`,
    args,
  });
  return res.rows.map(rowToJobPosting);
}

// 멱등성: 주어진 id 중 이미 DB에 존재하는 것만 반환한다(신규 판별용).
export async function findExistingJobIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const placeholders = ids.map(() => '?').join(', ');
  const res = await db.execute({
    sql: `SELECT id FROM job_postings WHERE id IN (${placeholders})`,
    args: ids,
  });
  return new Set(res.rows.map((r) => str(r.id)));
}

export async function upsertJobPosting(job: JobPosting): Promise<void> {
  const j = JobPostingSchema.parse(job);
  await db.execute({
    sql: `INSERT INTO job_postings
            (id, source, title, company, url, location, employment_type, description,
             posted_at, collected_at, match_score, match_reason, summary, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            company = excluded.company,
            url = excluded.url,
            location = excluded.location,
            employment_type = excluded.employment_type,
            description = excluded.description,
            posted_at = excluded.posted_at,
            match_score = excluded.match_score,
            match_reason = excluded.match_reason,
            summary = excluded.summary,
            tags = excluded.tags`,
    args: [
      j.id,
      j.source,
      j.title,
      j.company,
      j.url,
      j.location ?? null,
      j.employmentType ?? null,
      j.description,
      j.postedAt ?? null,
      j.collectedAt,
      j.matchScore ?? null,
      j.matchReason ?? null,
      j.summary ?? null,
      j.tags ? JSON.stringify(j.tags) : null,
    ],
  });
}

// ── Applications ───────────────────────────────────────────────

function rowToApplication(r: Row): Application {
  return ApplicationSchema.parse({
    id: str(r.id),
    jobId: str(r.job_id),
    status: str(r.status),
    appliedAt: optStr(r.applied_at),
    nextActionAt: optStr(r.next_action_at),
    notes: optStr(r.notes),
    updatedAt: str(r.updated_at),
  });
}

export async function listApplications(status?: ApplicationStatus): Promise<Application[]> {
  const sql = status
    ? 'SELECT * FROM applications WHERE status = ? ORDER BY updated_at DESC'
    : 'SELECT * FROM applications ORDER BY updated_at DESC';
  const res = await db.execute({ sql, args: status ? [status] : [] });
  return res.rows.map(rowToApplication);
}

export async function getApplication(id: string): Promise<Application | null> {
  const res = await db.execute({ sql: 'SELECT * FROM applications WHERE id = ?', args: [id] });
  return res.rows[0] ? rowToApplication(res.rows[0]) : null;
}

export async function upsertApplication(app: Application): Promise<void> {
  const a = ApplicationSchema.parse(app);
  await db.execute({
    sql: `INSERT INTO applications (id, job_id, status, applied_at, next_action_at, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            applied_at = excluded.applied_at,
            next_action_at = excluded.next_action_at,
            notes = excluded.notes,
            updated_at = excluded.updated_at`,
    args: [
      a.id,
      a.jobId,
      a.status,
      a.appliedAt ?? null,
      a.nextActionAt ?? null,
      a.notes ?? null,
      a.updatedAt,
    ],
  });
}

// ── EmailRuns ──────────────────────────────────────────────────

function rowToEmailRun(r: Row): EmailRun {
  return EmailRunSchema.parse({
    id: str(r.id),
    runDate: str(r.run_date),
    jobCount: num(r.job_count),
    success: bool(r.success),
    error: optStr(r.error),
    createdAt: str(r.created_at),
  });
}

export async function insertEmailRun(run: EmailRun): Promise<void> {
  const e = EmailRunSchema.parse(run);
  await db.execute({
    sql: `INSERT INTO email_runs (id, run_date, job_count, success, error, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [e.id, e.runDate, e.jobCount, e.success ? 1 : 0, e.error ?? null, e.createdAt],
  });
}

export async function listEmailRuns(limit = 30): Promise<EmailRun[]> {
  const res = await db.execute({
    sql: 'SELECT * FROM email_runs ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  });
  return res.rows.map(rowToEmailRun);
}

// ── Stats (대시보드 통계) ──────────────────────────────────────

export interface Stats {
  jobsByDate: { date: string; count: number }[];
  jobsBySource: { source: string; count: number }[];
  applicationsByStatus: { status: string; count: number }[];
  totals: { jobs: number; applications: number; runs: number };
}

export async function getStats(): Promise<Stats> {
  const [byDate, bySource, byStatus, totals] = await Promise.all([
    db.execute(
      `SELECT substr(collected_at, 1, 10) AS d, COUNT(*) AS c
       FROM job_postings GROUP BY d ORDER BY d DESC LIMIT 14`,
    ),
    db.execute(`SELECT source AS s, COUNT(*) AS c FROM job_postings GROUP BY s ORDER BY c DESC`),
    db.execute(`SELECT status AS s, COUNT(*) AS c FROM applications GROUP BY s`),
    db.execute(
      `SELECT
         (SELECT COUNT(*) FROM job_postings) AS jobs,
         (SELECT COUNT(*) FROM applications) AS applications,
         (SELECT COUNT(*) FROM email_runs) AS runs`,
    ),
  ]);

  const t = totals.rows[0];
  return {
    jobsByDate: byDate.rows.map((r) => ({ date: str(r.d), count: num(r.c) })).reverse(),
    jobsBySource: bySource.rows.map((r) => ({ source: str(r.s), count: num(r.c) })),
    applicationsByStatus: byStatus.rows.map((r) => ({ status: str(r.s), count: num(r.c) })),
    totals: { jobs: num(t.jobs), applications: num(t.applications), runs: num(t.runs) },
  };
}

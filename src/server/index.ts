import { randomUUID } from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ENV } from '../config/constant';
import {
  ApplicationSchema,
  ApplicationStatusSchema,
  ProfileSchema,
  SourceSchema,
} from '../config/schema';
import {
  deleteSource,
  getApplication,
  getJobPosting,
  getProfile,
  getSource,
  listApplications,
  listEmailRuns,
  listJobPostings,
  listSources,
  upsertApplication,
  upsertProfile,
  upsertSource,
} from '../db/repository';
import { runPipeline } from '../graph/run';

// 비동기 핸들러의 예외를 에러 미들웨어로 전달.
type AsyncHandler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

export function createServer() {
  const app = express();
  app.use(express.json());

  // 대시보드 프런트(별도 origin)용 CORS.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ── 공고 ─────────────────────────────────────────────
  app.get(
    '/api/jobs',
    wrap(async (req, res) => {
      const { date, minScore, source } = req.query;
      const jobs = await listJobPostings({
        collectedOn: typeof date === 'string' ? date : undefined,
        minScore: typeof minScore === 'string' ? Number(minScore) : undefined,
        source: typeof source === 'string' ? source : undefined,
      });
      res.json(jobs);
    }),
  );

  app.get(
    '/api/jobs/:id',
    wrap(async (req, res) => {
      const job = await getJobPosting(String(req.params.id));
      if (!job) return res.status(404).json({ error: 'not found' });
      res.json(job);
    }),
  );

  // ── 프로필 ───────────────────────────────────────────
  app.get(
    '/api/profile',
    wrap(async (_req, res) => {
      const profile = await getProfile();
      if (!profile) return res.status(404).json({ error: 'profile not seeded' });
      res.json(profile);
    }),
  );

  app.put(
    '/api/profile',
    wrap(async (req, res) => {
      const parsed = ProfileSchema.safeParse({
        ...req.body,
        id: 'default',
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
      await upsertProfile(parsed.data);
      res.json(parsed.data);
    }),
  );

  // ── 소스 ─────────────────────────────────────────────
  app.get(
    '/api/sources',
    wrap(async (_req, res) => res.json(await listSources())),
  );

  app.post(
    '/api/sources',
    wrap(async (req, res) => {
      const now = new Date().toISOString();
      const parsed = SourceSchema.safeParse({ ...req.body, createdAt: now, updatedAt: now });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
      await upsertSource(parsed.data);
      res.status(201).json(parsed.data);
    }),
  );

  app.patch(
    '/api/sources/:id',
    wrap(async (req, res) => {
      const existing = await getSource(String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'not found' });
      const parsed = SourceSchema.safeParse({
        ...existing,
        ...req.body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
      await upsertSource(parsed.data);
      res.json(parsed.data);
    }),
  );

  app.delete(
    '/api/sources/:id',
    wrap(async (req, res) => {
      await deleteSource(String(req.params.id));
      res.status(204).end();
    }),
  );

  // ── 지원 현황 ────────────────────────────────────────
  app.get(
    '/api/applications',
    wrap(async (req, res) => {
      const { status } = req.query;
      const parsedStatus =
        typeof status === 'string' ? ApplicationStatusSchema.safeParse(status) : null;
      res.json(await listApplications(parsedStatus?.success ? parsedStatus.data : undefined));
    }),
  );

  app.post(
    '/api/applications',
    wrap(async (req, res) => {
      const now = new Date().toISOString();
      const parsed = ApplicationSchema.safeParse({
        id: randomUUID(),
        status: 'bookmarked',
        ...req.body,
        updatedAt: now,
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
      await upsertApplication(parsed.data);
      res.status(201).json(parsed.data);
    }),
  );

  app.patch(
    '/api/applications/:id',
    wrap(async (req, res) => {
      const existing = await getApplication(String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'not found' });
      const parsed = ApplicationSchema.safeParse({
        ...existing,
        ...req.body,
        id: existing.id,
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
      await upsertApplication(parsed.data);
      res.json(parsed.data);
    }),
  );

  // ── 발송 이력 ────────────────────────────────────────
  app.get(
    '/api/runs',
    wrap(async (_req, res) => res.json(await listEmailRuns())),
  );

  // ── 파이프라인 수동 실행(비동기 트리거) ──────────────
  app.post(
    '/api/run',
    wrap(async (req, res) => {
      const limit = typeof req.body?.limit === 'number' ? req.body.limit : undefined;
      // 실행은 수 분 걸릴 수 있어 응답을 막지 않고 백그라운드로 시작.
      void runPipeline({ limit }).catch((err) => console.error('수동 실행 실패:', err));
      res.status(202).json({ started: true });
    }),
  );

  // 에러 핸들러
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API 오류:', err);
    res.status(500).json({ error: (err as Error).message });
  });

  return app;
}

if (require.main === module) {
  createServer().listen(ENV.DASHBOARD_PORT, () => {
    console.log(`대시보드 API: http://localhost:${ENV.DASHBOARD_PORT}`);
  });
}

import { z } from 'zod';

// ── Source (수집 대상 채용 페이지) ─────────────────────────────
// request/select는 DB에 JSON(TEXT)으로 저장되며, 로드 시 이 스키마로 검증한다.

export const SourceRequestSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

export const SourceSelectSchema = z.object({
  // api: 응답 JSON 안 목록 경로 / html: 목록 항목 cheerio 셀렉터
  list: z.string().min(1),
  // 추출할 필드 → 경로(또는 셀렉터) 매핑. title/url은 필수.
  fields: z
    .record(z.string(), z.string())
    .refine((f) => 'title' in f && 'url' in f, {
      message: 'select.fields must include "title" and "url"',
    }),
});

export const SourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['api', 'html']),
  request: SourceRequestSchema,
  select: SourceSelectSchema,
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SourceRequest = z.infer<typeof SourceRequestSchema>;
export type SourceSelect = z.infer<typeof SourceSelectSchema>;
export type Source = z.infer<typeof SourceSchema>;

// ── Profile (사용자 직무/필터 설정) ────────────────────────────

export const ProfileSchema = z.object({
  id: z.string().min(1).default('default'),
  roles: z.array(z.string()).min(1),
  keywords: z
    .object({
      include: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default([]),
    })
    .default({ include: [], exclude: [] }),
  locations: z.array(z.string()).default([]),
  matchThreshold: z.number().min(0).max(1).default(0.6),
  email: z.object({
    to: z.string().email(),
    maxItems: z.number().int().positive().default(20),
  }),
  updatedAt: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;

// ── JobPosting (수집 공고) ─────────────────────────────────────

export const JobPostingSchema = z.object({
  id: z.string().min(1), // sourceId + 원본 식별자 해시 (멱등 키)
  source: z.string().min(1),
  title: z.string(),
  company: z.string(),
  url: z.string().url(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  description: z.string(),
  postedAt: z.string().optional(),
  collectedAt: z.string(),
  matchScore: z.number().min(0).max(1).optional(),
  matchReason: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type JobPosting = z.infer<typeof JobPostingSchema>;

// ── Application (지원 현황) ────────────────────────────────────

export const APPLICATION_STATUSES = [
  'bookmarked',
  'applied',
  'assignment',
  'interview',
  'offer',
  'rejected',
  'closed',
] as const;

export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  status: ApplicationStatusSchema,
  appliedAt: z.string().optional(),
  nextActionAt: z.string().optional(),
  notes: z.string().optional(),
  updatedAt: z.string(),
});

export type Application = z.infer<typeof ApplicationSchema>;

// ── EmailRun (발송 로그) ───────────────────────────────────────

export const EmailRunSchema = z.object({
  id: z.string().min(1),
  runDate: z.string(), // 발송 기준 날짜 (YYYY-MM-DD)
  jobCount: z.number().int().nonnegative(),
  success: z.boolean(),
  error: z.string().optional(),
  createdAt: z.string(),
});

export type EmailRun = z.infer<typeof EmailRunSchema>;

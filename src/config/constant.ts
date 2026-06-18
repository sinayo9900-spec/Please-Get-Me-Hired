import 'dotenv/config';
import { z } from 'zod';

// .env를 읽어 검증한 뒤 타입 안전한 상수로 export한다.
// 앱 전체는 process.env를 직접 읽지 않고 이 모듈(ENV)만 참조한다.

const EnvSchema = z.object({
  // LLM: CLI 구독 재활용 (API 키 불필요)
  LLM_PROVIDER: z.enum(['claude', 'gemini', 'codex']).default('claude'),
  LLM_CONCURRENCY: z.coerce.number().int().positive().default(2),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  // 메일 (SMTP)
  SMTP_HOST: z.string().min(1).default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  MAIL_FROM: z.string().min(1),

  // 저장소 / 서버
  DATABASE_URL: z.string().min(1).default('file:./data/app.db'),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`환경 변수(.env) 검증 실패:\n${issues}`);
  }
  return parsed.data;
}

export const ENV: Env = loadEnv();

import { randomUUID } from 'crypto';
import type { Transporter } from 'nodemailer';
import type { JobPosting, Profile } from '../config/schema';
import { insertEmailRun } from '../db/repository';
import { buildDigest, getTransport } from '../mail/transport';

export interface MailResult {
  sent: boolean;
  count: number;
  skipped?: boolean;
  error?: string;
}

// 오늘 날짜(YYYY-MM-DD, 로컬).
function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 매칭·요약된 공고를 일괄 메일로 보내고 email_runs에 기록한다.
// 공고 0건이면 발송하지 않고 skip(로그 없음). 발송 실패는 비치명적 — 로그만 남기고 진행.
export async function sendDigest(
  profile: Profile,
  jobs: JobPosting[],
  transport: Transporter = getTransport(),
): Promise<MailResult> {
  if (jobs.length === 0) return { sent: false, count: 0, skipped: true };

  const dateStr = today();
  const { message, sentCount } = buildDigest(profile, jobs, dateStr);
  const base = { id: randomUUID(), runDate: dateStr, jobCount: sentCount, createdAt: new Date().toISOString() };

  try {
    await transport.sendMail(message);
    await insertEmailRun({ ...base, success: true });
    return { sent: true, count: sentCount };
  } catch (err) {
    const error = (err as Error).message;
    await insertEmailRun({ ...base, success: false, error });
    return { sent: false, count: sentCount, error };
  }
}

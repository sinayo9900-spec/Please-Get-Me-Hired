import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../config/constant';
import type { JobPosting, Profile } from '../config/schema';

// ENV의 SMTP 설정으로 nodemailer transport를 만든다.
export function getTransport(): Transporter {
  return nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_PORT === 465, // 465=SSL, 그 외(587)=STARTTLS
    auth: { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function card(job: JobPosting): string {
  const meta = [job.location, job.employmentType]
    .filter((x): x is string => Boolean(x))
    .map(escapeHtml)
    .join(' · ');
  const score = job.matchScore != null ? `${Math.round(job.matchScore * 100)}%` : '';
  return `
  <tr><td style="padding:12px 0;border-bottom:1px solid #eee">
    <div style="font-size:12px;color:#888">${escapeHtml(job.company)}${meta ? ' · ' + meta : ''}${
      score ? ` · 적합도 ${score}` : ''
    }</div>
    <div style="font-size:16px;font-weight:600;margin:2px 0">
      <a href="${escapeHtml(job.url)}" style="color:#1a73e8;text-decoration:none">${escapeHtml(job.title)}</a>
    </div>
    ${job.matchReason ? `<div style="font-size:13px;color:#555;margin:4px 0">💡 ${escapeHtml(job.matchReason)}</div>` : ''}
    ${job.summary ? `<div style="font-size:13px;color:#333;margin:4px 0">${escapeHtml(job.summary)}</div>` : ''}
    <a href="${escapeHtml(job.url)}" style="font-size:13px;color:#1a73e8">지원 보기 →</a>
  </td></tr>`;
}

// 발송할 공고 목록을 HTML로 렌더링한다(순수 함수).
export function renderDigestHtml(jobs: JobPosting[], dateStr: string, extraCount = 0): string {
  const cards = jobs.map(card).join('');
  const more =
    extraCount > 0
      ? `<p style="font-size:13px;color:#888">…그 외 ${extraCount}건은 대시보드에서 확인하세요.</p>`
      : '';
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;padding:16px">
  <h2 style="margin:0 0 4px">📬 ${dateStr} 신규 채용 매칭</h2>
  <p style="color:#888;margin:0 0 12px">오늘 새로 매칭된 공고 ${jobs.length}건</p>
  <table style="width:100%;border-collapse:collapse">${cards}</table>
  ${more}
  </body></html>`;
}

export interface DigestMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
}

// 정렬·상한 적용 후 메일 메시지를 구성한다.
export function buildDigest(
  profile: Profile,
  jobs: JobPosting[],
  dateStr: string,
): { message: DigestMessage; sentCount: number } {
  const sorted = [...jobs].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const top = sorted.slice(0, profile.email.maxItems);
  const extra = sorted.length - top.length;
  return {
    message: {
      from: ENV.MAIL_FROM,
      to: profile.email.to,
      subject: `[채용 알림] ${dateStr} 신규 매칭 ${sorted.length}건`,
      html: renderDigestHtml(top, dateStr, extra),
    },
    sentCount: top.length,
  };
}

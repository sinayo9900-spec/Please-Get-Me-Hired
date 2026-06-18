import { ENV } from '../config/constant';
import { migrate } from './client';
import { getProfile, listSources, upsertProfile, upsertSource } from './repository';
import type { Profile, Source } from '../config/schema';

// 최초 1회 실행: 테이블 생성 + 기본 profile/source 주입.
// 이미 데이터가 있으면 덮어쓰지 않는다(멱등).

async function main(): Promise<void> {
  await migrate();
  const now = new Date().toISOString();

  if (!(await getProfile())) {
    const profile: Profile = {
      id: 'default',
      roles: ['백엔드 개발자', 'Node.js', 'TypeScript'],
      keywords: { include: ['신입', '주니어'], exclude: ['시니어', '5년 이상'] },
      locations: ['서울', '원격'],
      matchThreshold: 0.6,
      email: { to: ENV.SMTP_USER, maxItems: 20 },
      updatedAt: now,
    };
    await upsertProfile(profile);
    console.log('✓ 기본 profile 생성 완료');
  } else {
    console.log('· profile 이미 존재 — 건너뜀');
  }

  if ((await listSources()).length === 0) {
    const example: Source = {
      id: 'example-careers',
      name: '예시 회사 채용',
      type: 'html',
      request: { url: 'https://example.com/careers', method: 'GET' },
      select: {
        list: '.job-card',
        fields: { title: '.title', company: '.company', url: 'a@href' },
      },
      enabled: false, // 실제 사이트 연동 전까지 비활성
      createdAt: now,
      updatedAt: now,
    };
    await upsertSource(example);
    console.log('✓ 예시 source 생성 완료 (enabled=false)');
  } else {
    console.log('· source 이미 존재 — 건너뜀');
  }

  console.log('시드 완료.');
}

main().catch((err) => {
  console.error('시드 실패:', err);
  process.exitCode = 1;
});

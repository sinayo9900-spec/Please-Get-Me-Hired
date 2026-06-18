import { migrate } from './client';
import { deleteSource, upsertSource } from './repository';
import type { Source } from '../config/schema';

// 실제 수집 대상 소스를 DB에 upsert한다(멱등). M0의 example-careers placeholder는 제거.

const SARAMIN_URL =
  'https://www.saramin.co.kr/zf_user/search/recruit?searchword=%EB%8D%B0%EC%9D%B4%ED%84%B0%20%EC%97%94%EC%A7%80%EB%8B%88%EC%96%B4&recruitPage=1&recruitPageCount=40&recruitSort=relation&searchType=search';

function buildSources(now: string): Source[] {
  return [
    {
      id: 'peoplenjob',
      name: '피플앤잡',
      type: 'html',
      request: { url: 'https://www.peoplenjob.com/jobs?career_level=1&page=1', method: 'GET' },
      select: {
        list: '.jd-card',
        fields: {
          title: '.jd-card-title a',
          url: '.jd-card-title a@href',
          company: '.jd-card-company',
          location: '.jd-card-meta-location-text',
        },
      },
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'saramin',
      name: '사람인 (데이터 엔지니어)',
      type: 'html',
      request: { url: SARAMIN_URL, method: 'GET' },
      select: {
        list: '.item_recruit',
        fields: {
          title: '.job_tit a',
          url: '.job_tit a@href',
          company: '.corp_name a',
          location: '.job_condition span',
        },
      },
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'inthiswork',
      name: '인디스워크',
      type: 'html',
      request: { url: 'https://inthiswork.com/entry?paged1=1', method: 'GET' },
      select: {
        // 제목이 "회사명｜직무" 형태 → company는 동일 링크에서 받고 M2 normalizer에서 분리
        list: '.sub-entry',
        fields: {
          title: '.dpt-title-link',
          url: '.dpt-title-link@href',
          company: '.dpt-title-link',
        },
      },
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

async function main(): Promise<void> {
  await migrate();
  const now = new Date().toISOString();
  for (const s of buildSources(now)) {
    await upsertSource(s);
    console.log(`✓ source upsert: ${s.id}`);
  }
  await deleteSource('example-careers');
  console.log('· placeholder example-careers 제거');
  console.log('소스 시드 완료.');
}

main().catch((err) => {
  console.error('소스 시드 실패:', err);
  process.exitCode = 1;
});

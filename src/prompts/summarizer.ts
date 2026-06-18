import type { JobPosting } from '../config/schema';

// 공고 요약 프롬프트. 구직자가 빠르게 훑도록 핵심만 한국어 2~3문장으로.
export function summarizerPrompt(
  posting: Pick<JobPosting, 'title' | 'company' | 'location' | 'employmentType' | 'description'>,
): string {
  const job = {
    title: posting.title,
    company: posting.company,
    location: posting.location ?? '',
    employmentType: posting.employmentType ?? '',
    description: posting.description.slice(0, 1500),
  };
  return [
    '다음 채용 공고를 구직자가 빠르게 파악하도록 한국어 2~3문장으로 요약하세요.',
    '과장 없이 핵심(직무 내용·주요 자격·근무지)만 담고, 정보가 없으면 지어내지 마세요.',
    '요약 본문 텍스트만 출력하세요. 머리말·따옴표·목록 기호 금지:',
    JSON.stringify(job),
  ].join('\n');
}

import type { JobPosting, Profile } from '../config/schema';

// 직무 연관도 채점 프롬프트. CLI 코딩 에이전트가 거부하지 않도록 자기완결적 분류 작업으로
// 프레이밍하고, JSON만 출력하도록 명시한다(PLAN §6.3).
export function matcherPrompt(
  profile: Pick<Profile, 'roles' | 'keywords'>,
  posting: Pick<JobPosting, 'title' | 'company' | 'location' | 'description'>,
): string {
  const job = {
    title: posting.title,
    company: posting.company,
    location: posting.location ?? '',
    description: posting.description.slice(0, 600),
  };
  return [
    '당신은 채용 공고와 구직자 관심 직무의 연관도를 0~1로 평가하는 분류기입니다.',
    `구직자 관심 직무: ${JSON.stringify(profile.roles)}`,
    `선호 키워드: ${JSON.stringify(profile.keywords.include)}`,
    `기피 키워드: ${JSON.stringify(profile.keywords.exclude)}`,
    `채용 공고: ${JSON.stringify(job)}`,
    '평가 기준: 직무 일치도가 가장 중요하고, 선호/기피 키워드를 가감 요소로 본다.',
    '아래 JSON 객체 하나만 출력하세요. 설명·코드펜스·다른 텍스트 금지:',
    '{"score": <0과 1 사이 숫자>, "reason": "<한국어 한 문장>"}',
  ].join('\n');
}

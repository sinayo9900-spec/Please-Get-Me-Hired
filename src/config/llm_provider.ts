import { ENV } from './constant';
import { createCliProvider } from '../llm/cliProvider';

// LLM 추론 추상화. 노드(matcher/summarizer)는 구현을 모르고 이 인터페이스만 호출한다.
// 현재 구현은 모두 CLI 구독 재활용(서브프로세스). 추후 API provider도 같은 인터페이스로 추가 가능.
export interface LLMProvider {
  // 프롬프트를 모델에 보내고 답변 텍스트를 반환한다.
  // (구조화 출력이 필요하면 프롬프트에서 JSON을 요구하고 호출부에서 파싱한다.)
  complete(prompt: string): Promise<string>;
}

// env LLM_PROVIDER에 따라 provider를 생성한다.
export function getProvider(): LLMProvider {
  return createCliProvider(ENV.LLM_PROVIDER);
}

import { spawn } from 'child_process';
import os from 'os';
import { ENV } from '../config/constant';
import type { LLMProvider } from '../config/llm_provider';

type ProviderName = 'claude' | 'gemini' | 'codex';

interface CliSpec {
  command: string;
  // 프롬프트는 항상 stdin으로 주입한다(셸 인자 보간 금지 → 인젝션 방지).
  args: string[];
  // CLI stdout에서 모델 답변 텍스트를 추출한다.
  parse(stdout: string): string;
}

const SPECS: Record<ProviderName, CliSpec> = {
  // JSON 엔벨로프의 .result에 모델 답변이 담긴다.
  claude: {
    command: 'claude',
    args: ['-p', '--output-format', 'json'],
    parse: (out) => {
      const env = JSON.parse(out) as { result?: string; is_error?: boolean };
      if (env.is_error || typeof env.result !== 'string') {
        throw new Error('claude returned an error envelope');
      }
      return env.result;
    },
  },
  // 헤드리스(-p) + 텍스트 출력. stdin으로 프롬프트 전달.
  gemini: {
    command: 'gemini',
    args: ['-p', '-o', 'text'],
    parse: (out) => out.trim(),
  },
  // `codex exec -` : '-'는 stdin에서 지시를 읽는다.
  codex: {
    command: 'codex',
    args: ['exec', '-'],
    parse: (out) => out.trim(),
  },
};

// CLI를 서브프로세스로 실행하고 stdout을 반환한다. 타임아웃 시 kill.
function runCli(command: string, args: string[], stdin: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Windows의 npm .cmd 실행 호환을 위해 shell 사용. 외부 텍스트는 args가 아닌
    // stdin으로만 전달하므로 셸 인젝션 위험이 없다.
    // cwd는 중립 임시 디렉터리 — CLI(코딩 에이전트)가 이 프로젝트 파일/지침을
    // 끌어와 분류 작업에 간섭하거나 비용을 키우지 않도록 한다.
    const child = spawn(command, args, {
      shell: process.platform === 'win32',
      cwd: os.tmpdir(),
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 500)}`));
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}

export function createCliProvider(name: ProviderName): LLMProvider {
  const spec = SPECS[name];
  if (!spec) throw new Error(`알 수 없는 LLM_PROVIDER: ${name}`);
  return {
    async complete(prompt: string): Promise<string> {
      const out = await runCli(spec.command, spec.args, prompt, ENV.LLM_TIMEOUT_MS);
      return spec.parse(out);
    },
  };
}

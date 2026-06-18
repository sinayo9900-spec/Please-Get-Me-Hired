// 사용법:
//   ts-node apiClient.ts --url <API_URL> [--method GET|POST] [--body '{"key":"value"}'] [--header "Key: Value"]... [--save <output.html>]
//
// 예시:
//   ts-node apiClient.ts --url https://jsonplaceholder.typicode.com/posts/1
//   ts-node apiClient.ts --url https://jsonplaceholder.typicode.com/posts --method POST --body '{"title":"foo","body":"bar","userId":1}' --header "Content-Type: application/json"
//   ts-node apiClient.ts --url https://example.com --save response.html

import fs from 'fs';
import path from 'path';

type Headers = Record<string, string>;

interface ApiResult {
  status: number;
  statusText: string;
  headers: Headers;
  data: unknown;
  rawText: string;
}

interface CliArgs {
  url?: string;
  method: 'GET' | 'POST';
  body?: string;
  headers: string[];
  save?: string;
}

function parseHeaders(headerArgs: string[]): Headers {
  const headers: Headers = {};
  for (const entry of headerArgs) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

async function sendGet(url: string, headers: Headers = {}): Promise<ApiResult> {
  const response = await fetch(url, { method: 'GET', headers });
  return buildResult(response);
}

async function sendPost(url: string, body?: string, headers: Headers = {}): Promise<ApiResult> {
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
  const finalHeaders = hasContentType ? headers : { ...headers, 'Content-Type': 'application/json' };
  const payload = typeof body === 'string' ? body : JSON.stringify(body ?? {});

  const response = await fetch(url, { method: 'POST', headers: finalHeaders, body: payload });
  return buildResult(response);
}

async function buildResult(response: Response): Promise<ApiResult> {
  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // 응답이 JSON이 아니면 텍스트 그대로 사용
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    data,
    rawText: text,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function saveAsHtml(result: ApiResult, outputPath: string): string {
  const isHtml = /<html[\s>]/i.test(result.rawText);
  const content = isHtml
    ? result.rawText
    : `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>API Response</title></head>\n<body><pre>${escapeHtml(
        result.rawText,
      )}</pre></body>\n</html>\n`;

  const resolvedPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedPath, content, 'utf-8');
  return resolvedPath;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { method: 'GET', headers: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--url':
      case '-u':
        args.url = argv[++i];
        break;
      case '--method':
      case '-m':
        args.method = (argv[++i] || 'GET').toUpperCase() as 'GET' | 'POST';
        break;
      case '--body':
      case '-b':
        args.body = argv[++i];
        break;
      case '--header':
      case '-H':
        args.headers.push(argv[++i]);
        break;
      case '--save':
      case '-s':
        args.save = argv[++i];
        break;
      default:
        break;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    console.error('사용법: ts-node apiClient.ts --url <API_URL> [--method GET|POST] [--body \'{"key":"value"}\'] [--header "Key: Value"]');
    process.exitCode = 1;
    return;
  }

  const headers = parseHeaders(args.headers);

  try {
    const result =
      args.method === 'POST' ? await sendPost(args.url, args.body, headers) : await sendGet(args.url, headers);

    console.log(`Status: ${result.status} ${result.statusText}`);
    console.log('Headers:', result.headers);
    console.log('Body:', result.data);

    if (args.save) {
      const savedPath = saveAsHtml(result, args.save);
      console.log(`응답을 파일로 저장했습니다: ${savedPath}`);
    }
  } catch (error) {
    console.error('요청 실패:', (error as Error).message);
    process.exitCode = 1;
  }
}

main();

export { sendGet, sendPost, saveAsHtml };

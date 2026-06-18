import fs from 'fs';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { ENV } from '../config/constant';

// 로컬 파일 DB(file:./data/app.db)인 경우 디렉터리를 미리 만든다.
function ensureLocalDir(url: string): void {
  const prefix = 'file:';
  if (!url.startsWith(prefix)) return;
  const filePath = url.slice(prefix.length);
  const dir = path.dirname(path.resolve(filePath));
  fs.mkdirSync(dir, { recursive: true });
}

ensureLocalDir(ENV.DATABASE_URL);

export const db: Client = createClient({ url: ENV.DATABASE_URL });

// schema.sql을 실행해 테이블을 생성한다(IF NOT EXISTS라 반복 실행 안전).
export async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await db.executeMultiple(sql);
}

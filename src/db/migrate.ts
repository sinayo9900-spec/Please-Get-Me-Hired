import { migrate } from './client';

// 테이블만 생성한다(IF NOT EXISTS). 시드 데이터는 seed.ts 참고.
migrate()
  .then(() => console.log('마이그레이션 완료.'))
  .catch((err) => {
    console.error('마이그레이션 실패:', err);
    process.exitCode = 1;
  });

import { useEffect, useState } from 'react';
import { api } from './api';
import type { Profile } from './types';
import { JobsView } from './components/JobsView';
import { ApplicationsBoard } from './components/ApplicationsBoard';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';

type Tab = 'jobs' | 'applications' | 'stats' | 'settings';

export function App() {
  const [tab, setTab] = useState<Tab>('jobs');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  async function handleRun() {
    setRunning(true);
    setMsg('');
    try {
      await api.runPipeline();
      setMsg('파이프라인을 시작했습니다. 잠시 후 새로고침하세요.');
    } catch (e) {
      setMsg(`실행 실패: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>📬 Please Get Me Hired</h1>
          {profile && (
            <p className="muted">
              관심 직무: {profile.roles.join(', ')} · 임계값 {profile.matchThreshold}
            </p>
          )}
        </div>
        <button onClick={handleRun} disabled={running}>
          {running ? '실행 중…' : '지금 실행'}
        </button>
      </header>

      {msg && <div className="banner">{msg}</div>}

      <nav className="tabs">
        <button className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>
          오늘의 공고
        </button>
        <button
          className={tab === 'applications' ? 'active' : ''}
          onClick={() => setTab('applications')}
        >
          지원 현황
        </button>
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
          통계
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          설정
        </button>
      </nav>

      <main>
        {tab === 'jobs' && <JobsView />}
        {tab === 'applications' && <ApplicationsBoard />}
        {tab === 'stats' && <StatsView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

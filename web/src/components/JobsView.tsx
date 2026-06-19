import { useEffect, useState } from 'react';
import { api } from '../api';
import type { JobPosting } from '../types';

export function JobsView() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  function load() {
    setLoading(true);
    api
      .getJobs({ minScore: minScore || undefined })
      .then(setJobs)
      .finally(() => setLoading(false));
  }

  useEffect(load, [minScore]);

  async function addToApplications(job: JobPosting) {
    await api.createApplication({ jobId: job.id, status: 'bookmarked' });
    setAdded((m) => ({ ...m, [job.id]: true }));
  }

  return (
    <section>
      <div className="toolbar">
        <label>
          최소 적합도&nbsp;
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
            <option value={0}>전체</option>
            <option value={0.5}>50%+</option>
            <option value={0.6}>60%+</option>
            <option value={0.8}>80%+</option>
          </select>
        </label>
        <span className="muted">{jobs.length}건</span>
      </div>

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : jobs.length === 0 ? (
        <p className="muted">표시할 공고가 없습니다. “지금 실행”으로 수집해 보세요.</p>
      ) : (
        <ul className="cards">
          {jobs.map((job) => (
            <li key={job.id} className="card">
              <div className="card-meta">
                {job.company}
                {job.location ? ` · ${job.location}` : ''}
                {job.matchScore != null ? ` · 적합도 ${Math.round(job.matchScore * 100)}%` : ''}
              </div>
              <a className="card-title" href={job.url} target="_blank" rel="noreferrer">
                {job.title}
              </a>
              {job.matchReason && <div className="card-reason">💡 {job.matchReason}</div>}
              {job.summary && <div className="card-summary">{job.summary}</div>}
              <button
                className="ghost"
                disabled={added[job.id]}
                onClick={() => addToApplications(job)}
              >
                {added[job.id] ? '추가됨 ✓' : '지원 목록에 추가'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

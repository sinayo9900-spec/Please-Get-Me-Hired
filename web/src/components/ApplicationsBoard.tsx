import { useEffect, useState } from 'react';
import { api } from '../api';
import { APPLICATION_STATUSES, STATUS_LABEL } from '../types';
import type { Application, ApplicationStatus, JobPosting } from '../types';

export function ApplicationsBoard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobPosting>>({});
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([api.getApplications(), api.getJobs()])
      .then(([a, j]) => {
        setApps(a);
        setJobs(Object.fromEntries(j.map((job) => [job.id, job])));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function move(app: Application, status: ApplicationStatus) {
    const updated = await api.updateApplication(app.id, { status });
    setApps((list) => list.map((a) => (a.id === app.id ? updated : a)));
  }

  if (loading) return <p className="muted">불러오는 중…</p>;

  return (
    <section className="board">
      {APPLICATION_STATUSES.map((status) => {
        const column = apps.filter((a) => a.status === status);
        return (
          <div key={status} className="column">
            <h3>
              {STATUS_LABEL[status]} <span className="muted">{column.length}</span>
            </h3>
            {column.map((app) => {
              const job = jobs[app.jobId];
              return (
                <div key={app.id} className="app-card">
                  <div className="app-title">{job?.title ?? app.jobId}</div>
                  {job && <div className="card-meta">{job.company}</div>}
                  <select
                    value={app.status}
                    onChange={(e) => move(app, e.target.value as ApplicationStatus)}
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {column.length === 0 && <div className="empty muted">—</div>}
          </div>
        );
      })}
    </section>
  );
}

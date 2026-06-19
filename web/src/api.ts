import type { Application, ApplicationStatus, EmailRun, JobPosting, Profile } from './types';

// vite dev proxy(/api → :3000) 사용. 빌드 배포 시 VITE_API_BASE로 절대 URL 지정 가능.
const BASE = import.meta.env.VITE_API_BASE ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getJobs: (params: { minScore?: number; date?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.minScore != null) q.set('minScore', String(params.minScore));
    if (params.date) q.set('date', params.date);
    const qs = q.toString();
    return req<JobPosting[]>(`/api/jobs${qs ? `?${qs}` : ''}`);
  },
  getProfile: () => req<Profile>('/api/profile'),
  getApplications: () => req<Application[]>('/api/applications'),
  createApplication: (body: { jobId: string; status?: ApplicationStatus; notes?: string }) =>
    req<Application>('/api/applications', { method: 'POST', body: JSON.stringify(body) }),
  updateApplication: (id: string, body: Partial<Application>) =>
    req<Application>(`/api/applications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getRuns: () => req<EmailRun[]>('/api/runs'),
  runPipeline: () => req<{ started: boolean }>('/api/run', { method: 'POST', body: '{}' }),
};

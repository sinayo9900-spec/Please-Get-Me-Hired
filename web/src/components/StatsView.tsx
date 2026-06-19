import { useEffect, useState } from 'react';
import { api } from '../api';
import { STATUS_LABEL } from '../types';
import type { ApplicationStatus, Stats } from '../types';

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="bar-value">{value}</span>
    </div>
  );
}

export function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return <p className="muted">불러오는 중…</p>;

  const dateMax = Math.max(1, ...stats.jobsByDate.map((d) => d.count));
  const srcMax = Math.max(1, ...stats.jobsBySource.map((d) => d.count));
  const statusMax = Math.max(1, ...stats.applicationsByStatus.map((d) => d.count));

  return (
    <section className="stats">
      <div className="totals">
        <div className="total-card">
          <div className="total-num">{stats.totals.jobs}</div>
          <div className="muted">수집 공고</div>
        </div>
        <div className="total-card">
          <div className="total-num">{stats.totals.applications}</div>
          <div className="muted">지원 현황</div>
        </div>
        <div className="total-card">
          <div className="total-num">{stats.totals.runs}</div>
          <div className="muted">메일 발송</div>
        </div>
      </div>

      <h3>일자별 수집</h3>
      {stats.jobsByDate.length === 0 ? (
        <p className="muted">데이터 없음</p>
      ) : (
        stats.jobsByDate.map((d) => <Bar key={d.date} label={d.date} value={d.count} max={dateMax} />)
      )}

      <h3>소스별 분포</h3>
      {stats.jobsBySource.length === 0 ? (
        <p className="muted">데이터 없음</p>
      ) : (
        stats.jobsBySource.map((d) => (
          <Bar key={d.source} label={d.source} value={d.count} max={srcMax} />
        ))
      )}

      <h3>지원 단계별</h3>
      {stats.applicationsByStatus.length === 0 ? (
        <p className="muted">데이터 없음</p>
      ) : (
        stats.applicationsByStatus.map((d) => (
          <Bar
            key={d.status}
            label={STATUS_LABEL[d.status as ApplicationStatus] ?? d.status}
            value={d.count}
            max={statusMax}
          />
        ))
      )}
    </section>
  );
}

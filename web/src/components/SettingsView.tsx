import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Profile, Source } from '../types';

const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const fromList = (a: string[]) => a.join(', ');

function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    roles: '',
    include: '',
    exclude: '',
    locations: '',
    matchThreshold: 0.6,
    to: '',
    maxItems: 20,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getProfile().then((p) => {
      setProfile(p);
      setForm({
        roles: fromList(p.roles),
        include: fromList(p.keywords.include),
        exclude: fromList(p.keywords.exclude),
        locations: fromList(p.locations),
        matchThreshold: p.matchThreshold,
        to: p.email.to,
        maxItems: p.email.maxItems,
      });
    });
  }, []);

  async function save() {
    await api.updateProfile({
      roles: toList(form.roles),
      keywords: { include: toList(form.include), exclude: toList(form.exclude) },
      locations: toList(form.locations),
      matchThreshold: Number(form.matchThreshold),
      email: { to: form.to, maxItems: Number(form.maxItems) },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!profile) return <p className="muted">불러오는 중…</p>;

  return (
    <div className="settings-block">
      <h3>프로필 (직무 / 필터 / 메일)</h3>
      <label>관심 직무 (쉼표 구분)
        <input value={form.roles} onChange={(e) => setForm({ ...form, roles: e.target.value })} />
      </label>
      <label>선호 키워드
        <input value={form.include} onChange={(e) => setForm({ ...form, include: e.target.value })} />
      </label>
      <label>기피 키워드
        <input value={form.exclude} onChange={(e) => setForm({ ...form, exclude: e.target.value })} />
      </label>
      <label>선호 지역
        <input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} />
      </label>
      <div className="row">
        <label>매칭 임계값 (0~1)
          <input type="number" step="0.05" min="0" max="1" value={form.matchThreshold}
            onChange={(e) => setForm({ ...form, matchThreshold: Number(e.target.value) })} />
        </label>
        <label>메일 최대 건수
          <input type="number" min="1" value={form.maxItems}
            onChange={(e) => setForm({ ...form, maxItems: Number(e.target.value) })} />
        </label>
      </div>
      <label>받는 메일
        <input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
      </label>
      <button onClick={save}>{saved ? '저장됨 ✓' : '프로필 저장'}</button>
    </div>
  );
}

const EMPTY_SOURCE = { id: '', name: '', url: '', list: '', title: '', urlSel: '', company: '' };

function SourcesPanel() {
  const [sources, setSources] = useState<Source[]>([]);
  const [draft, setDraft] = useState(EMPTY_SOURCE);
  const [error, setError] = useState('');

  function load() {
    api.getSources().then(setSources);
  }
  useEffect(load, []);

  async function toggle(s: Source) {
    const updated = await api.updateSource(s.id, { enabled: !s.enabled });
    setSources((list) => list.map((x) => (x.id === s.id ? updated : x)));
  }

  async function remove(id: string) {
    await api.deleteSource(id);
    setSources((list) => list.filter((x) => x.id !== id));
  }

  async function add() {
    setError('');
    if (!draft.id || !draft.name || !draft.url || !draft.list || !draft.title || !draft.urlSel) {
      setError('id·이름·URL·목록 셀렉터·제목·링크 셀렉터는 필수입니다.');
      return;
    }
    try {
      const fields: Record<string, string> = { title: draft.title, url: draft.urlSel };
      if (draft.company) fields.company = draft.company;
      const created = await api.createSource({
        id: draft.id,
        name: draft.name,
        type: 'html',
        request: { url: draft.url, method: 'GET' },
        select: { list: draft.list, fields },
        enabled: true,
      });
      setSources((list) => [...list, created]);
      setDraft(EMPTY_SOURCE);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="settings-block">
      <h3>수집 소스</h3>
      <table className="src-table">
        <thead>
          <tr><th>id</th><th>이름</th><th>type</th><th>활성</th><th></th></tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.type}</td>
              <td><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} /></td>
              <td><button className="ghost danger" onClick={() => remove(s.id)}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>HTML 소스 추가</h4>
      <div className="src-form">
        <input placeholder="id (예: wanted)" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
        <input placeholder="이름" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input placeholder="목록 페이지 URL" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        <input placeholder="목록 셀렉터 (예: .job-card)" value={draft.list} onChange={(e) => setDraft({ ...draft, list: e.target.value })} />
        <input placeholder="제목 셀렉터" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <input placeholder="링크 셀렉터 (예: a@href)" value={draft.urlSel} onChange={(e) => setDraft({ ...draft, urlSel: e.target.value })} />
        <input placeholder="회사 셀렉터 (선택)" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
        <button onClick={add}>소스 추가</button>
      </div>
      {error && <div className="banner error">{error}</div>}
    </div>
  );
}

export function SettingsView() {
  return (
    <section>
      <ProfileForm />
      <SourcesPanel />
    </section>
  );
}

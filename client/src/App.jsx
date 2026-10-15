import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function Breakdown({ title, rows }) {
  const total = rows.reduce((sum, r) => sum + r.clicks, 0);
  return (
    <div className="card">
      <h3>{title}</h3>
      {rows.length === 0 && <p className="muted">No data yet</p>}
      {rows.map(r => (
        <p key={r.name}>
          {r.name}: <strong>{r.clicks}</strong>{' '}
          <span className="muted">({total ? Math.round((r.clicks / total) * 100) : 0}%)</span>
        </p>
      ))}
    </div>
  );
}

export default function App() {
  const [links, setLinks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  async function loadLinks() {
    const res = await fetch(`${API}/api/links`);
    setLinks(await res.json());
    const s = await fetch(`${API}/api/summary`);
    setSummary(await s.json());
  }

  useEffect(() => { loadLinks(); }, []);

  useEffect(() => {
    if (!selected) return;
    setStats(null);
    fetch(`${API}/api/links/${selected.id}/stats`)
      .then(r => r.json())
      .then(setStats);
  }, [selected]);

  async function createLink(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, slug: slug || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Something went wrong');
    setUrl('');
    setSlug('');
    loadLinks();
  }

  async function askQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAnswer('');
    try {
      const res = await fetch(`${API}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(res.ok ? data.answer : data.error || 'Something went wrong');
    } catch {
      setAnswer('Could not reach the server');
    }
    setAsking(false);
  }

  const perDay = stats?.perDay.map(d => ({ ...d, day: d.day.slice(0, 10) })) || [];

  return (
    <div className="wrap">
      <h1>SmartLink</h1>

      <div className="totals">
        <div className="card">
          <span className="muted">Unique visitors</span>
          <p className="big">{summary ? summary.total_clicks : '-'}</p>
        </div>
        <div className="card">
          <span className="muted">Links</span>
          <p className="big">{summary ? summary.total_links : '-'}</p>
        </div>
        <div className="card">
          <span className="muted">New visitors today</span>
          <p className="big">{summary ? summary.clicks_today : '-'}</p>
        </div>
      </div>

      <div className="card">
        <form className="row" onSubmit={createLink}>
          <input placeholder="Paste a long URL (https://...)" value={url} onChange={e => setUrl(e.target.value)} required />
          <input placeholder="Custom slug (optional)" value={slug} onChange={e => setSlug(e.target.value)} />
          <button type="submit">Shorten</button>
        </form>
        {error && <p className="err">{error}</p>}
      </div>

      <div className="card">
        <h3>Your links</h3>
        {links.length === 0 && <p>No links yet.</p>}
        {links.map(l => (
          <div key={l.id} className="link" onClick={() => setSelected(l)}>
            <span>
              <strong>{l.short_url}</strong><br />
              <small>{l.original_url}</small>
              {l.summary && <><br /><small>{l.summary} {l.tags && `· ${l.tags}`}</small></>}
            </span>
            <span>{l.clicks} visitors</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Ask your analytics</h3>
        <form className="row" onSubmit={askQuestion}>
          <input
            placeholder="e.g. Which link performed best this week?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
          <button type="submit" disabled={asking}>{asking ? 'Thinking...' : 'Ask'}</button>
        </form>
        {answer && <p>{answer}</p>}
      </div>

      {selected && !stats && <p className="muted">Loading stats...</p>}

      {selected && stats && (
        <>
          <div className="card">
            <h3>{selected.short_url}</h3>
            <p><strong>{stats.total}</strong> unique visitors</p>
          </div>

          <div className="grid">
            <div className="card">
              <h3>Visitors per day</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={perDay}>
                  <XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip />
                  <Bar dataKey="clicks" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Top referrers</h3>
              {stats.referrers.map(r => <p key={r.referrer}>{r.referrer}: {r.clicks}</p>)}
            </div>
          </div>

          <h2>Devices</h2>
          <div className="grid">
            <Breakdown title="Device type" rows={stats.devices} />
            <Breakdown title="Operating system" rows={stats.os} />
            <Breakdown title="Browser" rows={stats.browsers} />
          </div>
        </>
      )}
    </div>
  );
}
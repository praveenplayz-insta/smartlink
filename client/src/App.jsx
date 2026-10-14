import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API = 'http://localhost:3000';

export default function App() {
  const [links, setLinks] = useState([]);
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);

  async function loadLinks() {
    const res = await fetch(`${API}/api/links`);
    setLinks(await res.json());
  }

  useEffect(() => { loadLinks(); }, []);

  useEffect(() => {
    if (!selected) return;
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

  const perDay = stats?.perDay.map(d => ({ ...d, day: d.day.slice(0, 10) })) || [];

  return (
    <div className="wrap">
      <h1>SmartLink</h1>

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
            <span>{l.clicks} clicks</span>
          </div>
        ))}
      </div>

      {selected && stats && (
        <div className="grid">
          <div className="card">
            <h3>Clicks per day</h3>
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
          <div className="card">
            <h3>Devices</h3>
            {stats.devices.map(d => <p key={d.device}>{d.device}: {d.clicks}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { nanoid } = require('nanoid');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Create a short link
app.post('/api/links', async (req, res) => {
  const { url, slug } = req.body;
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  const finalSlug = slug || nanoid(7);
  try {
    const r = await pool.query(
      'insert into links (slug, original_url) values ($1, $2) returning *',
      [finalSlug, url]
    );
    res.status(201).json({
      ...r.rows[0],
      short_url: `${process.env.BASE_URL}/${finalSlug}`,
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Slug already taken' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// All links with click counts
app.get('/api/links', async (req, res) => {
  try {
    const r = await pool.query(`
      select l.id, l.slug, l.original_url, l.created_at, count(c.id)::int as clicks
      from links l left join clicks c on c.link_id = l.id
      group by l.id order by l.created_at desc`);
    res.json(r.rows.map(l => ({ ...l, short_url: `${process.env.BASE_URL}/${l.slug}` })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Stats for one link
app.get('/api/links/:id/stats', async (req, res) => {
  const id = req.params.id;
  try {
    const perDay = await pool.query(
      `select clicked_at::date as day, count(*)::int as clicks
       from clicks where link_id = $1 group by 1 order by 1`, [id]);
    const referrers = await pool.query(
      `select coalesce(referrer, 'Direct') as referrer, count(*)::int as clicks
       from clicks where link_id = $1 group by 1 order by 2 desc limit 5`, [id]);
    const devices = await pool.query(
      `select case when user_agent ilike '%mobile%' then 'Mobile' else 'Desktop' end as device,
       count(*)::int as clicks from clicks where link_id = $1 group by 1`, [id]);
    res.json({ perDay: perDay.rows, referrers: referrers.rows, devices: devices.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Redirect + log the click
app.get('/:slug', async (req, res) => {
  try {
    const r = await pool.query('select * from links where slug = $1', [req.params.slug]);
    const link = r.rows[0];
    if (!link) return res.status(404).send('Link not found');
    if (link.expires_at && new Date(link.expires_at) < new Date())
      return res.status(410).send('Link expired');

    pool
      .query(
        'insert into clicks (link_id, referrer, user_agent, country) values ($1, $2, $3, $4)',
        [link.id, req.get('referer') || null, req.get('user-agent') || null, req.get('cf-ipcountry') || null]
      )
      .catch(console.error);

    res.redirect(302, link.original_url);
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log('Server running on port ' + (process.env.PORT || 3000))
);
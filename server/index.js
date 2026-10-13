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

app.get('/:slug', async (req, res) => {
  try {
    const r = await pool.query('select * from links where slug = $1', [req.params.slug]);
    const link = r.rows[0];
    if (!link) return res.status(404).send('Link not found');
    if (link.expires_at && new Date(link.expires_at) < new Date())
      return res.status(410).send('Link expired');
    res.redirect(302, link.original_url);
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log('Server running on port ' + (process.env.PORT || 3000))
);
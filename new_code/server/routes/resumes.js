const router = require('express').Router();
const { pool } = require('../db');


const blank = () => ({ personal: { name: '', title: '', email: '', phone: '', location: '', links: [] },
  summary: '', experience: [], education: [], projects: [], volunteer: [], skills: [], certifications: [] });
const arr = a => (Array.isArray(a) ? a : []);
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function ym(v) { // normalise to "YYYY-MM"; leave anything unparseable (e.g. "2025") untouched
  v = String(v == null ? '' : v).trim();
  if (/^\d{4}-\d{2}$/.test(v)) return v;
  const m = v.match(/^([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/);
  return m && MON[m[1].toLowerCase()] ? m[2] + '-' + String(MON[m[1].toLowerCase()]).padStart(2, '0') : v;
}
const isNow = v => /^(present|current|now|ongoing)$/i.test(String(v || '').trim());
const span = e => { const cur = !!e.current || isNow(e.end); return { start: ym(e.start), end: cur ? '' : ym(e.end), current: cur }; };
function normalize(d = {}) {
  const b = blank();
  return {
    personal: { ...b.personal, ...(d.personal || {}), links: arr(d.personal && d.personal.links) },
    summary: d.summary || '',
    experience: arr(d.experience).map(e => ({ title: '', company: '', location: '', ...e, ...span(e), bullets: arr(e.bullets) })),
    education: arr(d.education).map(e => ({ degree: '', school: '', location: '', grade: '', details: '', ...e, ...span(e) })),
    projects: arr(d.projects).map(p => ({ title: '', link: '', description: '', ...p, date: ym(p.date) })),
    volunteer: arr(d.volunteer).map(v => ({ position: '', organisation: '', location: '', description: '', ...v, ...span(v) })),
    skills: arr(d.skills).map(String),
    certifications: arr(d.certifications).map(c => ({ name: '', issuer: '', year: '', ...c }))
  };
}

const parseRow = r => ({ id: r.id, template: r.template, title: r.title, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data });
const wrap = fn => (req, res, next) => fn(req, res).catch(next);

router.get('/', wrap(async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const [rows] = await pool.query('SELECT id, title, template, updated_at FROM resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', [req.session.userId]);
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
   if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const data = normalize(req.body.data);
  const [r] = await pool.query('INSERT INTO resumes (title, template, data,user_id) VALUES (?,?,?,?)',
    [data.personal.name || 'Untitled', req.body.template || 'modern', JSON.stringify(data), req.session.userId]);
  res.json({ id: r.insertId });
}));

router.get('/:id', wrap(async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const [rows] = await pool.query('SELECT * FROM resumes WHERE id=? AND user_id = ?', [req.params.id, req.session.userId]);
  if (!rows.length) return res.status(404).json({ error: 'Resume not found' });
  res.json(parseRow(rows[0]));
}));

router.put('/:id', wrap(async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const data = normalize(req.body.data);
  const [r] = await pool.query('UPDATE resumes SET title=?, template=?, data=? WHERE id=? AND user_id = ?',
    [data.personal.name || 'Untitled', req.body.template || 'modern', JSON.stringify(data), req.params.id,req.session.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Resume not found' });
  res.json({ ok: true });
}));

module.exports = router;

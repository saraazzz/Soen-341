const express = require('express');
const multer = require('multer');
const path = require('path');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const { enabled, isCloudFile, cloudFiles, UPLOAD_BYTES } = require('../cloud-files');
const router = express.Router();
const query = (db, sql, args) => new Promise((resolve, reject) => db.query(sql, args, (err, rows) => err ? reject(err) : resolve(rows)));
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(() => res.status(503).json({ message: 'File storage is unavailable. Please try again.' }));
const safeDelete = async ref => {
    if (isCloudFile(ref)) {
        try { await cloudFiles().remove(ref); }
        catch { console.error('Could not remove an unused cloud object; storage cleanup is needed.'); }
    }
};
const avatarRef = value => typeof value === 'string' && value.startsWith('/api/media/avatar/') ? `r2/avatars/${value.slice('/api/media/avatar/'.length)}` : value;
const avatarUrl = ref => `/api/media/avatar/${path.basename(ref)}`;
const login = (req, res, next) => {
    if (!req.session?.userId) return res.status(401).json({ message: 'Please log in first.' });
    if (!['job_seeker', 'employer'].includes(req.session.role)) return res.status(403).json({ message: 'Invalid account role.' });
    next();
};
const seeker = (req, res, next) => req.session.role === 'job_seeker' ? next() : res.status(403).json({ message: 'Only job seekers can manage resumes.' });
function upload(field, extensions) {
    const handler = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: UPLOAD_BYTES, files: 1, fields: 0, parts: 1 },
        fileFilter: (req, file, cb) => cb(extensions.includes(path.extname(file.originalname).toLowerCase()) ? null : new Error('Invalid file type'), true)
    }).single(field);
    return (req, res, next) => handler(req, res, err => err
        ? res.status(400).json({ message: 'Choose an allowed file type, no larger than 1.5 MB.' }) : next());
}
router.use((req, res, next) => enabled() ? next() : next('router'));

// Avatars are intentionally visible on profiles. This route can sign only avatar
// objects; private resumes never use a client-selected download reference.
router.get('/media/avatar/:file', wrap(async (req, res) => {
    const ref = `r2/avatars/${req.params.file}`;
    if (!/^[0-9a-f-]{36}\.(png|jpe?g|webp)$/.test(req.params.file)) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store');
    res.redirect(await cloudFiles().url(ref, req.params.file, true));
}));

async function changeFile(req, res, kind, deleting = false) {
    const avatar = kind === 'avatar';
    const table = avatar && req.session.role === 'employer' ? 'employer_profiles' : 'job_seeker_profiles';
    const column = avatar ? 'profile_picture' : 'resume_path';
    const db = req.app.get('db');
    const rows = await query(db, `SELECT ${column} FROM ${table} WHERE user_id = ?`, [req.session.userId]);
    if (!rows.length) return res.status(404).json({ message: 'Create your profile first.' });
    if (!deleting && !req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const old = rows[0][column];
    let ref;
    const replacement = deleting ? (avatar ? 'images/default.png' : null)
        : (ref = await cloudFiles().put(req.file.buffer, req.file.originalname, avatar ? 'avatars' : 'profile-resumes'), avatar ? avatarUrl(ref) : ref);
    try {
        // Compare the old value as well: concurrent replacements cannot delete
        // another request's successfully saved file or leave it unattached.
        const result = await query(db, `UPDATE ${table} SET ${column} = ? WHERE user_id = ? AND ${column} <=> ?`, [replacement, req.session.userId, old]);
        if (!result.affectedRows) {
            await safeDelete(ref);
            return res.status(409).json({ message: 'Your profile changed. Refresh and try again.' });
        }
    } catch (error) { await safeDelete(ref); throw error; }
    // Never remove the old file before the database accepts its replacement.
    await safeDelete(avatar ? avatarRef(old) : old);
    res.json({ message: deleting ? 'File removed.' : 'File saved.', [column]: replacement });
}
router.post('/profile/avatar', login, upload('avatar', ['.png','.jpg','.jpeg','.webp']), wrap((req,res) => changeFile(req,res,'avatar')));
router.delete('/profile/avatar', login, wrap((req,res) => changeFile(req,res,'avatar',true)));
router.post('/profile/resume', login, seeker, upload('resume', ['.pdf','.doc','.docx']), wrap((req,res) => changeFile(req,res,'resume')));
router.delete('/profile/resume', login, seeker, wrap((req,res) => changeFile(req,res,'resume',true)));
async function ownResume(req) {
    const rows = await query(req.app.get('db'), 'SELECT resume_path FROM job_seeker_profiles WHERE user_id = ?', [req.session.userId]);
    const ref = rows[0]?.resume_path;
    return isCloudFile(ref) && ref.startsWith('r2/profile-resumes/') ? ref : null;
}
router.get('/profile/resume', login, seeker, wrap(async (req,res) => {
    const ref = await ownResume(req);
    if (!ref) return res.status(404).json({ message: 'Upload your resume to hosted storage first.' });
    res.set('Cache-Control','private, no-store');
    res.redirect(await cloudFiles().url(ref, `resume${path.extname(ref)}`, true));
}));
router.get('/profile/resume/preview', login, seeker, wrap(async (req,res) => {
    const ref = await ownResume(req);
    if (!ref) return res.sendStatus(404);
    if (!/\.docx?$/.test(ref)) return res.sendStatus(400);
    const buffer = await cloudFiles().read(ref);
    // Plain extracted text avoids executing links or embedded markup from files.
    const text = ref.endsWith('.docx') ? (await mammoth.extractRawText({ buffer })).value : (await new WordExtractor().extract(buffer)).getBody();
    const escaped = text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    res.set('Cache-Control','private, no-store');
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'");
    res.set('X-Content-Type-Options','nosniff');
    res.type('html').send(`<meta charset="utf-8"><style>pre{white-space:pre-wrap;overflow-wrap:anywhere;font:16px sans-serif;padding:24px}</style><pre>${escaped}</pre>`);
}));
module.exports = router;

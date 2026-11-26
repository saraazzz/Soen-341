// routes/feedback.js (Gemini, reads the logged-in user's profile resume)
// POST /api/feedback  body: { jobPosting?: "text" }
// Needs: Node 18+, GEMINI_API_KEY in .env, and in server.js right after the db connection is created:
//   app.set("db", db);
// Never put the key in frontend code or commit it to GitHub.

const express = require('express');
const router = express.Router();
const { readResumeParts } = require('../ai/resume-reader');
const { callGemini } = require('../ai/gemini-client');
const { validateFeedback } = require('../ai/validate-feedback');
const { AiError } = require('../ai/errors');
const { createRateLimiter } = require('../ai/rate-limit');

const MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const MAX_RESUME_TEXT_CHARS = 100_000;
const FEEDBACK_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 45_000;

// Usage control: each user may start this many AI feedback requests per window.
const LIMIT_MAX = Number(process.env.FEEDBACK_RATE_LIMIT_MAX) || 10;
const LIMIT_WINDOW_MINUTES = Number(process.env.FEEDBACK_RATE_LIMIT_WINDOW_MINUTES) || 60;
const limiter = createRateLimiter({ max: LIMIT_MAX, windowMs: LIMIT_WINDOW_MINUTES * 60_000 });

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    matchScore: {
      anyOf: [
        { type: 'integer', minimum: 0, maximum: 100 },
        { type: 'null' }
      ]
    },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    gapsVsPosting: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirement: { type: 'string' },
          status: { type: 'string', enum: ['met', 'partial', 'missing'] },
          evidence: { type: 'string' }
        },
        required: ['requirement', 'status', 'evidence'],
        additionalProperties: false
      }
    },
    suggestedEdits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          suggestion: { type: 'string' }
        },
        required: ['section', 'suggestion'],
        additionalProperties: false
      }
    },
    atsTips: { type: 'array', items: { type: 'string' } }
  },
  required: ['overallScore', 'matchScore', 'summary', 'strengths', 'gapsVsPosting', 'suggestedEdits', 'atsTips'],
  additionalProperties: false
};

const SYSTEM_PROMPT = `You are a resume reviewer. Use ONLY the resume text or attached resume PDF and the job posting text provided.
Never invent experience, skills, employers, or numbers. If something is missing from the resume, say it is missing.
If no job posting is given, set "matchScore" to null and "gapsVsPosting" to [].
Return ONLY valid JSON with this exact shape:
{
  "overallScore": number (0-100, general resume quality),
  "matchScore": number (0-100, fit to the posting) or null,
  "summary": "2 sentences max, mention the job title or company if the posting gives one",
  "strengths": ["... (reference specific resume details)"],
  "gapsVsPosting": [{ "requirement": "from the posting", "status": "met" | "partial" | "missing", "evidence": "specific resume detail, or 'not found in resume'" }],
  "suggestedEdits": [{ "section": "string", "suggestion": "concrete rewrite or addition, using only real resume facts" }],
  "atsTips": ["..."]
}`;

router.get('/jobs', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Please log in first.' });
  }
  if (req.session.role !== 'job_seeker') {
    return res.status(403).json({ message: 'Only job seekers can view their applied jobs.' });
  }

  const db = req.app.get('db');
  if (!db) return res.status(500).json({ message: 'Database not available.' });

  const sql = `
    SELECT jobs.id, jobs.title, jobs.location, jobs.category, jobs.job_type,
      jobs.description, jobs.company AS company_name
    FROM applications
    INNER JOIN jobs ON jobs.id = applications.job_id
    WHERE applications.job_seeker_id = ?
    ORDER BY applications.applied_at DESC, jobs.created_at DESC
  `;

  db.query(sql, [req.session.userId], (error, jobs) => {
    if (error) {
      console.error('Applied job list error:', error);
      return res.status(500).json({ message: 'Could not load your applied jobs.' });
    }
    res.json(jobs);
  });
});

router.post('/', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Please log in first.' });
  }
  if (req.session.role !== 'job_seeker') {
    return res.status(403).json({ error: 'Only job seekers can use resume feedback.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
  }

  const db = req.app.get('db');
  if (!db) {
    return res.status(500).json({ error: 'Database not available. Add app.set("db", db) in server.js.' });
  }

  db.query(
    'SELECT resume_path FROM job_seeker_profiles WHERE user_id = ?',
    [req.session.userId],
    async (dbError, rows) => {
      try {
        if (dbError) {
          console.error('Resume lookup error:', dbError);
          return res.status(500).json({ error: 'Could not load your resume.' });
        }

        // Shared code: read the resume (PDF/DOC/DOCX) into Gemini "parts".
        const { parts } = await readResumeParts(rows[0]?.resume_path, {
          maxBytes: MAX_RESUME_BYTES,
          maxTextChars: MAX_RESUME_TEXT_CHARS
        });

        // Usage control: counted only when a request is really about to go to Gemini
        // (a missing or unreadable resume does not use up the user's allowance).
        const slot = limiter.take(req.session.userId);
        res.set('X-RateLimit-Remaining', String(slot.remaining));
        if (!slot.allowed) {
          const minutes = Math.ceil(slot.retryAfterSec / 60);
          res.set('Retry-After', String(slot.retryAfterSec));
          return res.status(429).json({
            error: `You have reached the limit of ${LIMIT_MAX} feedback requests per ${LIMIT_WINDOW_MINUTES} minutes. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
            code: 'USER_LIMIT'
          });
        }

        const posting = typeof req.body?.jobPosting === 'string' ? req.body.jobPosting.trim().slice(0, 8000) : '';
        const userText = posting ? `Job posting:\n${posting}` : 'Job posting: (none provided)';

        // Shared code: one Gemini request with a timeout and typed errors.
        const feedback = await callGemini({
          systemPrompt: SYSTEM_PROMPT,
          parts: [...parts, { text: userText }],
          schema: FEEDBACK_SCHEMA,
          model: MODEL,
          maxOutputTokens: 6000,
          temperature: 0.3,
          timeoutMs: FEEDBACK_TIMEOUT_MS
        });

        // Feature-specific check: valid JSON alone is not enough.
        const result = validateFeedback(feedback, { hasPosting: Boolean(posting) });
        if (!result.ok) {
          console.error('Feedback failed validation:', result.errors.join('; '));
          return res.status(502).json({ error: 'The AI response was incomplete. Please try again.', code: 'INVALID_OUTPUT' });
        }
        res.json(result.value);
      } catch (err) {
        if (err instanceof AiError) {
          return res.status(err.status).json({ error: err.message, code: err.code });
        }
        console.error('Unexpected feedback error:', err.message);
        res.status(500).json({ error: 'Could not generate feedback.' });
      }
    }
  );
});

module.exports = router;

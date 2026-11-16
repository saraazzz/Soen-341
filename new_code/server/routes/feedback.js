// routes/feedback.js (Gemini, reads the logged-in user's profile resume)
// POST /api/feedback  body: { jobPosting?: "text" }
// Needs: Node 18+, GEMINI_API_KEY in .env, and in server.js right after the db connection is created:
//   app.set("db", db);
// Never put the key in frontend code or commit it to GitHub.

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const WordExtractor = require('word-extractor');

const MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const MAX_RESUME_TEXT_CHARS = 100_000;

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

        const resumePath = rows[0]?.resume_path;
        if (!resumePath) {
          return res.status(400).json({ error: 'Upload a resume to your profile first.' });
        }
        const extension = path.extname(resumePath).toLowerCase();
        if (!['.pdf', '.doc', '.docx'].includes(extension)) {
          return res.status(400).json({ error: 'Your profile resume must be a PDF, DOC, or DOCX file.' });
        }

        const uploadsDir = path.resolve('public/uploads');
        const file = path.resolve('public', resumePath);
        if (!file.startsWith(uploadsDir + path.sep) || !fs.existsSync(file)) {
          return res.status(400).json({ error: 'Your resume file could not be found. Upload it again.' });
        }
        if (fs.statSync(file).size > MAX_RESUME_BYTES) {
          return res.status(400).json({ error: 'Resume file is too large (10 MB max).' });
        }

        const resumeParts = [];
        if (extension === '.pdf') {
          const pdfBase64 = fs.readFileSync(file).toString('base64');
          resumeParts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
        } else {
          const document = await new WordExtractor().extract(file);
          const resumeText = [document.getHeaders(), document.getBody(), document.getFooters()]
            .filter(Boolean)
            .join('\n')
            .slice(0, MAX_RESUME_TEXT_CHARS)
            .trim();
          if (!resumeText) {
            return res.status(400).json({ error: 'Could not read text from this Word resume. Try saving it as DOCX or PDF.' });
          }
          resumeParts.push({ text: `Resume text (extracted from ${extension}):\n${resumeText}` });
        }

        const posting = typeof req.body?.jobPosting === 'string' ? req.body.jobPosting.trim().slice(0, 8000) : '';
        const userText = posting ? `Job posting:\n${posting}` : 'Job posting: (none provided)';

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{
              role: 'user',
              parts: [...resumeParts, { text: userText }]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: FEEDBACK_SCHEMA,
              maxOutputTokens: 6000,
              temperature: 0.3
            }
          })
        });

        if (r.status === 429) {
          return res.status(429).json({ error: 'Free-tier rate limit reached. Wait a minute and try again.' });
        }
        if (r.status === 503) {
          console.error('Gemini API temporarily unavailable:', r.status, await r.text());
          return res.status(503).json({ error: 'Gemini is temporarily experiencing high demand. Please wait a moment and try again.' });
        }
        if (!r.ok) {
          console.error('Gemini API error:', r.status, await r.text());
          return res.status(502).json({ error: 'AI service error. Check the API key and model name.' });
        }

        const data = await r.json();
        const candidate = data.candidates?.[0];
        const text = (candidate?.content?.parts || []).map(p => p.text || '').join('').trim();
        if (candidate?.finishReason === 'MAX_TOKENS') {
          console.error('Gemini feedback was truncated at the output token limit.');
          return res.status(502).json({ error: 'The AI response was cut off. Try again or use a shorter resume.' });
        }
        if (!text) {
          const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'NO_CONTENT';
          console.error('Gemini returned no feedback text:', reason);
          const error = reason === 'MAX_TOKENS'
            ? 'The AI response was cut short. Try again with a shorter resume.'
            : 'The AI could not read this resume and return feedback. Try a text-based PDF or Word document.';
          return res.status(502).json({ error });
        }

        const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

        let feedback;
        try {
          feedback = JSON.parse(clean);
        } catch (parseError) {
          // Recover if the model wrapped a valid JSON object in brief extra text.
          const objectStart = clean.indexOf('{');
          const objectEnd = clean.lastIndexOf('}');
          if (objectStart >= 0 && objectEnd > objectStart) {
            try {
              feedback = JSON.parse(clean.slice(objectStart, objectEnd + 1));
            } catch {
              console.error('Gemini feedback JSON parsing failed:', parseError.message, candidate?.finishReason);
              return res.status(502).json({ error: 'The AI response was incomplete. Please try again.' });
            }
          } else {
            console.error('Gemini feedback did not contain a JSON object:', parseError.message, candidate?.finishReason);
            return res.status(502).json({ error: 'The AI response was incomplete. Please try again.' });
          }
        }

        if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
          return res.status(502).json({ error: 'AI returned an unreadable response. Try again.' });
        }
        res.json(feedback);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not generate feedback.' });
      }
    }
  );
});

module.exports = router;

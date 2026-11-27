// Shared resume reading for AI features (resume feedback, job matching).
// Turns a stored resume path into "parts" that can be sent to Gemini:
//   PDF  -> { inlineData: { mimeType: 'application/pdf', data: <base64> } }
//   DOC/DOCX -> { text: 'Resume text (extracted from .docx): ...' }
// Prompts are NOT handled here; each feature keeps its own prompt.

const fs = require('fs');
const path = require('path');
const WordExtractor = require('word-extractor');
const { AiError } = require('./errors');
const { resolveProfileResume } = require('../application-resumes');

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const DEFAULTS = { maxBytes: 10 * 1024 * 1024, maxTextChars: 100_000 };

// Default location rule (same as the original feedback route): the stored
// path is relative to ./public and must stay inside ./public/uploads.
// If resumes move to private storage, pass your own resolvePath option.
function defaultResolvePath(resumePath) {
  return resolveProfileResume(resumePath);
}
// Throws AiError (NO_RESUME, BAD_TYPE, NOT_FOUND, TOO_LARGE, UNREADABLE).
// options: { maxBytes, maxTextChars, resolvePath(resumePath) -> absolute path | null }
async function readResumeParts(resumePath, options = {}) {
  const { maxBytes, maxTextChars, resolvePath } = { ...DEFAULTS, resolvePath: defaultResolvePath, ...options };

  if (!resumePath) throw new AiError('NO_RESUME', 400, 'Upload a resume to your profile first.');

  const extension = path.extname(resumePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new AiError('BAD_TYPE', 400, 'Your profile resume must be a PDF, DOC, or DOCX file.');
  }

  const file = resolvePath(resumePath);
  if (!file || !fs.existsSync(file)) {
    throw new AiError('NOT_FOUND', 400, 'Your resume file could not be found. Upload it again.');
  }
  if (fs.statSync(file).size > maxBytes) {
    throw new AiError('TOO_LARGE', 400, 'Resume file is too large (10 MB max).');
  }

  if (extension === '.pdf') {
    let data;
    try {
      data = fs.readFileSync(file).toString('base64');
    } catch {
      throw new AiError('UNREADABLE', 400, 'Could not read your resume file. Try uploading it again.');
    }
    return { parts: [{ inlineData: { mimeType: 'application/pdf', data } }], usedResume: true };
  }

  let text = '';
  try {
    const document = await new WordExtractor().extract(file);
    text = [document.getHeaders(), document.getBody(), document.getFooters()]
      .filter(Boolean).join('\n').slice(0, maxTextChars).trim();
  } catch {
    text = '';
  }
  if (!text) {
    throw new AiError('UNREADABLE', 400, 'Could not read text from this Word resume. Try saving it as DOCX or PDF.');
  }
  return { parts: [{ text: `Resume text (extracted from ${extension}):\n${text}` }], usedResume: true };
}

// "Soft" version for features that can continue without a resume (job matching):
// never throws for resume problems, returns { parts: [], usedResume: false, reason }.
async function tryReadResumeParts(resumePath, options) {
  try {
    return await readResumeParts(resumePath, options);
  } catch (error) {
    if (error instanceof AiError) return { parts: [], usedResume: false, reason: error.code };
    throw error;
  }
}

module.exports = { readResumeParts, tryReadResumeParts, defaultResolvePath };

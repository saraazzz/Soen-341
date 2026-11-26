// Unit tests for the shared AI code in server/ai/ (no database, no real Gemini calls).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AiError } = require('../server/ai/errors');
const { readResumeParts, tryReadResumeParts } = require('../server/ai/resume-reader');
const { callGemini } = require('../server/ai/gemini-client');
const { validateFeedback } = require('../server/ai/validate-feedback');

const goodFeedback = () => ({
  overallScore: 80, matchScore: 70, summary: 'Solid resume.',
  strengths: ['Java projects'],
  gapsVsPosting: [{ requirement: 'SQL', status: 'partial', evidence: 'SQL listed in skills' }],
  suggestedEdits: [{ section: 'Projects', suggestion: 'Add outcomes.' }],
  atsTips: ['Use plain headings']
});
const geminiReply = (text, finishReason = 'STOP') => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] })
});
const call = (extra = {}) => callGemini({ systemPrompt: 's', parts: [{ text: 'r' }], apiKey: 'k', model: 'm', retryDelayMs: 0, ...extra });
const expectAiError = async (promise, code, status) => {
  await expect(promise).rejects.toMatchObject({ name: 'AiError', code, status });
};

let originalFetch;
let errorSpy;
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = jest.fn();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { global.fetch = originalFetch; errorSpy.mockRestore(); });

describe('validateFeedback', () => {
  test('accepts a complete valid result', () => {
    const r = validateFeedback(goodFeedback());
    expect(r.ok).toBe(true);
    expect(r.value.overallScore).toBe(80);
  });
  test('drops fields that are not part of the contract', () => {
    const r = validateFeedback({ ...goodFeedback(), secret: 'x' });
    expect(r.value).not.toHaveProperty('secret');
  });
  test.each([[150], [-1], [80.5], ['80'], [null], [undefined]])('rejects overallScore %p', (score) => {
    expect(validateFeedback({ ...goodFeedback(), overallScore: score }).ok).toBe(false);
  });
  test('allows matchScore null but not out of range', () => {
    expect(validateFeedback({ ...goodFeedback(), matchScore: null }).ok).toBe(true);
    expect(validateFeedback({ ...goodFeedback(), matchScore: 101 }).ok).toBe(false);
  });
  test('rejects missing or wrong-type arrays and bad nested objects', () => {
    expect(validateFeedback({ ...goodFeedback(), strengths: 'nope' }).ok).toBe(false);
    expect(validateFeedback({ ...goodFeedback(), atsTips: [1] }).ok).toBe(false);
    const bad = goodFeedback(); bad.gapsVsPosting[0].status = 'maybe';
    expect(validateFeedback(bad).ok).toBe(false);
    const bad2 = goodFeedback(); delete bad2.suggestedEdits[0].suggestion;
    expect(validateFeedback(bad2).ok).toBe(false);
    const bad3 = goodFeedback(); delete bad3.summary;
    expect(validateFeedback(bad3).ok).toBe(false);
  });
  test('rejects non-objects', () => {
    [null, [], 'text', 5].forEach((v) => expect(validateFeedback(v).ok).toBe(false));
  });
  test('without a posting, matchScore is null and gaps are empty', () => {
    const r = validateFeedback(goodFeedback(), { hasPosting: false });
    expect(r.value.matchScore).toBeNull();
    expect(r.value.gapsVsPosting).toEqual([]);
  });
  test('error list names fields but never echoes model text', () => {
    const r = validateFeedback({ ...goodFeedback(), overallScore: 'SECRET-TEXT' });
    expect(r.errors.join(' ')).not.toContain('SECRET-TEXT');
  });
});

describe('callGemini', () => {
  test('returns parsed JSON and sends a timeout signal and the key header', async () => {
    global.fetch.mockResolvedValueOnce(geminiReply(JSON.stringify({ a: 1 })));
    await expect(call()).resolves.toEqual({ a: 1 });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/models/m:generateContent');
    expect(options.headers['x-goog-api-key']).toBe('k');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  test('missing API key fails before any request', async () => {
    await expectAiError(callGemini({ systemPrompt: 's', parts: [], apiKey: '' }), 'NO_API_KEY', 500);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test('timeout becomes a 504 TIMEOUT error', async () => {
    global.fetch.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));
    await expectAiError(call(), 'TIMEOUT', 504);
  });
  test('a really slow provider is cut off by the timeout', async () => {
    global.fetch.mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }));
    await expectAiError(call({ timeoutMs: 30 }), 'TIMEOUT', 504);
  });
  test('network failure becomes NETWORK', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expectAiError(call(), 'NETWORK', 502);
  });
  test('429 and 503 map to RATE_LIMIT and UNAVAILABLE', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429 });
    await expectAiError(call(), 'RATE_LIMIT', 429);
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expectAiError(call(), 'UNAVAILABLE', 503);
  });
  test('retries once on 503 when retries is set', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(geminiReply('{"ok":true}'));
    await expect(call({ retries: 1 })).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
  test('rejected key or model (400/401/403/404) becomes BAD_CONFIG', async () => {
    for (const status of [400, 401, 403, 404]) {
      global.fetch.mockResolvedValueOnce({ ok: false, status });
      await expectAiError(call(), 'BAD_CONFIG', 502);
    }
  });
  test('truncated, empty and malformed output are reported', async () => {
    global.fetch.mockResolvedValueOnce(geminiReply('{"a":', 'MAX_TOKENS'));
    await expectAiError(call(), 'TRUNCATED', 502);
    global.fetch.mockResolvedValueOnce(geminiReply('   '));
    await expectAiError(call(), 'EMPTY', 502);
    global.fetch.mockResolvedValueOnce(geminiReply('not json at all'));
    await expectAiError(call(), 'MALFORMED', 502);
  });
  test('recovers JSON wrapped in code fences or short extra text', async () => {
    global.fetch.mockResolvedValueOnce(geminiReply('```json\n{"a":1}\n```'));
    await expect(call()).resolves.toEqual({ a: 1 });
    global.fetch.mockResolvedValueOnce(geminiReply('Here you go: {"a":2} done'));
    await expect(call()).resolves.toEqual({ a: 2 });
  });
  test('a JSON array or string is not accepted', async () => {
    global.fetch.mockResolvedValueOnce(geminiReply('[1,2]'));
    await expectAiError(call(), 'BAD_SHAPE', 502);
  });
  test('logs never contain the prompt, resume text or API key', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    await call({ parts: [{ text: 'PRIVATE-RESUME-TEXT' }], apiKey: 'SECRET-KEY' }).catch(() => {});
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain('PRIVATE-RESUME-TEXT');
    expect(logged).not.toContain('SECRET-KEY');
  });
});

describe('readResumeParts', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const inDir = (name) => ({ resolvePath: (p) => path.join(dir, path.basename(p)) });

  test('missing path, wrong type and missing file are typed errors', async () => {
    await expect(readResumeParts(null)).rejects.toMatchObject({ code: 'NO_RESUME', status: 400 });
    await expect(readResumeParts('uploads/a.txt')).rejects.toMatchObject({ code: 'BAD_TYPE' });
    await expect(readResumeParts('uploads/a.pdf', inDir())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  test('default rule refuses paths outside public/uploads', async () => {
    await expect(readResumeParts('uploads/../../server/server.js.pdf')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  test('oversized file is rejected', async () => {
    fs.writeFileSync(path.join(dir, 'big.pdf'), 'x'.repeat(50));
    await expect(readResumeParts('big.pdf', { ...inDir(), maxBytes: 10 })).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });
  test('PDF becomes base64 inlineData', async () => {
    fs.writeFileSync(path.join(dir, 'cv.pdf'), 'hello');
    const r = await readResumeParts('cv.pdf', inDir());
    expect(r.usedResume).toBe(true);
    expect(r.parts[0].inlineData).toEqual({ mimeType: 'application/pdf', data: Buffer.from('hello').toString('base64') });
  });
  test('unreadable Word file is a typed error', async () => {
    fs.writeFileSync(path.join(dir, 'cv.docx'), 'not really a docx');
    await expect(readResumeParts('cv.docx', inDir())).rejects.toMatchObject({ code: 'UNREADABLE' });
  });
  test('tryReadResumeParts returns an empty result instead of throwing', async () => {
    await expect(tryReadResumeParts(null)).resolves.toEqual({ parts: [], usedResume: false, reason: 'NO_RESUME' });
  });
  test('custom resolvePath lets private storage plug in', async () => {
    fs.writeFileSync(path.join(dir, 'private.pdf'), 'x');
    const resolvePath = jest.fn((p) => path.join(dir, p));
    const r = await readResumeParts('private.pdf', { resolvePath });
    expect(resolvePath).toHaveBeenCalledWith('private.pdf');
    expect(r.usedResume).toBe(true);
  });
});

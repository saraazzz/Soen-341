// Route-level failure and validation tests for POST /api/feedback (Gemini is mocked).
process.env.FEEDBACK_RATE_LIMIT_MAX = '1000'; // these tests send many requests as one user
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcrypt');

jest.mock('mysql2', () => ({
  createConnection: jest.fn(() => ({ query: jest.fn(), connect: jest.fn() }))
}));

const mysql = require('mysql2');
const app = require('../server/server');
const db = mysql.createConnection.mock.results[0].value;

const RESUME_DIR = path.resolve('public/uploads');
const RESUME_FILE = path.join(RESUME_DIR, 'feedback-failure-test.pdf');
const originalFetch = global.fetch;
let password;
let errorSpy;

const goodFeedback = () => ({
  overallScore: 85, matchScore: 90, summary: 'A strong resume.',
  strengths: ['Good skills'],
  gapsVsPosting: [{ requirement: 'JavaScript', status: 'met', evidence: 'Listed in skills' }],
  suggestedEdits: [{ section: 'Projects', suggestion: 'Add details.' }],
  atsTips: ['Use clear headings']
});
const geminiReply = (payload, finishReason = 'STOP') => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] } }] })
});

async function loginAndSetResume(resumePath = 'uploads/feedback-failure-test.pdf') {
  db.query.mockImplementationOnce((sql, params, cb) => cb(null, [{ id: 42, role: 'job_seeker', password }]));
  const agent = request.agent(app);
  const login = await agent.post('/api/login').send({ email: 'seeker@example.com', password: 'test-password' });
  expect(login.status).toBe(200);
  db.query.mockClear();
  db.query.mockImplementationOnce((sql, params, cb) => cb(null, [{ resume_path: resumePath }]));
  return agent;
}

beforeAll(async () => {
  password = await bcrypt.hash('test-password', 4);
  process.env.GEMINI_API_KEY = 'test-api-key';
  app.set('db', db);
});
beforeEach(() => {
  db.query.mockReset();
  global.fetch = jest.fn();
  app.set('db', db);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  fs.mkdirSync(RESUME_DIR, { recursive: true });
  fs.writeFileSync(RESUME_FILE, 'Test resume PDF content');
});
afterEach(() => {
  errorSpy.mockRestore();
  if (fs.existsSync(RESUME_FILE)) fs.unlinkSync(RESUME_FILE);
});
afterAll(() => { global.fetch = originalFetch; delete process.env.GEMINI_API_KEY; });

const failureCases = [
  ['slow provider (timeout)', () => global.fetch.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError')), 504, 'TIMEOUT', /took too long/],
  ['network failure', () => global.fetch.mockRejectedValueOnce(new TypeError('fetch failed')), 502, 'NETWORK', /Could not reach/],
  ['rate limit', () => global.fetch.mockResolvedValueOnce({ ok: false, status: 429 }), 429, 'RATE_LIMIT', /rate limit/],
  ['service unavailable', () => global.fetch.mockResolvedValueOnce({ ok: false, status: 503 }), 503, 'UNAVAILABLE', /high demand/],
  ['rejected API key', () => global.fetch.mockResolvedValueOnce({ ok: false, status: 403 }), 502, 'BAD_CONFIG', /API key/],
  ['truncated output', () => global.fetch.mockResolvedValueOnce(geminiReply('{"overallScore":', 'MAX_TOKENS')), 502, 'TRUNCATED', /cut off/],
  ['malformed JSON', () => global.fetch.mockResolvedValueOnce(geminiReply('definitely not json')), 502, 'MALFORMED', /incomplete/],
  ['valid JSON with a score out of range', () => global.fetch.mockResolvedValueOnce(geminiReply({ ...goodFeedback(), overallScore: 150 })), 502, 'INVALID_OUTPUT', /incomplete/],
  ['valid JSON missing required fields', () => global.fetch.mockResolvedValueOnce(geminiReply({ overallScore: 50 })), 502, 'INVALID_OUTPUT', /incomplete/]
];

test.each(failureCases)('%s returns a friendly error and the server keeps working', async (name, arrange, status, code, message) => {
  const agent = await loginAndSetResume();
  arrange();
  const response = await agent.post('/api/feedback').send({ jobPosting: 'Needs JavaScript.' });
  expect(response.status).toBe(status);
  expect(response.body.code).toBe(code);
  expect(response.body.error).toMatch(message);

  // The user can try again right away (the button re-enables in the UI).
  db.query.mockImplementationOnce((sql, params, cb) => cb(null, [{ resume_path: 'uploads/feedback-failure-test.pdf' }]));
  global.fetch.mockResolvedValueOnce(geminiReply(goodFeedback()));
  const retry = await agent.post('/api/feedback').send({ jobPosting: 'Needs JavaScript.' });
  expect(retry.status).toBe(200);
});

test('resume file missing on disk returns a clear 400 and never calls Gemini', async () => {
  const agent = await loginAndSetResume('uploads/does-not-exist.pdf');
  const response = await agent.post('/api/feedback').send({});
  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/could not be found/);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('unsupported resume type returns 400 and never calls Gemini', async () => {
  const agent = await loginAndSetResume('uploads/resume.txt');
  const response = await agent.post('/api/feedback').send({});
  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/PDF, DOC, or DOCX/);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('without a job posting the browser gets matchScore null and no gaps', async () => {
  const agent = await loginAndSetResume();
  global.fetch.mockResolvedValueOnce(geminiReply(goodFeedback()));
  const response = await agent.post('/api/feedback').send({});
  expect(response.status).toBe(200);
  expect(response.body.matchScore).toBeNull();
  expect(response.body.gapsVsPosting).toEqual([]);
});

test('logs do not contain resume contents or the API key', async () => {
  const agent = await loginAndSetResume();
  global.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
  await agent.post('/api/feedback').send({ jobPosting: 'POSTING-TEXT' });
  const logged = JSON.stringify(errorSpy.mock.calls);
  expect(logged).not.toContain('Test resume PDF content');
  expect(logged).not.toContain('test-api-key');
  expect(logged).not.toContain('POSTING-TEXT');
});

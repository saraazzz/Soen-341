// Per-user request limit on POST /api/feedback (Gemini is mocked).
process.env.FEEDBACK_RATE_LIMIT_MAX = '2';
process.env.FEEDBACK_RATE_LIMIT_WINDOW_MINUTES = '60';
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
const RESUME_FILE = path.join(RESUME_DIR, 'feedback-limit-test.pdf');
const originalFetch = global.fetch;
let password;

const feedback = {
  overallScore: 80, matchScore: 70, summary: 'Fine.', strengths: ['A'],
  gapsVsPosting: [], suggestedEdits: [{ section: 'Skills', suggestion: 'Add one.' }], atsTips: ['B']
};
const geminiOk = () => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(feedback) }] } }] })
});

async function login(userId) {
  db.query.mockImplementationOnce((sql, params, cb) => cb(null, [{ id: userId, role: 'job_seeker', password }]));
  const agent = request.agent(app);
  const res = await agent.post('/api/login').send({ email: `u${userId}@example.com`, password: 'test-password' });
  expect(res.status).toBe(200);
  return agent;
}
const nextResume = (resumePath) =>
  db.query.mockImplementationOnce((sql, params, cb) => cb(null, [{ resume_path: resumePath }]));

beforeAll(async () => {
  password = await bcrypt.hash('test-password', 4);
  process.env.GEMINI_API_KEY = 'test-api-key';
  app.set('db', db);
  fs.mkdirSync(RESUME_DIR, { recursive: true });
  fs.writeFileSync(RESUME_FILE, 'resume');
});
beforeEach(() => { db.query.mockReset(); global.fetch = jest.fn(); app.set('db', db); });
afterAll(() => {
  global.fetch = originalFetch;
  delete process.env.GEMINI_API_KEY;
  if (fs.existsSync(RESUME_FILE)) fs.unlinkSync(RESUME_FILE);
});

test('the third request in the window is refused without calling Gemini', async () => {
  const agent = await login(101);
  for (let i = 0; i < 2; i += 1) {
    nextResume('uploads/feedback-limit-test.pdf');
    global.fetch.mockResolvedValueOnce(geminiOk());
    const ok = await agent.post('/api/feedback').send({ jobPosting: 'Job' });
    expect(ok.status).toBe(200);
  }
  expect(global.fetch).toHaveBeenCalledTimes(2);

  nextResume('uploads/feedback-limit-test.pdf');
  const blocked = await agent.post('/api/feedback').send({ jobPosting: 'Job' });
  expect(blocked.status).toBe(429);
  expect(blocked.body.code).toBe('USER_LIMIT');
  expect(blocked.body.error).toMatch(/limit of 2 feedback requests/);
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('another user is not affected by the first user hitting the limit', async () => {
  const agent = await login(202);
  nextResume('uploads/feedback-limit-test.pdf');
  global.fetch.mockResolvedValueOnce(geminiOk());
  const res = await agent.post('/api/feedback').send({ jobPosting: 'Job' });
  expect(res.status).toBe(200);
  expect(res.headers['x-ratelimit-remaining']).toBe('1');
});

test('requests that fail before reaching Gemini do not use up the allowance', async () => {
  const agent = await login(303);
  for (let i = 0; i < 3; i += 1) {
    nextResume(null); // no resume uploaded
    const res = await agent.post('/api/feedback').send({});
    expect(res.status).toBe(400);
  }
  nextResume('uploads/feedback-limit-test.pdf');
  global.fetch.mockResolvedValueOnce(geminiOk());
  const ok = await agent.post('/api/feedback').send({ jobPosting: 'Job' });
  expect(ok.status).toBe(200);
});

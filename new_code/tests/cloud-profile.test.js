const express = require('express');
const request = require('supertest');
const mockFiles = { put: jest.fn(), remove: jest.fn(), url: jest.fn(), read: jest.fn() };
jest.mock('../server/cloud-files', () => ({
    ...jest.requireActual('../server/cloud-files'), cloudFiles: () => mockFiles
}));
const router = require('../server/routes/cloud-profile');
const oldRef = 'r2/profile-resumes/00000000-0000-4000-8000-000000000000.pdf';
const newRef = 'r2/profile-resumes/00000000-0000-4000-8000-000000000001.pdf';
let db;
function app(userId = 42, role = 'job_seeker') {
    const server = express(); server.set('db', db);
    server.use((req,res,next) => { req.session = { userId, role }; next(); });
    server.use('/api', router); return server;
}
beforeEach(() => {
    process.env.FILE_STORAGE = 'r2';
    jest.clearAllMocks();
    db = { query: jest.fn() };
    mockFiles.put.mockResolvedValue(newRef); mockFiles.remove.mockResolvedValue(); mockFiles.url.mockResolvedValue('https://signed.invalid/file');
});
afterAll(() => delete process.env.FILE_STORAGE);
test('unauthenticated uploads never reach storage or database', async () => {
    expect((await request(app(null)).post('/api/profile/resume').attach('resume', Buffer.from('pdf'), 'a.pdf')).status).toBe(401);
    expect(mockFiles.put).not.toHaveBeenCalled(); expect(db.query).not.toHaveBeenCalled();
});
test('ownership comes from the session, never a query-string user id', async () => {
    db.query.mockImplementation((sql,args,cb) => { expect(args).toEqual([42]); cb(null,[{ resume_path: oldRef }]); });
    expect((await request(app()).get('/api/profile/resume?userId=99')).status).toBe(302);
    expect(mockFiles.url).toHaveBeenCalledWith(oldRef, 'resume.pdf', true);
});
test('failed database update removes only the new object', async () => {
    db.query.mockImplementationOnce((sql,args,cb) => cb(null,[{ resume_path: oldRef }]))
        .mockImplementationOnce((sql,args,cb) => cb(new Error('DB unavailable')));
    expect((await request(app()).post('/api/profile/resume').attach('resume', Buffer.from('pdf'), 'a.pdf')).status).toBe(503);
    expect(mockFiles.remove.mock.calls).toEqual([[newRef]]);
});
test('successful replacement updates the DB before deleting old resume', async () => {
    db.query.mockImplementationOnce((sql,args,cb) => cb(null,[{ resume_path: oldRef }]))
        .mockImplementationOnce((sql,args,cb) => { expect(mockFiles.remove).not.toHaveBeenCalled(); expect(args).toEqual([newRef,42,oldRef]); cb(null,{affectedRows:1}); });
    expect((await request(app()).post('/api/profile/resume').attach('resume', Buffer.from('pdf'), 'a.pdf')).status).toBe(200);
    expect(mockFiles.remove.mock.calls).toEqual([[oldRef]]);
});
test('concurrent replacement cleans up its rejected object', async () => {
    db.query.mockImplementationOnce((sql,args,cb) => cb(null,[{ resume_path: oldRef }]))
        .mockImplementationOnce((sql,args,cb) => cb(null,{affectedRows:0}));
    expect((await request(app()).post('/api/profile/resume').attach('resume', Buffer.from('pdf'), 'a.pdf')).status).toBe(409);
    expect(mockFiles.remove.mock.calls).toEqual([[newRef]]);
});
test('oversized uploads are rejected before storage', async () => {
    expect((await request(app()).post('/api/profile/resume').attach('resume', Buffer.alloc(1.5*1024*1024+1), 'a.pdf')).status).toBe(400);
    expect(mockFiles.put).not.toHaveBeenCalled();
});

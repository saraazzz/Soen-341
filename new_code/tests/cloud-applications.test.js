process.env.FILE_STORAGE = 'r2';
const request = require('supertest');
const bcrypt = require('bcrypt');
const mockFiles = { put: jest.fn(), snapshot: jest.fn(), remove: jest.fn(), url: jest.fn() };
jest.mock('../server/cloud-files', () => ({ ...jest.requireActual('../server/cloud-files'), cloudFiles: () => mockFiles }));
jest.mock('mysql2', () => ({ createConnection: jest.fn(() => ({query: jest.fn(), connect: jest.fn()})) }));
const mysql = require('mysql2');
const app = require('../server/server');
const db = mysql.createConnection.mock.results[0].value;
const profile = 'r2/profile-resumes/00000000-0000-4000-8000-000000000000.pdf';
const copy = 'r2/applications/00000000-0000-4000-8000-000000000001.pdf';
let password;
beforeAll(async () => { password = await bcrypt.hash('test-password',4); });
beforeEach(() => { jest.clearAllMocks(); db.query.mockReset(); mockFiles.remove.mockResolvedValue(); mockFiles.snapshot.mockResolvedValue({file:copy, originalName:'resume.pdf', missing:false}); mockFiles.put.mockResolvedValue(copy); });
afterAll(() => delete process.env.FILE_STORAGE);
async function login() {
    db.query.mockImplementationOnce((sql,args,cb) => cb(null,[{id:42,role:'job_seeker',password}]));
    const agent = request.agent(app);
    expect((await agent.post('/api/login').send({email:'test@example.com',password:'test-password'})).status).toBe(200);
    return agent;
}
const fields = { phone:'', address:'', postalCode:'', linkedinUrl:'', portfolioUrl:'', workAuthorization:'', availabilityDate:'', salaryMin:'', salaryMax:'', relevantExperience:'', coverNote:'', jobId:7, firstName:'Alex', lastName:'Applicant', email:'test@example.com', resumeChoice:'profile' };
function job() { db.query.mockImplementationOnce((sql,args,cb) => cb(null,[{id:7,archived_at:null,deadline_passed:0,employer_id:99,title:'Engineer'}])); }
test('profile application saves an independent R2 copy in the database', async () => {
    const agent = await login(); job();
    db.query.mockImplementationOnce((sql,args,cb) => cb(null,[{resume_path:profile}]))
      .mockImplementationOnce((sql,args,cb) => { expect(args[17]).toBe(copy); cb(null,{affectedRows:1,insertId:101}); })
      .mockImplementationOnce((sql,args,cb) => cb(null,{insertId:1}));
    expect((await agent.post('/api/applications').send(fields)).status).toBe(201);
    expect(mockFiles.snapshot).toHaveBeenCalledWith(profile);
    expect(mockFiles.remove).not.toHaveBeenCalled();
});
test('duplicate submission waits for deletion of its new cloud attachment', async () => {
    const agent = await login(); job();
    db.query.mockImplementationOnce((sql,args,cb) => cb({code:'ER_DUP_ENTRY'}));
    let removed = false;
    mockFiles.remove.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve,5)); removed = true; });
    const response = await agent.post('/api/applications').field({...fields,resumeChoice:'upload'}).attach('resume',Buffer.from('pdf'),'resume.pdf');
    expect(response.status).toBe(409); expect(removed).toBe(true);
    expect(mockFiles.remove).toHaveBeenCalledWith(copy);
});
test('another seeker cannot get a signed application resume URL', async () => {
    const agent = await login();
    db.query.mockImplementationOnce((sql,args,cb) => cb(null,[{id:1,job_seeker_id:99,submitted_resume_file:copy}]));
    const response = await agent.get('/api/applications/1/resume');
    expect([403,404]).toContain(response.status);
    expect(mockFiles.url).not.toHaveBeenCalled();
});

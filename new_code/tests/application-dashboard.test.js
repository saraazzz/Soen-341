
const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("mysql2", () => ({
    createConnection: jest.fn(() => ({
        query: jest.fn(),
        connect: jest.fn()
    }))
}));

const mysql = require("mysql2");
const app = require("../server/server");
const db = mysql.createConnection.mock.results[0].value;

let password;

beforeAll(async () => {
    password = await bcrypt.hash("test-password", 4);
});

beforeEach(() => db.query.mockReset());

async function login() {
    db.query.mockImplementationOnce((sql, params, cb) =>
        cb(null, [{ id: 42, role: "job_seeker", password }])
    );

    const agent = request.agent(app);

    const response = await agent.post("/api/login").send({
        email: "demo@example.com",
        password: "test-password"
    });

    expect(response.status).toBe(200);
    return agent;
}

const applications = [
    {
        id: 1,
        job_seeker_id: 42,
        job_id: 7,
        status: "Applied",
        applied_at: new Date().toISOString(),
        title: "Developer",
        location: "Montreal",
        job_type: "Full-time",
        company_name: "Demo Company",
        has_submitted_resume: 0
    },
    {
        id: 2,
        job_seeker_id: 42,
        job_id: 8,
        status: "Interview",
        applied_at: new Date().toISOString(),
        title: "Software Engineer",
        location: "Montreal",
        job_type: "Full-time",
        company_name: "Another Company",
        has_submitted_resume: 0
    }
];

test("job seeker can view application history", async () => {
    const agent = await login();

    db.query.mockImplementationOnce((sql, params, cb) => {
        expect(params).toEqual([42]);
        cb(null, applications);
    });

    const response = await agent.get("/api/applications/mine");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].title).toBe("Developer");
});

test("job seeker can view application analytics", async () => {
    const agent = await login();

    db.query.mockImplementationOnce((sql, params, cb) => {
        cb(null, applications);
    });

    const response = await agent.get("/api/applications/mine/analytics");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.byStatus.Applied).toBe(1);
    expect(response.body.byStatus.Interview).toBe(1);
});

test("logged-out users cannot view application history", async () => {
    const response = await request(app).get("/api/applications/mine");

    expect(response.status).toBe(401);
});

test("logged-out users cannot view application analytics", async () => {
    const response = await request(app).get("/api/applications/mine/analytics");

    expect(response.status).toBe(401);
});

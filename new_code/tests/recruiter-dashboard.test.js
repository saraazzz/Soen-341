
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
        cb(null, [{ id: 42, role: "employer", password }])
    );

    const agent = request.agent(app);

    const response = await agent.post("/api/login").send({
        email: "demo@example.com",
        password: "test-password"
    });

    expect(response.status).toBe(200);
    return agent;
}

test("recruiter can view their job postings", async () => {
    const agent = await login();

    db.query.mockImplementationOnce((sql, params, cb) => {
        expect(params).toEqual([42]);
        cb(null, [
            { id: 7, title: "Developer", company: "Demo Company" }
        ]);
    });

    const response = await agent.get("/api/employer/jobs");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].title).toBe("Developer");
});

test("recruiter can view applications received", async () => {
    const agent = await login();

    db.query.mockImplementationOnce((sql, params, cb) => {
        expect(params).toEqual([42]);
        cb(null, [
            {
                id: 1,
                job_id: 7,
                status: "Applied",
                job_title: "Developer",
                email: "candidate@example.com",
                first_name: "Alex",
                last_name: "Smith",
                phone: "555-0100",
                address: "123 Main Street",
                postal_code: "H2X 1Y4",
                linkedin_url: "https://linkedin.com/in/alex",
                portfolio_url: "https://alex.example.com",
                work_authorization: "authorized_no_sponsorship",
                availability_date: "2026-12-01",
                salary_min: 70000,
                salary_max: 90000,
                salary_currency: "CAD",
                relevant_experience: "Built and maintained web applications.",
                cover_letter_path: "1731720000000-0123456789abcdef-cover-letter.pdf",
                has_submitted_resume: 0
            }
        ]);
    });

    const response = await agent.get("/api/employer/applications");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
        job_title: "Developer",
        phone: "555-0100",
        address: "123 Main Street",
        postal_code: "H2X 1Y4",
        linkedin_url: "https://linkedin.com/in/alex",
        portfolio_url: "https://alex.example.com",
        work_authorization: "authorized_no_sponsorship",
        availability_date: "2026-12-01",
        salary_min: 70000,
        salary_max: 90000,
        salary_currency: "CAD",
        relevant_experience: "Built and maintained web applications.",
        has_additional_document: true,
        additional_document_name: "cover-letter.pdf"
    });
});

test("recruiter can open an additional document for their application", async () => {
    const agent = await login();
    db.query.mockImplementationOnce((sql, params, callback) => {
        expect(params).toEqual([1, 42]);
        expect(sql).toContain("applications.cover_letter_path");
        callback(null, [{
            id: 1,
            employer_id: 42,
            cover_letter_path: "uploads/missing-letter.pdf"
        }]);
    });

    const response = await agent.get("/api/employer/applications/1/additional-document");

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/no longer available/i);
});

test("recruiter can update an applicant's status", async () => {
    const agent = await login();

    db.query.mockImplementationOnce((sql, params, cb) => {
        expect(params).toEqual([1, 42]);
        cb(null, [{ id: 1 }]);
    });

    db.query.mockImplementationOnce((sql, params, cb) => {
        expect(params).toEqual(["Interview", 1]);
        cb(null, { affectedRows: 1 });
    });

    const response = await agent
        .put("/api/employer/applications/1")
        .send({ status: "Interview" });

    expect(response.status).toBe(200);
    expect(response.body.application.status).toBe("Interview");
});

test("recruiter cannot update another recruiter's application", async () => {
    const agent = await login();
    db.query.mockClear();

    db.query.mockImplementationOnce((sql, params, cb) => {
        cb(null, []);
    });

    const response = await agent
        .put("/api/employer/applications/1")
        .send({ status: "Rejected" });

    expect(response.status).toBe(404);
    expect(db.query).toHaveBeenCalledTimes(1);
});


const fs = require("fs");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcrypt");
const { PROFILE_RESUME_DIR } = require("../server/application-resumes");

jest.mock("mysql2", () => ({
    createConnection: jest.fn(() => ({
        query: jest.fn(),
        connect: jest.fn()
    }))
}));

const mysql = require("mysql2");
const app = require("../server/server");
const db = mysql.createConnection.mock.results[0].value;

const RESUME_DIR = path.resolve("public/uploads");
const RESUME_PATH = path.join(RESUME_DIR, "feedback-test.pdf");
const PRIVATE_RESUME_PATH = path.join(PROFILE_RESUME_DIR, "feedback-private-test.pdf");
const originalFetch = global.fetch;

let password;

const mockFeedback = {
    overallScore: 85,
    matchScore: 90,
    summary: "A strong resume with relevant experience.",
    strengths: ["Good technical skills", "Relevant project experience"],
    gapsVsPosting: [
        {
            requirement: "JavaScript experience",
            status: "met",
            evidence: "JavaScript listed in skills"
        }
    ],
    suggestedEdits: [
        {
            section: "Projects",
            suggestion: "Add more details about project contributions."
        }
    ],
    atsTips: ["Use clear section headings"]
};

async function login(role = "job_seeker") {
    db.query.mockImplementationOnce((sql, params, callback) =>
        callback(null, [{ id: 42, role, password }])
    );

    const agent = request.agent(app);

    const response = await agent.post("/api/login").send({
        email: "seeker@example.com",
        password: "test-password"
    });

    expect(response.status).toBe(200);
    return agent;
}

beforeAll(async () => {
    password = await bcrypt.hash("test-password", 4);
    process.env.GEMINI_API_KEY = "test-api-key";
    app.set("db", db);
});

beforeEach(() => {
    db.query.mockReset();
    global.fetch = jest.fn();
    app.set("db", db);
});

afterEach(() => {
    if (fs.existsSync(RESUME_PATH)) {
        fs.unlinkSync(RESUME_PATH);
    }
    if (fs.existsSync(PRIVATE_RESUME_PATH)) {
        fs.unlinkSync(PRIVATE_RESUME_PATH);
    }
});

afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
});

// 1. Users must be logged in.
test("unauthenticated users cannot access resume feedback", async () => {
    const response = await request(app)
        .post("/api/feedback")
        .send({});

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Please log in first.");
    expect(db.query).not.toHaveBeenCalled();
});

// 2. Only job seekers can use AI feedback.
test("employers cannot access resume feedback", async () => {
    const agent = await login("employer");
    db.query.mockClear();

    const response = await agent
        .post("/api/feedback")
        .send({});

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(
        "Only job seekers can use resume feedback."
    );
    expect(db.query).not.toHaveBeenCalled();
});

// 3. A resume must exist in the user's profile.
test("job seekers without an uploaded resume receive an error", async () => {
    const agent = await login();
    db.query.mockClear();

    db.query.mockImplementationOnce((sql, params, callback) => {
        expect(params).toEqual([42]);
        callback(null, [{ resume_path: null }]);
    });

    const response = await agent
        .post("/api/feedback")
        .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
        "Upload a resume to your profile first."
    );
    expect(global.fetch).not.toHaveBeenCalled();
});

// 4. A valid resume receives structured AI feedback.
test("valid resume returns AI-generated feedback and recommendations", async () => {
   fs.mkdirSync(PROFILE_RESUME_DIR, { recursive: true });
   fs.writeFileSync(PRIVATE_RESUME_PATH, "Test private resume PDF content");

    const agent = await login();
    db.query.mockClear();

    db.query.mockImplementationOnce((sql, params, callback) => {
        expect(params).toEqual([42]);
        callback(null, [{ resume_path: "feedback-private-test.pdf" }]);
    });

    global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
            candidates: [{
                content: {
                    parts: [{
                        text: JSON.stringify(mockFeedback)
                    }]
                }
            }]
        })
    });

    const response = await agent
        .post("/api/feedback")
        .send({
            jobPosting: "Looking for a software developer with JavaScript experience."
        });

    expect(response.status).toBe(200);
    expect(response.body.overallScore).toBe(85);
    expect(response.body.matchScore).toBe(90);
    expect(response.body.strengths).toContain("Good technical skills");
    expect(response.body.suggestedEdits.length).toBeGreaterThan(0);
    expect(response.body.atsTips.length).toBeGreaterThan(0);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const apiCall = global.fetch.mock.calls[0];
    expect(apiCall[0]).toContain("generateContent");
    expect(apiCall[1].headers["x-goog-api-key"]).toBe("test-api-key");
});

// 5. Gemini API errors are handled properly.
test("Gemini API failure returns an error instead of crashing", async () => {
    fs.mkdirSync(RESUME_DIR, { recursive: true });
    fs.writeFileSync(RESUME_PATH, "Test resume PDF content");

    const agent = await login();
    db.query.mockClear();

    db.query.mockImplementationOnce((sql, params, callback) => {
        callback(null, [{ resume_path: "uploads/feedback-test.pdf" }]);
    });

    global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error"
    });

    const errorSpy = jest.spyOn(console, "error")
        .mockImplementation(() => {});

    try {
        const response = await agent
            .post("/api/feedback")
            .send({});

        expect(response.status).toBe(502);
        expect(response.body.error).toBe(
            "AI service error. Check the API key and model name."
        );
    } finally {
        errorSpy.mockRestore();
    }
});

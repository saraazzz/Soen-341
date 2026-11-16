const fs = require("fs");
const request = require("supertest");
const bcrypt = require("bcrypt");
const { APPLICATION_RESUME_DIR } = require("../server/application-resumes");

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

test("a profile-resume application checks availability and inserts only once", async () => {
    const agent = await login();
    db.query.mockClear();
    let insertSql;
    let insertParams;

    db.query.mockImplementationOnce((sql, params, callback) => {
        expect(sql).toContain("FROM jobs");
        expect(params).toEqual([7]);
        callback(null, [{ id: 7, archived_at: null, deadline_passed: 0 }]);
    });
    db.query.mockImplementationOnce((sql, params, callback) => {
        expect(params).toEqual([42]);
        callback(null, [{ resume_path: null }]);
    });
    db.query.mockImplementationOnce((sql, params, callback) => {
        insertSql = sql;
        insertParams = params;
        callback(null, { affectedRows: 1, insertId: 101 });
    });

    const response = await agent.post("/api/applications").send({
        jobId: 7,
        firstName: "Alex",
        lastName: "Applicant",
        email: "alex@example.com",
        phone: "",
        address: "",
        postalCode: "",
        linkedinUrl: "",
        portfolioUrl: "",
        workAuthorization: "",
        availabilityDate: "",
        salaryMin: "",
        salaryMax: "",
        relevantExperience: "",
        coverNote: "Interested in this role.",
        resumeChoice: "profile"
    });

    expect(response.status).toBe(201);
    expect(insertSql).toContain("submitted_resume_file");
    expect(insertSql).toContain("WHERE id = ? AND archived_at IS NULL");
    expect(insertParams).toEqual([
        7, 42, "Interested in this role.", null,
        "Alex", "Applicant", "alex@example.com",
        null, null, null, null, null, null,
        null, null, null, null, null, null, 7
    ]);
    expect(response.body.application.id).toBe(101);
    expect(db.query).toHaveBeenCalledTimes(3);
});

test("an uploaded additional document stays private and is downloadable by its employer", async () => {
    const seeker = await login();
    db.query.mockClear();

    let insertParams;
    db.query.mockImplementationOnce((sql, params, callback) => {
        callback(null, [{ id: 7, archived_at: null, deadline_passed: 0 }]);
    });
    db.query.mockImplementationOnce((sql, params, callback) => {
        insertParams = params;
        callback(null, { affectedRows: 1, insertId: 101 });
    });

    const response = await seeker.post("/api/applications")
        .field("jobId", "7")
        .field("resumeChoice", "upload")
        .field("firstName", "Alex")
        .field("lastName", "Applicant")
        .field("email", "alex@example.com")
        .field("phone", "")
        .field("address", "")
        .field("postalCode", "")
        .field("linkedinUrl", "")
        .field("portfolioUrl", "")
        .field("workAuthorization", "")
        .field("availabilityDate", "")
        .field("salaryMin", "")
        .field("salaryMax", "")
        .field("relevantExperience", "")
        .field("coverNote", "")
        .attach("resume", Buffer.from("resume contents"), "resume.pdf")
        .attach("coverLetter", Buffer.from("additional document contents"), "cover-letter.pdf");

    expect(response.status).toBe(201);
    const coverLetterPath = insertParams[3];
    const submittedResumeFile = insertParams[17];
    try {
        expect(coverLetterPath).toMatch(/^\d+-[0-9a-f]{16}-cover-letter\.pdf$/i);
        expect(fs.existsSync(`${APPLICATION_RESUME_DIR}/${coverLetterPath}`)).toBe(true);

        const employer = await login("employer");
        db.query.mockImplementationOnce((sql, params, callback) => {
            expect(params).toEqual([101, 42]);
            callback(null, [{
                id: 101,
                employer_id: 42,
                cover_letter_path: coverLetterPath
            }]);
        });

        const documentResponse = await employer.get("/api/employer/applications/101/additional-document");
        expect(documentResponse.status).toBe(200);
        expect(documentResponse.body.toString()).toBe("additional document contents");
    } finally {
        [coverLetterPath, submittedResumeFile].forEach((fileName) => {
            const filePath = `${APPLICATION_RESUME_DIR}/${fileName}`;
            if (fileName && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    }
});

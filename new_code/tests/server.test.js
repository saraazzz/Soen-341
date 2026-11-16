
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

describe("Sprint 3 - CareerConnect Tests", () => {

    beforeEach(() => {
        db.query.mockReset();
    });

    // Helper: log in as an employer or job seeker.
    async function loginAs(role) {
        const agent = request.agent(app);

        const userId = role === "employer" ? 50 : 42;
        const email = role === "employer"
            ? "employer@example.com"
            : "seeker@example.com";

        const password = "Password123!";
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query.mockImplementation((sql, values, callback) => {
            if (sql.toLowerCase().includes("from users")) {
                callback(null, [{
                    id: userId,
                    email,
                    password: hashedPassword,
                    role
                }]);
            } else {
                callback(null, [{
                    id: userId,
                    first_name: "Test",
                    last_name: "User",
                    company_name: "Test Company"
                }]);
            }
        });

        const response = await agent.post("/api/login").send({
            email,
            password
        });

        expect(response.status).toBe(200);

        return agent;
    }

    // --------------------------------------------------
    // 1. Recruiter Dashboard and Job Posting Management
    // --------------------------------------------------

    describe("Job posting authorization and validation", () => {

        test("POST /api/jobs should reject users who are not logged in", async () => {
            const response = await request(app)
                .post("/api/jobs")
                .send({
                    title: "Software Developer",
                    company: "Test Company",
                    location: "Montreal",
                    category: "Technology",
                    job_type: "Internship",
                    description: "A software internship."
                });

            expect(response.status).toBe(401);
        });

        test("POST /api/jobs should reject job seekers", async () => {
            const agent = await loginAs("job_seeker");

            const response = await agent.post("/api/jobs").send({
                title: "Software Developer",
                company: "Test Company",
                location: "Montreal",
                category: "Technology",
                job_type: "Internship",
                description: "A software internship."
            });

            expect(response.status).toBe(403);
        });

        test("POST /api/jobs should reject incomplete job details", async () => {
            const agent = await loginAs("employer");

            const response = await agent.post("/api/jobs").send({
                title: "Software Developer"
            });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe("All fields are required.");
        });

        test("POST /api/jobs should reject an invalid job type", async () => {
            const agent = await loginAs("employer");

            const response = await agent.post("/api/jobs").send({
                title: "Software Developer",
                company: "Test Company",
                location: "Montreal",
                category: "Technology",
                job_type: "Invalid Type",
                description: "A software internship."
            });

            expect(response.status).toBe(400);
        });
    });

    describe("Recruiter job listings", () => {

        test("Employer can view their job postings", async () => {
            const agent = await loginAs("employer");

            db.query.mockImplementation((sql, values, callback) => {
                callback(null, [
                    {
                        id: 10,
                        title: "Software Developer",
                        location: "Montreal",
                        job_type: "Internship",
                        description: "Develop software applications.",
                        status: "open"
                    },
                    {
                        id: 11,
                        title: "Web Developer",
                        location: "Quebec",
                        job_type: "Full-time",
                        description: "Develop websites.",
                        status: "open"
                    }
                ]);
            });

            const response = await agent.get("/api/employer/jobs");

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body[0].title).toBe("Software Developer");
            expect(response.body[1].title).toBe("Web Developer");
        });

        test("Job seeker cannot view employer job postings", async () => {
            const agent = await loginAs("job_seeker");

            const response = await agent.get("/api/employer/jobs");

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Only employers can view their job postings."
            );
        });

        test("Unauthenticated user cannot view employer job postings", async () => {
            const response = await request(app).get("/api/employer/jobs");

            expect(response.status).toBe(401);
        });
    });

    describe("Recruiter applicant lists", () => {

        test("Employer can view applicants", async () => {
            const agent = await loginAs("employer");

            db.query.mockImplementation((sql, values, callback) => {
                callback(null, []);
            });

            const response = await agent.get("/api/employer/applications");

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);

            // Verify that the employer ID is used in the database query.
            expect(db.query).toHaveBeenCalledWith(
                expect.any(String),
                [50],
                expect.any(Function)
            );
        });

        test("Job seeker cannot view recruiter applicants", async () => {
            const agent = await loginAs("job_seeker");

            const response = await agent.get("/api/employer/applications");

            expect(response.status).toBe(403);
            expect(response.body.message).toBe(
                "Only employers can view applicants."
            );
        });

        test("Unauthenticated user cannot view recruiter applicants", async () => {
            const response = await request(app)
                .get("/api/employer/applications");

            expect(response.status).toBe(401);
        });
    });

    // --------------------------------------------------
    // 2. Application Status Tracking
    // --------------------------------------------------

    describe("Application status updates", () => {

        test("PUT /api/employer/applications/:id should update application status", async () => {
            const agent = await loginAs("employer");

            db.query.mockImplementation((sql, values, callback) => {
                const normalizedSql = sql.toLowerCase();

                // Confirm that the application belongs to this employer.
                if (
                    normalizedSql.includes("from applications") &&
                    normalizedSql.includes("join jobs")
                ) {
                    callback(null, [{ id: 77 }]);
                }

                // Simulate a successful status update.
                else if (normalizedSql.includes("update applications")) {
                    callback(null, { affectedRows: 1 });
                } else {
                    callback(null, []);
                }
            });

            const response = await agent
                .put("/api/employer/applications/77")
                .send({ status: "Interview" });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe(
                "Application status updated."
            );
            expect(response.body.application.status).toBe("Interview");
        });

        test("Should reject another employer's application", async () => {
            const agent = await loginAs("employer");

            db.query.mockImplementation((sql, values, callback) => {
                callback(null, []);
            });

            const response = await agent
                .put("/api/employer/applications/77")
                .send({ status: "Interview" });

            expect(response.status).toBe(404);
            expect(response.body.message).toBe(
                "That application could not be found."
            );
        });

        test("Should reject an invalid application ID", async () => {
            const agent = await loginAs("employer");

            const response = await agent
                .put("/api/employer/applications/abc")
                .send({ status: "Interview" });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(
                "A valid application is required."
            );
        });

        test("Should reject an invalid application status", async () => {
            const agent = await loginAs("employer");

            const response = await agent
                .put("/api/employer/applications/77")
                .send({ status: "Pending" });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(
                "Status must be Applied, Under Review, Interview, Offered, or Rejected."
            );
        });

        test.each([
            "Applied",
            "Under Review",
            "Interview",
            "Offered",
            "Rejected"
        ])("Should accept application status: %s", async (status) => {
            const agent = await loginAs("employer");

            db.query.mockImplementation((sql, values, callback) => {
                const normalizedSql = sql.toLowerCase();

                if (
                    normalizedSql.includes("from applications") &&
                    normalizedSql.includes("join jobs")
                ) {
                    callback(null, [{ id: 77 }]);
                } else if (
                    normalizedSql.includes("update applications")
                ) {
                    callback(null, { affectedRows: 1 });
                } else {
                    callback(null, []);
                }
            });

            const response = await agent
                .put("/api/employer/applications/77")
                .send({ status });

            expect(response.status).toBe(200);
            expect(response.body.application.status).toBe(status);
        });
    });
});


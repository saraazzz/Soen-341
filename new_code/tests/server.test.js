
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

describe("CareerConnect API Tests", () => {

    beforeEach(() => {
        db.query.mockReset();
    });

    test("GET /api/test should confirm that the server is working", async () => {
        const response = await request(app).get("/api/test");

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("The server is working!");
    });

    test("POST /api/login should reject an unknown email", async () => {
        db.query.mockImplementation((sql, values, callback) => {
            callback(null, []);
        });

        const response = await request(app)
            .post("/api/login")
            .send({
                email: "unknown@example.com",
                password: "Password123!"
            });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid email or password.");
    });

    test("GET /api/profile should reject users who are not logged in", async () => {
        const response = await request(app).get("/api/profile");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Not logged in.");
    });

    test("A user with valid credentials should log in and access their profile", async () => {
        const hashedPassword = await bcrypt.hash("Password123!", 10);

        db.query
            .mockImplementationOnce((sql, values, callback) => {
                callback(null, [{
                    id: 42,
                    email: "test@example.com",
                    password: hashedPassword,
                    role: "job_seeker"
                }]);
            })
            .mockImplementationOnce((sql, values, callback) => {
                callback(null, [{
                    id: 42,
                    email: "test@example.com",
                    role: "job_seeker",
                    first_name: "Test",
                    last_name: "User"
                }]);
            });

        const agent = request.agent(app);

        const loginResponse = await agent
            .post("/api/login")
            .send({
                email: "test@example.com",
                password: "Password123!"
            });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.message).toBe("Login successful!");
        expect(loginResponse.body.role).toBe("job_seeker");

        const profileResponse = await agent.get("/api/profile");

        expect(profileResponse.status).toBe(200);
        expect(profileResponse.body.email).toBe("test@example.com");
        expect(profileResponse.body.first_name).toBe("Test");
    });

    test("POST /api/login should reject an incorrect password", async () => {
    const hashedPassword = await bcrypt.hash("CorrectPassword123!", 10);

    db.query.mockImplementation((sql, values, callback) => {
        callback(null, [{
            id: 42,
            email: "test@example.com",
            password: hashedPassword,
            role: "job_seeker"
        }]);
    });

    const response = await request(app)
        .post("/api/login")
        .send({
            email: "test@example.com",
            password: "WrongPassword123!"
        });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password.");
});



test("POST /api/register/job-seeker should create an account", async () => {

    db.query
        .mockImplementationOnce((sql, values, callback) => {
            callback(null, { insertId: 101 });
        })
        .mockImplementationOnce((sql, values, callback) => {
            callback(null, { affectedRows: 1 });
        });

    const response = await request(app)
        .post("/api/register/job-seeker")
        .send({
            firstName: "Alex",
            lastName: "Smith",
            email: "alex@example.com",
            password: "Password123!"
        });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
        "Job Seeker account created successfully!"
    );
});

test("POST /api/register/employer should reject a duplicate email", async () => {

    db.query.mockImplementation((sql, values, callback) => {
        const error = new Error("Duplicate email");
        error.code = "ER_DUP_ENTRY";
        callback(error);
    });

    const response = await request(app)
        .post("/api/register/employer")
        .send({
            companyName: "Test Company",
            contactName: "Alex Smith",
            email: "existing@example.com",
            password: "Password123!"
        });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
        "That email is already being used."
    );
});



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
    const agent = request.agent(app);

    // Log in as a job seeker
    db.query.mockImplementationOnce((sql, values, callback) => {
        callback(null, [{
            id: 42,
            email: "seeker@example.com",
            password: require("bcrypt").hashSync("Password123!", 10),
            role: "job_seeker"
        }]);
    });

    const login = await agent.post("/api/login").send({
        email: "seeker@example.com",
        password: "Password123!"
    });

    expect(login.status).toBe(200);

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
    const agent = request.agent(app);

    db.query.mockImplementationOnce((sql, values, callback) => {
        callback(null, [{
            id: 50,
            email: "employer@example.com",
            password: require("bcrypt").hashSync("Password123!", 10),
            role: "employer"
        }]);
    });

    const login = await agent.post("/api/login").send({
        email: "employer@example.com",
        password: "Password123!"
    });

    expect(login.status).toBe(200);

    const response = await agent.post("/api/jobs").send({
        title: "Software Developer"
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("All fields are required.");
});

test("POST /api/jobs should reject an invalid job type", async () => {
    const agent = request.agent(app);

    db.query.mockImplementationOnce((sql, values, callback) => {
        callback(null, [{
            id: 50,
            email: "employer@example.com",
            password: require("bcrypt").hashSync("Password123!", 10),
            role: "employer"
        }]);
    });

    const login = await agent.post("/api/login").send({
        email: "employer@example.com",
        password: "Password123!"
    });

    expect(login.status).toBe(200);

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


test("GET /api/employer/applications should reject users who are not logged in", async () => {
    const response = await request(app)
        .get("/api/employer/applications");

    expect(response.status).toBe(401);
});

test("GET /api/employer/applications should reject job seekers", async () => {
    const agent = await loginAs("job_seeker");

    const response = await agent
        .get("/api/employer/applications");

    expect(response.status).toBe(403);
});

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

test("PUT /api/employer/applications/:id should reject another employer's application", async () => {
    const agent = await loginAs("employer");

    // Simulate an application that does not belong to this employer.
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


});

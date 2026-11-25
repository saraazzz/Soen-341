const request = require("supertest");
jest.mock("mysql2", () => ({ createConnection: jest.fn(() => ({ query: jest.fn(), connect: jest.fn() })) }));
const mysql = require("mysql2");
const app = require("../server/server");
const db = mysql.createConnection.mock.results[0].value;
beforeEach(() => db.query.mockReset());

test("liveness needs neither a login nor a database", async () => {
    const response = await request(app).get("/health/live");
    expect(response.status).toBe(200);
    expect(db.query).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
});

test.each([[null, 200], [new Error("private connection details"), 503]])(
    "readiness reports database availability without leaking connection details", async (error, status) => {
        db.query.mockImplementationOnce((options, cb) => {
            expect(options.timeout).toBe(3000);
            cb(error);
        });
        const response = await request(app).get("/health/ready");
        expect(response.status).toBe(status);
        expect(response.text).not.toMatch(/private connection details/);
        expect(response.headers["cache-control"]).toBe("no-store");
    }
);

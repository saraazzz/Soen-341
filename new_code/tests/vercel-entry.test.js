const request = require("supertest");
jest.mock("mysql2", () => ({
    createConnection: jest.fn(),
    createPool: jest.fn(() => ({ query: jest.fn() }))
}));
jest.mock("mysql2/promise", () => ({
    createPool: jest.fn(() => ({ query: jest.fn() }))
}));

const originalVercel = process.env.VERCEL;
process.env.VERCEL = "1";
const mysql = require("mysql2");
const mysqlPromise = require("mysql2/promise");
const app = require("../index");
afterAll(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
});

test("Vercel import creates pools without issuing schema changes or opening a listener", () => {
    expect(mysql.createConnection).not.toHaveBeenCalled();
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({ connectionLimit: 2 }));
    expect(mysql.createPool.mock.results[0].value.query).not.toHaveBeenCalled();
    expect(mysqlPromise.createPool.mock.results[0].value.query).not.toHaveBeenCalled();
});

test("Vercel entry dispatches liveness and database readiness to the application", async () => {
    expect((await request(app).get("/health/live")).status).toBe(200);
    mysql.createPool.mock.results[0].value.query.mockImplementationOnce((options, callback) => callback(null, []));
    const result = await request(app).get("/health/ready");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ready" });
});

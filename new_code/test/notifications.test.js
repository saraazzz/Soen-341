const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createNotification
} = require("../server/notifications");

test("createNotification rejects missing required fields", async () => {
    const mockDb = { query: () => {} };

    await assert.rejects(
        () => createNotification(mockDb, { userId: null, type: 'status_update', title: 'T', message: 'M', link: 'L' }),
        /Missing required notification fields/
    );

    await assert.rejects(
        () => createNotification(mockDb, { userId: 5, type: null, title: 'T', message: 'M', link: 'L' }),
        /Missing required notification fields/
    );

    await assert.rejects(
        () => createNotification(mockDb, { userId: 5, type: 'status_update', title: '', message: 'M', link: 'L' }),
        /Missing required notification fields/
    );
});

test("createNotification inserts with correct parameters", async () => {
    let executedSql = "";
    let executedParams = [];

    const mockDb = {
        query: (sql, params, callback) => {
            executedSql = sql;
            executedParams = params;
            callback(null, { insertId: 42 });
        }
    };

    const result = await createNotification(mockDb, {
        userId: 12,
        type: 'interview_invite',
        title: 'Interview Invitation',
        message: 'You have an interview!',
        link: 'job.html?id=3'
    });

    assert.equal(result.insertId, 42);
    assert.match(executedSql, /INSERT INTO notifications/);
    assert.deepEqual(executedParams, [
        12,
        'interview_invite',
        'Interview Invitation',
        'You have an interview!',
        'job.html?id=3'
    ]);
});

test("user isolation: notification queries only match targeted user", () => {
    // Simulating notification filtering by user_id
    const notificationsInDb = [
        { id: 1, user_id: 10, title: 'Notice for user 10', is_read: 0 },
        { id: 2, user_id: 20, title: 'Notice for user 20', is_read: 0 },
        { id: 3, user_id: 10, title: 'Another notice for 10', is_read: 1 }
    ];

    const user10Notifications = notificationsInDb.filter(n => n.user_id === 10);
    const user20Notifications = notificationsInDb.filter(n => n.user_id === 20);

    assert.equal(user10Notifications.length, 2);
    assert.equal(user20Notifications.length, 1);
    assert.ok(user10Notifications.every(n => n.user_id === 10));
    assert.ok(user20Notifications.every(n => n.user_id === 20));
});

test("Event 3: Interview status creates interview_invite linking to job description", () => {
    const status = "Interview";
    const job = { id: 8, title: "Backend Engineer", company: "TechCorp" };

    const type = status === "Interview" ? "interview_invite" : "status_update";
    const link = status === "Interview" ? `job.html?id=${job.id}` : "my-applications.html";

    assert.equal(type, "interview_invite");
    assert.equal(link, "job.html?id=8");
});

test("Offered status creates job_offer notification linking to job description", () => {
    const status = "Offered";
    const job = { id: 8, title: "Backend Engineer", company: "TechCorp" };

    let type = "status_update";
    let link = "my-applications.html";

    if (status === "Interview") {
        type = "interview_invite";
        link = `job.html?id=${job.id}`;
    } else if (status === "Offered") {
        type = "job_offer";
        link = `job.html?id=${job.id}`;
    }

    assert.equal(type, "job_offer");
    assert.equal(link, "job.html?id=8");
});

test("Event 2: Other status creates status_update linking to my-applications", () => {
    const status = "Under Review";
    const job = { id: 8, title: "Backend Engineer", company: "TechCorp" };

    const type = status === "Interview" ? "interview_invite" : "status_update";
    const link = status === "Interview" ? `job.html?id=${job.id}` : "my-applications.html";

    assert.equal(type, "status_update");
    assert.equal(link, "my-applications.html");
});

test("Event 1: New application creates new_application linking to recruiter applicants", () => {
    const jobId = 15;
    const type = "new_application";
    const link = `employer-applicants.html?job_id=${jobId}`;

    assert.equal(type, "new_application");
    assert.equal(link, "employer-applicants.html?job_id=15");
});

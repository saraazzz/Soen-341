
const {
    createNotification
} = require("../server/notifications");

describe("Notification Helper Unit Tests", () => {

    test("successfully creates a notification", async () => {
        // Mock database query.
        const db = {
            query: jest.fn((sql, values, callback) => {
                callback(null, {
                    insertId: 1,
                    affectedRows: 1
                });
            })
        };

        const notification = {
            userId: 5,
            type: "new_application",
            title: "New application",
            message: "A candidate applied for your job.",
            link: "applications.html"
        };

        const result = await createNotification(db, notification);

        expect(result.insertId).toBe(1);
        expect(db.query).toHaveBeenCalledTimes(1);

        expect(db.query.mock.calls[0][1]).toEqual([
            5,
            "new_application",
            "New application",
            "A candidate applied for your job.",
            "applications.html"
        ]);
    });

    test("rejects notification when required fields are missing", async () => {
        const db = {
            query: jest.fn()
        };

        const notification = {
            userId: 5,
            type: "new_application",
            title: "",
            message: "A candidate applied for your job.",
            link: "applications.html"
        };

        await expect(
            createNotification(db, notification)
        ).rejects.toThrow("Missing required notification fields");

        // Database should not be called.
        expect(db.query).not.toHaveBeenCalled();
    });

});


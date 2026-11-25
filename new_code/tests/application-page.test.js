const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const publicDir = path.join(__dirname, "..", "public");
let dom;

// Run the real page scripts against controlled API responses: no database,
// credentials, uploaded files, or live AI requests are needed for these checks.
async function openApplicationPage(submission) {
    dom = new JSDOM(fs.readFileSync(path.join(publicDir, "apply.html"), "utf8"), {
        url: "http://localhost/apply.html?id=7",
        runScripts: "outside-only"
    });
    dom.window.fetch = jest.fn(async (url) => {
        if (url === "/api/profile") return {
            ok: true,
            json: async () => ({ role: "job_seeker", first_name: "Alex", last_name: "Smith",
                email: "alex@example.com", resume_path: "uploads/resume.pdf" })
        };
        if (url === "/api/jobs/7") return {
            ok: true, json: async () => ({ id: 7, title: "Developer", status: "open" })
        };
        if (url === "/api/applications") return submission;
        throw new Error("Unexpected request: " + url);
    });
    dom.window.eval(fs.readFileSync(path.join(publicDir, "applications-common.js"), "utf8"));
    dom.window.eval(fs.readFileSync(path.join(publicDir, "apply.js"), "utf8"));
    await new Promise(setImmediate);
    const form = dom.window.document.getElementById("apply-form");
    form.reportValidity = () => true;
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(setImmediate);
    return dom.window.document;
}

afterEach(() => dom?.window.close());

test.each([
    "This posting is archived and no longer accepts applications.",
    "The application deadline has passed."
])("a posting that closes during submission shows its actual reason: %s", async (message) => {
    const document = await openApplicationPage({
        status: 409, ok: false, json: async () => ({ code: "POSTING_UNAVAILABLE", message })
    });
    expect(document.getElementById("page-message").textContent).toBe(message);
    expect(document.getElementById("page-message").textContent).not.toMatch(/already applied/i);
    expect(document.getElementById("apply-card").hidden).toBe(true);
    expect(document.getElementById("confirmation").hidden).toBe(true);
});

test("a duplicate application still directs the seeker to application history", async () => {
    const document = await openApplicationPage({
        status: 409, ok: false, json: async () => ({ message: "You have already applied to this job." })
    });
    expect(document.getElementById("page-message").textContent).toMatch(/already applied.*My Applications/);
});

test("a successful application still displays confirmation", async () => {
    const document = await openApplicationPage({
        status: 201, ok: true, json: async () => ({ application: { status: "Applied" } })
    });
    expect(document.getElementById("confirmation").hidden).toBe(false);
    expect(document.getElementById("confirmation").textContent).toMatch(/Application submitted successfully/);
});

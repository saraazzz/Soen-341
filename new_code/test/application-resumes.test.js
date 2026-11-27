const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
    snapshotProfileResume,
    storeUploadedFile,
    resolveStoredResume,
    resolveStoredApplicationDocument,
    unlinkPublicUpload,
    migrateLegacyProfileResumes
} = require("../server/application-resumes");

function temporaryDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "careerconnect-"));
}

test("an application stores a copy of the resume that was submitted", () => {
    const sourceRoot = temporaryDirectory();
    const destinationRoot = temporaryDirectory();
    fs.mkdirSync(path.join(sourceRoot, "uploads"));
    fs.writeFileSync(path.join(sourceRoot, "uploads", "resume-a.pdf"), "resume-a bytes");

    const snapshot = snapshotProfileResume({
        sourceRelativePath: "uploads/resume-a.pdf",
        sourceRoot,
        destinationRoot,
        now: 1000,
        randomHex: "aaaa"
    });

    assert.equal(snapshot.file, "1000-aaaa.pdf");
    assert.equal(snapshot.originalName, "resume-a.pdf");
    assert.equal(fs.readFileSync(path.join(destinationRoot, snapshot.file), "utf8"), "resume-a bytes");
});

test("an uploaded application resume is moved into private storage with its original name", () => {
    const sourcePath = path.join(temporaryDirectory(), "upload.tmp");
    const destinationRoot = temporaryDirectory();
    fs.writeFileSync(sourcePath, "uploaded resume bytes");

    const stored = storeUploadedFile({
        sourcePath,
        destinationRoot,
        originalName: "candidate-resume.PDF",
        now: 1500,
        randomHex: "cccc"
    });

    assert.deepEqual(stored, {
        file: "1500-cccc-candidate-resume.PDF",
        originalName: "candidate-resume.PDF",
        missing: false
    });
    assert.equal(fs.existsSync(sourcePath), false);
    assert.equal(fs.readFileSync(path.join(destinationRoot, stored.file), "utf8"), "uploaded resume bytes");
    assert.equal(resolveStoredApplicationDocument(stored.file, destinationRoot, temporaryDirectory()),
        path.join(destinationRoot, stored.file));
});

test("legacy additional documents resolve only inside public uploads", () => {
    const publicRoot = temporaryDirectory();
    const uploadsRoot = path.join(publicRoot, "uploads");
    const outsideRoot = temporaryDirectory();
    fs.mkdirSync(uploadsRoot);
    fs.writeFileSync(path.join(uploadsRoot, "letter.pdf"), "letter bytes");
    fs.writeFileSync(path.join(outsideRoot, "secret.pdf"), "secret bytes");

    assert.equal(
        resolveStoredApplicationDocument("uploads/letter.pdf", temporaryDirectory(), publicRoot),
        path.join(uploadsRoot, "letter.pdf")
    );
    assert.equal(
        resolveStoredApplicationDocument("uploads/../secret.pdf", temporaryDirectory(), publicRoot),
        null
    );
});

test("replacing the profile resume does not change an earlier application resume", () => {
    const sourceRoot = temporaryDirectory();
    const destinationRoot = temporaryDirectory();
    const profileResume = path.join(sourceRoot, "uploads", "resume-a.pdf");
    fs.mkdirSync(path.dirname(profileResume));
    fs.writeFileSync(profileResume, "resume-a bytes");

    const first = snapshotProfileResume({
        sourceRelativePath: "uploads/resume-a.pdf",
        sourceRoot,
        destinationRoot,
        now: 1000,
        randomHex: "aaaa"
    });

    fs.writeFileSync(profileResume, "resume-b bytes");
    const second = snapshotProfileResume({
        sourceRelativePath: "uploads/resume-a.pdf",
        sourceRoot,
        destinationRoot,
        now: 2000,
        randomHex: "bbbb"
    });
    fs.unlinkSync(profileResume);

    assert.notEqual(first.file, second.file);
    assert.equal(fs.readFileSync(path.join(destinationRoot, first.file), "utf8"), "resume-a bytes");
    assert.equal(fs.readFileSync(path.join(destinationRoot, second.file), "utf8"), "resume-b bytes");
    assert.equal(fs.existsSync(profileResume), false);
});

test("an application without a profile resume still has an empty resume reference", () => {
    const snapshot = snapshotProfileResume({
        sourceRelativePath: null,
        sourceRoot: temporaryDirectory(),
        destinationRoot: temporaryDirectory()
    });

    assert.deepEqual(snapshot, { file: null, originalName: null, missing: false });
});

test("a missing profile file does not invent a submitted resume", () => {
    const snapshot = snapshotProfileResume({
        sourceRelativePath: "uploads/missing.pdf",
        sourceRoot: temporaryDirectory(),
        destinationRoot: temporaryDirectory()
    });

    assert.equal(snapshot.file, null);
    assert.equal(snapshot.missing, true);
});

test("resume paths outside the upload directory are rejected", () => {
    const sourceRoot = temporaryDirectory();
    const outside = temporaryDirectory();
    fs.writeFileSync(path.join(outside, "secret.pdf"), "secret");

    assert.throws(
        () => snapshotProfileResume({
            sourceRelativePath: "../secret.pdf",
            sourceRoot,
            destinationRoot: temporaryDirectory()
        }),
        { code: "RESUME_PATH_UNSAFE" }
    );
    assert.equal(resolveStoredResume("../secret.pdf", outside), null);
});

test("replacing a profile resume cannot delete a private application copy", () => {
    const publicRoot = temporaryDirectory();
    const privateRoot = temporaryDirectory();
    const privateResume = path.join(privateRoot, "secret.pdf");
    fs.writeFileSync(privateResume, "keep");

    unlinkPublicUpload(path.relative(publicRoot, privateResume), publicRoot);

    assert.equal(fs.readFileSync(privateResume, "utf8"), "keep");
});

test("legacy resumes are moved out of public uploads", () => {
    const publicRoot = temporaryDirectory();
    const privateRoot = temporaryDirectory();
    const uploadsRoot = path.join(publicRoot, "uploads");

    fs.mkdirSync(uploadsRoot);
    fs.writeFileSync(path.join(uploadsRoot, "resume.pdf"), "resume bytes");

    migrateLegacyProfileResumes(publicRoot, privateRoot);

    assert.equal(fs.existsSync(path.join(uploadsRoot, "resume.pdf")), false);
    assert.equal(fs.readFileSync(path.join(privateRoot, "resume.pdf"), "utf8"), "resume bytes");
});
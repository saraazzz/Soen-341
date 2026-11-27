const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const APPLICATION_RESUME_DIR = path.join(__dirname, "..", "private", "application-resumes");
const PROFILE_RESUME_DIR = process.env.PROFILE_RESUME_DIR
    ? path.resolve(process.env.PROFILE_RESUME_DIR)
    : path.join(__dirname, "..", "private", "profile-resumes");
    
function resolveInside(rootDir, relativePath) {
    if (!relativePath || typeof relativePath !== "string") {
        return null;
    }

    const root = path.resolve(rootDir);
    const resolved = path.resolve(root, relativePath);
    const relative = path.relative(root, resolved);

    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }

    return resolved;
}

function resolveProfileResume(storedPath) {
    if (!storedPath || typeof storedPath !== "string") {
        return null;
    }

    // 1. Check new private location (if stored as bare filename or relative path)
    const privateResolved = resolveInside(PROFILE_RESUME_DIR, path.basename(storedPath));
    if (privateResolved && fs.existsSync(privateResolved) && fs.statSync(privateResolved).isFile()) {
        return privateResolved;
    }

    // 2. Check legacy location (stored like "uploads/123-resume.pdf" inside public/)
    const publicResolved = resolveInside(PUBLIC_DIR, storedPath);
    if (publicResolved && fs.existsSync(publicResolved) && fs.statSync(publicResolved).isFile()) {
        return publicResolved;
    }

    return null;
}

function snapshotProfileResume({
    sourceRelativePath,
    sourceRoot,
    destinationRoot,
    now = Date.now(),
    randomHex
}) {
    if (!sourceRelativePath) {
        return { file: null, originalName: null, missing: false };
    }

    const resolved = resolveProfileResume(sourceRelativePath) || resolveInside(sourceRoot, sourceRelativePath);

    if (!resolved) {
        const error = new Error("Resume path is outside the uploads directory.");
        error.code = "RESUME_PATH_UNSAFE";
        throw error;
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return { file: null, originalName: null, missing: true };
    }

    const originalName = path.basename(resolved);
    const extension = path.extname(originalName).toLowerCase();
    const suffix = randomHex || crypto.randomBytes(8).toString("hex");
    const storedName = `${now}-${suffix}${extension}`;

    fs.mkdirSync(destinationRoot, { recursive: true });
    fs.copyFileSync(resolved, path.join(destinationRoot, storedName));

    return {
        file: storedName,
        originalName,
        missing: false
    };
}

function storeUploadedFile({
    sourcePath,
    destinationRoot,
    originalName,
    now = Date.now(),
    randomHex
}) {
    const safeOriginalName = path.basename(originalName);
    const suffix = randomHex || crypto.randomBytes(8).toString("hex");
    const storedName = `${now}-${suffix}-${safeOriginalName.slice(-200)}`;
    const destination = path.join(destinationRoot, storedName);

    fs.mkdirSync(destinationRoot, { recursive: true });

    try {
        fs.renameSync(sourcePath, destination);
    } catch (error) {
        if (error.code !== "EXDEV") {
            throw error;
        }

        fs.copyFileSync(sourcePath, destination);
        fs.unlinkSync(sourcePath);
    }

    return {
        file: storedName,
        originalName: safeOriginalName,
        missing: false
    };
}

function resolveStoredResume(storedName, destinationRoot) {
    if (!storedName || storedName !== path.basename(storedName)) {
        return null;
    }

    const resolved = resolveInside(destinationRoot, storedName);

    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return null;
    }

    return resolved;
}

function resolveStoredApplicationDocument(storedName, privateRoot, publicRoot) {
    if (!storedName || typeof storedName !== "string") {
        return null;
    }

    if (storedName === path.basename(storedName)) {
        return resolveStoredResume(storedName, privateRoot);
    }

    const legacyPrefix = "uploads/";
    if (!storedName.startsWith(legacyPrefix)) {
        return null;
    }

    const uploadsRoot = path.join(publicRoot, "uploads");
    const resolved = resolveInside(uploadsRoot, storedName.slice(legacyPrefix.length));

   if (!resolved) {
    return null;
}

if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
}

// The startup migration moves legacy documents here while the database
// continues to store paths such as "uploads/letter.pdf".
return resolveStoredResume(path.basename(storedName), PROFILE_RESUME_DIR);
}

function removeStoredResume(storedName, destinationRoot) {
    const resolved = resolveStoredResume(storedName, destinationRoot);

    if (resolved) {
        fs.unlinkSync(resolved);
    }
}

function unlinkPublicUpload(relativePath, publicRoot) {
    const resolved = resolveInside(publicRoot, relativePath);

    if (!resolved) {
        return;
    }

    fs.unlink(resolved, () => {});
}

function unlinkProfileResume(storedPath) {
    const resolved = resolveProfileResume(storedPath);
    if (resolved) {
        fs.unlink(resolved, () => {});
    }
}

function migrateLegacyProfileResumes(publicRoot = PUBLIC_DIR, privateRoot = PROFILE_RESUME_DIR) {
    const legacyDir = path.join(publicRoot, "uploads");
    if (!fs.existsSync(legacyDir)) {
        return;
    }

    const entries = fs.readdirSync(legacyDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!/\.(pdf|docx?)$/i.test(entry.name)) continue;

        fs.mkdirSync(privateRoot, { recursive: true });
        const src = path.join(legacyDir, entry.name);
        const dest = path.join(privateRoot, entry.name);

        if (!fs.existsSync(dest)) {
            fs.renameSync(src, dest);
        } else {
    fs.unlinkSync(src);
        }
    }
}

module.exports = {
    PUBLIC_DIR,
    APPLICATION_RESUME_DIR,
    PROFILE_RESUME_DIR,
    resolveProfileResume, 
    migrateLegacyProfileResumes,
    snapshotProfileResume,
    storeUploadedFile,
    resolveStoredResume,
    resolveStoredApplicationDocument,
    removeStoredResume,
    unlinkPublicUpload,
    unlinkProfileResume
};

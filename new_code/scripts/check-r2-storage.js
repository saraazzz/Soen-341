// Read-only: checks bucket access without uploading, listing, or deleting files.
const { createR2Storage } = require("../server/r2-client");

async function main() {
    const storage = createR2Storage();
    try {
        await storage.checkConnection();
        console.log("PASS: R2 bucket connection and access");
        console.log("Upload/download authorization, bucket privacy, and persistence still need live application tests.");
    } finally {
        storage.close();
    }
}

main().catch(() => {
    // Provider errors can include request metadata. Do not print credentials or
    // raw errors into logs copied into the team report.
    console.error("R2 check failed. Check R2 environment settings, bucket-scoped permissions, and network access.");
    process.exitCode = 1;
});

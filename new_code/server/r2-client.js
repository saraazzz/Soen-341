const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");

// Create this only when R2 is needed: local development can still use local files.
// Keep credentials on the server. Route handlers must check ownership before
// accessing any object; knowing an object key is not permission to read it.
function createR2Storage(env = process.env) {
    for (const name of ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
        if (!env[name] || !env[name].trim()) throw new Error(`Missing ${name}`);
    }
    if (!/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID)) {
        throw new Error("R2_ACCOUNT_ID must be the 32-character Cloudflare account ID");
    }
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.R2_BUCKET_NAME)) {
        throw new Error("R2_BUCKET_NAME must be a valid bucket name");
    }
    const client = new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY
        },
        maxAttempts: 2
    });
    return {
        client,
        bucket: env.R2_BUCKET_NAME,
        // This confirms connection/access only, not private-download behavior or
        // file persistence. Those require the integrated routes and live tests.
        checkConnection: () => client.send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME })),
        close: () => client.destroy()
    };
}

module.exports = { createR2Storage };

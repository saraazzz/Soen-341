// Explicit live probe: writes only newly generated dummy objects, then deletes them.
// Never lists a bucket or touches existing user files. Credentials stay in env.
const { createCloudFiles } = require('../server/cloud-files');
async function main() {
    const files = createCloudFiles();
    const created = [];
    try {
        const bytes = Buffer.from('%PDF-1.4\nCareerConnect storage connection test\n%%EOF');
        const profile = await files.put(bytes, 'storage-test.pdf', 'profile-resumes');
        created.push(profile);
        const copy = await files.snapshot(profile); created.push(copy.file);
        if (!(await files.read(copy.file)).equals(bytes)) throw new Error('Copy mismatch');
        const url = await files.url(copy.file, 'storage-test.pdf');
        const response = await fetch(url);
        if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(bytes)) throw new Error('Download mismatch');
        console.log('PASS: private upload, independent application copy, read, and signed download.');
    } finally {
        try {
            await Promise.all(created.map(ref => files.remove(ref)));
            console.log('PASS: temporary probe objects removed.');
        } finally { files.close(); }
    }
}
main().catch(() => { console.error('R2 roundtrip failed. Check storage settings and any temporary-object cleanup before retrying.'); process.exitCode = 1; });

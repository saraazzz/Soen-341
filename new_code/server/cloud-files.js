const crypto = require('crypto');
const path = require('path');
const { PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createR2Storage } = require('./r2-client');

const UPLOAD_BYTES = 1.5 * 1024 * 1024;
const READ_BYTES = 10 * 1024 * 1024;
const TYPES = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const PREFIXES = ['profile-resumes', 'applications', 'avatars'];
const enabled = () => process.env.FILE_STORAGE === 'r2';
const isCloudFile = value => typeof value === 'string' && value.startsWith('r2/');
function objectKey(reference) {
    if (!/^r2\/(profile-resumes|applications|avatars)\/[0-9a-f-]{36}\.(pdf|docx?|png|jpe?g|webp)$/.test(reference || '')) throw new Error('Invalid stored file reference');
    return reference.slice(3);
}

// Callers authorize the database record first. Never accept an object reference
// supplied by a client as proof that the client owns a resume.
function createCloudFiles(storage = createR2Storage(), sign = getSignedUrl) {
    const { client, bucket } = storage;
    const send = command => client.send(command);
    function newReference(group, name) {
        const ext = path.extname(name).toLowerCase();
        if (!PREFIXES.includes(group) || !TYPES[ext]) throw new Error('Invalid file type');
        if ((group === 'avatars') !== ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) throw new Error('Invalid file category');
        return `r2/${group}/${crypto.randomUUID()}${ext}`;
    }
    return {
        async put(buffer, name, group) {
            if (!Buffer.isBuffer(buffer) || buffer.length > UPLOAD_BYTES) throw new Error('File exceeds hosted upload limit');
            const ref = newReference(group, name);
            await send(new PutObjectCommand({ Bucket: bucket, Key: objectKey(ref), Body: buffer, ContentType: TYPES[path.extname(ref)], CacheControl: 'private, no-store' }));
            return ref;
        },
        async read(ref) {
            const result = await send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(ref) }));
            const body = result.Body;
            try {
                if (result.ContentLength > READ_BYTES) throw new Error('Stored file exceeds read limit');
                const chunks = []; let size = 0;
                for await (const chunk of body) {
                    size += chunk.length;
                    if (size > READ_BYTES) throw new Error('Stored file exceeds read limit');
                    chunks.push(Buffer.from(chunk));
                }
                return Buffer.concat(chunks);
            } finally { body?.destroy?.(); }
        },
        async snapshot(ref) {
            const key = objectKey(ref);
            if (!key.startsWith('profile-resumes/')) throw new Error('Invalid profile resume reference');
            const target = newReference('applications', ref);
            // A new immutable object is retained with the application, independently
            // of later profile replacement or deletion.
            await send(new CopyObjectCommand({ Bucket: bucket, Key: objectKey(target), CopySource: `${bucket}/${key}` }));
            return { file: target, originalName: `resume${path.extname(ref)}`, missing: false };
        },
        async remove(ref) { await send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(ref) })); },
        async url(ref, filename, inline = false) {
            const safeName = path.basename(filename || `file${path.extname(ref)}`).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150);
            return sign(client, new GetObjectCommand({
                Bucket: bucket, Key: objectKey(ref), ResponseContentType: TYPES[path.extname(ref)],
                ResponseCacheControl: 'private, no-store',
                ResponseContentDisposition: `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`
            }), { expiresIn: 60 });
        },
        close: () => storage.close()
    };
}
let instance;
function cloudFiles() { return instance || (instance = createCloudFiles()); }
module.exports = { enabled, isCloudFile, objectKey, createCloudFiles, cloudFiles, UPLOAD_BYTES, READ_BYTES };

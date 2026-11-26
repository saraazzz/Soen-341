const { Readable } = require('stream');
const { createCloudFiles, UPLOAD_BYTES, READ_BYTES } = require('../server/cloud-files');
const ref = 'r2/profile-resumes/00000000-0000-4000-8000-000000000000.pdf';
let send, sign, files;
beforeEach(() => {
    send = jest.fn().mockResolvedValue({}); sign = jest.fn().mockResolvedValue('https://signed.invalid');
    files = createCloudFiles({ client: { send }, bucket: 'private-test', close() {} }, sign);
});
test('uploads use generated private keys and correct content type', async () => {
    const result = await files.put(Buffer.from('pdf'), '../../name.pdf', 'profile-resumes');
    expect(result).toMatch(/^r2\/profile-resumes\/[0-9a-f-]+\.pdf$/);
    expect(send.mock.calls[0][0].input).toMatchObject({ Key: result.slice(3), ContentType: 'application/pdf', CacheControl: 'private, no-store' });
});
test('application copy survives profile replacement by having a different key', async () => {
    const copy = await files.snapshot(ref);
    expect(copy.file).toMatch(/^r2\/applications\//);
    expect(send.mock.calls[0][0].input.CopySource).toBe('private-test/' + ref.slice(3));
    await files.remove(ref);
    expect(send.mock.calls[1][0].input.Key).not.toBe(copy.file.slice(3));
});
test('rejects traversal, wrong categories, and oversized uploads before storage calls', async () => {
    await expect(files.read('r2/profile-resumes/../secret')).rejects.toThrow();
    await expect(files.put(Buffer.from('x'), 'resume.pdf', 'avatars')).rejects.toThrow();
    await expect(files.put(Buffer.alloc(UPLOAD_BYTES + 1), 'resume.pdf', 'profile-resumes')).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
});
test('signed downloads expire after 60 seconds and sanitize filenames', async () => {
    await files.url(ref, 'bad"\r\n.pdf');
    expect(sign.mock.calls[0][2]).toEqual({ expiresIn: 60 });
    expect(sign.mock.calls[0][1].input.ResponseContentDisposition).not.toMatch(/[\r\n]/);
});
test('bounded reads reject oversized responses and close their stream', async () => {
    const body = Readable.from([Buffer.from('pdf')]);
    send.mockResolvedValue({ ContentLength: READ_BYTES + 1, Body: body });
    await expect(files.read(ref)).rejects.toThrow('read limit');
    expect(body.destroyed).toBe(true);
});
test('reads streams without a declared length', async () => {
    send.mockResolvedValue({ Body: Readable.from([Buffer.from('pdf')]) });
    expect(await files.read(ref)).toEqual(Buffer.from('pdf'));
});

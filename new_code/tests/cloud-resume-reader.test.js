const mockRead = jest.fn();
jest.mock('../server/cloud-files', () => ({ cloudFiles: () => ({ read: mockRead }) }));
const { readCloudResumeParts } = require('../server/cloud-resume-reader');
test('AI receives PDF bytes read from private storage', async () => {
    mockRead.mockResolvedValue(Buffer.from('pdf bytes'));
    const parts = await readCloudResumeParts('r2/profile-resumes/00000000-0000-4000-8000-000000000000.pdf');
    expect(parts).toEqual([{inlineData:{mimeType:'application/pdf',data:Buffer.from('pdf bytes').toString('base64')}}]);
});
test('AI reader refuses application and avatar references', async () => {
    mockRead.mockClear();
    await expect(readCloudResumeParts('r2/applications/other.pdf')).rejects.toThrow();
    expect(mockRead).not.toHaveBeenCalled();
});

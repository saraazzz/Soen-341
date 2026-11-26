jest.mock("@aws-sdk/client-s3", () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}), destroy: jest.fn() })),
    HeadBucketCommand: jest.fn().mockImplementation(input => ({ input }))
}));
const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");
const { createR2Storage } = require("../server/r2-client");
const settings = {
    R2_ACCOUNT_ID: "a".repeat(32), R2_BUCKET_NAME: "careerconnect-private",
    R2_ACCESS_KEY_ID: "fictional-access-key", R2_SECRET_ACCESS_KEY: "fictional-secret"
};

beforeEach(() => jest.clearAllMocks());

test.each(Object.keys(settings))("rejects missing %s without exposing credentials", name => {
    expect(() => createR2Storage({ ...settings, [name]: " " })).toThrow(`Missing ${name}`);
    expect(S3Client).not.toHaveBeenCalled();
});

test("rejects an account value that could change the endpoint", () => {
    expect(() => createR2Storage({ ...settings, R2_ACCOUNT_ID: "example.com/path" })).toThrow("R2_ACCOUNT_ID");
});

test("rejects bucket paths", () => {
    expect(() => createR2Storage({ ...settings, R2_BUCKET_NAME: "bucket/file" })).toThrow("R2_BUCKET_NAME");
});

test("checks the configured bucket without reading or changing stored objects", async () => {
    const storage = createR2Storage(settings);
    expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({
        region: "auto", endpoint: `https://${"a".repeat(32)}.r2.cloudflarestorage.com`
    }));
    await storage.checkConnection();
    expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: settings.R2_BUCKET_NAME });
    expect(storage.client.send).toHaveBeenCalledTimes(1);
    storage.close();
    expect(storage.client.destroy).toHaveBeenCalledTimes(1);
});

test("surfaces connection failures so the check cannot report a false pass", async () => {
    const storage = createR2Storage(settings);
    storage.client.send.mockRejectedValueOnce(new Error("AccessDenied"));
    await expect(storage.checkConnection()).rejects.toThrow("AccessDenied");
});

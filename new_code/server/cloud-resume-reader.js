const path = require('path');
const WordExtractor = require('word-extractor');
const { cloudFiles } = require('./cloud-files');

// Used by both AI routes after they load the logged-in seeker's resume reference.
async function readCloudResumeParts(reference, maxTextChars = 100000) {
    if (!/^r2\/profile-resumes\//.test(reference)) throw new Error('Invalid profile resume reference');
    const buffer = await cloudFiles().read(reference);
    const ext = path.extname(reference).toLowerCase();
    if (ext === '.pdf') return [{ inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }];
    if (!['.doc', '.docx'].includes(ext)) throw new Error('Invalid resume type');
    const document = await new WordExtractor().extract(buffer);
    const text = [document.getHeaders(), document.getBody(), document.getFooters()].filter(Boolean).join('\n').slice(0, maxTextChars).trim();
    if (!text) throw new Error('Unreadable resume');
    return [{ text: `Resume text (extracted from ${ext}):\n${text}` }];
}
module.exports = { readCloudResumeParts };

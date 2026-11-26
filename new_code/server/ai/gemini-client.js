// Shared Gemini request code with a timeout and typed errors.
// Returns the parsed JSON object from the model, or throws AiError.
// It never logs prompts, resume text, API keys or response bodies.

const { AiError } = require('./errors');

const DEFAULT_TIMEOUT_MS = 45_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isTimeout = (err) => err && (err.name === 'TimeoutError' || err.name === 'AbortError');
const GENERIC_AI_ERROR = 'AI service error. Check the API key and model name.';

function extractJson(text) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Recover if the model wrapped one JSON object in a little extra text.
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* fall through */ }
    }
    return undefined;
  }
}

// options: { systemPrompt, parts, schema, model, apiKey, maxOutputTokens,
//            temperature, timeoutMs, retries, retryDelayMs }
async function callGemini({
  systemPrompt,
  parts,
  schema,
  model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
  apiKey = process.env.GEMINI_API_KEY,
  maxOutputTokens = 6000,
  temperature = 0.3,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = 0,          // extra attempts, only when Gemini answers 503 (busy)
  retryDelayMs = 1000
}) {
  if (!apiKey) throw new AiError('NO_API_KEY', 500, 'GEMINI_API_KEY is not set on the server.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      ...(schema ? { responseJsonSchema: schema } : {}),
      maxOutputTokens,
      temperature
    }
  });

  let response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err) {
      if (isTimeout(err)) {
        console.error('Gemini request timed out after', timeoutMs, 'ms');
        throw new AiError('TIMEOUT', 504, 'The AI took too long to respond. Please try again.');
      }
      console.error('Gemini request failed:', err.name);
      throw new AiError('NETWORK', 502, 'Could not reach the AI service. Please try again.');
    }
    if (response.status === 503 && attempt < retries) {
      await sleep(retryDelayMs);
      continue;
    }
    break;
  }

  if (response.status === 429) {
    throw new AiError('RATE_LIMIT', 429, 'Free-tier rate limit reached. Wait a minute and try again.');
  }
  if (response.status === 503) {
    console.error('Gemini unavailable (503)');
    throw new AiError('UNAVAILABLE', 503, 'Gemini is temporarily experiencing high demand. Please wait a moment and try again.');
  }
  if (!response.ok) {
    console.error('Gemini API error, status', response.status);
    const code = [400, 401, 403, 404].includes(response.status) ? 'BAD_CONFIG' : 'AI_ERROR';
    throw new AiError(code, 502, GENERIC_AI_ERROR);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    if (isTimeout(err)) throw new AiError('TIMEOUT', 504, 'The AI took too long to respond. Please try again.');
    throw new AiError('MALFORMED', 502, 'The AI response was incomplete. Please try again.');
  }

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    console.error('Gemini output truncated at the token limit');
    throw new AiError('TRUNCATED', 502, 'The AI response was cut off. Try again or use a shorter resume.');
  }
  const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) {
    console.error('Gemini returned no text:', candidate?.finishReason || data.promptFeedback?.blockReason || 'NO_CONTENT');
    throw new AiError('EMPTY', 502, 'The AI could not read this resume and return feedback. Try a text-based PDF or Word document.');
  }

  const parsed = extractJson(text);
  if (parsed === undefined) {
    console.error('Gemini output was not valid JSON');
    throw new AiError('MALFORMED', 502, 'The AI response was incomplete. Please try again.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AiError('BAD_SHAPE', 502, 'AI returned an unreadable response. Try again.');
  }
  return parsed;
}

module.exports = { callGemini, DEFAULT_TIMEOUT_MS };

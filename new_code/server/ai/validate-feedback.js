// Server-side check of the resume-feedback JSON before it reaches the browser.
// Valid JSON is not enough: this checks required fields, types, score ranges,
// arrays and nested objects. Returns { ok, value, errors }.
// `errors` only names fields (never the model's text) so it is safe to log.

const STATUSES = ['met', 'partial', 'missing'];
const isScore = (v) => Number.isInteger(v) && v >= 0 && v <= 100;
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function textList(raw, name, errors) {
  if (!Array.isArray(raw)) { errors.push(`${name} must be an array`); return []; }
  const out = [];
  raw.forEach((item, i) => {
    if (isText(item)) out.push(item.trim());
    else errors.push(`${name}[${i}] must be a non-empty string`);
  });
  return out;
}

// options.hasPosting: when false, matchScore is forced to null and
// gapsVsPosting to [] (the prompt promises this when no posting is given).
function validateFeedback(raw, { hasPosting = true } = {}) {
  const errors = [];
  if (!isObject(raw)) return { ok: false, value: null, errors: ['feedback must be an object'] };

  if (!isScore(raw.overallScore)) errors.push('overallScore must be an integer from 0 to 100');
  if (!isText(raw.summary)) errors.push('summary must be a non-empty string');

  let matchScore = null;
  let gaps = [];
  if (hasPosting) {
    if (raw.matchScore === null) matchScore = null;
    else if (isScore(raw.matchScore)) matchScore = raw.matchScore;
    else errors.push('matchScore must be an integer from 0 to 100 or null');

    if (!Array.isArray(raw.gapsVsPosting)) errors.push('gapsVsPosting must be an array');
    else {
      raw.gapsVsPosting.forEach((g, i) => {
        if (!isObject(g) || !isText(g.requirement) || !STATUSES.includes(g.status) || typeof g.evidence !== 'string') {
          errors.push(`gapsVsPosting[${i}] needs requirement, status (met/partial/missing) and evidence`);
        } else gaps.push({ requirement: g.requirement.trim(), status: g.status, evidence: g.evidence.trim() });
      });
    }
  }

  const strengths = textList(raw.strengths, 'strengths', errors);
  const atsTips = textList(raw.atsTips, 'atsTips', errors);

  const suggestedEdits = [];
  if (!Array.isArray(raw.suggestedEdits)) errors.push('suggestedEdits must be an array');
  else {
    raw.suggestedEdits.forEach((e, i) => {
      if (!isObject(e) || !isText(e.section) || !isText(e.suggestion)) {
        errors.push(`suggestedEdits[${i}] needs section and suggestion`);
      } else suggestedEdits.push({ section: e.section.trim(), suggestion: e.suggestion.trim() });
    });
  }

  if (errors.length) return { ok: false, value: null, errors };
  // Only known fields are copied, so extra fields from the model never reach the browser.
  return {
    ok: true,
    errors: [],
    value: {
      overallScore: raw.overallScore,
      matchScore,
      summary: raw.summary.trim(),
      strengths,
      gapsVsPosting: gaps,
      suggestedEdits,
      atsTips
    }
  };
}

module.exports = { validateFeedback };

// feedback-ui.js (vanilla JS)
// The server reads the logged-in user's saved profile resume (PDF, DOC, or DOCX). This page
// loads available postings from /api/jobs and sends the selected posting text.

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

const jobSelect = document.getElementById('jobPosting');
const jobStatus = document.getElementById('feedbackJobStatus');
const feedbackButton = document.getElementById('feedbackBtn');
const feedbackPanel = document.getElementById('feedbackPanel');
let availableJobs = [];

async function loadFeedbackJobs() {
  try {
    const response = await fetch('/api/jobs');
    const jobs = await response.json().catch(() => []);
    if (!response.ok) throw new Error(jobs.message || 'Could not load job postings.');

    availableJobs = Array.isArray(jobs) ? jobs : [];
    jobSelect.innerHTML = '<option value="">Choose a job posting</option>' +
      availableJobs.map(job => {
        const label = [job.title, job.company_name, job.location].filter(Boolean).join(' — ');
        return `<option value="${esc(String(job.id))}">${esc(label)}</option>`;
      }).join('');

    if (availableJobs.length === 0) {
      jobSelect.innerHTML = '<option value="">No job postings available</option>';
      jobStatus.textContent = 'No job postings are available yet.';
      return;
    }

    jobStatus.textContent = `${availableJobs.length} job posting${availableJobs.length === 1 ? '' : 's'} available.`;
    feedbackButton.disabled = false;
  } catch (error) {
    jobSelect.innerHTML = '<option value="">Could not load job postings</option>';
    jobStatus.textContent = error.message || 'Could not load job postings. Refresh to try again.';
  }
}

function renderFeedback(f) {
  const list = arr => (arr || []).map(x => `<li>${esc(x)}</li>`).join('');
  const gaps = (f.gapsVsPosting || [])
    .map(g => `<li><strong>${esc(g.requirement)}</strong> [${esc(g.status)}]<br><em>Resume evidence:</em> ${esc(g.evidence)}</li>`)
    .join('');
  const edits = (f.suggestedEdits || [])
    .map(e => `<li><strong>${esc(e.section)}:</strong> ${esc(e.suggestion)}</li>`)
    .join('');

  return `
    <div class="feedback-card">
      <h3>Resume score: ${esc(String(f.overallScore))}/100${f.matchScore != null ? ` | Job match: ${esc(String(f.matchScore))}/100` : ''}</h3>
      <p>${esc(f.summary)}</p>
      <h4>Strengths</h4><ul>${list(f.strengths)}</ul>
      ${gaps ? `<h4>Gaps vs. the job posting</h4><ul>${gaps}</ul>` : ''}
      <h4>Suggested edits</h4><ul>${edits}</ul>
      <h4>ATS tips</h4><ul>${list(f.atsTips)}</ul>
    </div>`;
}

feedbackButton.addEventListener('click', async () => {
  const btn = feedbackButton;
  const panel = feedbackPanel;
  const job = availableJobs.find(item => String(item.id) === jobSelect.value);
  if (!job) {
    panel.innerHTML = '<p class="feedback-error">Choose a job posting first.</p>';
    return;
  }

  const jobPosting = [
    `Job title: ${job.title || 'Not provided'}`,
    `Company: ${job.company_name || 'Not provided'}`,
    `Location: ${job.location || 'Not provided'}`,
    `Category: ${job.category || 'Not provided'}`,
    `Job type: ${job.job_type || 'Not provided'}`,
    `Description and requirements:\n${job.description || 'Not provided'}`
  ].join('\n');

  btn.disabled = true;
  panel.innerHTML = '<p>Analyzing your resume...</p>';
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobPosting })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    panel.innerHTML = renderFeedback(data);
  } catch (e) {
    panel.innerHTML = `<p class="feedback-error">Could not get feedback: ${esc(e.message)}</p>`;
  } finally {
    btn.disabled = false;
  }
});

loadFeedbackJobs();

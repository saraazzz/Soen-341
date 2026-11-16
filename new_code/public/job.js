const jobDetail = document.getElementById("job-detail");
const applyJobLink = document.getElementById("apply-job-link");
const confirmation = document.getElementById("confirmation");
const pageMessage = document.getElementById("page-message");
const params = new URLSearchParams(window.location.search);
const jobId = Number(params.get("id"));

function showPageMessage(message) {
    pageMessage.hidden = false;
    pageMessage.textContent = message;
}

function showConfirmation(heading, status, resumeNote) {
    confirmation.hidden = false;
    confirmation.innerHTML = `
        <h2>${escapeHtml(heading)}</h2>
        <p>Status: ${statusBadge(status)}</p>
        ${resumeNote ? `<p>${escapeHtml(resumeNote)}</p>` : ""}
        <p><a href="my-applications.html">View my applications</a></p>
    `;
}

function renderJob(job) {
    document.title = `${job.title} | CareerConnect`;
    jobDetail.hidden = false;

    const jobTitleEl = document.getElementById("job-title");
    const jobLocationEl = document.getElementById("job-location");
    const jobTypeEl = document.getElementById("job-type");
    const jobCompanyEl = document.getElementById("job-company");
    const jobDescEl = document.getElementById("job-description");

    if (jobTitleEl) jobTitleEl.textContent = job.title;
    if (jobLocationEl) jobLocationEl.textContent = job.location || "Location not listed";
    if (jobTypeEl) jobTypeEl.textContent = job.job_type || "Job type not listed";
    if (jobCompanyEl) jobCompanyEl.textContent = job.company_name || "Company";
    if (jobDescEl) jobDescEl.textContent = job.description || "No description provided.";
}

// Stage 3A: Retry loading without submitting an application or altering the note.
const retryJob = document.getElementById('retry-job');
let jobLoading = false;
async function loadJob() {
    if (jobLoading) return;
    if (!Number.isInteger(jobId) || jobId <= 0) {
        showPageMessage('That job could not be found.');
        return;
    }
    jobLoading = true;
    retryJob.hidden = true;
    retryJob.disabled = true;
    if (applyJobLink) applyJobLink.hidden = true;
    confirmation.hidden = true;
    jobDetail.hidden = true;
    jobDetail.setAttribute('aria-busy', 'true');
    showPageMessage('Loading job...');
    try {
        // Only a 401 means logged out. A profile/server failure must not ask the user to log in again.
        let profile = null;
        let accountFailed = false;
        try {
            const profileResponse = await fetch('/api/profile');
            if (profileResponse.ok) {
                profile = await profileResponse.json();
                if (!profile || !['job_seeker', 'employer'].includes(profile.role)) accountFailed = true;
            } else if (profileResponse.status !== 401) {
                accountFailed = true;
            }
        } catch (error) {
            accountFailed = true;
        }
        const response = await fetch(`/api/jobs/${jobId}`);
        const job = await response.json();
        if (!response.ok) {
            showPageMessage(job.message || 'Could not load that job.');
            retryJob.hidden = response.status === 404;
            return;
        }
        if (!job || typeof job !== 'object' || Array.isArray(job) || typeof job.title !== 'string') {
            throw new Error('Unexpected job response.');
        }
        renderJob(job);
        pageMessage.hidden = true;
        if (accountFailed) {
            showPageMessage('Could not verify your account. Please retry before applying.');
            retryJob.hidden = false;
            return;
        }
        if (job.alreadyApplied) {
            showConfirmation('You have already applied to this job.', job.applicationStatus || 'Applied');
            return;
        }
        if (job.status !== 'open') {
            showPageMessage('This job is not open for applications.');
            return;
        }
        if (!profile) {
            showPageMessage('Log in as a job seeker to apply for this job.');
            return;
        }
        if (profile.role !== 'job_seeker') {
            showPageMessage('Employers can post jobs, but only job seekers can apply.');
            return;
        }
        if (applyJobLink) {
            applyJobLink.href = `apply.html?id=${jobId}`;
            applyJobLink.hidden = false;
        }
    } catch (error) {
        console.error('Job detail error:', error);
        showPageMessage('Could not load that job. Please try again.');
        retryJob.hidden = false;
    } finally {
        jobLoading = false;
        retryJob.disabled = false;
        jobDetail.setAttribute('aria-busy', 'false');
    }
}
retryJob.addEventListener('click', loadJob);

loadJob();

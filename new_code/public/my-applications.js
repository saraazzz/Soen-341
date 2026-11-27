// Stage 3B: Keep a local copy for status filtering; no extra database requests on filter changes.
const applicationsList = document.getElementById('applications-list');
const applicationsMessage = document.getElementById('applications-message');
const applicationsState = document.getElementById('applications-state');
const applicationsBrowse = document.getElementById('applications-browse');
const statusFilter = document.getElementById('status-filter');
const retryList = document.getElementById('retry-applications');
let records = [];
let listLoading = false;

function showApplicationsMessage(text) {
    applicationsMessage.textContent = text;
    applicationsMessage.hidden = !text;
    const isEmpty = text === 'You have not applied to any jobs yet.' || text === 'No applications match this status.';
    applicationsState.hidden = !text;
    applicationsState.classList.toggle('is-empty', isEmpty);
    applicationsState.querySelector('.applications-state-icon').hidden = !isEmpty;
    applicationsBrowse.hidden = text !== 'You have not applied to any jobs yet.';
}

function renderApplications() {
    const visible = records.filter(record => !statusFilter.value || record.status === statusFilter.value);
    applicationsList.innerHTML = '';
    if (!visible.length) {
        showApplicationsMessage(records.length ? 'No applications match this status.' : 'You have not applied to any jobs yet.');
        return;
    }
    showApplicationsMessage('');
    applicationsList.innerHTML = visible.map((application) => {
        const resumeUrl = application.resume_path
            ? `/${String(application.resume_path).split("/").map(encodeURIComponent).join("/")}`
            : "";
        const coverLetterUrl = application.cover_letter_path
            ? `/${String(application.cover_letter_path).split("/").map(encodeURIComponent).join("/")}`
            : "";

        return `
            <article class="application-card">
                <h2>${escapeHtml(application.title)}</h2>
                <p class="application-meta">${escapeHtml(application.company_name || "Company")}</p>
                ${application.recruiter_name ? `<p class="application-meta">Recruiter: ${escapeHtml(application.recruiter_name)}</p>` : ""}
                <p class="application-meta">${escapeHtml(application.location || "Location not listed")}</p>
                <p class="application-meta">Applied ${escapeHtml(formatDate(application.applied_at))}</p>
                <p>${APPLICATION_STATUSES.includes(application.status) ? statusBadge(application.status) : escapeHtml(application.status || "Unavailable")}</p>
                ${resumeUrl ? `<p class="application-meta"><a href="${escapeHtml(resumeUrl)}" target="_blank" rel="noopener noreferrer">View attached resume (${escapeHtml(resumeDisplayName(application.resume_path))})</a></p>` : ""}
                ${coverLetterUrl ? `<p class="application-meta"><a href="${escapeHtml(coverLetterUrl)}" target="_blank" rel="noopener noreferrer">View additional document (${escapeHtml(resumeDisplayName(application.cover_letter_path))})</a></p>` : ""}
                <p class="application-meta">${application.has_submitted_resume ? "Resume: " + escapeHtml(application.submitted_resume_original_name || "Submitted resume") : "No resume submitted"}</p>
                <p><a href="application.html?id=${encodeURIComponent(application.id)}">View details</a></p>
            </article>
        `;
    }).join("");
}

async function loadApplications() {
    if (listLoading) return;
    listLoading = true;
    statusFilter.disabled = true;
    retryList.hidden = true;
    retryList.disabled = true;
    records = [];
    applicationsList.innerHTML = '';
    applicationsList.setAttribute('aria-busy', 'true');
    showApplicationsMessage('Checking your account and loading applications...');
    try {
        const profile = await requireRole('job_seeker', 'Employer_Dashboard.html');
        if (!profile) return;
        const response = await fetch('/api/applications/mine');
        if (response.status === 401 || response.status === 403) {
            window.location.href = response.status === 401 ? 'login.html' : 'Employer_Dashboard.html';
            return;
        }
        if (!response.ok) throw new Error('Could not load applications. Please try again.');
        const data = await response.json();
        if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
            throw new Error('Could not read the applications. Please try again.');
        }
        records = data;
        statusFilter.disabled = false;
        renderApplications();
    } catch (error) {
        // Database or profile failures stay visible instead of pretending the account has no applications.
        showApplicationsMessage(error.message || 'Could not load applications. Please try again.');
        retryList.hidden = false;
    } finally {
        listLoading = false;
        retryList.disabled = false;
        applicationsList.setAttribute('aria-busy', 'false');
    }
}
statusFilter.addEventListener('change', renderApplications);
retryList.addEventListener('click', loadApplications);
loadApplications();

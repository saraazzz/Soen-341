// Stage 3B: Keep a local copy for status filtering; no extra database requests on filter changes.
const applicantsList = document.getElementById('applicants-list');
const applicantsMessage = document.getElementById('applicants-message');
const statusFilter = document.getElementById('status-filter');
const retryList = document.getElementById('retry-applicants');
let records = [];
let listLoading = false;
let statusSaving = false;
//variable needed for the job_id
const urlParams = new URLSearchParams(window.location.search);
const selectedJobId = urlParams.get('job_id'); 

function showApplicantsMessage(text) {
    applicantsMessage.textContent = text;
    applicantsMessage.hidden = !text;
}

function safeExternalUrl(value) {
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
        return "";
    }
}

function formatSalaryRange(applicant) {
    if (applicant.salary_min == null || applicant.salary_max == null) return "";
    const currency = applicant.salary_currency || "CAD";
    const minimum = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2
    }).format(Number(applicant.salary_min));
    const maximum = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2
    }).format(Number(applicant.salary_max));
    return `${minimum} to ${maximum}`;
}

function formatAvailabilityDate(value) {
    const dateParts = String(value).slice(0, 10).split("-").map(Number);
    if (dateParts.length !== 3 || dateParts.some(Number.isNaN)) return String(value);
    return new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function renderApplicants() {
    //renderApplicants checks both selectedJobId and statusFilter.value
    const visible = records.filter(record => {
    const matchesJob = !selectedJobId || String(record.job_id) === String(selectedJobId);
    const matchesStatus =  !statusFilter.value || record.status === statusFilter.value;
        return matchesJob && matchesStatus;
    });
    applicantsList.innerHTML = '';
    if (!visible.length) {
        showApplicantsMessage(records.length ?(selectedJobId ? 'No applications match this job and status filter.' : 'No applications match this status.'): 'No one has applied to your jobs yet.');
        return;
    }
    showApplicantsMessage('');
        applicantsList.innerHTML = visible.map((applicant) => {
            const name = `${applicant.first_name || ""} ${applicant.last_name || ""}`.trim();
            const resumeUrl = applicant.resume_path
                ? `/${String(applicant.resume_path).split("/").map(encodeURIComponent).join("/")}`
                : "";
            const additionalDocumentUrl = applicant.has_additional_document
                ? `/api/employer/applications/${encodeURIComponent(applicant.id)}/additional-document`
                : "";
            const linkedinUrl = safeExternalUrl(applicant.linkedin_url);
            const portfolioUrl = safeExternalUrl(applicant.portfolio_url);
            const workAuthorization = {
                authorized_no_sponsorship: "Authorized to work; no sponsorship required",
                authorized_sponsorship: "Authorized to work; sponsorship required",
                not_authorized: "Not currently authorized to work"
            }[applicant.work_authorization] || "";
            const salaryRange = formatSalaryRange(applicant);

            return `
                <article class="application-card" data-application-id="${escapeHtml(applicant.id)}">
                    <h2>${escapeHtml(name || "Job seeker")}</h2>
                    <p class="application-meta">${escapeHtml(applicant.job_title)}</p>
                    <p class="application-meta">Applied ${escapeHtml(formatDate(applicant.applied_at))}</p>
                    <details class="applicant-details">
                        <summary>View application details</summary>
                        <div class="applicant-details-content">
                            <p class="application-meta">Email: ${escapeHtml(applicant.email || "")}</p>
                            ${applicant.phone ? `<p class="application-meta">Phone: ${escapeHtml(applicant.phone)}</p>` : ""}
                            ${applicant.address || applicant.postal_code ? `<p class="application-meta">Address: ${escapeHtml(applicant.address || "")}${applicant.address && applicant.postal_code ? ", " : ""}${escapeHtml(applicant.postal_code || "")}</p>` : ""}
                            ${applicant.cover_note ? `<p class="cover-note"><strong>Note to employer:</strong><br>${escapeHtml(applicant.cover_note)}</p>` : ""}
                            ${linkedinUrl ? `<p class="application-meta"><a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener noreferrer">LinkedIn profile</a></p>` : ""}
                            ${portfolioUrl ? `<p class="application-meta"><a href="${escapeHtml(portfolioUrl)}" target="_blank" rel="noopener noreferrer">Portfolio / work sample</a></p>` : ""}
                            ${workAuthorization ? `<p class="application-meta">Work authorization: ${escapeHtml(workAuthorization)}</p>` : ""}
                            ${applicant.availability_date ? `<p class="application-meta">Earliest start date: ${escapeHtml(formatAvailabilityDate(applicant.availability_date))}</p>` : ""}
                            ${salaryRange ? `<p class="application-meta">Salary expectations (per year): ${escapeHtml(salaryRange)}</p>` : ""}
                            ${applicant.relevant_experience ? `<p class="cover-note"><strong>Relevant experience:</strong><br>${escapeHtml(applicant.relevant_experience)}</p>` : ""}
                            ${resumeUrl ? `<p class="application-meta"><a href="${escapeHtml(resumeUrl)}" target="_blank" rel="noopener noreferrer">View resume (${escapeHtml(resumeDisplayName(applicant.resume_path))})</a></p>` : ""}
                            ${additionalDocumentUrl ? `<p class="application-meta"><a href="${escapeHtml(additionalDocumentUrl)}" target="_blank" rel="noopener noreferrer">View additional document (${escapeHtml(applicant.additional_document_name || "attached file")})</a></p>` : ""}
                        </div>
                    </details>
                    ${applicant.cover_note ? `<p class="cover-note">${escapeHtml(applicant.cover_note)}</p>` : ""}
                    ${applicant.has_submitted_resume
                        ? `<p><a href="/api/employer/applications/${encodeURIComponent(applicant.id)}/resume">View submitted resume</a></p>`
                        : `<p class="application-meta">No resume was submitted with this application.</p>`}
                    <div class="status-row">
                        <label for="status-${escapeHtml(applicant.id)}">Status</label>
                        <select id="status-${escapeHtml(applicant.id)}">
                            ${statusOptions(applicant.status)}
                        </select>
                        <button type="button" class="save-status">Save status</button>
                    </div>
                    <p class="save-message" role="status" hidden></p>
                </article>
            `;
        }).join("");

        applicantsList.querySelectorAll(".application-card").forEach((card) => {
            const button = card.querySelector(".save-status");
            const select = card.querySelector("select");
            const messageElement = card.querySelector(".save-message");

            button.addEventListener("click", () => {
                saveStatus(
                    card.dataset.applicationId,
                    select.value,
                    messageElement,
                    button,
                    select
                );
            });
        });
}

function statusOptions(currentStatus) {
    // Preserve unknown future statuses until the recruiter deliberately selects a supported one.
    const unknown = APPLICATION_STATUSES.includes(currentStatus) ? ''
        : `<option value="" selected disabled>${escapeHtml(currentStatus || 'Select a status')}</option>`;
    return unknown + APPLICATION_STATUSES.map((status) => `
        <option value="${escapeHtml(status)}" ${status === currentStatus ? "selected" : ""}>
            ${escapeHtml(status)}
        </option>
    `).join("");
}

// Lock the affected controls while saving and update the cached status only on success.
async function saveStatus(applicationId, status, messageElement, button, select) {
    if (statusSaving || listLoading) return;
    const record = records.find(item => String(item.id) === String(applicationId));
    if (!record || !APPLICATION_STATUSES.includes(status)) return;
    if (record.status === status) {
        messageElement.hidden = false;
        messageElement.textContent = 'This status is already saved.';
        return;
    }
    statusSaving = true;
    statusFilter.disabled = true;
    button.disabled = true;
    select.disabled = true;
    button.textContent = 'Saving...';
    messageElement.hidden = false;
    messageElement.textContent = 'Saving status...';
    try {
        const response = await fetch(`/api/employer/applications/${encodeURIComponent(applicationId)}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
        });
        if (response.status === 401 || response.status === 403) {
            window.location.href = response.status === 401 ? 'login.html' : 'Dashboard.html';
            return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not save the status.');
        record.status = status;
        // Reapply the filter so a card moves out of its old status immediately after a successful save.
        renderApplicants();
        showApplicantsMessage('Application status saved as ' + status + '.');
    } catch (error) {
        select.value = APPLICATION_STATUSES.includes(record.status) ? record.status : '';
        messageElement.textContent = error.message || 'Could not save the status. Please try again.';
        messageElement.className = 'save-message error';
    } finally {
        statusSaving = false;
        statusFilter.disabled = false;
        button.disabled = false;
        select.disabled = false;
        button.textContent = 'Save status';
    }
}

async function loadApplicants() {
    if (listLoading || statusSaving) return;
    listLoading = true;
    statusFilter.disabled = true;
    retryList.hidden = true;
    retryList.disabled = true;
    records = [];
    applicantsList.innerHTML = '';
    applicantsList.setAttribute('aria-busy', 'true');
    showApplicantsMessage('Checking your account and loading applications...');
    try {
        const profile = await requireRole('employer', 'Dashboard.html');
        if (!profile) return;
        const response = await fetch('/api/employer/applications');
        if (response.status === 401 || response.status === 403) {
            window.location.href = response.status === 401 ? 'login.html' : 'Dashboard.html';
            return;
        }
        if (!response.ok) throw new Error('Could not load applications. Please try again.');
        const data = await response.json();
        if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
            throw new Error('Could not read the applications. Please try again.');
        }
        records = data;
        statusFilter.disabled = false;
        renderApplicants();
    } catch (error) {
        // Database or profile failures stay visible instead of pretending the account has no applications.
        showApplicantsMessage(error.message || 'Could not load applications. Please try again.');
        retryList.hidden = false;
    } finally {
        listLoading = false;
        retryList.disabled = false;
        applicantsList.setAttribute('aria-busy', 'false');
    }
}
statusFilter.addEventListener('change', renderApplicants);
retryList.addEventListener('click', loadApplicants);
loadApplicants();

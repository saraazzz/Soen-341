const applyCard = document.getElementById("apply-card");
const applyForm = document.getElementById("apply-form");
const applyButton = document.getElementById("apply-button");
const applyError = document.getElementById("apply-error");
const confirmation = document.getElementById("confirmation");
const pageMessage = document.getElementById("page-message");
const backLink = document.getElementById("back-link");
const retryJob = document.getElementById("retry-job");

// Resume UI elements
const resumeOptionProfile = document.getElementById("resume-option-profile");
const resumeOptionUpload = document.getElementById("resume-option-upload");
const resumeUploadRow = document.getElementById("resume-upload-row");
const resumeHint = document.getElementById("resume-hint");
const resumeProfileName = document.getElementById("resume-profile-name");
const resumeFileInput = document.getElementById("resume-file");
const resumeFileNameDisplay = document.getElementById("resume-file-name-display");
const coverLetterInput = document.getElementById("cover-letter-file");
const coverLetterButton = document.getElementById("cover-letter-button");
const coverLetterFileName = document.getElementById("cover-letter-file-name");

const params = new URLSearchParams(window.location.search);
const jobId = Number(params.get("id"));

if (backLink) {
    backLink.href = jobId ? `job.html?id=${jobId}` : "jobs.html";
}

coverLetterButton.addEventListener("click", () => coverLetterInput.click());
coverLetterInput.addEventListener("change", () => {
    coverLetterFileName.textContent = coverLetterInput.files[0]?.name || "";
});

function showPageMessage(message) {
    pageMessage.hidden = false;
    pageMessage.textContent = message;
}

function showApplyError(message) {
    applyError.hidden = false;
    applyError.textContent = message;
}

function showConfirmation(heading, status) {
    confirmation.hidden = false;
    confirmation.innerHTML = `
        <h2>${escapeHtml(heading)}</h2>
        <p>Status: ${statusBadge(status)}</p>
        <p><a href="my-applications.html">View my applications</a></p>
    `;
}

function populateApplicantDetails(profile) {
    const profileFields = {
        "applicant-first-name": profile.first_name,
        "applicant-last-name": profile.last_name,
        "applicant-email": profile.email,
        "applicant-phone": profile.phone,
        "applicant-address": profile.address,
        "applicant-postal-code": profile.postal_code
    };

    Object.entries(profileFields).forEach(([id, value]) => {
        document.getElementById(id).value = value || "";
    });
}

function getApplicationDetails() {
    return {
        firstName: document.getElementById("applicant-first-name").value.trim(),
        lastName: document.getElementById("applicant-last-name").value.trim(),
        email: document.getElementById("applicant-email").value.trim(),
        phone: document.getElementById("applicant-phone").value.trim(),
        address: document.getElementById("applicant-address").value.trim(),
        postalCode: document.getElementById("applicant-postal-code").value.trim(),
        linkedinUrl: document.getElementById("applicant-linkedin").value.trim(),
        portfolioUrl: document.getElementById("applicant-portfolio").value.trim(),
        workAuthorization: document.getElementById("work-authorization").value,
        availabilityDate: document.getElementById("availability-date").value,
        salaryMin: document.getElementById("salary-min").value,
        salaryMax: document.getElementById("salary-max").value,
        salaryCurrency: "CAD",
        relevantExperience: document.getElementById("relevant-experience").value.trim(),
        coverNote: document.getElementById("cover-note").value.trim()
    };
}

/** Wire up resume-choice buttons and the file picker */
function setupResumeUI(profileResumePath) {
    const hasProfileResume = Boolean(profileResumePath);
    const resumeOptions = document.querySelectorAll(".resume-option");

    if (hasProfileResume) {
        // Show the profile-resume option and pre-select it
        resumeProfileName.textContent = resumeDisplayName(profileResumePath);
        resumeOptionProfile.hidden = false;
    } else {
        // No profile resume — hide profile option, auto-select upload, show hint
        resumeOptionProfile.hidden = true;
        if (resumeHint) resumeHint.hidden = false;
    }

    const setResumeChoice = (choice) => {
        resumeOptions.forEach((option) => {
            const isSelected = option.dataset.resumeChoice === choice;
            option.setAttribute("aria-pressed", String(isSelected));
        });
        resumeUploadRow.hidden = choice !== "upload";
    };

    resumeOptions.forEach((option) => {
        option.addEventListener("click", () => {
            setResumeChoice(option.dataset.resumeChoice);
            if (option.dataset.resumeChoice === "upload" && resumeFileInput) {
                resumeFileInput.click();
            }
        });
    });

    setResumeChoice(hasProfileResume ? "profile" : "upload");

    // Show chosen filename
    if (resumeFileInput) {
        resumeFileInput.addEventListener("change", () => {
            const file = resumeFileInput.files[0];
            resumeFileNameDisplay.textContent = file ? file.name : "";
        });
    }
}

let loadingJob = false;
async function loadApplyPage() {
    if (loadingJob || applicationSubmitting) return;

    if (!Number.isInteger(jobId) || jobId <= 0) {
        showPageMessage("That job could not be found.");
        return;
    }

    loadingJob = true;
    retryJob.hidden = true;
    retryJob.disabled = true;
    applyCard.hidden = true;
    confirmation.hidden = true;
    pageMessage.hidden = true;

    try {
        // Verify user login and role
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!profileResponse.ok) {
            showPageMessage("Could not verify your account. Please retry before applying.");
            retryJob.hidden = false;
            return;
        }

        const profile = await profileResponse.json();
        if (profile.role !== "job_seeker") {
            showPageMessage("Employers can post jobs, but only job seekers can apply.");
            return;
        }

        // Fetch job details
        const response = await fetch(`/api/jobs/${jobId}`);
        const job = await response.json();

        if (!response.ok) {
            showPageMessage(job.message || "Could not load that job.");
            retryJob.hidden = response.status === 404;
            return;
        }

        document.title = `Apply for ${job.title} | CareerConnect`;

        if (job.alreadyApplied) {
            showConfirmation("You have already applied to this job.", job.applicationStatus || "Applied");
            return;
        }

        if (job.status !== "open") {
            showPageMessage("This job is not open for applications.");
            return;
        }

        const titleEl = document.getElementById("job-title");
        const subtitleEl = document.getElementById("job-subtitle");

        if (titleEl) titleEl.textContent = job.title;
        if (subtitleEl) {
            const meta = [job.company_name, job.location, job.job_type].filter(Boolean).join(" • ");
            subtitleEl.textContent = meta;
        }

        // Set up resume options using the profile's resume_path
        setupResumeUI(profile.resume_path || null);
        populateApplicantDetails(profile);

        applyCard.hidden = false;
    } catch (err) {
        console.error("Apply page load error:", err);
        showPageMessage("Could not load job details. Please try again.");
        retryJob.hidden = false;
    } finally {
        loadingJob = false;
        retryJob.disabled = false;
    }
}
retryJob.addEventListener("click", loadApplyPage);

let applicationSubmitting = false;
applyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (applicationSubmitting || applyForm.hidden || !applyForm.reportValidity()) return;

    // Determine resume choice
    const selectedResumeOption = document.querySelector('.resume-option[aria-pressed="true"]');
    const resumeChoice = selectedResumeOption?.dataset.resumeChoice || "profile";
    const details = getApplicationDetails();

    if (Boolean(details.salaryMin) !== Boolean(details.salaryMax)) {
        showApplyError("Enter both a minimum and maximum salary, or leave both blank.");
        return;
    }
    if (details.salaryMin && Number(details.salaryMin) > Number(details.salaryMax)) {
        showApplyError("The minimum salary cannot be greater than the maximum.");
        return;
    }

    // Validate: if "upload" chosen, a file must be selected
    if (resumeChoice === "upload") {
        const file = resumeFileInput && resumeFileInput.files[0];
        if (!file) {
            showApplyError("Please select a resume file to upload, or choose your profile resume.");
            return;
        }
        const ext = file.name.split(".").pop().toLowerCase();
        if (!["pdf", "docx", "doc"].includes(ext)) {
            showApplyError("Only PDF, DOC, or DOCX files are accepted.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showApplyError("Resume files must be 10 MB or smaller.");
            return;
        }
    }
    if (coverLetterInput.files[0]) {
        const file = coverLetterInput.files[0];
        const extension = file.name.split(".").pop().toLowerCase();
        if (!["pdf", "doc", "docx"].includes(extension)) {
            showApplyError("Additional documents must be PDF, DOC, or DOCX files.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showApplyError("Additional documents must be 10 MB or smaller.");
            return;
        }
    }

    applicationSubmitting = true;
    applyError.hidden = true;
    applyButton.disabled = true;
    applyButton.textContent = "Submitting...";

    try {
        let response;

        if ((resumeChoice === "upload" && resumeFileInput && resumeFileInput.files[0])
            || (coverLetterInput && coverLetterInput.files[0])) {
            // Send as multipart when either application document is uploaded.
            const formData = new FormData();
            formData.append("jobId", jobId);
            formData.append("resumeChoice", resumeChoice);
            Object.entries(details).forEach(([key, value]) => formData.append(key, value));
            if (resumeChoice === "upload" && resumeFileInput.files[0]) {
                formData.append("resume", resumeFileInput.files[0]);
            }
            if (coverLetterInput.files[0]) {
                formData.append("coverLetter", coverLetterInput.files[0]);
            }

            try {
                response = await fetch("/api/applications", {
                    method: "POST",
                    body: formData
                });
            } catch (error) {
                throw new Error("Could not reach the application server. Check that it is running.", {
                    cause: error
                });
            }
        } else {
            // Profile resume — plain JSON
            try {
                response = await fetch("/api/applications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jobId,
                        ...details,
                        resumeChoice: "profile"
                    })
                });
            } catch (error) {
                throw new Error("Could not reach the application server. Check that it is running.", {
                    cause: error
                });
            }
        }

        if (response.status === 401 || response.status === 403) {
            window.location.href = response.status === 401 ? "login.html" : "Employer_Dashboard.html";
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (error) {
            throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`, {
                cause: error
            });
        }

        if (response.ok) {
            applyCard.hidden = true;
            showConfirmation(
                data.message || "Application submitted successfully.",
                data.application?.status || "Applied"
            );
            return;
        }

        if (response.status === 409) {
            applyCard.hidden = true;
            // A posting can close after this form loads. Both that race and a
            // duplicate application use HTTP 409, so distinguish the server code.
            showPageMessage(data.code === "POSTING_UNAVAILABLE"
                ? (data.message || "This posting is no longer available for applications.")
                : "You have already applied. Check My Applications for its current status.");
            return;
        }

        showApplyError(data.message || "Could not submit application.");
    } catch (err) {
        console.error("Apply submission error:", err);
        showApplyError(err.message || "Could not submit application. Please try again.");
    } finally {
        applicationSubmitting = false;
        applyButton.disabled = false;
        applyButton.textContent = "Submit Application";
    }
});

loadApplyPage();

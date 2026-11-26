const matchForm = document.getElementById("match-form");
const profileNote = document.getElementById("profile-note");
const skillList = document.getElementById("skill-list");
const recommendButton = document.getElementById("recommend-btn");
const matchMessage = document.getElementById("match-message");
const matchMessageText = document.getElementById("match-message-text");
const profileNoteText = document.getElementById("profile-note-text");
const retryMatches = document.getElementById("retry-matches");
const matchResults = document.getElementById("match-results");

const educationInput = document.getElementById("education");
const experienceInput = document.getElementById("experience");
const preferredTypeInput = document.getElementById("preferred-job-type");
const preferredLocationInput = document.getElementById("preferred-location");
const preferredCategoryInput = document.getElementById("preferred-category");
const preferencesNoteInput = document.getElementById("preferences-note");

function setStatus(message) {
    const text = message || "";
    matchMessageText.textContent = text;
    matchMessage.hidden = text.length === 0;
}

function formPayload() {
    return {
        education: educationInput.value.trim(),
        experience: experienceInput.value.trim(),
        preferredJobType: preferredTypeInput.value,
        preferredLocation: preferredLocationInput.value.trim(),
        preferredCategory: preferredCategoryInput.value.trim(),
        preferencesNote: preferencesNoteInput.value.trim()
    };
}

function renderSkills(skills) {
    skillList.replaceChildren();
    if (!skills.length) {
        const empty = document.createElement("p");
        empty.textContent = "No skills saved yet. Add them on your profile so matches can use them.";
        skillList.append(empty);
        return;
    }
    skills.forEach((skill) => {
        const tag = document.createElement("span");
        tag.className = "match-skill";
        tag.textContent = skill;
        skillList.append(tag);
    });
}

function renderMatches(data) {
    matchResults.replaceChildren();
    matchResults.setAttribute("aria-busy", "false");
    const matches = Array.isArray(data.matches) ? data.matches : [];

    if (data.summary) setStatus(data.summary);
    if (matches.length === 0) {
        const empty = document.createElement("p");
        empty.className = "match-callout";
        const emptyIcon = document.createElement("i");
        emptyIcon.className = "bi bi-info-circle";
        emptyIcon.setAttribute("aria-hidden", "true");
        const emptyText = document.createElement("span");
        if (data.status === "no_open_jobs") {
            emptyText.textContent = "No open jobs are available to recommend.";
        } else if (data.status === "unavailable") {
            emptyText.textContent = "Those jobs are no longer open. Try again to refresh the list.";
        } else if (data.status === "unverified") {
            emptyText.textContent = "The suggestions could not be verified against open jobs. Try again.";
        } else {
            emptyText.textContent = "No suitable matches for this profile. Add skills, experience, education, or preferences and try again.";
        }
        empty.append(emptyIcon, emptyText);
        matchResults.append(empty);
        return;
    }

    const basis = document.createElement("p");
    basis.className = "match-callout";
    const basisIcon = document.createElement("i");
    basisIcon.className = data.usedResume ? "bi bi-file-earmark-text" : "bi bi-file-earmark";
    basisIcon.setAttribute("aria-hidden", "true");
    const basisText = document.createElement("span");
    basisText.textContent = data.usedResume
        ? "A saved resume was included with your profile."
        : "No resume was included. These matches use your profile only.";
    basis.append(basisIcon, basisText);
    matchResults.append(basis);

    matches.forEach((match) => {
        const card = document.createElement("article");
        card.className = "match-card";

        const score = document.createElement("p");
        score.className = "match-score";
        score.textContent = `${match.matchScore}% match`;

        const title = document.createElement("h2");
        title.textContent = match.title || "Job";

        const meta = document.createElement("p");
        meta.className = "match-meta";
        meta.textContent = [match.company || "Company", match.location || "Location not listed", match.jobType || "Job type not listed"]
            .filter(Boolean)
            .join(" · ");

        card.append(score, title, meta);

        if (match.excerpt) {
            const excerpt = document.createElement("p");
            excerpt.textContent = match.excerpt;
            card.append(excerpt);
        }

        const reasonHeading = document.createElement("h3");
        reasonHeading.textContent = "Why this matches";
        const reason = document.createElement("p");
        reason.textContent = match.reason || "";
        card.append(reasonHeading, reason);

        appendList(card, "Evidence from your profile", match.evidence);
        appendList(card, "Gaps", match.gaps);

        if (match.href && match.jobId) {
            const link = document.createElement("a");
            link.href = match.href;
            link.textContent = "View job";
            card.append(link);
        }

        matchResults.append(card);
    });
}

function appendList(card, headingText, items) {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    if (values.length === 0) return;
    const heading = document.createElement("h3");
    heading.textContent = headingText;
    const list = document.createElement("ul");
    values.forEach((item) => {
        const line = document.createElement("li");
        line.textContent = item;
        list.append(line);
    });
    card.append(heading, list);
}

async function loadMatchProfile() {
    setStatus("");
    const response = await fetch("/api/job-matching/profile");
    if (response.status === 401) {
        window.location.href = "login.html";
        return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load your profile.");

    educationInput.value = data.education || "";
    experienceInput.value = data.experience || "";
    preferredTypeInput.value = data.preferredJobType || "";
    preferredLocationInput.value = data.preferredLocation || "";
    preferredCategoryInput.value = data.preferredCategory || "";
    preferencesNoteInput.value = data.preferencesNote || "";
    renderSkills(Array.isArray(data.skills) ? data.skills : []);
    profileNoteText.textContent = data.hasResume
        ? "A resume is saved on your profile and will be included when it can be read."
        : "No resume is saved. You can still get recommendations from your profile.";
}

async function recommendJobs() {
    recommendButton.disabled = true;
    retryMatches.hidden = true;
    matchResults.replaceChildren();
    matchResults.setAttribute("aria-busy", "true");
    setStatus("Comparing your profile with open jobs...");

    try {
        const response = await fetch("/api/job-matching", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formPayload())
        });
        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not recommend jobs.");
        renderMatches(data);
    } catch (error) {
        matchResults.setAttribute("aria-busy", "false");
        setStatus(error.message || "Could not recommend jobs. Please try again.");
        retryMatches.hidden = false;
    } finally {
        recommendButton.disabled = false;
    }
}

matchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    recommendJobs();
});

retryMatches.addEventListener("click", () => {
    recommendJobs();
});

loadMatchProfile().catch((error) => {
    profileNoteText.textContent = error.message || "Could not load your profile.";
    recommendButton.disabled = true;
    retryMatches.hidden = false;
});

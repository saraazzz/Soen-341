/**
 * Shared Navigation Component for CareerConnect
 * Centralizes the top header, sidebar navigation, hamburger toggle, and logout logic.
 */
(function () {
    const JOB_SEEKER_LINKS = [
        { label: "My Profile", href: "Profile.html", icon: "person" },
        { label: "Jobs", href: "jobs.html", icon: "briefcase" },
        { label: "Job Matches", href: "job-matches.html", icon: "stars" },
        { label: "My Applications", href: "my-applications.html", icon: "clipboard-check" },
        { label: "Dashboard", href: "Dashboard.html", icon: "house" },
        { label: "Settings", href: "settings.html", icon: "gear" },
        { label: "Logout", href: "#", icon: "box-arrow-right", id: "logout-link" }
    ];

    const EMPLOYER_LINKS = [
        { label: "My Profile", href: "Employer_Profile.html", icon: "person" },
        { label: "Post a Job", href: "employer-post-job.html", icon: "plus-circle" },
        { label: "Applicants", href: "employer-applicants.html", icon: "people" },
        { label: "Dashboard", href: "Employer_Dashboard.html", icon: "house" },
        { label: "Settings", href: "settings.html", icon: "gear" },
        { label: "Logout", href: "#", icon: "box-arrow-right", id: "logout-link" }
    ];

    function getActiveHref(currentFile) {
        const lower = currentFile.toLowerCase();
        if (lower === "job.html" || lower === "apply.html") return "jobs.html";
        if (lower === "edit_profile.html") return "Profile.html";
        if (lower === "employer_edit_profile.html") return "Employer_Profile.html";
        return currentFile;
    }

    async function detectRole() {
        const container = document.getElementById("navbar-container") || document.getElementById("app-navbar");
        const explicit = document.body?.dataset.role || container?.dataset.role;
        if (explicit === "employer" || explicit === "recruiter") return "employer";
        if (explicit === "job_seeker" || explicit === "seeker") return "job_seeker";

        const filename = (window.location.pathname.split("/").pop() || "").toLowerCase();
        if (filename.startsWith("employer_") || filename.startsWith("employer-")) {
            sessionStorage.setItem("careerconnect_role", "employer");
            return "employer";
        }

        if (filename && filename !== "settings.html") {
            sessionStorage.setItem("careerconnect_role", "job_seeker");
            return "job_seeker";
        }

        // For settings.html, check cache first, then API
        const cached = sessionStorage.getItem("careerconnect_role");
        if (cached === "employer" || cached === "job_seeker") {
            return cached;
        }

        try {
            const res = await fetch("/api/profile");
            if (res.ok) {
                const profile = await res.json();
                if (profile.role) {
                    sessionStorage.setItem("careerconnect_role", profile.role);
                    return profile.role;
                }
            }
        } catch (_) {}

        return "job_seeker";
    }

    function renderNavbarHtml(role) {
        const currentFile = window.location.pathname.split("/").pop() || "index.html";
        const activeTarget = getActiveHref(currentFile);
        const links = role === "employer" ? EMPLOYER_LINKS : JOB_SEEKER_LINKS;

        const linksHtml = links.map(link => {
            const isActive = link.href.toLowerCase() === activeTarget.toLowerCase();
            const activeClass = isActive ? ' class="active"' : "";
            const idAttr = link.id ? ` id="${link.id}"` : "";

            return `
                <li>
                    <a href="${link.href}"${activeClass}${idAttr}>
                        <i class="bi bi-${link.icon}"></i>
                        <span>${link.label}</span>
                    </a>
                </li>`;
        }).join("");

        return `
        <header class="top-header">
            <button id="hamburger" class="hamburger" aria-label="Toggle navigation" aria-expanded="false" aria-controls="main-nav">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <a class="brand-link" href="${role === "employer" ? "Employer_Dashboard.html" : "jobs.html"}" aria-label="${role === "employer" ? "Go to dashboard" : "Go to jobs"}">
                <img class="header-logo" src="images/careerconnect-logo.png" alt="CareerConnect">
            </a>
        </header>

        <nav id="main-nav" class="navbar" aria-label="Main navigation">
            <ul class="nav-links" id="nav-links" data-navbar-managed="true">
                ${linksHtml}
            </ul>
        </nav>
        `.trim();
    }

    async function initNavbar() {
        const container = document.getElementById("navbar-container") || document.getElementById("app-navbar");
        if (!container && document.querySelector(".top-header")) {
            return;
        }

        const role = await detectRole();
        const html = renderNavbarHtml(role);

        if (container) {
            container.outerHTML = html;
        } else if (!document.querySelector(".top-header")) {
            document.body.insertAdjacentHTML("afterbegin", html);
        }

        if (!document.body.classList.contains("nav-collapsed")) {
            document.body.classList.add("nav-collapsed");
        }
    }

    // Intercept clicks on hamburger and logout across the application
    document.addEventListener("click", async (e) => {
        const hamburger = e.target.closest("#hamburger");
        if (hamburger) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const isCollapsed = document.body.classList.toggle("nav-collapsed");
            hamburger.setAttribute("aria-expanded", String(!isCollapsed));
            return;
        }

        const logoutLink = e.target.closest("#logout-link");
        if (logoutLink) {
            e.preventDefault();
            e.stopImmediatePropagation();
            try {
                const res = await fetch("/api/logout", { method: "POST" });
                if (res.ok) {
                    alert("You have been logged out.");
                }
            } catch (err) {
                console.error("Logout error:", err);
            } finally {
                sessionStorage.removeItem("careerconnect_role");
                window.location.href = "login.html";
            }
        }
    }, true);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNavbar);
    } else {
        initNavbar();
    }
})();

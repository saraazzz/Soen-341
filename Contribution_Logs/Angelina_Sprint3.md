---

# Sprint 3 Contribution Log — Angelina Yajaira Montano

**Project:** CareerConnect  
**GitHub username:** aymontano1  
**Estimated time:** 
- Recruiter Dashboard & Applicant Navigation: **4 hours**
- Recruiter Access Control & Backend Updates: **3 hours**
- Automated Unit & Acceptance Testing: **3 hours**
- Sprint 3 Demo Preparation & Team Checkpoint: **2 hours**
- Meetings & Coordination: **approximately 3 hours**  
**Total estimated time:** **approximately 15 hours**.

| Date / work period | Activity | Detailed contribution and outcome | Time (hours) | Supporting evidence |
| --- | --- | --- | --- | --- |
| November 5, 2026 | Sprint 3 Kickoff Meeting & Planning | Participated in the Sprint 3 planning session. Locked down feature ownership with teammates: owned recruiter applicant review, recruiter resume access control, posting-specific filtering, and agreed on applicant handoffs and schema compatibility. | 1.5 | [Nov 5 kickoff minutes](../Meeting%20minutes.md), [Sprint 3 Guidelines](../../SOEN341_CareerConnect_Sprint3.pdf) |
| November 11, 2026 | Recruiter Dashboard & Applicant Navigation | Updated `Employer_Dashboard.js` to add a direct "View Applicants" link per job posting passing `job_id` via URL parameters. Updated `employer-applicants.js` to parse `job_id` and filter applicants by both posting and status, adding contextual empty states. | 4 | [Commit 85919b1](https://github.com/zayum20/Soen-341/commit/85919b1), [Employer_Dashboard.js](../new_code/public/Employer_Dashboard.js), [employer-applicants.js](../new_code/public/employer-applicants.js) |
| November 11, 2026 | Backend Data Serialization & Access Control | Updated `application-metrics.js` (`EMPLOYER_LIST_SQL` and `presentEmployerApplication`) to expose `job_id` in API responses so frontend cards accurately map candidates. Verified backend authorization in `server.js` and `application-metrics.js` enforcing job ownership (`jobs.employer_id === session.userId`). | 3 | [Commit 85919b1](https://github.com/zayum20/Soen-341/commit/85919b1), [application-metrics.js](../new_code/server/application-metrics.js) |
| November 11, 2026 | Local Database Migration Execution | Ran and verified database migration `002_link_submitted_application_resumes.sql` in local MySQL using `/usr/local/mysql/bin/mysql`, confirming `submitted_resume_file` and `submitted_resume_original_name` columns exist for resume persistence. | 1 | [Migration 002](../new_code/migrations/002_link_submitted_application_resumes.sql) |
| November 11, 2026 | Automated Acceptance & Unit Testing | Authored comprehensive automated acceptance tests in `test/sprint3-acceptance.test.js` validating: 401 unauthenticated access rejection, 403 non-employer role rejection, owner permission validation for resume download vs competitor recruiter denial, and legacy application backward compatibility. Verified all 21 test suite tests pass. | 3 | [sprint3-acceptance.test.js](../new_code/test/sprint3-acceptance.test.js) |
| November 11–12, 2026 | Checkpoint Demo & Walkthrough | Prepared and demonstrated feature workflow: opening applicants per posting, filtering by status, updating status, viewing resume as owner, proving 401/403 denial in private window/separate account, and verifying backward compatibility on older rows. | 2.5 | [Nov 11 Checkpoint Script](../SPRINT3_DEMO.md) |
| **Total** | | | **15 (including meetings)** | |
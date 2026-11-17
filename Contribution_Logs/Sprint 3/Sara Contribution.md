# Sara Azmoon — Sprint 3 Individual Contribution Log

**Project:** CareerConnect — Job Search and Application Tracking Platform  
**Course:** SOEN 341 — Software Process  
**Total Estimated Time Spent:** 15.5h

## Contribution Overview

During Sprint 3, my contributions focused on recruiter posting management, dashboard updates, optional application deadlines, automatic archiving, testing, database integration, and project documentation.

I used ChatGPT/Codex to assist with implementation, debugging, testing, and documentation. I approved changes incrementally, reviewed explanations and demonstrations, and handled commits, pushes, pull requests, and merges myself.

## Detailed Contribution Log

| # | Contribution | Date | Time Spent | Description | Related Evidence |
|---|---|---|---|---|---|
| 1 | Posting Editing and Ownership Protection | November 12 | 1.5h | Added an owner-protected editing endpoint and form controls for updating posting details. Implemented loading existing values, saving changes, cancelling unsaved edits, validation, and request feedback. Verified that edits persisted after refresh. | [PR #85](https://github.com/zayum20/Soen-341/pull/85), posting-edit tests |
| 2 | Posting Archiving | November 12–13 | 1.5h | Implemented archiving without deleting postings or existing applications. Added confirmation controls and archived labels. Archived postings disappear from seeker search and reject new applications while existing applicants remain accessible. | PR #85, migration 003, posting-archive tests |
| 3 | Recruiter Dashboard Updates | November 12–13 | 1h | Added separate active and archived posting counts while retaining the total count. Added availability labels to recent postings and loading/error handling for the new counts. Verified totals against local records. | PR #85, recruiter dashboard files |
| 4 | Applicant Navigation Integration | November 13 | 0.5h | Integrated Angelina’s posting-specific applicant links and filtering with my dashboard changes. Resolved the overlapping dashboard conflict while preserving both contributors’ features. Verified that status filtering remained scoped to the selected posting, including archived postings. | PR #85 merge resolution, acceptance record |
| 5 | Application Submission Reliability | November 13 | 1h | Fixed a timing issue that could allow an application after archiving by checking availability within the database insert. Added cleanup of unused resume copies and distinguished unavailable postings from duplicate applications in the seeker message. | PR #85 follow-up commits, regression tests |
| 6 | Optional Application Deadlines | November 13 | 2h | Proposed and implemented optional deadlines in both recruiter posting forms and editing. Blank dates mean no deadline. Added Toronto-time cutoffs, UTC storage, daylight-saving handling, and saved deadline labels. Verified loading, persistence, and deadline removal. | [PR #86](https://github.com/zayum20/Soen-341/pull/86), migration 004, deadline tests |
| 7 | Automatic Expiry Archiving | November 13 | 1h | Added a background check at startup and every minute to archive expired postings. Search and application saving enforce expiry immediately between checks. Verified that a fictional expiring posting was archived while a no-deadline control stayed active. | PR #86, deadline archiver and tests |
| 8 | Local Environment and Database Integration | November 12–13 | 1.5h | Troubleshot MySQL login and connection issues, configured the private local environment file, and repaired the dependency lock file. Tested migrations on temporary databases, backed up the class database, and applied migrations 002, 003, and 004 with record-preservation checks. | Migration documentation, local validation records |
| 9 | Automated and Live Acceptance Testing | November 12–13 | 2h | Added focused editing, archiving, deadline, and worker tests. Validated browser and API flows using fictional accounts and postings. Confirmed another recruiter could not edit or archive an owner’s posting. The final deadline-stage local suite passed 65 tests, and PR CI passed. | PRs #85–86, `SPRINT3_SARA_ACCEPTANCE.md` |
| 10 | GitHub and Team Integration | November 12–16 | 1h | Organized changes into small commits, prepared PR descriptions, pushed changes, and merged PRs #85 and #86. Requested Tasneem’s review of deadlines because of their connection to notifications. Provided the shared UTC deadline field for reminder integration; notification delivery remained her contribution. | PRs #85–86, review request |
| 11 | Sprint 3 Meeting Documentation | November 16 | 1h | Prepared records for the November 5, 11, 13, and 15 meetings, documenting attendance, demonstrations, decisions, and follow-up actions. Used retrospective confirmations and the shared update for the November 15 meeting, which I did not attend. Recorded the decisions to defer deployment to Sprint 4 and retain the current analytics presentation. | `minutes/sprint-3/` |
| 12 | Demo Preparation and Submission Documentation | November 12–16 | 1.5h | Prepared walkthroughs explaining how to demonstrate posting creation, editing, cancellation, archiving, applicant preservation, permissions, and deadlines. Maintained acceptance and AI usage records. Reviewed team work and prepared an editable one-page team submission summary with all members’ names and the repository link. | Acceptance record, AI log, team submission summary |

**Total Time:** 15.5h

## Implementation Evidence

- **[PR #85 — Recruiter Posting Management](https://github.com/zayum20/Soen-341/pull/85):** Posting editing, archiving, dashboard updates, permission checks, reliability fixes, and applicant-navigation integration.
- **[PR #86 — Optional Deadlines and Automatic Archiving](https://github.com/zayum20/Soen-341/pull/86):** Optional deadline controls, timezone handling, expiry enforcement, automatic archiving, and tests.
- **Additional evidence:** Migration files, `new_code/SPRINT3_SARA_ACCEPTANCE.md`, Sprint 3 meeting minutes, AI usage documentation, and GitHub CI results.

## Challenges and Resolutions

**Local database compatibility:** Missing submitted-resume fields caused application loading errors. After reviewing the schema, migrations were tested and applied with backups and checks that existing records remained intact.

**Shared dashboard changes:** My archive labels overlapped with Angelina’s applicant links. The conflict was resolved by combining both features and testing posting-specific filtering.

**Archiving during application submission:** Review identified a gap between checking posting availability and saving an application. The insert was changed to enforce availability during the write, with regression tests.

**Deadline handling:** Toronto dates required conversion to UTC across daylight-saving changes. Tests covered seasonal offsets and the closing boundary. Immediate request checks enforce expiry even between background-worker runs.

## Summary

My Sprint 3 work completed recruiter posting editing and archiving, improved dashboard visibility, and added optional deadlines with automatic expiry handling. I also supported integration, testing, database setup, meeting records, demonstration preparation, and submission documentation.

I preserved teammate contributions during integration and distinguished my work from applicant-navigation, analytics, AI feedback, and notification implementations owned by other members.

AI assisted with code generation, debugging, testing, and drafting. I guided the requirements, approved actions, reviewed results, and managed GitHub delivery. Validation limitations were recorded rather than treating every feature as fully demonstrated.

## AI Chat — Sprint 3 Planning and Meeting Documentation

**Responsible Person:** Sara Azmoon  
**AI Tool:** Codex / ChatGPT (OpenAI)  
**Sprint:** 3  
**Conversation Period:** November 5–16, 2026  
**Chat Link:** https://chatgpt.com/s/cx_6afbaefa86bc8191b29b355b83e73e66

**Purpose of AI Use:**  
Review Sprint 3 requirements, organize responsibilities and meeting checkpoints, inspect repository progress, and prepare meeting minutes.

**AI-Suggested Content:**  
AI reviewed the sprint guidelines and GitHub code, issues, PRs, and Sprint 2 records. It proposed task assignments, identified remaining work, and drafted separate Markdown minutes for November 5, 11, 13, and 15 using the Sprint 2 format.

**Validation:**  
I confirmed meeting times, attendance, demonstrations, remaining work, and decisions using my recollection and a teammate’s chat update. AI checked repository records and the latest successful CI run. I clarified that meetings involved regular demonstrations, with no formal test sessions.

**Decision:**  
Modified before use. I corrected assumptions about recruiter resume viewing, confirmed that online hosting moved to Sprint 4, and supplied missing meeting details. The files were prepared locally for me to review and commit manually.

**Reflection:**  
AI helped organize the planning and documentation. Human review was necessary to distinguish proposed work, implemented features, meeting demonstrations, and verified test results.

## AI Chat — Sprint 3 Posting Management, Deadlines, Testing, and Integration

**Project:** CareerConnect — Job Search and Application Tracking Platform  
**Course:** SOEN 341 — Software Process  
**Sprint:** Sprint 3  
**Responsible Person:** Sara Azmoon  
**AI Tool:** Codex / ChatGPT (OpenAI)  
**Conversation Period:** November 12–16, 2026  
**Chat Link:** https://chatgpt.com/s/cx_6afbafc803dc81918844ece7131fcc10

### Purpose of AI Use

AI was used to review my Sprint 3 responsibilities, inspect the existing repository, implement recruiter posting-management features, troubleshoot the local environment, write tests, and prepare acceptance records and demonstration instructions.

I requested incremental changes with explanations and clear code comments. I approved actions before they were performed and handled commits, pushes, pull requests, and GitHub merges myself.

### AI-Suggested and Generated Content

**Posting editing and ownership protection**

AI implemented an owner-protected posting-edit endpoint and frontend controls for loading, editing, saving, and cancelling changes. Editable fields included title, company, location, category, job type, and description. Tests covered valid updates, invalid input, authentication, ownership restrictions, and database failures.

**Posting archiving and dashboard updates**

AI implemented archiving without deleting postings or their existing applications. Archived postings were excluded from seeker search and blocked from accepting new applications.

The recruiter interface gained archive controls, a confirmation prompt, archived labels, and separate active and archived counts alongside the total posting count.

**Applicant navigation integration**

AI reviewed the teammate’s existing posting-specific applicant-navigation work. After that work reached main, AI helped resolve a dashboard conflict while preserving both the teammate’s View Applicants links and my archive labels and counts.

The applicant navigation and filtering were teammate contributions integrated with my posting-management work.

**Optional deadlines and automatic archiving**

I proposed adding an optional application deadline to support posting closure and the teammate’s upcoming-deadline notifications.

AI implemented deadline fields in both recruiter posting forms and posting editing. Blank values mean no deadline. The selected date closes at the start of the following day in Toronto time, with the closing instant stored in UTC and daylight-saving changes handled.

Search and application saving enforce expiry immediately. A background process archives expired postings at startup and every minute while the server runs. Existing applications remain accessible, and postings without deadlines remain open.

Notification delivery was not implemented in this conversation. The deadline field was made available for the teammate responsible for notifications.

**Debugging, database setup, and documentation**

AI helped diagnose MySQL authentication and connection issues, create a local environment file, and repair an incomplete dependency lock file.

AI also created migrations, tested schema changes on separate temporary databases, backed up the local class database before approved migrations, and verified that existing records remained intact.

AI drafted acceptance results, commit descriptions, pull-request descriptions, and customer demonstration instructions.

### Validation

Validation combined automated tests, live API requests, browser checks, database inspection, and GitHub CI evidence.

- Editing loaded saved fields, saved changes persisted after refresh, and cancelling discarded unsaved edits.
- Archiving persisted after refresh, removed postings from search, and preserved existing applicants.
- Posting-specific applicant links and status filtering worked for the archived sample.
- A separate fictional recruiter could not list, edit, or archive another recruiter’s posting. Edit and archive requests returned HTTP 404, and a database comparison confirmed the posting remained unchanged.
- Fresh fictional postings accepted applications while active. After archiving, new submission requests were rejected while existing applications remained in seeker history.
- The seeker browser displayed that archived postings were unavailable and hid the application form.
- Deadline creation, loading, removal, timezone conversion, and persistence were checked.
- A short test deadline was set directly on a fictional local posting to demonstrate automatic expiry. The background worker archived it while a no-deadline control posting remained active.
- The final local automated suite passed 65 tests. Syntax and whitespace checks also passed.
- GitHub screenshots confirmed passing CI and successful merges for PR #85 and PR #86.

**Validation limits:** The concurrent archive/submission case was simulated in automated tests. The revised rejection message for a page archived while already open was not visually reproduced. The dashboard deadline field was visually inspected, while the full posting form’s deadline save/removal flow was exercised in the browser. Notification delivery remained outside this work.

### Decision

**Modified before use and accepted after incremental review and testing.**

AI-generated changes were adapted to the existing project and implemented in small steps. Repository updates were reviewed before integration, and conflicts were resolved by preserving both contributors’ features.

Additional defects found during review were corrected, including an application-save race during archiving and an inaccurate duplicate-application message.

I handled GitHub actions manually. PR #85 merged the posting-management work, and PR #86 merged optional deadlines and automatic archiving. Tasneem was requested as a reviewer for the deadline work because of its connection to notifications; her approval was not confirmed in this conversation.

### Reflection

AI helped connect frontend controls, backend permissions, database changes, and tests into a complete posting-management workflow. The explanations and comments helped me understand how the features worked rather than only copying code.

I learned that hiding a button does not prove authorization: permission checks must also be verified on the server. I also learned that passing tests does not replace browser checks, and that updating application code may require database migrations and a server restart.

The work reinforced the importance of preserving teammate contributions, using small commits, recording test limitations honestly, and coordinating shared fields before building related features.

### Outcome

- Owner-protected posting editing implemented.
- Manual archiving implemented without deleting application history.
- Recruiter dashboard availability counts and labels added.
- Teammate’s posting-specific applicant navigation integrated.
- Optional Toronto-time deadlines and automatic expiry archiving implemented.
- Database migrations tested and applied locally after backups.
- Acceptance results and demonstration instructions documented.
- Final local suite passed 65 automated tests.
- Changes merged through PR #85 and PR #86.
- Deadline data prepared for notification integration; notification delivery remained the teammate’s responsibility.

**AI Contribution:** Repository inspection, direct local code generation and editing, debugging, migration preparation and execution after approval, automated tests, live API and browser checks, conflict resolution, and documentation drafts.

**Human Contribution:** Defining requirements, proposing optional deadlines, approving actions, providing local configuration and account access, reviewing demonstrations and changes, creating commits and pull requests, pushing and merging changes, and coordinating with teammates.

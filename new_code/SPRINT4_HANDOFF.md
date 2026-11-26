# Sprint 4 handoff: remaining tasks

Prepared November 25 for the November 30 submission. This is the proposed continuation of the earlier task split, not proof that teammates have not already completed these items on other branches. Confirm status and owners at today's meeting. Target stack: Vercel + MySQL-compatible TiDB Starter + private R2 storage, subject to account eligibility.

## Angie re-review — November 26

PR #95 now points to `07aab2a` on `feature/sprint4-db-and-access-control`. This supersedes the November 25 review status below. Main was merged into her branch; no merge into Sara's branch and no GitHub review submission were performed.

Confirmed improvements: profile uploads now use `PROFILE_RESUME_DIR`; the resume-builder router follows session middleware (focused tests return 401 anonymously and 200 after login). Migration 007 now creates a missing table and checks the ownership column and foreign key independently; this revised migration has been inspected but not executed in this re-review.

Remaining blockers:

1. `server/routes/feedback.js:137–178`: merge retained the old public-file reader, references undefined `path`, `fs`, `WordExtractor`, and `parts`, and removed the limiter call. Restore main's shared `readResumeParts` and limiter blocks; the shared reader now resolves private profile files. Existing feedback tests fail with HTTP 500 (`path is not defined`).
2. `server/server.js:188–192`: the legacy `/uploads` extension guard checks the encoded URL. A fictional `/uploads/review-private.pdf` returns 403, but `/uploads/review-private%2epdf` returns 200 without login. Remove/migrate legacy private documents out of the static tree and test encoded URLs; Vercel's static CDN also bypasses Express middleware.
3. New private profile filenames are not read by `routes/job-matching.js:69–73`, which still resolves only `public/uploads`. Adapting its existing resume test to a private filename produces `usedResume: false`. Coordinate with Ayza to use the shared reader and preserve optional-resume behavior.

Validation on installed Node v24.22.0 in an isolated archive: existing Jest suite 110 passed / 17 failed (3 failing suites); Node suite 37 passed. Four focused review checks confirmed builder behavior and reproduced the legacy URL bypass. A separate private-path matching test reproduced the missing resume. Provider calls and application queries were mocked; no hosted database or R2 contents were changed. Node 22 was not rerun because its temporary download cache was no longer present.

## Earlier Angie review — November 25

Angie submitted Tasks 1–7 on `feature/sprint4-db-and-access-control`, reviewed locally at `65e6f4a`. Treat these tasks as submitted / changes requested, not unstarted. The resume-builder ownership task is now implemented in her PR and no longer needs a separate owner assignment, but its middleware ordering needs correction.

Verified review blockers:
- `/api/resumes` is still mounted before session middleware. Both anonymous and logged-in list requests return 500.
- Profile uploads still write to `public/uploads`; a new fictional PDF was retrievable without authentication. `PROFILE_RESUME_DIR` currently affects resolution, not upload destination. Legacy documents also remain publicly served.
- Migration 007 fails on a fresh database without `resumes`; it also skips the foreign key when `user_id` already exists. Both cases reproduced in a disposable MySQL database.
- Her branch must integrate current main: `routes/feedback.js` conflicts with Elfy's shared-AI refactor. Renaming the deadline migration to 005 also collides numerically with main's 005 matching-profile migration; document already-applied migrations without rerunning the same ALTER statements.

Validation: the branch's existing 57 Jest tests plus 37 Node tests passed. Two extra review-only reproductions demonstrated the first two issues; no new regression tests are present in the submitted diff. Temporary tests did not modify either source branch or the application database. No GitHub review was posted and no merge was performed.

Deployment impact: preserve Angie's ownership/query work during integration, adapt Elfy's shared reader to the approved storage interface, and remove the deprecated `jobs.deadline` requirement from Sara's hosted preflight after migration 006 is integrated. R2 storage is still a separate integration: a configurable local directory alone is not persistent on Vercel.

## Sara — deployment and release integration

Prepared locally: closed-posting feedback fix; persistent sessions; health checks; production settings; Vercel entry point and connection pools; authenticated daily maintenance; read-only database preflight; R2 client configuration and read-only bucket access check; deployment/release instructions. Manual commits/pushes are still Sara's responsibility. The R2 client does not yet connect the application's file routes to cloud storage.

November 25 validation: latest main (`ecfb5f9`) plus Sara's changes passed 185 tests on Node 22 in an isolated copy. The later R2 client passed 8 targeted tests. Main has not been merged into Sara's branch. The Git remote was updated to `https://github.com/saraazzz/Soen-341.git` after ownership transfer; nothing was pushed.

Remaining:
1. Review and manually commit changes in the groups in VERCEL_SETUP.md; coordinate merge of `server/server.js` with Angie.
2. Sign in/create Vercel and TiDB accounts. Complete R2 account/billing setup personally. Record account owner and free quotas privately.
3. With Angie, apply the reviewed schema to the hosted instance; run the read-only preflight and full feature checks. Configure secrets privately.
4. Integrate the final storage adapter and ownership fixes; deploy a protected candidate and run the release checklist.
5. Verify real redeployment preserves users, applications, sessions, profile documents, submitted copies, and avatars. Confirm the scheduler works.
6. Record URL, deployed commit, test results, known limitations, and rollback/backup procedure. Coordinate final rehearsal/submission.

Done means: a tested accessible URL and recorded release evidence, not only a successful build.

## Angie — database and private resume integration

Earlier agreed work: migrations/schema and protected profile resumes. The following cloud-storage adaptation is proposed coordination work to confirm with her, because moving local folders alone does not work on Vercel.

1. Review/apply the schema on TiDB; resolve schema-name assumptions, track both 004 files separately, reconcile resume-builder table definitions, and preserve existing data when migrating.
2. Confirm the shared storage interface before further upload changes. Implement or coordinate private object storage for profile resumes, submitted resume snapshots, additional application documents, and avatars.
3. Replace local-path reads/writes across uploads, previews, downloads, replacement/deletion, and snapshot copying. Keep submitted snapshots after a profile resume changes.
4. Enforce authentication and ownership before downloads or signed links; validate uploaded content/size and ensure direct uploads cannot claim another user's object.
5. Coordinate Vercel's request-size limit: the current 10 MB-per-file form needs a direct-upload flow or a revised total size policy, consistently enforced in the UI and backend.
6. Check candidate-profile access (`/api/candidates/:id`) as part of the privacy review; it currently lacks a route-level login check.
7. Provide the final storage environment names and migration order to Sara. Test owner, other seeker, unrelated employer, permitted employer, and logged-out access.

Done means: private files survive a redeploy and unauthorized access fails, with both AI features still able to read authorized resumes.

## Resume-builder ownership — Angie PR submitted; fixes pending

Angie has now included this work in Tasks 1–7. Review and complete it in her PR; Sara verifies the integrated release.

1. Move the builder API behind session middleware.
2. Add/enforce owner identity for saved resumes; derive it from the session, never the request body.
3. Scope list/read/update queries to that owner. Define safe handling of old records with no owner rather than exposing them to everyone.
4. Test seeker A/B and logged-out access, including guessed record IDs. Coordinate the schema migration with Angie.

Done means: one user cannot list, read, or change another user's builder documents.

## Elfy — AI resume feedback

1. Confirm the existing feedback feature works with the shared hosted Gemini key/model configuration.
2. Replace local resume-file assumptions with the agreed private-storage reader alongside Angie.
3. Check supported file formats, missing/invalid resumes, provider failures, and key/quota errors produce understandable messages.
4. Verify feedback is restricted to the authorized user's resume; run a live hosted example with a fictional document.
5. Supply test/demo evidence and the required personal AI-use record.

## Ayza — AI job matching

1. Confirm the second feature is integrated from her latest branch; it is already present in the reviewed main revision, so do not recreate it.
2. Adapt resume reads to the shared private storage helper.
3. Verify profile/preferences and resume content produce relevant matches, with archived/expired postings excluded.
4. Test missing inputs, no matches, provider failure, and API quota/key problems; do not expose the key to browser code.
5. Run the feature on the deployed candidate and supply test/demo evidence and the personal AI-use record.

## Aminata — CI and static analysis

1. Run the agreed checks on the final integrated revision, including the new Vercel/readiness/maintenance tests.
2. Use the chosen supported Node runtime and lockfile; confirm CI does not require teammates' real `.env` files or live API keys for automated tests.
3. Review static-analysis failures and assign code fixes to their feature owners; verify resolved findings.
4. Record the passing workflow/revision and remaining findings for the final report. Keep hosted manual testing separate from mocked automated checks.

## Tasneem — notifications and final documentation

1. Confirm notification behavior for applications, status changes, interview invites, and implemented deadline reminders on the integrated build.
2. Reconcile `deadline` versus `deadline_at` with Angie; verify expected Toronto-date behavior. The new daily maintenance route does not send reminders.
3. Check user isolation and read/read-all behavior; verify notifications remain after redeployment.
4. Coordinate final feature descriptions/screenshots and assigned report/demo material against the Sprint 4 PDF, using the actual deployed behavior.
5. Supply test/demo evidence and the personal AI-use record.

## Team decisions for today's meeting

- Has anyone already configured hosting or storage? Reuse that work if appropriate.
- Confirm Vercel/TiDB/R2, account owner, R2 billing responsibility, and quota monitoring.
- Confirm the cloud-storage implementation owner; Angie has now submitted resume-builder ownership in her PR, with review fixes pending.
- Agree an integration cutoff before the November 29 rehearsal. Each owner gives a short update: done, remaining, blocker, next delivery.
- Confirm who submits the final required artifacts on November 30. Every member verifies their required personal contribution/AI-use material against the course PDF.

## Sara R2 integration — November 26, uncommitted

Hosted storage adapters are implemented on Sara's release branch: profile resumes, public-facing avatars in a private bucket, immutable application document copies, authenticated application downloads, and both AI reads. Live dummy-object upload/copy/read/signed-download/delete passed; no real user files were touched. See VERCEL_SETUP.md for configuration/limits and MANUAL_COMMITS.md for whole-file commit groups.

This is not a merge of main or PR #95. After Angie fixes the pending review issues, preserve her local private-file routes and ownership checks alongside Sara's cloud routes. Elfy's current shared AI reader/rate limiter must remain authoritative when integrating the R2 read branch. Ayza verifies matching uses cloud and private local resumes. Sara imports the reviewed schema, configures Vercel secrets, deploys, and verifies persistence with the team.

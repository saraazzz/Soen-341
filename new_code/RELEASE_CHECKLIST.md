# Sprint 4 release checklist

Submission: November 30. This is an execution checklist, not a claim that deployment has passed. Sara records the final evidence with the relevant feature owner.

## Evidence already collected

- Base reviewed: `e8eef1e`; Sara's completed local commits: `61d0fb6` and `8e1817d`.
- November 25: an isolated copy of latest main (`ecfb5f9`) plus Sara's deployment changes passed 19 Jest suites / 143 tests and 42 Node tests (185 total) on Node v22.23.5. This is a compatibility check, not a merge into Sara's branch, and excludes Angie's pending PR. Vercel's actual hosted build still needs verification.
- The subsequently added R2 client passed 8 targeted tests on Node 22. This was the initial client-only evidence; see the November 26 integration evidence below.
- Separate isolated MySQL check passed: missing session table rejected, login survived a session-store restart, logout invalidated the saved session. The application database was not modified.
- November 26: live TiDB login/TLS and the read-only R2 bucket access check passed. TiDB's application database is not yet created; R2's dashboard confirms public access disabled. No application data or files were written by these checks.
- Hosted TiDB schema/feature checks, Vercel build/restart, live Gemini requests, integrated-release checks, and the browser release checks below have not been run.
- Follow [VERCEL_SETUP.md](VERCEL_SETUP.md) for the preferred stack and [SPRINT4_HANDOFF.md](SPRINT4_HANDOFF.md) for each teammate's remaining work.

- November 26: R2 integration implemented; live synthetic upload/copy/read/signed-download/delete passed with dummy objects only. Hosted application/browser acceptance remains pending.

## Before publishing

- [ ] Sara: finish account connections for the selected Vercel/TiDB/R2 stack; confirm quotas through evaluation. Git remote now points to the transferred repository under `saraazzz`. No paid upgrade.
- [ ] Sara: review changes and manually commit/push the release branch; integrate through the team's review process.
- [ ] Angie: finalize migrations, resolve schema naming/004 numbering tracking and resume-builder table differences; verify preservation of existing records.
- [ ] Angie + Sara: agree durable file storage and configure private profile resumes, application snapshots, avatars, and temporary uploads.
- [ ] Angie: protect profile resume downloads with authentication and ownership checks.
- [ ] Angie (submitted in PR at `65e6f4a`, review fixes pending): protect resume-builder list/read/create/update endpoints. Move the router after sessions and verify logged-in/anonymous/cross-user behavior. Sara verifies the integrated release.
- [ ] Elfy + Ayza + Angie: update both AI resume readers to use the final storage helper.
- [ ] Sara: configure HTTPS, proxy trust, MySQL TLS as applicable, sessions table, session secret, Gemini key, and health check.
- [ ] Aminata/team: run the agreed CI/static analysis on the integrated release revision; record results.

## Hosted browser acceptance

Use two seekers (A/B) and two employers (A/B) in separate browser sessions, with fictional resumes R1/R2. Record PASS/FAIL and evidence for each row; a checkbox alone is not execution evidence.

| Check | Expected result | Result / evidence |
| --- | --- | --- |
| Health | `/health/live` and `/health/ready` return 200; no credentials in responses | Not run |
| Account lifecycle | Register/login for both roles, navigate protected pages, logout denies protected API access | Not run |
| Ownership | Seeker B cannot list/read/change A's builder resumes or download A's private resume; unauthenticated requests denied | Not run |
| Recruiter authorization | Employer A can access applications to A's jobs; B cannot access those private documents | Not run |
| Profiles/uploads | Allowed fictional file uploads and avatar changes work; invalid/oversized files rejected according to the final upload policy | Not run |
| Immutable application | Apply using R1, replace profile with R2; submitted application still serves R1 | Not run |
| Application/status | Submit once, duplicate rejected correctly; employer status change appears in seeker tracker and analytics | Not run |
| Closed posting race | Open application page, archive posting elsewhere, submit; page explains closure rather than duplicate application | Not run |
| Deadline | Expired posting cannot receive applications; existing application remains visible | Not run |
| AI feedback | Authorized seeker receives feedback from the stored resume; missing resume/provider failure handled visibly | Not run |
| AI job matching | Authorized seeker receives matching results for open jobs; archived/expired jobs excluded | Not run |
| Notifications | Application/status/deadline behavior agrees with Tasneem's implemented feature requirements | Not run |
| Real redeploy | While logged in, redeploy same secret/database/storage; login, accounts, applications, avatars, and resumes survive | Not run |
| Logout persistence | Reusing the logged-out session after restart does not restore access | Not run |
| Mobile and second browser | Main registration, browsing, apply, and recruiter flows remain usable | Not run |

## Suggested remaining meetings

1. November 25–26, 20 minutes: Sara and Angie agree hosting/storage/schema; feature owners confirm integration dependencies. Record exact responsibilities and blockers.
2. November 27–28, 30 minutes: whole-team integration check on the deployed candidate; execute the cross-account and restart scenarios, assign failures.
3. November 29, 30 minutes: final demonstration rehearsal, verify evidence/report/video requirements against the Sprint 4 PDF, confirm submission owner and backup plan.

Use short asynchronous updates between meetings: completed task, blocker, next action. These dates are a proposal, not meetings already booked. Leave November 30 for final verification and submission.

## Release record (fill after deployment)

- Public URL: pending
- Deployed commit: pending
- Hosting owner and free quota checked: pending
- Database migration filenames/date: pending
- File storage and retention verified: pending
- Browser testers/date: pending
- AI checks completed by: pending
- Known failures and owners: pending
- Previous working revision and backup location (no secrets): pending
- Submission evidence/report/demo owner: pending

## Dependency audit follow-up

November 26: npm audit reports 20 affected dependency entries (19 moderate, 1 high). The high advisory is the nested mysql2 3.10.2 used by express-mysql-session, not the app's direct mysql2 3.24.6 or the new AWS packages. A package override did not refresh the locked nested copy and was reverted; no fix is claimed. Resolve and retest session persistence before deployment. Remaining moderate entries largely involve the Jest toolchain. Do not blindly apply npm audit fix --force, which proposes major downgrades.

## R2 integration test record

November 26: current Sara branch plus uncommitted integration passes 22 Jest suites / 123 tests and 42 Node tests (165 total) on local Node 24.22.0. This is not a test of latest main plus Angie; run that combined revision on deployment Node 22 before release. Live synthetic R2 upload/copy/read/signed download/delete passed. Browser tests and real Gemini calls were not performed.

# Sara's manual commit checklist

Working checkout: `/Users/saraazmoon/.codex/worktrees/sara-sprint4-release/Soen-341`
Branch: `sara-sprint4-release`. These changes are not in the separate Documents/GitHub checkout. Open this checkout in your Git client before committing. Nothing is staged or committed automatically.

Select only the files in one group, review the diff, and commit using the suggested message. All paths below are relative to this checkout; except root README.md they start with new_code/.

## 1. Add private R2 storage adapters and connection checks

- new_code/package.json and package-lock.json (AWS clients, Node version, check scripts)
- new_code/.env.example and .gitignore (placeholders only; private env files ignored)
- new_code/server/r2-client.js, cloud-files.js, cloud-resume-reader.js
- new_code/scripts/check-r2-storage.js, check-r2-roundtrip.js, check-hosted-database.js
- new_code/tests/r2-client.test.js, cloud-files.test.js, cloud-resume-reader.test.js

These add reusable storage operations and diagnostics. The live roundtrip check writes only fresh dummy objects and deletes them.

## 2. Connect hosted uploads and prepare Vercel runtime

- new_code/index.js and vercel.json
- new_code/server/server.js, db.js, session-config.js, serverless-readiness.js, maintenance.js
- new_code/server/routes/cloud-profile.js, feedback.js, job-matching.js
- new_code/public/Profile.html, profile.js, apply.html, apply.js, storage-config.js (Profile.html is capitalized in Git)
- new_code/tests/cloud-profile.test.js, cloud-applications.test.js, maintenance.test.js, serverless-readiness.test.js, vercel-entry.test.js

These files connect storage to actual user flows, retain local development, display hosted size limits, and prepare the serverless runtime. server.js includes the earlier private-download path fix; keep it in this group to avoid splitting hunks.

## 3. Document deployment progress and remaining release checks

- README.md (repository root)
- new_code/DATABASE_SETUP.md, DEPLOYMENT.md, VERCEL_SETUP.md
- new_code/RELEASE_CHECKLIST.md, SPRINT4_HANDOFF.md, MANUAL_COMMITS.md

## Before a pull request / deployment

- Never select .env, .env.hosted, real resumes, credentials, or node_modules.
- Run npm test from new_code after all code groups are committed.
- Integrate latest main and reviewed Angie changes, then rerun tests. The current branch's feedback.js predates Elfy's shared-reader/rate-limit changes; preserve that upstream implementation and port the small R2 read branch into its shared reader. Do not overwrite it with the older whole file.
- Keep local-disk privacy fixes and resume-builder ownership checks from Angie. R2 integration does not replace those responsibilities.
- Reviewed TiDB schema import, Vercel environment variables, deployment, real Gemini checks, and hosted browser/persistence checks are still pending.

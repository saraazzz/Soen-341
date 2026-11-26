# Vercel + TiDB + private object storage

Target proposed with Sara on November 25: Vercel Hobby, MySQL-compatible TiDB Cloud Starter, and Cloudflare R2 Standard. Accounts are connected and the R2 adapter is implemented. Reviewed database migrations, integration with current main/Angie, and a live deployment remain pending. This guide does not authorize paid upgrades.

### Account progress — November 26

- Vercel GitHub application installed for `saraazzz/Soen-341` only. The import form was prepared with project name `careerconnect-soen341`, root `new_code`, and Express preset on Hobby. Deploy has not been clicked; these are form selections, not a deployed project.
- TiDB `careerconnect-sprint4` is Active, Starter / MySQL-compatible, AWS North Virginia (`us-east-1`), with a $0 monthly spending limit. No application schema has been imported. Sara generated and saved the initial password privately.
- Local `.env.hosted` is an owner-readable/writable, Git-ignored connection template, separate from `.env`. Sara saved its credentials privately. It initially selects `sys` for a read-only connectivity check; change `DB_NAME` to `recruiting_website` only after importing the reviewed schema. Never run application migrations against `sys`.
- Latest fetched main is `caaa0f0`; Angie remains at reviewed `07aab2a`. The earlier 185-test evidence covered `ecfb5f9`, not this newer main revision.
- TiDB login and TLS encryption passed a live read-only check on November 26. `recruiting_website` does not exist yet; no application tables or records were changed.
- Sara activated R2. Bucket `careerconnect-private` was created with Standard storage in Eastern North America, and the dashboard confirms Public Access Disabled. Sara created the `careerconnect-server` credential with Object Read & Write on this bucket only and saved its S3 keys privately. The live read-only bucket connection check passed on November 26. A subsequent live synthetic roundtrip verified upload, copy, read, signed download, and cleanup. Both dummy objects were deleted. Full hosted browser authorization and redeployment checks remain pending.

## What this branch prepares

- `index.js` exports Express for Vercel; `npm start` still runs the local server.
- With Vercel's `VERCEL=1` environment, small database pools replace the main long-lived connection. Resume-builder startup no longer creates tables, and session cleanup no longer relies on a process timer.
- First API requests wait for the session-table check. A failed check returns a generic 503 and retries on a later request. Liveness remains available without the database.
- `vercel.json` schedules `/api/internal/maintenance` once daily at 06:00 UTC. It checks a bearer secret, archives expired postings, and removes expired session rows. Local development retains the minute-based archiver.
- The existing search/application code still rejects expired postings immediately; daily maintenance does not extend application deadlines. The archived timestamp can be updated later on Vercel. Notifications are still checked by the existing notification endpoint, not by this maintenance route.
- `npm run check:database` checks selected schema fields without reading user contents or applying SQL. It is not a full compatibility or permission audit.
- `server/r2-client.js` supplies a server-only R2 client and `npm run check:r2` checks bucket access without reading or changing files. Eight targeted Node 22 tests pass. R2 profile, avatar, application upload/download, application-copy, and AI-read integrations are now implemented. Set `FILE_STORAGE=r2` to enable hosted uploads.

## 1. Prepare TiDB (Sara + Angie)

1. Create a **MySQL-compatible Starter** instance within its free quota. Do not choose PostgreSQL compatibility or enable paid scaling.
2. In its Connect panel, choose the Node.js/mysql2 connection example. Keep the host, port, username, and password private.
3. Use `DB_SSL=true` in this app. The certificate chain must validate; if the provider supplies a required CA, install it as a secret file and set `DB_SSL_CA_FILE`. Never disable verification.
4. Have Angie import the reviewed empty-install schema and pending migrations using [DEPLOYMENT.md](DEPLOYMENT.md). Existing scripts select `recruiting_website`; agree that name before importing. Never use the destructive starting schema on existing records.
5. Apply `deployment/sessions.sql` to that same database. Apply the final resume-builder schema/ownership migration too; hosted cold starts will not repair it.
6. Put the hosted `DB_*` values in a private local environment file or terminal environment, then run `npm run check:database` from `new_code`. Do not overwrite the existing local development `.env` inadvertently. An alternative is `node --env-file=/absolute/path/to/private-hosted.env scripts/check-hosted-database.js`.
7. Test fictional registration, login, posting, applications, updates, deletion behavior, and session persistence on TiDB. Current documentation supports mysql2, foreign keys, and the schema's MySQL 8 collation in recent TiDB versions, but the actual migrations and queries remain unverified on the team's instance.

TiDB's free allowance is limited; keep consumption-based billing disabled. Provider references: [Starter plans](https://docs.pingcap.com/tidbcloud/select-cluster-tier/), [mysql2 connections](https://docs.pingcap.com/developer/dev-guide-sample-application-nodejs-mysql2/), [compatibility](https://docs.pingcap.com/tidbcloud/mysql-compatibility/), [collations](https://docs.pingcap.com/tidbcloud/character-set-and-collation/).

## 2. Prepare R2 and coordinate storage (Sara + Angie)

Sara creates the account/subscription herself and reviews billing terms. R2 Standard includes free usage but charges beyond it; this is not a hard zero-cost plan. Create a private Standard bucket; leave public access disabled. Keep access credentials server-side and scoped to the intended bucket.

The proposed client configuration is `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` (placeholders in `.env.example`). Coordinate these names with Angie. `createR2Storage()` from `server/r2-client.js` returns an official S3 SDK client, bucket name, connection check, and cleanup method. `cloud-files.js` provides upload/read/copy/delete/sign operations; `routes/cloud-profile.js` handles hosted profile uploads and authorized resume access. Keep Angie’s local private-file resolver when integrating her changes.

After supplying private settings, run `npm run check:r2` from `new_code`, or `node --env-file=/absolute/path/to/private-hosted.env scripts/check-r2-storage.js`. This read-only check verifies access only. Confirm public access is disabled in Cloudflare and test actual authenticated application routes separately. Do not put credentials in GitHub, screenshots, or team messages.

Sara's R2 integration covers the following; preserve and verify these behaviors when combining it with Angie's local-storage security changes:

- Private profile resume upload, preview, download, replacement and deletion.
- Immutable application resume copies and additional application documents.
- Both AI features' server-side file reads.
- Avatars, which also currently depend on a local writable folder.
- Temporary parsing files, if needed, in temporary storage with cleanup; never use the deployed source tree for uploads.
- Owner/role checks before reading, deleting, copying, or issuing a short-lived signed URL. Clients must not choose another user's object key.
- Failed-upload cleanup and migration of any retained local file references.

Hosted uploads are limited to 1.5 MB per file (two documents per application), with bounded text fields, to fit Vercel's 4.5 MB function request limit. The UI and backend use the same limit. Downloads use short-lived signed links issued after authorization.

References: [R2 setup](https://developers.cloudflare.com/r2/get-started/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [Vercel payload limits](https://vercel.com/docs/errors/function_payload_too_large).

## 3. Import into Vercel (Sara)

After Sara manually commits/pushes and the team reviews the integration:

1. Sign in to Vercel and choose the **Hobby** account. Check that the repository's ownership and contributor permissions are supported by that account. Do not upgrade if import is blocked; resolve access with the repository owner.
2. Import the CareerConnect GitHub repository. Grant access only to the required repository.
3. Set Root Directory to `new_code`, framework to Express (or confirm automatic detection), Node version to **22.x**, and install command to `npm ci`. Keep the framework's default build/output settings. Do not configure a static-site-only deployment or start a separate `npm start` daemon on Vercel.
4. Set production environment variables from `.env.example`: `NODE_ENV=production`, TiDB `DB_*`, `DB_SSL=true`, `SESSION_STORE=mysql`, a stable random `SESSION_SECRET`, `GEMINI_API_KEY`, and a separate random `CRON_SECRET` of at least 32 bytes. Set `TRUST_PROXY` to match the verified deployment proxy behavior and test the HTTPS session cookie. Let Vercel supply `PORT` and `VERCEL`.
5. Set `FILE_STORAGE=r2` and the four `R2_*` variables listed above after the adapter is integrated. Avoid sharing the production database/bucket with untrusted preview branches. Give previews separate test resources or leave credentials unset.
6. Keep deployment protected while storage and ownership blockers remain. Static files in `public` are served by Vercel's CDN; never put private resumes or secrets there.
7. Deploy the reviewed revision; run the full [release checklist](RELEASE_CHECKLIST.md). Verify homepage/assets, both roles, ownership failures, both AI features, real redeployment persistence, and the maintenance route.

The maintenance route must return 401 for an incorrect secret. Vercel uses `CRON_SECRET` as its bearer token. Hobby cron runs daily with hour-level precision; verify a scheduled production run in the dashboard. Do not replace its daily schedule with a once-per-minute cron on Hobby. Reference: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).

## Commit groups for Sara (manual only)

Follow [MANUAL_COMMITS.md](MANUAL_COMMITS.md). The groups use whole files so shared changes do not require line-by-line staging. No commits, pushes, merges, or deployments were performed during the R2 integration.

Pushing to Vercel's configured production branch can trigger a deployment once its GitHub integration is configured.

## R2 behavior and limits

- Set `FILE_STORAGE=r2` plus the four `R2_*` settings in Vercel. Do not expose secrets to frontend JavaScript.
- Hosted uploads use memory, up to 1.5 MB per file; applications accept at most two documents. This keeps requests below the function payload limit. Local disk development retains its existing limit.
- The database stores `r2/profile-resumes/<uuid>.<ext>` or `r2/applications/<uuid>.<ext>` references, never signed URLs. Application resumes are separate copies.
- Profile resume reads authorize the current session. Application reads use existing seeker/employer ownership checks. Signed downloads expire after 60 seconds; anyone holding that temporary link can use it until expiry.
- Avatar images are intentionally visible publicly through `/api/media/avatar/<uuid>.<ext>`, which cannot sign resume objects. The bucket itself remains private.
- Replacement deletes the old cloud object only after the database accepts the new reference. Failed writes/submissions attempt cleanup before returning. Storage deletion failures are logged for follow-up; there is no automatic orphan sweep.
- Existing local files are NOT migrated. Re-upload fictional demo profile resumes and avatars after deployment. Existing application files require an explicit migration if they must be retained.
- No cloud keys are added to `.env.hosted` automatically beyond credentials already saved by Sara. It still selects `sys` for the initial DB check; do not start the app with it until the application database is created and `DB_NAME` is changed.
- Live synthetic storage check: `node --env-file=.env.hosted scripts/check-r2-roundtrip.js`. This writes and removes fresh dummy objects. It does not inspect existing user files.
- Merge latest main and Angie's fixes before release. Preserve Elfy's shared reader and rate limiter; carry the R2 branch into the shared reader instead of reverting to this branch's older feedback implementation. Coordinate the equivalent private-local-file reader change with Ayza.

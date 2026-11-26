# CareerConnect deployment guide

Preferred target: Vercel + MySQL-compatible TiDB Starter + private R2 storage. Follow [VERCEL_SETUP.md](VERCEL_SETUP.md) for that platform; the generic `npm start` service instructions below apply to traditional Node hosts, not Vercel.

Status: deployment preparation only. No hosting account, public URL, or remote database has been configured. Sara handles deployment; Angie coordinates schema and protected resume storage. Recheck this guide after those changes merge.

## Runtime and service settings

Deploy the existing Express app as one Node web service: it serves both the pages and the API. Use Node.js 22 (a current patched release), MySQL 8, repository root directory `new_code`, install command `npm ci`, and start command `npm start`. There is no frontend build step. Start in `new_code`, because uploads and static pages currently use relative paths.

Use `/health/ready` as the host health-check path. `/health/live` checks the HTTP process; readiness checks database connectivity, not every table, uploads, or Gemini.

Configure these values in the host's private environment settings:

| Setting | Hosted value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | The port assigned by the host; the app listens on all interfaces |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | The hosted MySQL connection details, not laptop credentials |
| `DB_SSL` | `true` when connecting over a public network to a TLS-enabled MySQL service |
| `DB_SSL_CA_FILE` | Optional absolute path to the provider's CA certificate, installed as a secret file; use with `DB_SSL=true` |
| `SESSION_STORE` | `mysql` |
| `SESSION_SECRET` | A private random secret, kept unchanged across redeploys |
| `TRUST_PROXY` | The actual trusted proxy hop count or explicit IP/subnet list; confirm with the chosen host |
| `GEMINI_API_KEY` | The team's authorized server-side key for both AI features |
| `GEMINI_MODEL` | Optional override supported by the AI routes |

Generate a session secret locally and paste it directly into the host settings:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not commit the output, `.env`, database passwords, or Gemini keys. HTTPS is required for production session cookies. If TLS ends at the host's proxy, configure trust correctly or login cookies will not be set. Never use blanket `TRUST_PROXY=true`. Do not disable certificate verification to fix a database certificate error.

## Database handoff with Angie

Back up an existing database before applying changes. `database.sql` drops tables: use it only for a confirmed empty installation. Current SQL explicitly selects `recruiting_website`; passing a different database name on the command line does not override its `USE` statements. If the provider assigns another name, have Angie prepare/review the matching schema scripts before import. Do not point unreviewed scripts at that service.

For a fresh database named `recruiting_website`, connect using the provider's MySQL client instructions (including verified TLS for public connections). From the repository root, use the following order at the MySQL prompt:

```sql
-- Fresh, empty installation ONLY:
SOURCE new_code/database.sql;
-- Apply only pending files on an existing installation:
SOURCE new_code/migrations/001_add_applications_and_resume_path.sql;
SOURCE new_code/migrations/002_link_submitted_application_resumes.sql;
SOURCE new_code/migrations/003_archive_job_postings.sql;
SOURCE new_code/migrations/004_create_notifications.sql;
SOURCE new_code/migrations/004_optional_posting_deadlines.sql;
SOURCE new_code/migrations/005_job_seeker_match_profile.sql;
-- Review the resume-builder schema with Angie before final release:
SOURCE new_code/public/resume-builder/schema.sql;
USE recruiting_website;
SOURCE new_code/deployment/sessions.sql;
```

Both files numbered 004 are needed; they add different features. Record filenames applied successfully. Some migrations are not repeatable; stop on errors rather than blindly rerunning. `sessions.sql` uses the selected database and must exist before starting with MySQL sessions. The server does not automatically create that table.

The resume-builder schema file and startup table definition currently differ. `CREATE TABLE IF NOT EXISTS` does not update an existing table. Angie must reconcile this with resume ownership before public release. Current startup code also issues schema changes; do not assume a data-only database user can run the app until that behavior is resolved.

## File storage handoff with Angie

A database stores file references; it does not currently store uploaded file contents. These paths are relative to `new_code`:

| Content | Current location | Release action |
| --- | --- | --- |
| Profile resumes and avatars | `public/uploads` | Move resumes behind authenticated access; preserve avatars separately |
| Submitted application snapshots | `private/application-resumes` | Preserve immutable snapshots in durable private storage |
| Temporary application uploads | `server/private/application-resumes` | Keep writable temporary space and verify cleanup |
| Proposed protected profile resumes | `private/profile-resumes` | Coordinate the final helper and path with Angie; not implemented on this branch |

Do not treat moving a resume into a private folder as persistent hosting storage. It still disappears on an ephemeral server. With a persistent disk, map all durable paths to that disk through Angie's shared storage configuration. With object storage, readers/writers need an integration; setting a new environment variable alone will not work. Both AI readers and application snapshot creation must use the same storage helper. Never mount over the whole application directory.

Before publication, verify that profile resume access and resume-builder CRUD require authentication and enforce ownership. The current resume-builder router is mounted before session middleware and queries records without a user filter; this is a release blocker to coordinate with Angie.

## Verification and release

From `new_code`:

```sh
npm ci
npm test
```

Optional local MySQL integration check:

```sh
npm run test:sessions
```

That check uses `DB_*` from your private `.env`, needs permission to create/drop a database, and creates then deletes only a randomly named test database. Run it against a development MySQL server, not the hosted project database. It verifies a session-store restart, not a full cloud redeployment.

After the host and storage are configured, use [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Record the deployed commit, URL, test date, and evidence. Test with fictional accounts/documents. Complete browser checks and a real redeploy before calling deployment done.

## Recovery

Before a release, record the last working commit and back up the database plus uploaded files together. A code rollback does not reverse SQL migrations or restore missing files. Keep the same session secret when rolling back. If a schema update fails, stop deployment and have Angie inspect partially applied changes; do not run the destructive starting schema. If a release fails, restore the previous compatible application version and recheck health/login. Restore data only from a reviewed backup when necessary.

## Free-only hosting decision

Budget: no paid subscriptions or upgrades. These findings were checked on November 25, 2026; confirm the actual account's quotas before deploying.

- Railway is a candidate for the class demonstration: its documented Free plan supports MySQL, but has a small monthly usage allowance and stops services when it runs out. A new-account trial is temporary, not unlimited hosting. The documented free allocation includes one volume, so do not assume separate database and upload disks are available. Its bucket option would require integration with Angie's storage helper. The periodic deadline worker and database connections may also prevent sleeping. [Railway Free plan](https://docs.railway.com/pricing/free-plan).
- Render Free can run the Node service, but has no persistent disk and loses local uploads on restarts or sleep. It therefore cannot host this app unchanged with reliable uploads. [Render Free limitations](https://render.com/docs/free).
- Do not select Aiven based on old free-MySQL instructions: its retirement notice says new free MySQL services are no longer available. [Aiven retirement notice](https://aiven.io/free-mysql-database-retired).

Vercel/TiDB/R2 is now the preferred proposal; the alternatives above are retained as research context. No service has been configured by these code changes. Confirm a free account's eligibility, MySQL capacity, file storage, and quota through the evaluation period before committing to it. Do not switch the project to PostgreSQL just to obtain a free database: the application and migrations currently depend on MySQL.

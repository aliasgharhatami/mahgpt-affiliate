# MAH GPT Studio: 7-day retention + cloud-first deployment
Status: Database and UI ready; R2 deletion Cron Worker implemented, tested, **NOT deployed or enabled**. Cloud render engine auto-deployment gate prepared but no Linux render host connected. Date: 2026-11-03.

## Retention policy
- Completed projects: backend transition to lifecycle=`completed` stamps `finalized_at`, `last_opened_at`, `expires_at=now()+7days`. Only trusted service keys may finalize a project after verified output.
- Reopening a live completed project through Supabase authenticated `studio_touch_completed_project` atomically resets expiry to seven days. Expired projects cannot be revived.
- My Projects shows actual per-project deadline and a notice; it never lists private unfinished intakes.
- Abandoned private intakes: eligible for cleanup seven days after latest server-recorded message/asset activity. No generated media is accepted by public beta yet.
- Cleanup GC: dedicated Cloudflare Cron Worker `mahgpt-studio-retention` hourly, with private `STUDIO_MEDIA` binding to `mahgpt-studio-private-media`.
- The Worker uses only a dedicated elevated **Supabase secret API key** in an encrypted Cloudflare Worker secret, NEVER the website or git. It claims the expired project, freezes it against new uploads, deletes all associated R2 paths (including outputs), and only after successful R2 deletes, finalizes metadata and messages in Supabase. R2 errors result in a retry, not silent metadata deletion.
- The worker refuses mismatched owner/project/key paths and unexpected Supabase-stored assets; no Cloudflare/other-bucket objects are touched.
- Current pilot has 15MB/file, 80MB lifetime and one tester; no new paid resources without founder approval.

## Preferred no-token Cloudflare deployment (Cloudflare native Git integration)
Cloudflare Workers Builds officially supports using an existing GitHub repository to automatically deploy a Worker from a monorepo. This avoids manually creating a GitHub Actions Cloudflare token:
1. Cloudflare Dashboard → Workers & Pages → **Create application** → GitHub → choose `aliasgharhatami/mahgpt-affiliate`.
2. Worker name **exactly** `mahgpt-studio-retention`. Production branch `main`. Root directory: `workers/studio-retention`. No build command; deploy command `npx wrangler deploy` (from root), using its existing `wrangler.toml`.
3. Check private R2 binding `STUDIO_MEDIA` and hourly UTC trigger in Settings. The source defaults to `STUDIO_RETENTION_ENABLED=false` so no deletion occurs upon initial deployment.
4. Add the dedicated `SUPABASE_RETENTION_SECRET_KEY` as an encrypted **Worker runtime secret**. Do not add it to the Git repository or browser. Run a local/sandbox no-delete scheduled test first.
5. After end-to-end private-project deletion is validated, change `STUDIO_RETENTION_ENABLED` in `wrangler.toml` to `true` through a reviewed Git commit; Cloudflare rebuilds the Worker automatically.
6. If Git import is unavailable for this account, the alternate GitHub Actions deployment gate below supports a scoped token.

Official Cloudflare reference: https://developers.cloudflare.com/workers/ci-cd/builds/

## Deployment readiness and necessary owner-only account steps
1. In GitHub repository `aliasgharhatami/mahgpt-affiliate` > Settings > Secrets and variables > Actions: add `CLOUDFLARE_API_TOKEN` as a scoped Cloudflare API token with permission to deploy Workers. Add `CLOUDFLARE_ACCOUNT_ID` (from Cloudflare account page/URL) as a repository secret. Never paste either key in chat, screenshots, Git or public text.
2. Create repository **variable** `STUDIO_RETENTION_DEPLOY_ENABLED=true`. The GitHub Action `.github/workflows/studio-retention.yml` runs safety tests before deploying `workers/studio-retention/wrangler.toml`.
3. Cloudflare Workers & Pages: verify the `mahgpt-studio-retention` Worker exists, its binding `STUDIO_MEDIA` is the **existing** private `mahgpt-studio-private-media` R2 bucket, and Cron is `0 * * * *` (UTC).
4. In Supabase `mah-gpt-studio` > API Keys, create a **dedicated new secret key** named for the retention worker. In Cloudflare Worker > Settings > Variables and Secrets, add encrypted secret `SUPABASE_RETENTION_SECRET_KEY` with that value. Never use the public `sb_publishable` key for elevated GC, and never expose this key via browser.
5. Confirm the Worker is deployed with `STUDIO_RETENTION_ENABLED=false`. In this state Cron is safe: it does **not** claim or delete any project. Use Cron preview/logs for healthy execution and verify DB security tests. In a controlled transaction, test expiry claim+finish rollback (provided migrations and CI tests).
6. Once worker binding and secret are confirmed, change `STUDIO_RETENTION_ENABLED` to `true` in `workers/studio-retention/wrangler.toml`, commit, and let GitHub Actions redeploy. Verify Cron Events and the R2+database end-to-end cleanup using a **separate authorized, short-lived test project** (not a real customer project). Avoid reducing expiry on a real project.
7. Only after real end-to-end confirmation, update public Privacy Policy and in-app language from "being activated" to active guarantee.

## Cloud engine integration and automatic release
- Canonical source of the real editing engine: private GitHub `aliasgharhatami/ai-video-studio`. Do NOT reimplement it inside the website or replace its fonts, text motion, sound and reference analysis.
- Website: `aliasgharhatami/mahgpt-affiliate` on Cloudflare Pages; frontend + Auth, private R2 and user projects.
- A future **Linux cloud rendering service** must run the engine code (Remotion, FFmpeg, fonts, effects, Gemini voiceover where allowed) and access input R2 objects privately. Windows PowerShell paths from the old engine cannot be assumed to work on Linux. A Render/Railway/GPU host requires a separately budgeted plan; free-tier capabilities must be verified before enabling rendering.
- Private engine repo now has `.github/workflows/studio-engine-release.yml`: on every `main` code/asset update it validates core manifest compatibility and records an immutable Git commit revision.
- Cloud deploy job is intentionally **off** (`STUDIO_RENDER_CLOUD_ENABLED` must be true); when Linux renderer is provisioned, set secret `STUDIO_RENDER_DEPLOY_HOOK` and enable the job. It will request cloud engine redeployment after tests on each verified `main` commit. Rollback should redeploy a known previous commit and pin job renders to the exact engine version.
- The deployed website uses the renderer via a stable, authenticated server-side API and receives job status/output paths. Website Pages does NOT need to contain/copy the Remotion engine itself; the engine cloud service updates automatically.
- No local Windows PC, Codex session, or manual copy should be needed once cloud renderer deployment, secrets, queue and artifact fetch are proven operational. **This end-to-end cloud render connection is not yet active.**

## References
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- https://supabase.com/docs/guides/getting-started/api-keys

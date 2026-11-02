# MAH GPT Studio — account activation checklist

Status: **prepared in source control, not connected to a live Supabase project**.

These components are already committed:
- `studio-config.js`: public, disabled-by-default Supabase configuration. **Never put service_role or secret keys here.**
- `studio-account.js`: browser authentication and private draft management with `@supabase/supabase-js` 2.118.0.
- `backend/supabase/001_accounts_projects.sql`: owner-protected projects, media metadata, acceptance records, quotes and a private storage bucket.
- `backend/pricing/quote-engine.mjs`: server-only quote calculator, deliberately refuses to quote when any operation lacks a measured rate.

## Activate only after the user chooses the organization

1. Confirm the organization with the project owner, request the Supabase project cost from the provider for that organization and **get approval of any nonzero charge**. Use a dedicated project for this studio, ideally EU regional hosting with the user's approval.
2. Create the project and apply/review the SQL schema, then run security advisors and test with **two separate test users** that they cannot access each other's projects or media.
3. Set Supabase Auth Site URL to `https://mahgpt.com/`. Add this exact URL as an allowed redirect for email links and Google OAuth. Google needs configured OAuth credentials; email needs delivery testing and production SMTP configuration if required.
4. Finalize the real operator/controller identity, retention policy, processor list, residency/transfer information, contact address, and final Terms/Privacy documents. Current `terms.html` and `privacy.html` are **drafts**.
5. Publish the Supabase **project URL** and **publishable (not secret) key** in `studio-config.js`. Set `termsVersion` and `privacyVersion` to their finalized identifiers. Enable `redirectsReady` only after confirming the exact Site URL and Redirect URL in Authentication → URL Configuration and testing the email callback. Enable `authReady` and `legalApproved` only once Auth and data policies are tested. Enable `googleProviderReady` only after successful Google OAuth test.
6. Verify sign-up, email callback, Google callback, duplicate login, required terms acknowledgement, sign-out, saving/loading/deleting a project, and RLS in a production-like environment.
7. Add a separate explicit media upload action once retention/deletion policy and storage quotas are ready. The `Image/Video/Audio` toolbar remains a local browser file selector, NOT an upload pipeline.
8. Keep `Get a Quote` disabled until server-side AI Director planning, verified provider rates, budget caps and price quote persistence are ready. Never put internal cost tables or OpenAI secrets into public JS.

## Current safeguards

- Account actions cannot run if config is blank or final legal approval flag is false.
- OAuth and magic-link operations use Supabase Auth; they are **not simulated**.
- `My Projects` is accessible only after a verified session and saved Terms/Privacy versions.
- Private project and asset records use Postgres row-level security; quotes are client-read-only.
- Frontend project drafts include text and references; it does **not** silently upload the customer's media.
- The quote engine only runs on a trusted backend and will not silently treat missing render/media rates as zero.

## Follow-up

Before production: pin and locally bundle Supabase dependencies if moving to a build system, consider CSP/SRI for CDN usage, and run a real-browser integration test after the Supabase project exists.

## Exact required manual Supabase Auth setting (2026-11-02)

URL configuration: https://supabase.com/dashboard/project/gthwpfscrewwamjxheyj/auth/url-configuration

- Site URL: `https://mahgpt.com/`
- Redirect URLs: add `https://mahgpt.com/` as an exact entry.
- Email sign-in: Authentication → Sign In / Providers → Email (verify enabled).
- Google sign-in: leave disabled until a Google Cloud OAuth client is configured with the Supabase callback URL `https://gthwpfscrewwamjxheyj.supabase.co/auth/v1/callback`. Google and email login must be tested separately.
- This connector can inspect projects/databases, but does **not** expose an operation to update the hosted Supabase Auth site URL, redirect allowlist, or Google provider secrets. The account owner must make those changes in the dashboard. Do not circumvent this by writing to Supabase-managed auth schema.
- Publish final legal notices and identify the legal operator before enabling `legalApproved`. Register first user only after this.

Checked: project `gthwpfscrewwamjxheyj` is ACTIVE_HEALTHY, 4 public studio tables have RLS, no anonymous access to projects, private storage bucket, and security advisor reported no lints. No sign-in email callback was end-to-end tested because the URL allowlist has not yet been confirmed.

Note (2026-11-02): MAH GPT Studio is now the site root. Keep the OAuth/email callback as `https://mahgpt.com/`, not `/ai-video-studio/`. The old Studio path is an alias. The AI Models portal resides at `https://mahgpt.com/ai-models/`.

# MAH GPT Studio: Customer-media storage and upload architecture
Date: 2026-11-02
Status: Architecture decided; uploads remain disabled. Bucket / paid subscription / Worker / end-to-end validation pending.

## Founder-approved zero-spend phase — strict launch condition
The project owner has requested **no payments or subscriptions with charges before first paying customer**. Do **not** activate any R2 checkout that incurs fees, select Infrequent Access, expose public/customer uploads, or create a paid Cloudflare subscription without explicit fresh approval.

**Provider fact:** R2 Standard includes 10 GB-month storage, 1 million Class A and 10 million Class B operations per month with free egress, but free tier is **not a hard stop**. Cloudflare may require checkout/payment information to enable an R2 subscription. Budget alerts do NOT cap/stop overages.

**Engineering launch gate:** reject public access until the Worker implements race-safe server-side capacity reservations and cleanup. Use a protective 8,000,000,000-byte total active+reserved allowance for the *whole Studio*, not 10 GB per user. Initial limits recommended: 1 GB/account and 300 MB/file with at most 2 active uploads per account. These are proposed limits, not yet enforced: R2 cannot be marketed as guaranteed $0 until account-specific billing and all operations are monitored. Keep the storage feature flag OFF until verified.

**Required owner action:** open Cloudflare Dashboard → Storage & databases → R2 → Overview. If R2 is already active, create a private Standard bucket named `mahgpt-studio-private-media`. If dashboard asks for payment method or checkout, stop and review terms; do not assume a $0 screen guarantees no future charges.

**Status:** neither Cloudflare R2 activation nor a bucket connection has been verified in this chat, so the public Studio upload feature remains OFF.

## R2 binding to live Cloudflare Pages
The user has created the bucket `mahgpt-studio-private-media` (Standard; Public Access Disabled; 0 B at creation). Keep the unrelated `living-ad-media` bucket untouched.

A safe diagnostic route exists at `functions/api/studio/storage-status.js`, available after Cloudflare Pages deploys as `https://mahgpt.com/api/studio/storage-status`.
- **Cloudflare Dashboard → Workers & Pages → mahgpt-video-studio → Settings → Bindings → Add → R2 bucket.**
- Binding variable: `STUDIO_MEDIA`.
- Select **existing** `mahgpt-studio-private-media` (do not create another bucket).
- Apply to production; save and **redeploy Pages** so the binding becomes available.
- Health response with binding: `{"storage_connected":true,"uploads_enabled":false}`; missing binding: HTTP 503. The diagnostic performs zero R2 object operations and never reveals object paths or customer files.
- Do not enable public bucket access, create R2 API tokens or set secret keys on the client.
- This is **binding verification**, not yet a functioning customer upload system. Public uploads remain blocked behind legal and cost controls.

## Architecture
- **Supabase Auth + PostgreSQL:** users, projects, private asset metadata, agreement and access records. Preserve RLS and project ownership.
- **Cloudflare R2 Standard private bucket:** original customer images, audio and video, later processed results. Use a dedicated bucket e.g. `mahgpt-studio-private-media`; no public bucket URL or unrestricted public objects.
- **Cloudflare Worker:** validate user's Supabase JWT server-side and confirm ownership of the project from trusted Supabase context; then issue **short-lived scoped upload/download capabilities** (for multipart, use authenticated Worker handlers with server-only R2 binding or short-lived S3-compatible presigned URLs). Never expose R2 or Supabase secret keys in the browser.
- **Browser:** asks for an upload session only after sign-in + project creation + explicit media-rights acknowledgement; displays upload progress, retry and errors. For large videos implement multipart/resumable upload, not single POST through the static Pages server.
- **GPU processing:** a trusted worker consumes R2 originals via temporary scoped server-side access; outputs are written back to R2 privately. Expensive GPU processing stays independent of storage.
- **Object path:** `u/{supabase-user-uuid}/p/{studio-project-uuid}/{asset-uuid}/{sanitized-filename}`. R2 objects and metadata are never enumerated by guessing paths; request handlers enforce project ownership.
- **Asset metadata:** enhance existing `public.studio_assets` with backend/provider storage identity, upload state, sha256/checksum where available, length, mime, creation/expiry timestamps. Current schema has a 150MB check and cannot support large R2 videos unchanged.
- **Quotas:** enforce per-account file size, count and total storage budget on the trusted backend, NOT only in JS. Proposed beta values to decide after billing confirmation: 1GB/file video, 25MB/image, 50MB/audio, 2GB/account, total allocation cap; refuse new uploads rather than silently incur unbounded charges.
- **Input validation:** allowlist MIME and media content/probe; enforce safety rights declarations, filenames sanitized, block dangerous formats/active payloads, and implement malware/content-abuse reporting/review before public upload goes live.
- **Lifecycle:** delete abandoned multipart sessions, stale unfinished uploads and temporary rendering files. Provide a tested project deletion workflow which deletes original files, derivatives, metadata and temporary credentials. Define actual retention windows and backup caveats, then publish them.
- **Privacy/terms gate:** before launch, update legal documents with actual R2/Cloudflare processing and locations, real retention schedule, lawful rights to people/voices in user media, and optional promotion/training opt-in. Review KVKK/GDPR as relevant. No launch without secure deletion and safety review.
- **Billing guard:** R2 subscription may require a payment method despite an included free tier. Secure a budget alert and an internal upload quota before granting public access. No user card data is entered into the Studio's upload UI.

## Verified constraints (2026-11-02)
- Supabase Free: 1GB included, maximum uploaded object 50MB; existing private `studio-project-media` bucket's configured 150MB limit cannot override global Free limit.
- R2 Standard: 10GB-month free, 1 million Class A operations and 10 million Class B included, free egress (Cloudflare Oct 2026 pricing). Beyond included usage usage-based billing applies.
- Current Studio has functioning email/Google Auth, project drafts, owner-scoped RLS, but **no actual customer media upload, payment, or video rendering**.

Sources:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/

## Implementation order
1. Owner confirms Cloudflare R2 availability and any billing activation.
2. Create dedicated **private R2 Standard** bucket and set per-account capacity/cost limits before production.
3. Implement and deploy Worker with authenticated Supabase user verification, project access check, signed upload init/finalize, secure download and delete; add migrations in Supabase.
4. Create first-party upload UI (image, video, audio; progress, cancellation/retry), start with a single test account, and test cross-account isolation.
5. Add deletion/retention + legal changes and technical safety measures; only then change client/public flags and allow general customer uploads.

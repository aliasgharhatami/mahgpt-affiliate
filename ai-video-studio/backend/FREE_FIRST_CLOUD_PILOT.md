# MAH GPT Studio — free-credit CPU/GPU provider pilot
Date: 2026-11-03. Status: PREPARATION ONLY; NO CUSTOMER RENDERING ENABLED.

## Decision
Use the **entire** `aliasgharhatami/ai-video-studio` codebase as the single source of truth. Pilot:
- Google Cloud Run CPU service, **private authenticated** API and later bounded CPU tasks.
- Modal GPU T4/L4 on demand for features that truly need GPU, scaled to zero between invocations.
- Existing Cloudflare Pages + private R2 media + Supabase project ownership remain the customer frontend and data store.
- Never duplicate or reimplement the engine's visual features in website code.

## Current status
The engine's staging PR https://github.com/aliasgharhatami/ai-video-studio/pull/2 adds `scripts/cloud/deploy-cloud-run.sh`, `cloud/modal/studio_gpu_probe.py`, documentation and automated security checks.
The website's staging PR https://github.com/aliasgharhatami/mahgpt-affiliate/pull/59 adds a gated capability discovery route.

**Neither provider is attached to a live owner account, and no real customer render has been tested.**
Website order submission is an intake pilot only. Job execution and provider credentials remain off.

## Owner account gates
1. Google Cloud: sign in to https://console.cloud.google.com/ , determine eligibility/remaining $300 90-day trial, use a separate project, verify billing, create a dedicated Secret Manager token for internal API, set request-based billing, min instances=0, max instances=1, and restrict all unauthenticated access. Set a supported Cloud Run spend cap where available. Cloud Build and Artifact Registry have independent billing.
2. Modal: sign in to https://modal.com/ , verify $30 monthly Starter compute inclusion, add a valid payment method if permitted, and BEFORE GPU use set a small Workspace usage budget and spend limit. Free credits do not guarantee zero fees and do not cover Shared Endpoints.
3. Do not paste API keys into chat, public GitHub repositories or browser JavaScript. Run all provider smoke tests on synthetic media without customer files.
4. Only after account readiness, run smoke and verify actual billing in each dashboard, then implement authenticated job queue, media staging, render output verification, parity tests and release pinning.
5. No paid plan or additional out-of-pocket usage without founder approval.

## Official references
- https://cloud.google.com/signup-faqs
- https://cloud.google.com/run/pricing
- https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
- https://modal.com/pricing
- https://modal.com/docs/guide/gpu
- https://modal.com/docs/guide/budgets

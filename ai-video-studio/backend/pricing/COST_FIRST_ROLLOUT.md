# MAH GPT Studio — cost-first verified quotes (2026-11-07)

## Product rule

- The **retail floor is $1**, not $29. There is no fixed $29/$59/$99 tier table.
- The already deployed Luna model (`gpt-6-luna`) privately classifies the
  saved brief and returns method, complexity, intended duration, narration and
  review needs. The trusted quote planner maps those classifications to the
  least-cost **verified** engine capability.
- A server-controlled plan reserves additional model tokens and accounts for
  rendering, storage and delivery. A server-controlled versioned rate card
  prices these operations, adds reserves, overhead and margin, and applies the
  $1 floor. More complex certified plans may cost more; choosing Professional
  alone never generates an arbitrary premium.
- Pricing is in **USD**, only the final customer amount leaves the API.
  Provider/model names, planned operations, token counts and margin never
  appear in browser responses or in the customer-facing chat.
- The checkout may later display an *applicable* payment processor fee
  separately. The configured production quote must have
  `paymentFeeFraction:0` and `paymentFeeFixedUSD:0` until a real
  provider, fee legality, checkout totals and refund flows have been audited.
  Do not charge fees secretly or describe provider-dependent fees as guaranteed.

## What is implemented here

- `backend/pricing/verified-production-plan.mjs` performs strict
  classification/capability matching and builds a private operation plan.
  Production of unknown/unlicensed assets, unsupported rendering,
  voiceover or quality is not silently assumed free.
- `/api/studio/estimate` authenticates the Supabase owner; after a completed
  analysis it can **optionally** compute, write and return a server-issued,
  30-minute, single-analysis quote. Inserts are idempotent with migration 011.
- `studio-account.js` shows a correctly formatted quoted dollar amount
  and a small English payment fee disclosure below the disabled payment CTA.
  **No checkout and no commercial production starts.**
- The existing founder-only Luna queue and Oracle preview worker remain
  unchanged. Public purchases, automated production and payments are OFF.

## Required verified prerequisites — DO NOT bypass

1. Cloudflare version of both the frontend and estimate route deployed.
   Supabase migrations 001, 009, 010, 011 applied and verified on the target
   project; do not infer that a Git-tracked SQL file was executed.
2. Only activate a production capability **after** the actual cloud engine
   has rendered that same quality, duration, technique and asset type
   successfully. Current founder preview is only an 8-second 720×1280
   FFmpeg text/media test. It must NOT be claimed as professional export.
3. Authoritatively measure/render-test the costs. A rate card entry of 0 must
   be justified by available free-tier quota; missing rates stay null.
   Tool license, commercial asset rights, and any TTS quota must be checked.
4. Enable real seven-day physical deletion and customer legal agreements,
   and check service/currency/tax policies before accepting orders.
5. Turn on server-only flags **only after** successful staging tests:
   - `STUDIO_VERIFIED_QUOTING_ENABLED=true`
   - `STUDIO_AUTO_QUOTE_V1_ENABLED=true`
   - `STUDIO_COMMERCIAL_QUOTING_APPROVED=true`
   - `STUDIO_PRICING_RATE_CARD_JSON` — trusted JSON, versioned
   - `STUDIO_VERIFIED_CAPABILITY_PLANS_JSON` — trusted JSON, audited
6. Neither the example JSON nor these flags belongs in browser JavaScript.
   Do **not** enable `paymentsReady` or `aiRenderingReady` from this PR.

## Server-side reference configuration (NOT a deployed price list)

Only **after** confirming zero *marginal* cost for Oracle render and R2 use
within free quotas, a restricted FFmpeg text-only pilot could use:

```json
{
  "version":"verified-operator-revision",
  "models":{
    "gpt-6-luna":{"inputUSDPerMTok":0.1,"outputUSDPerMTok":0.5}
  },
  "operations":{
    "render":0,"storage":0,"download":0,
    "audio_generation":null,"image_generation":null,
    "video_generation":null,"other":null
  },
  "business":{
    "reserveFraction":0.2,
    "targetGrossMargin":0.25,
    "paymentFeeFraction":0,
    "paymentFeeFixedUSD":0,
    "overheadUSDPerOrder":0,
    "minimumSaleUSD":1
  }
}
```

This JSON is **illustrative**, not a claim of current availability. Check
the official OpenAI API prices immediately before actual activation.
Operation rate units are per rendered second, per reserved storage unit,
and per expected delivery unit respectively. Rate-card and capability
revisions should be pinned to the quote.

An equally restricted *server-only* capability map might be:

```json
{
  "normal":{
    "ffmpeg_text_motion":{
      "verified":true,
      "revision":"measured-8s-text-v1",
      "assetPolicy":"text_only",
      "complexities":["simple"],
      "maxSeconds":8,
      "verifiedVoiceover":false,
      "plannedModelCalls":[
        {"model":"gpt-6-luna","inputTokens":4000,"outputTokens":900}
      ],
      "storageUnits":1,
      "downloadUnits":1
    }
  }
}
```

The capability must remain `verified:false` until real end-to-end
commercial render tests justify it. Different verified quality/method
combinations can be added without changing the customer UI. Additional
media-generation methods are intentionally NOT supported by this v1
quoting plan; they will return pending verification.

## Release / rollback

1. Run: `node --test tests/studio-customer-quote-gate.test.mjs
   ai-video-studio/backend/pricing/quote-engine.test.mjs
   ai-video-studio/backend/pricing/verified-production-plan.test.mjs`.
2. Confirm unauthenticated requests to `/api/studio/estimate` return 401,
   and owner or wrong-project requests never disclose prices.
3. Verify founder-only text analysis remains opt-in and existing preview
   production works without changes.
4. First activate **backend quoting flags only for verified production**.
   The UI is already scoped to the founder pilot.
5. Roll back all three new backend flags to `false` immediately to return
   to authenticated pending-verification responses; do not touch Oracle
   render/analysis containers or other MahGPT services.

## Honest limitations

The current Luna worker is a **preflight classifier**. Full creative
storyboarding, actual model-token forecasting per render stage,
asset-rights checks and production orchestration are still separate work.
Today's quote planner reserves trusted server-side token budgets, rather
than passing a model-generated arbitrary dollar amount to the user.
This conservative design avoids pretending that an analysis job itself
created the video. An active payment gateway is also still missing.

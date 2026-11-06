# MAH GPT Studio — audited customer prices (Phase 12B)

## Current rollout
The real AI director and Oracle CPU preview worker are running for the
founder. They are **not yet complete commercial 15-second travel-video
production**. The model's token cost is NOT a video quote.

The consumer must only see their chosen **quality**, a final customer
price once verified, a validity deadline, and (in a later phase) a real
payment / production action. The client must never receive provider
rates, Luna classification JSON, input/output token counts, internal
costs, profit, margins, or production tools.

## Audited quote prerequisites

1. Immutable customer request and tier, linked to a completed analysis.
2. Actual available rendering adapter for the requested duration and
   technique; a basic eight-second FFmpeg preview does not imply that
   `template_motion_graphics`, longer sequences or 3D can be produced.
3. A verified media source and license for every missing scenic clip,
   music track, font and visual. If the client supplied an asset,
   verify rights and technical viability before quoting. A general
   stock subscription cannot be treated as unlimited cost-free
   automated downloads; respect each provider's API and license terms.
4. Versioned server-only rate card for AI operations, CPU/GPU render
   time, storage, traffic/downloads, licensing, review/labor,
   re-generation/reserve allowance, currency and payment processing.
5. Business policy on gross margin, reserve, minimum order and payment
   fees. Existing `quote-engine.mjs` models:
   `salePrice=(fullyCoveredCost + fixedPaymentFee) /
   (1 - grossMargin - variablePaymentFee)`, rounded up and floored
   at a verified service minimum. It fails closed on missing rates.
6. Server-issued quote stored in `studio_quotes`, attached to one
   completed `analysis_job_id` and matching owner/project/quality.
   Only after audits may `STUDIO_VERIFIED_QUOTING_ENABLED=true` be
   set on the Cloudflare server. No price comes from browser payloads.
7. Payment may be activated ONLY after real checkout session issuance,
   provider signature verification, refund and taxation policies,
   idempotent order authorization, and a bounded render-capable backend.

## Experimental pricing hypothesis — NOT live, NOT a final quote
For a 15-second 9:16 Italy ad requiring three scenic scenes and music,
consider validating this retail hypothesis after production trials:

- Normal: $29
- Semi-professional: $59
- Professional: $99

The above are **NOT** the production cost, not market-verified
profit estimates, not a promise to deliver, and must never be
hardcoded into a customer quote without supplier and renderer cost
validation. Higher quality implies real additional work, not merely
selecting a stronger LLM. All three tiers require explicit technical
production definitions before selling.

Example of pure pricing math (not a measured Studio run): if a
job's all-in cost is $10, desired gross margin is 50%, variable
payment fee 3%, fixed payment fee $0.30, price is ceil((10+0.30)/
(1-0.50-0.03)*100)/100 = $21.92. Taxes, refunds and actual
usage are separate obligations. Never set missing cost to zero.

Useful supplier list-price starting points for subsequent audits:
https://elements.envato.com/pricing
https://www.storyblocks.com/pricing?site=video
Both have licensing and usage conditions; subscription advertised
prices are NOT an approved API integration or actual per-job cost.

## Rollout / rollback
- Deploy chat-only UI + authenticated lookup first; feature stays
  limited to founder test account under Supabase RLS.
- Apply migration 010 **after** updated browser code deploys because
  older browser builds select internal columns.
- Apply migration 011; test ownership, quote currency, quality,
  final amount, expiry, and no unaudited payment.
- Keep public AI rendering, payment and live verified quoting OFF.
- Revert the front-end chat-flow flag to false to return to existing
  founder UI if it fails; do NOT stop the separate Oracle workers.

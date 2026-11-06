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

## Experimental low-cost retail policy — NOT live, NOT a final quote
**Founder pricing target (Nov 6, 2026): $1 for a genuinely simple Normal
video.** The earlier $29 / $59 / $99 default proposal was explicitly
rejected by the founder and must not be used as a Studio pricing anchor.

- **Normal: $1 target** for a narrowly bounded, template-based output:
  up to 15 seconds; preset typography/transitions/captions; basic 1080x1920
  FFmpeg rendering on existing free-quota CPU; source video/images/audio
  uploaded by the customer or legally reusable at zero marginal license
  cost; no paid video/image generation; one render; no manual editing.
  OpenAI Luna (or a measured cheaper equivalent) classifies and plans;
  it does **not** itself render the MP4. Additional hidden provider calls
  must never start without a measured budget and delivery capability.
- Semi-professional and Professional: **not priced yet**. The quote
  must depend on actual operations, model selection and cost. Terra may
  assist with planning when justified but using a higher-cost text model
  alone must never imply a premium video was created.
- A 15-second Italy travel advertisement with three scenic clips and music
  is **not automatically in the $1 tier** unless all 3 clips and legal music
  are supplied or sourced with proven free commercial-use rights, and
  production succeeds in the supported template renderer. Otherwise
  request files or return "awaiting verified estimate", never promise
  $1 delivery or charge for a job the backend cannot make.

**Hypothesis, not a measurement:** at a $1 checkout price, fixed
payment-processor fees can dominate the actual AI cost. For example,
a purely illustrative $0.30 fixed fee and 3% variable fee leave $0.67
BEFORE rendering, assets, taxes, refunds and profit. To attain a 25%
gross-margin target, all-in service cost must be no more than $0.42
in that illustrative example. The actual regional payment provider's
fees must be verified; consider prepaid customer credit packs to
amortize fixed transaction fees while retaining $1-per-Normal-video
retail unit pricing.

**Cost-first implementation:** classify request; build an executable
media/FFmpeg operation plan; verify uploaded or legally usable free
assets; measure CPU time, storage/egress and license fees; use a
versioned rate card and a per-order profitability floor. A "free
tier" is a monthly allowance and may be exhausted; allocate usage
conservatively, rate-limit orders, and fail closed on any missing rate.
For unsupported features, provide a higher documented quote or decline
the order. All price calculations and owner margin remain server-only.

This is not a production cost estimate or public offer. Never embed
$1 as a hardcoded payable quote until the complete delivery + payment
path passes cost and rights audits.

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

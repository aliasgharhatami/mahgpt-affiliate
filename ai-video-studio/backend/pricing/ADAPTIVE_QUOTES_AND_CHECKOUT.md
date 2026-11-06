# MAH GPT Studio — Adaptive director, quality, quoting and checkout (design contract)

Status: **STAGED ONLY — no public AI call, no paid quote, no payment, no API key**.
The existing founder-only Oracle 8-second preview remains separate and unchanged.

## Product steps

1. **Brief**: description, assets, duration, aspect ratio, delivery format.
2. **Quality**: Normal / Semi-professional / Professional. Always show **Back** and **Cancel**.
3. **Plan**: a low-cost director (prefer Luna) analyzes complexity, expected tool calls,
   duration, media types, GPU/CPU needs and expected token caps. Show the chosen approach
   and whether the requested tier can support it. No spending beyond the explicitly
   disclosed free planning allowance; before connecting any paid API, obtain owner approval.
4. **Quote**: server validates model catalog, operation plan, measured non-token rates,
   expected tokens, retry allowance, platform costs, payment fees, profit target,
   estimated cost cap and expiry. Never invent zero-dollar media/render costs. Show
   what is included (format, quality, revision count) and total fixed payable amount.
   Offer Back, Edit brief, Cancel. Quote is not payable until backend/payment integration.
5. **Payment**: server-owned quote ID and price, real payment-provider verification,
   idempotency, fraud prevention, legal compliance and confirmation via provider webhook.
   Never let the browser declare a job paid.
6. **Production**: only a paid/explicitly free **authorized** job can start. Lock maximum
   spend per job; log per-stage actual input/cached/output/reasoning tokens, tools and
   CPU/GPU/storage. Prevent model upgrades or unplanned tools from exceeding quoted cap;
   request a new quote/approval instead of a hidden extra charge.
7. **Result**: play MP4 in the editor at the top of the composer with Download, Edit/new
   version, and show the same item in My Projects. Retention rules still apply.

## Quality and complexity are different controls

| Quality | Production review passes | Allowed validated complexity |
| --- | ---: | --- |
| Normal | 1 | Simple, moderate |
| Semi-professional | 2 | Simple, moderate, advanced |
| Professional | 3 | Simple, moderate, advanced, specialist/3D |

A validated production plan with simple/moderate/advanced/specialist-3D complexity
sets the minimum model capability. The chosen quality sets a capability/QA floor and
may force an upgrade, but does not directly authorize external billable tools.
Current audited model mapping: Luna (1), Terra (2), Sol 6.1 (3), Astra (4).
The model is a **director/code planner**; producing 3D/video/images is a separate
backend capability and expense. The current Oracle ARM64 pilot is only FFmpeg and has
not yet passed a real 3D production benchmark.

## Low-price economic strategy

For simple animation use reusable templates, SVG/HTML/CSS motion design, FFmpeg and
low-cost planning. Reserve generative media tools for scenes that truly require
them. For example, a **$1 total price** is viable only if the measured end-to-end
cost plus payment fees, risk reserve, storage and profit fit under that price.
A complex 1-minute generative cinematic sequence cannot be promised at $1.
Keep internal cost breakdown private, but show the customer a transparent total.

Server-side math is already in `quote-engine.mjs`:
- Model input and output token estimates × trusted live reviewed price
- Render time / storage / download / third-party media operations × measured rates
- Safety reserve + order overhead
- Gross margin and payment processing costs
- Final fixed price rounded up, with an expiry and approved spending ceiling

**Never** issue a payable quote when any required rate is absent, even if the
director's token cost is tiny. Current `rate-card.example.json` deliberately
contains NULL rates for production tools.

## Future-model compatibility

Every proposed model must pass: availability for owner's API account, audited
capabilities, current standard API prices, quality evaluation, compatible
tool/use-case support and an explicit allowlisted enablement. After review,
add its ID/rate metadata to server catalog. No autonomous switch to an unknown
model. If pricing changes or a model retires, stop quoting until verified rates
and fallbacks are available.

## Cancel / Back contract

- Before payment: Back/edit/cancel is free and does not start a render; release draft
  holds and pending quote reservations safely.
- During checkout: cancel the checkout session; verify server state, do not assume
  no payment if the provider callback is late.
- After payment but before render: request cancellation and initiate documented
  refund/credit policy, idempotently.
- During production: show Stop request when supported; tell the user any refund
  eligibility accurately; never claim a full refund until provider confirms.
- After completion: Edit means a new version/quote; the current MP4 stays accessible.
- Navigation, refresh, retries and lost connectivity must restore state from
  server-side order/quote/job records, not browser-only state.

## Immediate next release gates

1. Confirm Cloudflare Production deploy of UI PR #64, which was queued at the time
   of this design; do **not** trigger repeat deploys during backlog.
2. Measure a reproducible sample of Oracle CPU seconds, storage/egress, retries and
   each prospective AI model's input/output tokens and output quality.
3. Implement signed-in private quote analysis service with hard token/tool budgets.
4. Render quality-choice wizard and price preview only after step 3 is verified.
5. Choose compliant payment processor and enable payment only with verified
   webhook + refund/withdrawal/legal policies and explicit owner go-live approval.

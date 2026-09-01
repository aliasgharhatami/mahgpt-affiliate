# MahGPT Operations Reference

Last updated: 2026-09-01

This document is the human-readable source of truth for the current MahGPT automation, SEO, multilingual pages, social publishing, and affiliate-link safety rules. Read this before changing workflows, SEO scripts, social publishers, locale generation, or affiliate redirects.

## Current Production Rules

- Do not break Telegram or Instagram publishing while changing SEO or multilingual pages.
- Keep X/Twitter manual-only until the owner explicitly enables automatic X scheduling.
- Do not add paid APIs or paid services for translation, SEO, or news automation.
- Do not expose secrets in code, logs, documentation, screenshots, or generated files.
- Preserve affiliate redirects and use `/go/*.html` redirect paths for active affiliate partners.
- After meaningful production changes, ask the owner whether this document should be updated.

## Social Publishing

Current intended cadence, in Europe/Istanbul time:

| Task | Time |
| --- | --- |
| Refresh daily news, social queue, analysis pages, and sitemaps | 08:17 daily |
| Publish Telegram and Instagram item 1 | 08:20 |
| Publish Telegram and Instagram item 2 | 10:20 |
| Publish Telegram and Instagram item 3 | 12:20 |
| Publish Telegram and Instagram item 4 | 14:20 |
| Publish Telegram and Instagram item 5 | 16:20 |
| Publish Telegram and Instagram item 6 | 18:20 |
| Publish Telegram and Instagram item 7 | 20:20 |
| Publish Telegram and Instagram item 8 | 22:20 |
| Publish Telegram and Instagram item 9 | 00:20 |
| Publish Telegram and Instagram item 10 | 02:20 |

UTC cron source of truth:

- `.github/workflows/update-news.yml`: `7,22,37,52 * * * *` offset watchdog; readiness defers stale refresh until 08:17 Europe/Istanbul
- `.github/workflows/social-delivery.yml`: `7,22,37,52 * * * *` offset watchdog; publishers still enforce the two-hour queue slots

Important behavior:

- `social-delivery.yml` is the only scheduled production publisher for Telegram + Instagram.
- `social-delivery.yml` and `update-news.yml` share `mahgpt-content-automation` concurrency in production to prevent state commit races.
- `.github/workflows/publish-social-queue.yml` is manual-only and should not have a `schedule` trigger.
- `.github/workflows/test-instagram-publisher.yml` is manual-only and should not have a `schedule` trigger.
- `social-delivery.yml` must not have a `workflow_run` trigger from `Refresh MahGPT news`.
- Each automatic run publishes at most one eligible Telegram item and one eligible Instagram item.
- Publisher cooldown is 75 minutes to prevent bursts while still allowing the next two-hour slot.
- Eligibility window is 150 minutes so delayed 00:20 and 02:20 Europe/Istanbul slots still work after the local date rolls over, without replaying stale backlog.

Key files:

- `data/social-queue.json`: daily shared queue.
- `data/social-delivery-history.json`: Telegram delivery state.
- `data/instagram-delivery-history.json`: Instagram delivery state.
- `scripts/social-queue.mjs`: builds the daily queue and fallback cards.
- `scripts/social-publisher.mjs`: publishes Telegram queue items.
- `scripts/instagram-publisher.mjs`: publishes Instagram queue items.
- `scripts/social-queue-readiness.mjs`: decides whether today's queue needs refresh.
- `scripts/validate-social-cadence.mjs`: protects cadence and publisher guardrails.

Manual workflows:

- `Manage MahGPT social queue`: can rebuild, inspect, or manually publish one Telegram item.
- `Publish one MahGPT social item`: manual Telegram publisher.
- `Test MahGPT Instagram publisher`: manual Instagram publish or dry run.
- `Test MahGPT X publisher`: manual X/Twitter preview or publish only.

## Affiliate Links

Active affiliate links currently protected by CI:

| Partner | Redirect path | Target |
| --- | --- | --- |
| Descript | `/go/descript.html` | `https://get.descript.com/35sevxkoxqev` |
| SOUNDRAW | `/go/soundraw.html` | `https://soundraw.io/?ref=jwgoliii` |
| Pictory | `/go/pictory.html` | `https://pictory.ai?fpr=ali-asghar30` |

Rules:

- Active partner social links should prefer the redirect path, not raw official URLs.
- Redirect pages must remain `noindex`.
- Do not change these URLs unless the owner provides a replacement affiliate URL.
- Use `scripts/validate-affiliate-links.mjs` before merging changes that touch affiliate config or redirect files.

Key files:

- `config/social-affiliate-links.json`
- `go/descript.html`
- `go/soundraw.html`
- `go/pictory.html`
- `scripts/validate-affiliate-links.mjs`

## Multilingual SEO

Configured locales:

| Code | Hreflang | Direction | Name |
| --- | --- | --- | --- |
| en | en | ltr | English |
| es | es | ltr | Espanol |
| de | de | ltr | Deutsch |
| fr | fr | ltr | Francais |
| pt-BR | pt-BR | ltr | Portugues |
| ar | ar | rtl | Arabic |
| fa | fa | rtl | Persian |
| tr | tr | ltr | Turkish |
| it | it | ltr | Italiano |
| ja | ja | ltr | Japanese |
| ko | ko | ltr | Korean |
| id | id | ltr | Bahasa Indonesia |
| hi | hi | ltr | Hindi |

Rules:

- Translation mode is static and zero-paid-API.
- Keep canonical and hreflang aligned across generated locale pages.
- Keep multilingual sitemaps in sync after page generation.
- Do not let localized pages replace affiliate redirects with non-affiliate links.

Key files:

- `config/locales.json`
- `docs/multilingual-seo.md`
- `scripts/generate-multilingual.mjs`
- `scripts/validate-multilingual.mjs`
- `scripts/generate-sitemaps.mjs`
- `scripts/validate-hreflang-sitemaps.mjs`
- `sitemap.xml`
- `sitemaps/`

## SEO Stage 1-10 Status

Recent SEO work created or reinforced these areas:

1. Safe backup and review branch before SEO changes.
2. Title, meta description, canonical, and Open Graph improvements.
3. Hreflang and multilingual sitemap alignment.
4. Internal-link, broken-link, and orphan-candidate checks.
5. Breadcrumb and Article schema where appropriate.
6. Image alt text, H1/H2 structure, and publication/update signals.
7. Topic clusters for AI-tool categories such as video, audio, voice, SEO, and related areas.
8. Internal linking between news, guide, and partner/tool pages.
9. Secure IndexNow notification with key validation and deduplication.
10. Real daily SEO maintenance audit instead of only creating audit tooling.

Daily SEO maintenance:

- Workflow: `.github/workflows/daily-seo-maintenance.yml`
- Schedule: `30 6 * * *` UTC
- Includes cadence guard, affiliate guard, daily analysis validation, deterministic SEO audit, hreflang/sitemap validation, internal-link/content audit.

Key scripts:

- `scripts/seo-audit.mjs`
- `scripts/seo-content-audit.mjs`
- `scripts/validate-hreflang-sitemaps.mjs`
- `scripts/validate-topic-clusters.mjs`
- `scripts/apply-topic-cluster-links.mjs`

## Daily Original Analysis

Purpose:

- Avoid only repeating external news.
- Publish MahGPT-owned daily analysis that adds interpretation, context, and category-level insight.
- Support SEO and AI discovery by creating original, structured content around AI news and tool categories.

Behavior:

- Generated during `Refresh MahGPT news` when the daily queue refresh runs.
- Included in locale news pages and analysis routes.
- Sitemaps are regenerated afterward.

Key files:

- `scripts/daily-analysis.mjs`
- `scripts/validate-daily-analysis.mjs`
- `assets/daily-analysis.json`
- `news/analysis/`
- `*/news/analysis/`

## IndexNow

Current behavior:

- Workflow: `.github/workflows/indexnow-notify.yml`
- Script: `scripts/indexnow-notify.mjs`
- Tests: `tests/indexnow-notify.test.mjs`
- Key file: `indexnow-key.txt`
- Secret: `INDEXNOW_KEY`
- Variable: `INDEXNOW_DRY_RUN`

Rules:

- Keep notifications deduplicated.
- Keep the key file publicly reachable at `https://mahgpt.com/indexnow-key.txt`.
- Do not log the secret value.
- IndexNow can be non-blocking, but tests must pass.

See also: `docs/indexnow.md`.

## Required Checks Before Merging Related Changes

Run or verify the relevant workflow checks before merging:

- `node scripts/validate-social-cadence.mjs`
- `node scripts/validate-affiliate-links.mjs`
- `node scripts/validate-daily-analysis.mjs`
- `node scripts/seo-audit.mjs`
- `node scripts/validate-hreflang-sitemaps.mjs`
- `node scripts/seo-content-audit.mjs`
- `node --test tests/indexnow-notify.test.mjs`
- `node --check scripts/social-publisher.mjs`
- `node --check scripts/instagram-publisher.mjs`

GitHub Actions that should pass for related PRs:

- `MahGPT Daily SEO Maintenance`
- `Deliver scheduled MahGPT social items`
- `Publish one MahGPT social item`
- `Test MahGPT Instagram publisher`
- `Generate zero-cost multilingual pages` when multilingual files are touched
- `MahGPT IndexNow notification` when IndexNow files are touched

## Recent Important PRs

- PR #36: restored exact social cadence, removed off-cadence triggers, made fallback publishers manual-only, protected key affiliate links.
- PR #37: fixed overnight 00:20 and 02:20 Europe/Istanbul delivery slots.
- PR #39: replaced exact-minute social scheduling with a 15-minute watchdog.
- Current hardening: refresh and delivery watchdogs defer to the protected queue/cadence guards and share production concurrency.

## Maintenance Rule For Future Work

After every meaningful change to automation, SEO, multilingual pages, social publishing, IndexNow, affiliate links, or workflow timing, ask:

"Do you want me to update `docs/operations.md` with these changes too?"

If the owner says yes, update this document in the same PR or in a small follow-up PR.

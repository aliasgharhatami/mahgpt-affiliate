# MahGPT social publishing

## Scope

Phase one publishes MahGPT news to Telegram only. Instagram, LinkedIn and X are intentionally not wired yet.

## Architecture

The news workflow remains the primary publisher:

1. `scripts/update-news.mjs` fetches RSS/Atom feeds and writes `assets/news-feed.json`.
2. The website reads that feed and deploys normally.
3. The social layer reads the same normalized article objects.
4. A platform-neutral publisher resolves product links and formats a post.
5. The Telegram adapter uses `sendPhoto` when an image can be downloaded, otherwise `sendMessage`.

The Telegram adapter never runs before the website feed is written. Telegram errors are logged and do not fail news generation.

## Required secret

Add repository secret `TELEGRAM_BOT_TOKEN` at **Settings → Secrets and variables → Actions → New repository secret**. Never put the token in source, workflow YAML, logs or a commit.

Optional variable: `TELEGRAM_CHANNEL`; the default is `@mahgptplus`.

## Manual test

Open **Actions → Test MahGPT Telegram publisher → Run workflow**. Leave the source input empty to send exactly one post for the first current feed item, or paste one exact `source` URL from `assets/news-feed.json`. This workflow does not read or alter duplicate state and never sends historical items in bulk.

Expected result: one Telegram post containing the headline, summary, primary MahGPT article link, and a product link when configured.

## Automatic publishing

After the manual test is verified, enable the automatic step in `update-news.yml` by merging this PR. The first automatic run only creates a baseline of current feed items; it sends nothing historical. Later runs send only items newer than that baseline and absent from `data/telegram-published.json`.

The state is written only after a successful Telegram API call. Re-runs are safe because the workflow serializes executions and checks the persistent state before sending. A failed delivery is logged and remains retryable.

## Link resolution

`config/social-affiliate-links.json` is the central resolver table:

- `status: active` plus `affiliateUrl` → affiliate URL.
- `status: pending` or `none` → official product URL.
- No valid entry → no product CTA.

Never add signup URLs. When a relationship becomes active, update only this table; future posts automatically use the affiliate URL.

## Images

The existing news job stores image URLs from RSS or article `og:image`; it does not maintain a local image archive. The Telegram adapter downloads the selected image to a temporary runner file only for `sendPhoto`, then deletes it. If download fails, it falls back to `sendMessage`.

## Duplicate prevention and failure handling

`data/telegram-published.json` stores article keys and delivery timestamps. The initial baseline prevents historical posts. The workflow uses a concurrency group so reruns cannot race the state file. Telegram failures never block the website news update.

## Future platforms

Future Instagram, LinkedIn and X adapters should consume the same normalized article object and link resolver. Add a formatter and adapter per platform; do not duplicate RSS parsing or affiliate logic.


## Editorial normalization

Before formatting, the shared normalizer in `scripts/social-content.mjs`:

- removes HTML entities, tags, `&nbsp;` and common publisher suffixes;
- detects partner names from headline, source and metadata using explicit keyword rules;
- rejects title-as-description duplicates;
- creates a concise factual fallback when the source description has no useful detail;
- creates the stable story slug used by both Telegram and the website.

The normalized object contains `story_id`, `headline`, `summary`, `mahgpt_url`, `source_name`, `source_url`, `image`, `detected_partner`, `product_url` and `affiliate_status` conceptually. Future platforms should consume this object rather than parse RSS independently.

## Clean article URLs

New posts use:

`https://mahgpt.com/news/story.html?id=<headline-slug>`

The old `/news/index.html?story=<source-url>` route remains available for backwards compatibility. Homepage and related-story links now use the clean route. The story page resolves the slug back to the current feed and sets a matching canonical URL.

## Product links and redirects

The resolver checks `config/social-affiliate-links.json`. Active entries use a valid `affiliateUrl`; pending/none entries use an existing `redirectPath` where one exists, otherwise the official product URL. Adobe currently has no active tracking URL in the repository, so its CTA remains the official Firefly destination. Signup pages are never used.

## Safe test recommendation

Do not resend the earlier Adobe test. In the manual workflow, paste the exact `source` URL of a different current item from `assets/news-feed.json`; one selected item is sent and duplicate state is not changed.

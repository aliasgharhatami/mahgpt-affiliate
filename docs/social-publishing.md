# MahGPT social publishing

## Scope

Phase one publishes to Telegram only. The queue is platform-neutral and reserves per-platform state for LinkedIn, Instagram and X, which are not implemented yet.

## Daily flow

1. The existing news refresh runs once daily at 05:17 UTC / 08:17 Türkiye and writes assets/news-feed.json.
2. Immediately afterward, scripts/social-queue.mjs snapshots the same current feed items (up to 10) into data/social-queue.json.
3. The social workflow runs every two hours and publishes at most one eligible Telegram item. It never fetches news or rebuilds the queue.
4. Delivery state is committed after success or failure.

The refresh schedule is unchanged. Website publishing remains independent and primary; Telegram failures retain the queue item and never prevent the feed update.

## Türkiye publishing slots

The GitHub Actions schedule is:
20 5,7,9,11,13,15,17,19,21,23 * * * UTC

That is:
08:20, 10:20, 12:20, 14:20, 16:20, 18:20, 20:20, 22:20, 00:20 and 02:20 Türkiye time.

The first slot is deliberately a few minutes after the 08:17 refresh. A missed workflow run still publishes only one item on the next execution; it does not catch up with a batch.

## Required secret

Add repository secret TELEGRAM_BOT_TOKEN at Settings → Secrets and variables → Actions → New repository secret. No new secret is required for the queue. The channel defaults to @mahgptplus.

## Queue and duplicate protection

data/social-queue.json contains the daily snapshot and per-platform state. story_id is the stable source URL, with a title/date fallback only when no source URL exists. scheduled_publish_at is the assigned slot. telegram.status is pending, published, failed or skipped_duplicate. LinkedIn, Instagram and X remain pending placeholders.

data/social-delivery-history.json preserves successful deliveries across daily queue resets. The builder also imports previously sent records from data/telegram-published.json. If the same source appears again, it is marked skipped_duplicate and is not sent again. A success is recorded only after Telegram returns a successful API response. Failures are retained and can be retried manually.

## Manual operations

Open Actions → Manage MahGPT social queue → Run workflow:
- rebuild: rebuild today’s queue from the current assets/news-feed.json; sends nothing.
- inspect: print today’s queue in the workflow log; sends nothing.
- publish_next: publish exactly one next queued item, even if its slot is still in the future. Optional retry_failed retries one failed item.

The existing Test MahGPT Telegram publisher workflow remains available for a controlled direct test, but queue testing should use publish_next.

## Content and links

Queue creation uses the shared editorial normalizer: cleaned headlines, concise summaries, source attribution, clean MahGPT story URLs, and strict explicit-brand partner detection. Product resolution happens only after a valid partner is detected. Active affiliate destinations are used when configured; pending/none uses the official destination or an existing /go/ redirect. No signup URL is used.

Images reuse the article image when safe. Telegram uses sendPhoto when it can download that image and falls back to sendMessage otherwise.

## Future platforms

Future adapters should consume the normalized queue item and its platform state. They should not re-parse RSS or change the daily queue.


## Fallback social cards

When a queue item has no usable source image, queue creation generates deterministic MahGPT editorial cards with no external API or new secret:

- landscape PNG for Telegram, LinkedIn and X: 1200×675
- portrait PNG reserved for Instagram: 1080×1350
- SVG sources may remain beside the PNGs for deterministic regeneration
- stored under assets/social-cards/YYYY-MM-DD/
- queue fields image_mode, fallback_image_landscape and fallback_image_instagram identify the selected media

Telegram first attempts the source image, then reads the generated local landscape PNG directly from the checked-out repository and uploads it as image/png. It falls back to a text-only message only if both image sends fail. Generated cards are committed with the queue so they are not regenerated during social publishing slots.

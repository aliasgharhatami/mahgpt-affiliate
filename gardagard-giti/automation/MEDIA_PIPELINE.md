# گرد گیتی — خط تولید مستقل پنج محتوای روزانه

**Status: technical preview implemented. Instagram publishing intentionally OFF.**

## Daily stages
1. `giti-daily-discovery.yml` runs ~07:05 Europe/Istanbul: original local source RSS, source article analysis, original colloquial Persian scripts and candidate archival images.
2. `giti-render-daily-previews.yml` runs automatically **only after a successful discovery workflow** on `main`. It uses the brand-new separate `gardagard-giti/automation/queue.json` (and refuses live queues); fetches Wikimedia Commons candidates with credits, generates 3 narrated video drafts + 2 feed photos/Story copies if five usable stories are present, and uploads a review package to GitHub Actions. It DOES NOT publish.
3. After review and public HTTPS media hosting, the existing `giti-instagram-slots.yml` would publish approved items at 10:00/13:00/16:00/19:00/21:30 Türkiye time. **Do not turn on any live-publishing flags until controlled Instagram test and legal checks pass.**

## Code
- `automation/render_daily.py` — uses Pillow with RAQM for correct Persian RTL; illustrative photos (with author/license captured) or labelled design-only placeholder; cream/charcoal editorial split cover, per-sentence fixed subtitles with 70% opacity panel, Kore voice via Gemini free tier and original low-volume synthesized ambient underscore. The preview output is marked **«پیش‌نمایش — منتشر نشود»**.
- `automation/research_queue_media.py` — selects Wikimedia Commons license candidates, no automatic claim that a generic archival image shows the event.
- `tests/media-preview-fixture.json` — **not a real daily news batch**. One earlier Edirne incident and four clearly marked technical layout-only samples. Never publish.
- `giti-media-preview.yml` — isolated manual/branch-triggered pilot rendering; `giti-media-sanity.yml` — no-cost code and queue tests.

## Constraints and blockers
- **Free only:** Google AI Studio Free tier and free GitHub Actions quota; do not activate billing. If quota runs out, stop and notify; no paid fallback.
- **Missing production approval:** automatically generated news has NOT passed independent fact verification, voice listening, image relevance, image reuse and on-graphic QA; no script automatically marks approval.
- **Missing public media host:** GitHub Actions artifacts cannot be supplied as `media_url` / `video_url` to Instagram. Need a dedicated HTTPS public asset site, e.g. a Render Static Site in a workspace selected by user, without changing MahGPT website.
- **Brand logo:** the actual circular gold user logo can be placed as a discreet overlay once a safe source file is committed to the branch.
- **Daily source diversity:** current RSS selection covers only a few countries; insufficient credible news means fewer than five pieces, not filler or invented posts.
- **Social publishing:** the Instagram token has been separately validated read-only against the intended Gerde Giti account; existing MahGPT Telegram/site should not be modified.
- **Render:** preview size is 540×960 at 18fps for fast QA; production option 720×1280 at 24fps for lower free-tier compute. Feed posts 1080×1350 and Story images 1080×1920.

## Safety gate
`GITI_LIVE_PUBLISHING` remains false/unset, `config.json.publication.enabled` remains false, and `queue.live` remains false. A generated media file does not equal approval.

## Validation
```bash
python -m py_compile gardagard-giti/automation/render_daily.py gardagard-giti/automation/research_queue_media.py
node gardagard-giti/automation/queue.mjs validate gardagard-giti/tests/media-preview-fixture.json
```
Review rendered artifacts under GitHub Actions before making any future publishing changes.

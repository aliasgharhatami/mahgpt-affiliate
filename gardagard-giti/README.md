# گرد گیتی | Gerde Giti

A separate world-local-news Instagram automation inside the MahGPT GitHub repository. **Live publication is intentionally disabled** until voice, images, hosting, permissions, and token tests pass.

## Official branding and layout
- Brand: **گرد گیتی**
- Editorial line, exact text: **اخباری از جهان که احتمالا نمیشنوید!**
- CTA, exact text: **فالو کن تا بگردیم به گرد گیتی**
- Style: minimal modern magazine, warm cream and charcoal, split-tone real/reconstructed photography. Country flag small but visible. Avoid airplane and travel iconography.
- Caption panel opacity approx. **70%** (30% more transparent than the original prototype).
- No `LOCAL / 01`, `EP 001`, decorative editions or unnecessary category lists. Use the user's actual logo as a discreet optional identifier once integrated.
- Narration: naturally colloquial Iranian Persian with female **Gemini Kore** voice; subtitles reproduce spoken sentences in a consistent lower-third panel. Reel duration 30–180 seconds.
- Real event photos require permission; generic archival pictures must be labelled «تصویر آرشیوی» and AI reconstruction «بازسازی تصویری».

## Daily plan
- At **07:05 Europe/Istanbul** search local feeds and prepare draft candidates.
- **10:00** Reel / **13:00** photo + Story / **16:00** Reel / **19:00** photo + Story / **21:30** Reel.
- GitHub Actions schedules are best-effort, not exact-minute SLAs.
- No new posts go live unless `config.json.publication.enabled`, `GITI_LIVE_PUBLISHING`, `queue.live` and all per-post rights and quality gates are approved.

## What exists today
- `automation/discover.py`: native local publisher RSS research, diverse shortlist; the first live smoke test discovered 115 recent candidates and 20 shortlisted from 3 countries.
- `automation/compose.py`: retrieve original publisher text, build Persian colloquial editorial drafts with Gemini free tier; factual human cross-check still required.
- `automation/commons_media.py`: candidates from Wikimedia Commons with licence and photographer metadata. Its new daily research step records candidates **without automatically approving their use**.
- `automation/queue.mjs`: five separate scheduled review/publish states.
- `automation/publish.mjs`: existing Instagram Login API, Reel/feed photo/Story support, duplicate prevention and remote-media validation.
- `automation/refresh_ig_token.py`: refresh a still-valid token, if explicitly configured for secret rotation.
- The `ai-video-studio` repository has an optional Gemini TTS module for reusable WAV/SRT/Remotion integration. It has not yet been wired into the **daily automated five-asset renderer** for this account.

## Current blockers (verified 2026-10-26)
1. Existing Instagram token was rejected by Graph API as **expired on 2026-10-23**. It cannot publish, and cannot be refreshed after expiry. Issue a fresh token from the **existing Meta developer app** and replace `INSTAGRAM_ACCESS_TOKEN` in this repository's GitHub Actions secrets. No need to make a new Instagram page.
2. Three automatically narrated 1080p videos + two complete magazine-template images, fully licensed footage/photos, and automatic public HTTPS hosting do **not** yet exist end-to-end.
3. Today's production queue is not live and content QA/media-rights flags remain unapproved.
4. Free-tier Gemini quotas and GitHub Actions compute budgets must be checked using real daily workload.
5. Current local publisher feeds do not cover all nations; expand source-country coverage carefully.

## Operational references
- [Independent Giti publishing and discovery workflow](automation/README.md)
- [Current automation config](automation/config.json)
- [MahGPT operations safeguards](../docs/operations.md)
- [Persian narrator style](narration/COLLOQUIAL_FA_STYLE.md)

**Safety rule:** do not change the existing MahGPT website, Telegram queue or affiliate publishing to activate this project. The former MahGPT Instagram publisher is now manual-only; switching the same Instagram account to Giti must happen only after new assets pass preview and a controlled Meta publishing test.

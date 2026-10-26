# Gerde Giti – production matching first approved Reel

Last updated 2026-10-26. No posting is enabled by this document.

## Locked reference
The actual user-approved first 1080x1920 Reel is the visual master:
https://gerde-giti-media.onrender.com/media/2026-10-26/edirne-horses-first/reel.mp4

Reuse its approved logo and header/footer, cream/charcoal typography, location tag, split scene photos, translucent subtitle panel and CTA. Preserve real 1080x1920. Start narration exactly at 1.0 seconds.

Use ONLY Gemini 3.8 Flash TTS with Kore voice, expressive fully colloquial Iranian Persian. Never substitute Edge/Dilara. If free-tier quota or service fails, do not publish.

## New cloud production modules
- quality_news_photos.py: discover actual photos in the original news article; returned candidates are NOT automatically licensed for republication.
- quality_cloud_images.py: prefer a real, relevant photo with evidence of permission/license. If unavailable, an optional high-quality AI reconstruction can be requested, with an explicit paid API authorization and a per-run generation cap. Default: refuse charge.
- quality_kore_voice.py: measured per-scene Kore audio with 1-second intro and network timeouts.
- quality_reel_renderer.py: brand-master-based 1080x1920 compositor; refuses unrelated, insufficient, unauthorized or unreviewed visuals.
- giti-cloud-quality-check.yml: manual REVIEW ONLY cloud pipeline (no Instagram publishing).
- giti-reference-render-smoke.yml: no-cost technical smoke for reference-layout rendering on a GitHub-hosted computer.

## Rights policy
First search original article photos. An actual news image may be reused only with explicit permission or a compatible license, documented per scene; mere presence on a news site does not grant reuse rights. When unavailable, generate event-specific reconstructions, clearly labelled and checked for truthfulness; do not use generic motorcycle/river stock photography.

## Storyboard
Store scene data as JSON under the schema gerde-giti/quality-cloud/v1, with id, country_fa, location_fa, original source_url, original caption and 5–10 narrated scenes. Each scene has narration, kind actual/reconstruction, image_url or path, provenance/rights, and explicit relevance/visual review. At least 4 unique source images.

## Zero-cost constraints
GitHub Actions runs remotely and can work with user's PC off (subject to GitHub billing/quotas). Gemini 3.8 Flash TTS has a quota-limited free API tier. Gemini 3.1 image-generation API does NOT have a free tier. ChatGPT subscription image creation is not an included unattended GitHub API. Therefore exact quality at strictly $0 can only be attempted when enough actually licensed event photos are available; otherwise do not downgrade to generic stock or silent slides. Never activate paid Gemini Image without owner opt-in and a hard cap.

## Publication hold
The second trial Reel was rejected and deleted; do not retry it. Keep GITI live publishing OFF and the independent MahGPT Telegram delivery untouched. Once two matching preview assets pass the user's test, enable posting separately with single-claim duplicate protection, never just because a technical job passed.

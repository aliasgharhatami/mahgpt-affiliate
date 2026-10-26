# Gerde Giti — isolated public media host

This directory is **only for Instagram's public HTTPS access** to approved image/video assets. It must not store API tokens, narration prompts, unreviewed news, third-party photos without confirmed rights, or private documents.

Source branch: `giti-media-host-20261026`, *not* the MahGPT production website branch.

Render configuration:
- Workspace: LIA
- Service: `gerde-giti-media`
- Repository: `https://github.com/aliasgharhatami/mahgpt-affiliate`
- Branch: `giti-media-host-20261026`
- Build command: `true`
- Publish directory: `gardagard-giti/media-host/public`
- Auto-deploy: only when hosting branch changes (no effect from main)
- Pricing: free static site (subject to Render's included bandwidth/pipeline limits)

## Future approved-media layout
`public/media/YYYY-MM-DD/<story-id>/reel.mp4`
`public/media/YYYY-MM-DD/<story-id>/cover.jpg`
`public/media/YYYY-MM-DD/<story-id>/feed.jpg`
`public/media/YYYY-MM-DD/<story-id>/story.jpg`

Do **not** assert Instagram publishing is working until each URL returns a real 200 HTTP response with the correct public content type and the read-only `gerde_giti` account check passes. Direct asset URLs must remain public while Instagram ingests the media. Avoid publishing low-quality placeholders.

Media assets are currently **not uploaded**. The queue's `media_url` fields must remain empty until approved files are actually accessible. No public Instagram publishing has been activated.

## HTTP transport test
Public files under `public/checks/` are explicitly synthetic transport diagnostics, not news images/videos and MUST NEVER be used as Instagram content. This is used to validate that Render's CDN serves real MP4 and JPEG file bytes with correct MIME types. Automated publishing remains OFF.

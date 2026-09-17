# MahGPT Video Studio

Private Seedance 2.5 video-generation workspace intended for `video.mahgpt.com`.

## What it supports

- Text → Video with no reference image
- Multi-image reference mode
- Ordered Seedance image tags: `@Image1`, `@Image2`, `@Image3`, ...
- 10 / 20 / 30 second video generation
- 480p / 720p / 1080p
- AI audio on/off via the native `generate_audio` API parameter
- 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 and adaptive aspect ratios
- Server-side upload to the KIE File Upload API
- Server-side Seedance task creation and status polling
- MP4 preview and same-origin download endpoint
- Browser-local recent generation history
- No API key in frontend code

## KIE integration

Model: `bytedance/seedance-2-5`

The browser uploads each reference image to `/api/upload`. The Pages Function forwards it to KIE's file-stream upload endpoint. The returned temporary URL is then included in `reference_image_urls` in the same order as the UI. The first URL maps to `@Image1`, the second to `@Image2`, and so on.

Text → Video simply omits `reference_image_urls` and sends the prompt directly to Seedance.

The app intentionally uses status polling instead of a public callback URL. This lets the entire `video.mahgpt.com` application stay behind Cloudflare Access while KIE itself remains reachable only from server-side functions.

## Cloudflare Pages deployment

Create a **separate Cloudflare Pages project** from the existing `aliasgharhatami/mahgpt-affiliate` repository so the affiliate site is not changed.

Recommended settings:

- Project name: `mahgpt-video-studio`
- Production branch: `feature/mahgpt-video-studio-v1` initially
- Root directory: `video-studio`
- Framework preset: None
- Build command: leave blank
- Build output directory: `.`

Pages Functions are under `video-studio/functions` and will be deployed with this Pages project.

### Required secret

In the new Pages project, add the following encrypted environment variable for Production and Preview:

`KIE_API_KEY`

Never place the key in GitHub, HTML, JavaScript, or a public `.env` file.

## Make the studio private

After the Pages project works, add the custom domain `video.mahgpt.com`. Then create a Cloudflare Zero Trust Access application for that hostname and allow only the owner's chosen email/account.

Because this implementation does not rely on a KIE callback URL, Cloudflare Access can protect the entire hostname without breaking image uploads or task completion polling.

The site also ships with `noindex` headers and a `robots.txt` that disallows crawling. These are extra safeguards, not substitutes for Access authentication.

## API routes

- `GET /api/health` — confirms server configuration without exposing the key
- `POST /api/upload` — uploads one image to KIE temporary storage
- `POST /api/generate` — creates a Seedance 2.5 task
- `GET /api/status?taskId=...` — reads current task state/results
- `GET /api/download?taskId=...` — revalidates the completed task and streams the MP4 as a download

## Privacy note

KIE reference uploads are temporary according to their File Upload API documentation. Generated media URLs can also be time-limited, so important results should be downloaded promptly.

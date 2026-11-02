# MAH GPT Studio — one-composer intake and finalized project archive
Date: 2026-11-03 · Product decision from founder

## Non-negotiable UX
- The big editor/composer on `mahgpt.com` is **the only user intake surface**.
- Text brief, iterative chat, image/video/audio, reference videos/links, style choices and future quote request must all originate there. No separate manual "Save Current Draft" or another media archive upload form to begin.
- A private database project with lifecycle `intake` is an implementation detail — it exists so uploaded files have a private project id and can be processed safely. It is *not* listed in My Projects.
- The future director is **a conversation**, asking targeted clarification questions if the goal or media is ambiguous; do not claim AI understanding before its API is actually installed.
- On real render completion, trusted backend promotes intake/processing to `completed` and attaches verified output asset, pricing/payment state as appropriate. **Only completed projects are displayed in My Projects**; a fake browser-only "complete" signal must never publish a job.
- All editing, motion graphics, typography, font assets, effects, sound design, captions, FFmpeg/Remotion and project manifest work must reuse the established private `aliasgharhatami/ai-video-studio` repository. Remotion is the renderer, NOT the entire service. No new simplified renderer should replace that source of truth.

## Retention policy (DESIGN ONLY until scheduler is deployed)
- Proposed completed-project retention: **7 days after last user use**.
- Backend sets `finalized_at`, `last_opened_at`, `expires_at = now() + interval '7 days'` on successful final output.
- Every authenticated reopening/reuse of an archived **completed** project extends the deadline by 7 days. This requires a trusted endpoint since clients cannot set completion/expiry columns directly.
- My Projects must show a precise expiration date and warnings close to expiry.
- A scheduled **trusted** GC must list expired projects, delete all R2 originals and render derivatives, then delete metadata and related messages and mark appropriate audit traces. It must be idempotent, retry failed object deletes, and not delete data immediately upon crossing an arbitrary client timestamp.
- Do not use SQL-only row deletion for R2-owned assets: it leaves orphaned billable R2 objects.
- Cloudflare R2 object-lifecycle expiry alone is insufficient because reopening a project must reset retention, and uploaded media may precede final render.
- Temporary intake assets need an additional abandoned-intake TTL and owner controls; do not open public intake until this GC is deployed.
- **No seven-day automatic deletion is active at present.** Do not show a false promise or countdown in the live UI while it is unimplemented.

## Current development state
- Main composer now creates an owner-only private intake when submitting, records user messages, and uses the existing R2 media upload with the pilot size quota and explicit media rights check. A single approved tester can try it.
- The main composer displays pending messages and any uploaded assets with authenticated download/removal.
- The archive filters `lifecycle='completed'`. No render backend is yet marking projects completed, so My Projects should remain empty.
- OpenAI API credit is unused and chat replies are not yet live.
- Remotion + FFmpeg + full editing studio not yet connected to this website; preserve all original capabilities during adaptation.
- Price engine and payment provider remain disabled.
- Production status must be validated after deployment with static checks, a private authenticated upload, and cleanup/retention tests.

## No-spend constraint
- R2 Standard's 10 GB-month free storage quota is ACCOUNT-WIDE and not a hard cost stop. Original pilot enforces 15 MB/file and 80 MB lifetime, one user only.
- No public uploads, paid provider calls, or bank checkout until rate/billing/retention caps are functional and explicitly approved.

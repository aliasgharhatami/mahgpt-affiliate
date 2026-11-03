# MAH GPT Studio website ↔ full engine contract
Decision recorded: 2026-11-03.

## Source-of-truth invariant
**Connect the entire and continuously extensible AI Video Studio—not only Remotion rendering.** Remotion is one adapter. The authoritative engine source is `aliasgharhatami/ai-video-studio` (`main` after tests); this website repository must not copy or maintain competing versions of its analysis, AI planning, voiceover, transcription, motion, typography, templates or rendering code.

## Product boundary
1. Website: authenticated customer request, reference style, file uploads, quote/approval, project progress, preview, final media and seven-day notice.
2. Supabase: account ownership, request/job metadata and lifecycle/RLS. Never expose elevated Supabase keys to browser code.
3. Private Cloudflare R2: input, previews and verified outputs; scoped server-side media access only.
4. **Cloud Studio orchestrator:** a Linux-hosted instance/collection of workers using the *whole* `ai-video-studio` source revision. It dispatches to versioned capabilities: reference analysis, edit planning, semantic planner, subtitle/speech alignment, audio and narration, effects, templates, Remotion/FFmpeg rendering, quality validation, and future adapters.
5. Website ↔ orchestrator must use a private authenticated **versioned API** with capability discovery and job create/status/result/cancel. Use stable project and job IDs; verify owner, content permissions, byte/time limits, idempotency and per-user budgets before queueing. Do not let browser-provided paths or URLs become arbitrary filesystem/R2 access.
6. The UI only offers capabilities that are deployed and verified for the current engine revision. Features merged later to the engine are deployed automatically **after CI and compatibility checks**, but must remain gated until their cloud adapter and UI are ready. Pin each job to an immutable engine commit to prevent breaking in-flight projects.
7. Mark Supabase projects `completed` only once a playable output has been verified in private R2. Retention and garbage collection remain separate concerns.

## Release and safety rules
- Canonical engine: `https://github.com/aliasgharhatami/ai-video-studio`
- Website: `https://github.com/aliasgharhatami/mahgpt-affiliate`
- Full-studio cloud and automatic code synchronization must operate with the founder's Windows computer off.
- No paid host/API or public automatic editing until owner approves spend and end-to-end tests pass.
- As of 2026-11-03, there is no production cloud editor. Retention Cron was deployed but real deletion remains disabled pending physical R2 test.
- Do not imply a UI demo, stored request, or Remotion-only renderer equals a fully functional Studio.

# NARRATION / گرد گیتی

## Episode 001: Edirne horses

**Not published.** Test narration is prepared, but no voice file exists until a real TTS credential is configured. This branch does not change MahGPT's website, Telegram, or live Instagram workflows.

Approved requirements:
- Female, fluent natural Persian (fa-IR-DilaraNeural as the first voice candidate); commercial rights subject to service plan.
- Exactly one spoken sentence per caption; caption text must equal the spoken sentence.
- Generate audio in 7 separate segments, then use the **measured** WAV duration to build `timing.json` and `narration.srt`.
- Keep original cover for first 3 seconds. Intro voice is silent.
- Re-render the 30–180 second reel according to **actual speech duration**, not fixed 7-second estimates.
- Add licensed music at lower volume beneath speech; do not publish unreviewed pronunciation.

## Voice preview

```bash
node gardagard-giti/scripts/synthesize-narration.mjs gardagard-giti/narration/script.json gardagard-giti/output/narration --dry-run
node --test gardagard-giti/tests/narration.test.mjs
```

## Real audio (requires valid Microsoft Azure Speech resource)

Configure private environment secrets `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` before executing the same command **without** `--dry-run`. Never place secret values into the repository. The script invokes the documented Azure TTS REST endpoint, writes 24kHz mono WAV clips, joins the clips with a short pause and exports aligned SRT captions. The generated voice is still marked as requiring pronunciation review, even if synthesis succeeds.

**Important:** absence of credentials is a hard failure. No robotic voice or silent MP4 is allowed to be marked publish-ready. Do not enable the new Reels publishing workflow until the audio and rights gates pass.

## Persian pronunciation checklist
- «ادرنه» (Edirne)
- «سلیمیه»
- «سینان»
- «یونسکو»
- طبیعی و محاوره‌ای بودن جملهٔ «تو جای آن‌ها بودی، عکس می‌گرفتی یا اعتراض می‌کردی؟»

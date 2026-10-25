# گرد گیتی (Gerde Giti) — research-backed Persian narration shortlist

Date: 2026-10-25. No model has passed the project's own blind listening test yet. This document **does not authorize publishing**.

## Top choices
1. **Google Gemini 3.8 Flash TTS (Kore or another natural female voice)** — new expressive speech engine, supports Iranian Persian. https://ai.google.dev/gemini-api/docs/speech-generation
2. **Google Gemini 2.5 Pro TTS + Kore** — a small independent Persian-specific listening evaluation liked its pronunciation, timing and narrator rhythm most among evaluated configurations, but this is NOT a comprehensive scientific benchmark. https://github.com/mohammadmirashe/persian-tts-benchmark
3. **ElevenLabs v4 (a tested native-Persian-sounding female voice)** — officially supports Persian and expressive narration. Older Multilingual v2 does not formally support Persian. https://elevenlabs.io/docs/overview/models
4. **BananaAI Persian narrator (Eleven v4)** — Persian-localized female voices including «نازی» (warm storytelling) and «نوشین» (playful) and «مریم» (precise). These are vendor descriptions, not audited native-speaker ratings. Confirm voices, pricing, terms and reliability. https://bananaai.ir/docs/api/audio/speech
5. **Azure Speech fa-IR-DilaraNeural** — reliable price-oriented candidate; Persian-specific voice exists, but preset emotional speaking styles are not listed for Dilara. https://learn.microsoft.com/en-us/azure/ai-services/Speech-Service/language-support

## Costs and licensing
- Google Cloud Gemini 2.5 Pro TTS: paid from first usage, currently no free tier in Cloud TTS. https://cloud.google.com/text-to-speech/pricing
- ElevenLabs Free: 10,000 monthly credits and no commercial use license; paid Starter includes commercial license but 30,000 monthly credits may not be enough for ~90 reels. https://elevenlabs.io/pricing
- Azure standard neural F0: free character allowance; verify eligibility and account billing before enabling real audio.

## Blind A/B test protocol
- Generate the *same three 15–25-second Persian paragraphs* using the candidate services.
- Control loudness and do not reveal the provider to reviewers.
- Grade correct Persian pronunciation, foreign proper names, rhythm, pause placement, emotional naturalness, and voice stability, each from 1 to 5.
- The test includes: «ادرنه»، «مسجد سلیمیه»، «معمار سینان»، «یونسکو»، «پاراگوئه»، «ازبکستان»، and colloquial Persian sentences with questions.
- Compare at least two female voices per provider when offered. Fail any voice that consistently mispronounces locations.
- Confirm commercial terms and estimated monthly volume before selecting.
- Only after passing, update voice configuration, record exact provider/model/voice, and permit automated render. Always derive subtitles from actual generated audio duration.

## Mandatory brand migration
Official brand is **گرد گیتی / Gerde Giti**. Permanent tagline: **فالو کن تا بگردیم به گرد گیتی**. Retired `گرداگرد گیتی` must not appear in public-facing covers, videos, captions or account bio. Any older pre-rendered preview assets are obsolete and need to be re-rendered, NOT reused as published assets.

## Existing prototype warning
The current experimental `synthesize-narration.mjs` is **Azure-only**, not the selected production provider. Its presence does not mean Azure has won the voice test.
MahGPT website, Telegram pipeline and live Instagram must remain unchanged until voice and publishing tests pass.

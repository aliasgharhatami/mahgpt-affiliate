# گرد گیتی — پژوهش گزینه‌های رایگان نریشن فارسی

Date: 2026-10-25
Budget: USD 0/month. No paid voice API or subscription is authorized. No narrator voice has been approved or created.

## Zero-cost candidates

1. Microsoft Azure Speech F0, fa-IR-DilaraNeural, FEMALE: official free allowance 500,000 neural TTS characters/month. Registration and confirmation of an F0 resource is needed. Never silently enable paid tier. Pronunciation and emotional naturalness require listening tests.
  https://azure.microsoft.com/en-us/pricing/details/speech/
  https://learn.microsoft.com/en-us/azure/ai-services/Speech-Service/language-support

2. MahtaFetrat Mana-Persian-Piper: MIT-model and CC0-data sources, runs offline on CPU, zero API charge. Speaker gender has NOT been verified; cannot assume this is a suitable female narrator. Better ezafe accuracy may require its context-aware phonemization system.
  https://huggingface.co/MahtaFetrat/Mana-Persian-Piper

3. Piper other fa_IR voices: amir, ganji, ganji_adabi, gyro etc. No API cost; confirm each voice's gender, performance and per-model license.
  https://huggingface.co/rhasspy/piper-voices/tree/main/fa

4. Kamtera/persian-tts-female-vits: locally downloadable female VITS checkpoint. About 1 GB per checkpoint and OpenRAIL model label, with exact usage obligations requiring review. Its model card ambiguously refers to a male dataset. Do not assume quality without a real test.
  https://huggingface.co/Kamtera/persian-tts-female-vits

5. rany2/edge-tts: convenient keyless Dilara test samples from an undocumented Microsoft Edge consumer endpoint. Availability and commercial usage rights are NOT guaranteed; do not use it for unattended production unless rights, policy and reliability are established.
  https://github.com/rany2/edge-tts

## Models excluded from public publishing in current budget
- Paid Gemini Cloud TTS and paid commercial ElevenLabs: excluded for USD 0 goal.
- Nimaone ParSiGo Pocket TTS v2, Persian Chatterbox and Meta MMS Persian model: checkpoints carry non-commercial CC-BY-NC licenses; evaluation only, not automatic public/monetized publishing.
  https://github.com/nimaone/persian_tts
  https://github.com/parhamfdi/PersianTTS
  https://huggingface.co/facebook/mms-tts-fas

## Required quality gates
- On the same test text, compare accuracy of ادرنه، سلیمیه، سینان، یونسکو، پاراگوئه، ازبکستان.
- Confirm female voice, natural news-story pacing, punctuation, emotional delivery and stable output.
- Use real generated audio length to align subtitle sentences; no silent or robotic placeholders.
- Evaluate actual GitHub Actions CPU runtime before claiming 90 reels a month are free to render.
- No production voice is selected until native Persian speaker listening approval and license checks.

## Branding and editorial labels
Official brand: گرد گیتی / Gerde Giti
Replace old navigation categories with exact phrase: اخباری از جهان که احتمالا نمیشنوید!
Keep bottom CTA: فالو کن تا بگردیم به گرد گیتی
Approved visual layout: beige/charcoal modern editorial split-photo. No travel iconography.

Live MahGPT site, Telegram and Instagram publishing remain unchanged; prototype publishing stays disabled.

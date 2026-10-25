"""Generate a zero-billing candidate sample using official Google Gemini AI Studio TTS.

Requires: python -m pip install -U 'google-genai>=2.25.0'
Set GEMINI_API_KEY as a GitHub Actions secret or local environment variable.
This is a voice AUDITION only. Never publish the output automatically.
"""
import base64
import os
from pathlib import Path

from google import genai

SAMPLE = (
    "در شهر ادرنهٔ ترکیه، سه اسب سرگردان وارد میدان تاریخی مسجد سلیمیه شدند! "
    "اسب‌ها خیلی راحت روی چمن‌ها شروع به چرا کردند؛ انگار هیچ اتفاق عجیبی نیفتاده! "
    "تو جای آن‌ها بودی، عکس می‌گرفتی یا اعتراض می‌کردی؟"
)
MODEL = os.environ.get("GITI_TTS_MODEL", "gemini-3.8-flash-tts")
VOICE = os.environ.get("GITI_TTS_VOICE", "Kore")
OUTPUT = Path(os.environ.get("GITI_TTS_PREVIEW_PATH", "gardagard-giti/output/gemini-free-voice-preview.wav"))

def main():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise SystemExit("GEMINI_API_KEY missing; use AI Studio Free tier, NOT a billing-enabled key.")
    if MODEL not in ("gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"):
        raise SystemExit("Only confirmed free-tier TTS models are allowed.")
    client = genai.Client(api_key=key)
    response = client.interactions.create(
        model=MODEL,
        input=[{
            "type": "user_input",
            "content": [{
                "type": "text",
                "text": SAMPLE,
                "annotations": [{
                    "type": "speech_metadata",
                    "style": (
                        "Speak Iranian Persian naturally and fluently, using an engaging, "
                        "warm and youthful female-news-storyteller tone. Avoid robotic "
                        "cadence. Pronounce Edirne (ادرنه) and Selimiye (سلیمیه) accurately. "
                        "Read ONLY the supplied Persian sentence text without extra words."
                    ),
                }],
            }],
        }],
        response_format={"type": "audio"},
        generation_config={"speech_config": [{"voice": VOICE}]},
    )
    audio = getattr(response, "output_audio", None)
    if audio is None or not getattr(audio, "data", None):
        raise RuntimeError("Gemini returned no audio; do not proceed to reel rendering.")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(base64.b64decode(audio.data))
    print(f"Created voice audition: {OUTPUT} ({OUTPUT.stat().st_size} bytes); no publishing performed.")

if __name__ == "__main__":
    main()

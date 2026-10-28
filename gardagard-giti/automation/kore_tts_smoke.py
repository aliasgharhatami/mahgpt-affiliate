"""Isolated, non-publishing Kore/Gemini TTS smoke test for Gerde Giti.

This invokes the production one-sentence generator in bounded subprocesses, so a
network stall cannot turn into a silent fallback or an Instagram action.
"""
import os
import pathlib
import subprocess
import sys
import time
import wave

ROOT = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(os.environ.get("GITI_TTS_SMOKE_OUT", "gardagard-giti/output/kore-tts-smoke.wav"))
TEXT = "یک خبر کوتاه از گرد گیتی؛ این فقط یک آزمایش صداست و هیچ چیزی منتشر نمی‌شود."
ATTEMPTS = 3
PER_ATTEMPT_SECONDS = 120

def valid_wav(path: pathlib.Path) -> float:
    with wave.open(str(path), "rb") as audio:
        if (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) != (24000, 1, 2):
            raise RuntimeError("Unexpected Kore audio format")
        seconds = audio.getnframes() / audio.getframerate()
    if not 1.0 <= seconds <= 30.0:
        raise RuntimeError(f"Unexpected Kore audio duration: {seconds:.2f}s")
    return seconds

def main() -> None:
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY missing; smoke test blocked")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable, str(ROOT / "quality_kore_voice.py"),
        "--one", TEXT, "--wav", str(OUT),
    ]
    failures = []
    for attempt in range(1, ATTEMPTS + 1):
        try:
            result = subprocess.run(
                command, text=True, capture_output=True, check=True,
                timeout=PER_ATTEMPT_SECONDS,
            )
            duration = valid_wav(OUT)
            print(f"KORE_TTS_SMOKE_PASSED attempt={attempt} duration={duration:.2f}s")
            if result.stdout.strip():
                print(result.stdout.strip())
            return
        except subprocess.TimeoutExpired:
            failures.append(f"attempt {attempt}: timeout after {PER_ATTEMPT_SECONDS}s")
        except subprocess.CalledProcessError as exc:
            detail = (exc.stderr or exc.stdout or str(exc)).strip().replace("\n", " ")
            failures.append(f"attempt {attempt}: process error: {detail[:500]}")
        except Exception as exc:
            failures.append(f"attempt {attempt}: validation error: {exc}")
        if attempt < ATTEMPTS:
            time.sleep(15 * attempt)
    raise RuntimeError("Kore TTS smoke test failed; no render or publication allowed. " + " | ".join(failures))

if __name__ == "__main__":
    main()

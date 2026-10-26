"""Generate the complete seven-sentence Gerde Giti narration via official Gemini free tier.

Kept on an isolated non-publishing branch. Requires GEMINI_API_KEY as repository
secret and verified Free-tier account; never enables billing or posts to socials.
"""
import base64
import io
import json
import os
import time
import wave
from pathlib import Path
from google import genai

ROOT=Path(__file__).resolve().parents[1]
JOB=ROOT/"narration"/"script.json"
OUT=ROOT/"output"/"full-narration"
VOICE="Kore"
MODEL="gemini-3.8-flash-tts"

STYLE=(
 "Read the supplied sentence in clear, expressive, naturally conversational Iranian Persian. "
 "Use the same young adult female narrator character Kore in every sentence, with friendly curiosity "
 "and balanced newsroom energy. Accurate Persian grammar and stress, not monotonous or robotic. "
 "Pronounce ادرنه as Turkish Edirne, سلیمیه as Selimiye, معمار سینان and یونسکو naturally. "
 "Speak ONLY the sentence supplied, no introductions, titles, explanations, or new words."
)

def duration_pcm16_wav(payload):
    try:
        with wave.open(io.BytesIO(payload),"rb") as w:
            if w.getcomptype()!="NONE" or w.getsampwidth()!=2 or w.getnchannels()!=1:
                raise ValueError("Expected PCM16 mono WAV")
            rate=w.getframerate()
            if rate!=24000: raise ValueError(f"Unexpected sample rate {rate}")
            frames=w.readframes(w.getnframes())
            if not frames: raise ValueError("Empty Gemini audio")
            return frames,rate
    except wave.Error as e:
        raise ValueError("Malformed WAV from Gemini") from e

def stamp(ms):
    n=round(ms)
    return f"{n//3600000:02d}:{n//60000%60:02d}:{n//1000%60:02d},{n%1000:03d}"

def main():
    key=os.environ.get("GEMINI_API_KEY")
    if not key: raise RuntimeError("Missing GEMINI_API_KEY")
    job=json.loads(JOB.read_text(encoding="utf-8"))
    assert job["brand"]=="گرد گیتی" and job["language"]=="fa-IR"
    assert len(job["sentences"])==7
    client=genai.Client(api_key=key)
    clips=[]
    for idx,sentence in enumerate(job["sentences"],1):
        for attempt in range(3):
            try:
                result=client.interactions.create(
                    model=MODEL,
                    input=[{"type":"user_input","content":[{
                        "type":"text",
                        "text":sentence["text"],
                        "annotations":[{"type":"speech_metadata","style":STYLE}]
                    }]}],
                    response_format={"type":"audio"},
                    generation_config={"speech_config":[{"voice":VOICE}]}
                )
                audio=getattr(result,"output_audio",None)
                if audio is None or not getattr(audio,"data",None):
                    raise RuntimeError(f"No audio returned for sentence {idx}")
                data=audio.data
                payload=base64.b64decode(data) if isinstance(data,str) else bytes(data)
                frames,rate=duration_pcm16_wav(payload)
                clips.append((sentence["text"],frames))
                print(f"Sentence {idx}/{len(job['sentences'])} generated: {len(frames)/2/rate:.2f}s")
                break
            except Exception as exc:
                msg=str(exc)
                if attempt==2 or not any(x in msg for x in ("429","RESOURCE_EXHAUSTED","503","UNAVAILABLE")):
                    raise
                time.sleep(15*(attempt+1))
        if idx<len(job["sentences"]): time.sleep(3)
    OUT.mkdir(parents=True,exist_ok=True)
    rate=24000
    intro=int(3*rate)
    pause=int(.28*rate)
    finale=int(1.8*rate)
    allframes=bytearray(intro*2)
    segments=[]
    for idx,(spoken,frames) in enumerate(clips,1):
        start=len(allframes)//2
        allframes.extend(frames)
        end=len(allframes)//2
        segments.append({
            "id":idx,"text":spoken,
            "start":round(start/rate,3),"end":round(end/rate,3),
            "startMs":round(start*1000/rate),"endMs":round(end*1000/rate),
            "timing":"measured-wave-segment (not word-aligned)"
        })
        if idx<len(clips): allframes.extend(bytes(pause*2))
    allframes.extend(bytes(finale*2))
    full_duration=len(allframes)/2/rate
    if not 30<=full_duration<=180:
        raise RuntimeError(f"Outside requested 30–180s total reel duration: {full_duration}")
    audiofile=OUT/"gerde-giti-episode-001-narration.wav"
    with wave.open(str(audiofile),"wb") as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(bytes(allframes))
    timings={
        "episode":"2026-10-19-tr-edirne-horses","brand":"گرد گیتی",
        "tagline":"فالو کن تا بگردیم به گرد گیتی",
        "editorialLine":"اخباری از جهان که احتمالا نمیشنوید!",
        "model":MODEL,"voice":VOICE,"language":"fa-IR","duration":round(full_duration,3),
        "qualityGate":"human listening not yet performed on all 7 sentences",
        "captionPrecision":"per-sentence audio segment (not word level)",
        "segments":segments
    }
    (OUT/"timings.json").write_text(json.dumps(timings,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (OUT/"captions.srt").write_text("\n\n".join(f"{s['id']}\n{stamp(s['startMs'])} --> {stamp(s['endMs'])}\n{s['text']}" for s in segments)+"\n",encoding="utf-8")
    print("OK: complete female Persian narration, duration",round(full_duration,2),"seconds; nothing published.")

if __name__=="__main__":main()

"""Cloud-safe Persian Kore narration for Gerde Giti: exact one-second start.
Uses the same official Gemini 3.8 Flash TTS voice as the approved first Reel.
Never substitutes another TTS provider. Does not publish or generate images.
"""
import argparse,base64,io,json,os,pathlib,subprocess,sys,time,wave

STYLE=("Speak ONLY the supplied Persian sentence, in fully natural conversational "
       "Iranian Persian. You are Kore, a warm lively curious professional female "
       "storyteller. Avoid formal Persian, robotic narration, or adding any words. "
       "Use friendly and expressive but not cartoonish intonation.")

def speak_one(text,out):
    from google import genai
    client=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    result=client.interactions.create(
        model="gemini-3.8-flash-tts",
        input=[{"type":"user_input","content":[{"type":"text","text":text,
                "annotations":[{"type":"speech_metadata","style":STYLE}]}]}],
        response_format={"type":"audio"},generation_config={"speech_config":[{"voice":"Kore"}]})
    audio=result.output_audio
    if audio is None or not audio.data:raise RuntimeError("No Kore audio")
    data=base64.b64decode(audio.data) if isinstance(audio.data,str) else bytes(audio.data)
    with wave.open(io.BytesIO(data),"rb") as f:
        if f.getframerate()!=24000 or f.getsampwidth()!=2 or f.getnchannels()!=1:
            raise RuntimeError("Unexpected Gemini output audio format")
        pcm=f.readframes(f.getnframes())
    if len(pcm)<2400:raise RuntimeError("Empty spoken phrase")
    with wave.open(str(out),"wb") as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(24000);f.writeframes(pcm)

def assemble(job_path,out,max_seconds):
    if not os.getenv("GEMINI_API_KEY"):raise RuntimeError("Gemini key missing; never fall back to Dilara")
    job=json.loads(pathlib.Path(job_path).read_text(encoding="utf-8"))
    scenes=job.get("scenes",[])
    if job.get("schema")!="gerde-giti/quality-cloud/v1" or not 5<=len(scenes)<=10:
        raise RuntimeError("Source-verified storyboard of 5–10 scenes required")
    output=pathlib.Path(out);output.mkdir(parents=True,exist_ok=True)
    pcm=bytearray(b"\x00"*48000) # 24kHz PCM16, EXACT first 1.000s silent
    timing=[]
    for i,scene in enumerate(scenes):
        text=str(scene["narration"]).strip()
        dest=output/f"kore-{i+1:02d}.wav"
        # One sentence is isolated in its own subprocess so a stuck network response
        # cannot hang the entire GitHub Action (the previous second Reel did this).
        child=[sys.executable,str(pathlib.Path(__file__).resolve()),"--one",text,"--wav",str(dest)]
        for attempt in range(2):
            try:
                subprocess.run(child,timeout=max_seconds,check=True,capture_output=True,text=True)
                break
            except (subprocess.TimeoutExpired,subprocess.CalledProcessError) as e:
                if attempt==1:raise RuntimeError("Kore unavailable after bounded retries; publication blocked") from e
                time.sleep(7)
        with wave.open(str(dest),"rb") as f:
            if f.getframerate()!=24000 or f.getnchannels()!=1 or f.getsampwidth()!=2:
                raise RuntimeError("Invalid voice segment")
            frames=f.readframes(f.getnframes())
        start=len(pcm)/48000
        pcm.extend(frames)
        end=len(pcm)/48000
        timing.append({"index":i+1,"text":text,"start":round(start,3),"end":round(end,3)})
        if i<len(scenes)-1:pcm.extend(b"\x00"*int(.18*48000))
    pcm.extend(b"\x00"*48000)
    with wave.open(str(output/"narration.wav"),"wb") as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(24000);f.writeframes(pcm)
    (output/"timing.json").write_text(json.dumps(timing,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("KORE_VOICE_READY first=1.000s duration=%.2fs"%(len(pcm)/48000))

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--job");ap.add_argument("--out");ap.add_argument("--one")
    ap.add_argument("--wav");ap.add_argument("--max-seconds",type=int,default=75)
    a=ap.parse_args()
    if a.one is not None:
        if not a.wav:ap.error("--wav required")
        speak_one(a.one,pathlib.Path(a.wav))
    else:
        if not a.job or not a.out:ap.error("--job and --out required")
        assemble(a.job,a.out,a.max_seconds)

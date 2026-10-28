"""Cloud-safe Persian Kore narration for Gerde Giti: exact one-second start.

One Gemini request creates the complete narration.  This avoids the unreliable
seven-request pattern while retaining only the exact Kore voice.  Captions are
then timed from marked natural pauses in the returned WAV; timing falls back to
a clearly labelled word-weighted review estimate only if no pauses are found.
Nothing here publishes content.
"""
import argparse,audioop,base64,io,json,os,pathlib,subprocess,sys,time,wave

RATE=24000
STYLE=(
    "Read ONLY the supplied Persian narration in fully natural conversational "
    "Iranian Persian. You are Kore, a warm lively curious professional female "
    "storyteller. Avoid formal Persian, robotic delivery, or adding words. "
    "Respect each <short pause> tag as a brief silent transition between scenes."
)

def speak_one(text,out):
    from google import genai
    client=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    result=client.interactions.create(
        model="gemini-3.8-flash-tts",
        input=[{"type":"user_input","content":[{"type":"text","text":text,
                "annotations":[{"type":"speech_metadata","style":STYLE}]}]}],
        response_format={"type":"audio"},
        generation_config={"speech_config":[{"voice":"Kore"}]},
    )
    audio=result.output_audio
    if audio is None or not audio.data:raise RuntimeError("No Kore audio")
    data=base64.b64decode(audio.data) if isinstance(audio.data,str) else bytes(audio.data)
    with wave.open(io.BytesIO(data),"rb") as f:
        if (f.getframerate(),f.getsampwidth(),f.getnchannels()) != (RATE,2,1):
            raise RuntimeError("Unexpected Gemini output audio format")
        pcm=f.readframes(f.getnframes())
    if len(pcm)<2400:raise RuntimeError("Empty spoken narration")
    with wave.open(str(out),"wb") as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm)

def _read_pcm(path):
    with wave.open(str(path),"rb") as f:
        if (f.getframerate(),f.getnchannels(),f.getsampwidth()) != (RATE,1,2):
            raise RuntimeError("Invalid Kore WAV")
        pcm=f.readframes(f.getnframes())
    return pcm

def _marked_pause_timings(pcm,texts):
    """Return scene timings from TTS pause tags, or a review-only estimate."""
    window=RATE//50*2  # 20ms PCM16
    levels=[audioop.rms(pcm[i:i+window],2) for i in range(0,len(pcm)-window+1,window)]
    if not levels:raise RuntimeError("Empty narration PCM")
    reference=sorted(levels)[max(0,int(len(levels)*.85)-1)]
    threshold=max(30,int(reference*.055))
    runs=[];start=None
    for i,level in enumerate(levels+[reference]):
        if level<=threshold:
            if start is None:start=i
        elif start is not None:
            end=i
            seconds=(end-start)*.02
            if seconds>=.12:runs.append((start*.02,end*.02,seconds))
            start=None
    spoken=len(pcm)/(RATE*2)
    expected=[]
    weight_total=sum(max(1,len(t.replace(" ",""))) for t in texts)
    running=0
    for text in texts[:-1]:
        running+=max(1,len(text.replace(" ","")))
        expected.append(spoken*running/weight_total)
    chosen=[];cursor=0.0
    for target in expected:
        options=[r for r in runs if r[0]>=cursor and abs((r[0]+r[1])/2-target)<=3.5]
        if not options:
            chosen=[];break
        run=min(options,key=lambda r:abs((r[0]+r[1])/2-target)-min(r[2],.6)*.25)
        chosen.append(run);cursor=run[1]
    if len(chosen)==len(texts)-1:
        timing=[];start=1.0
        for index,text in enumerate(texts):
            if index<len(chosen):
                end=1.0+chosen[index][0]
                next_start=1.0+chosen[index][1]
            else:
                end=1.0+spoken
                next_start=end
            timing.append({"index":index+1,"text":text,"start":round(start,3),"end":round(end,3),
                           "timing":"pause-aligned-from-single-Kore-WAV"})
            start=next_start
        return timing,"pause-aligned"
    # This is review-only, never an automatic publishing timestamp.
    timing=[];weight_total=sum(max(1,len(t.replace(" ",""))) for t in texts);elapsed=1.0
    for index,text in enumerate(texts):
        duration=spoken*max(1,len(text.replace(" ","")))/weight_total
        timing.append({"index":index+1,"text":text,"start":round(elapsed,3),
                       "end":round(elapsed+duration,3),
                       "timing":"word-weighted-estimate-requires-human-review"})
        elapsed+=duration
    return timing,"word-weighted-review-estimate"

def assemble(job_path,out,max_seconds,attempts):
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("Gemini key missing; never fall back to another voice")
    job=json.loads(pathlib.Path(job_path).read_text(encoding="utf-8"))
    scenes=job.get("scenes",[])
    if job.get("schema")!="gerde-giti/quality-cloud/v1" or not 5<=len(scenes)<=10:
        raise RuntimeError("Source-verified storyboard of 5–10 scenes required")
    texts=[str(scene["narration"]).strip() for scene in scenes]
    if any(not text for text in texts):raise RuntimeError("Empty scene narration")
    output=pathlib.Path(out);output.mkdir(parents=True,exist_ok=True)
    raw=output/"kore-complete.wav"
    combined=" <short pause> ".join(texts)
    child=[sys.executable,str(pathlib.Path(__file__).resolve()),"--one",combined,"--wav",str(raw)]
    failures=[]
    for attempt in range(1,attempts+1):
        try:
            subprocess.run(child,timeout=max_seconds,check=True,capture_output=True,text=True)
            break
        except subprocess.TimeoutExpired:
            failures.append(f"attempt {attempt}: timeout after {max_seconds}s")
        except subprocess.CalledProcessError as exc:
            detail=(exc.stderr or exc.stdout or str(exc)).strip().replace("\n"," ")
            failures.append(f"attempt {attempt}: Gemini process error: {detail[:500]}")
        if attempt==attempts:
            raise RuntimeError("Complete Kore narration unavailable; render and publication blocked. "+" | ".join(failures))
        time.sleep(18*attempt)
    raw_pcm=_read_pcm(raw)
    timing,method=_marked_pause_timings(raw_pcm,texts)
    pcm=bytearray(b"\x00"*(RATE*2))  # exact first 1.000s silent
    pcm.extend(raw_pcm);pcm.extend(b"\x00"*int(.8*RATE*2))
    with wave.open(str(output/"narration.wav"),"wb") as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm)
    (output/"timing.json").write_text(json.dumps(timing,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (output/"timing-method.json").write_text(json.dumps({
        "method":method,"requires_human_caption_review":True,
        "tts_requests":1,"voice":"Kore","model":"gemini-3.8-flash-tts"
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("KORE_COMPLETE_VOICE_READY requests=1 first=1.000s duration=%.2fs timing=%s"%
          (len(pcm)/(RATE*2),method))

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--job");ap.add_argument("--out");ap.add_argument("--one")
    ap.add_argument("--wav");ap.add_argument("--max-seconds",type=int,default=240)
    ap.add_argument("--attempts",type=int,default=2)
    a=ap.parse_args()
    if a.one is not None:
        if not a.wav:ap.error("--wav required")
        speak_one(a.one,pathlib.Path(a.wav))
    else:
        if not a.job or not a.out:ap.error("--job and --out required")
        assemble(a.job,a.out,a.max_seconds,a.attempts)

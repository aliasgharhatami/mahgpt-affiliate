"""Build 3 Reel + 2 photo candidates for human review, NEVER publish.

No rights flags are auto-approved: only images explicitly supplied by an editor with
rights metadata are eligible. Works offline via --validate to check manifest rules.
Actual render requires Pillow, ffmpeg, ffprobe and the official Gemini SDK.
"""
from __future__ import annotations
import argparse, base64, io, json, os, re, subprocess, sys, wave
from pathlib import Path

ROOT=Path(__file__).resolve().parent
CONFIG=json.loads((ROOT/"config.json").read_text(encoding="utf8"))
FORMATS=("reel","photo","reel","photo","reel")
SCHEMA="gerde-giti/ready-media/v1"
SAFE_ID=re.compile(r"^[a-z0-9][a-z0-9_-]{2,70}$")
ALLOWED={"CC0","Public Domain","CC BY 4.0","CC BY 3.0","Pixabay Content License","Owner provided"}

def check(manifest):
    """No generated image can claim to be documentation of a real incident."""
    if manifest.get("schema")!=SCHEMA:raise ValueError("Wrong media manifest schema")
    items=manifest.get("items",[])
    if len(items)!=5:raise ValueError("Exactly 5 curated stories needed (3 reels, 2 photos)")
    seen=set()
    for i,x in enumerate(items):
        if x.get("kind")!=FORMATS[i]:raise ValueError(f"Incorrect slot type {i}")
        sid=x.get("id","")
        if not SAFE_ID.fullmatch(sid) or sid in seen:raise ValueError("Bad or duplicate ID")
        seen.add(sid)
        if not x.get("source_url","").startswith("https://"):raise ValueError("Missing news source")
        if not x.get("editor_fact_checked"):raise ValueError("Facts not approved")
        lines=x.get("sentences",[])
        if not isinstance(lines,list) or not lines or any(not isinstance(t,str) or not 10<=len(t)<=250 for t in lines):raise ValueError("Unusable Persian narration/caption")
        images=x.get("images",[])
        if not images or len(images)>9:raise ValueError("Need approved relevant visuals")
        for a in images:
            if not a.get("rights_checked") or a.get("license") not in ALLOWED or not a.get("credit"):raise ValueError("Image rights unverified")
            if not a.get("path","").startswith("input/"):raise ValueError("Images must be pre-reviewed local input files")
            if ".." in Path(a["path"]).parts:raise ValueError("Image path traversal")
            if a.get("illustrative") is not True and a.get("documentary_proven") is not True:raise ValueError("Documentary status not verified")
        if x.get("kind")=="reel" and (len(lines)<4 or not x.get("spoken_fa_checked")):
            raise ValueError("Reel narration has not been checked")
    return manifest

def run(*args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

def font():
    options=[
      "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf",
      "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in options:
        if Path(path).exists():return path
    raise RuntimeError("Install fonts-noto-core first")

def render_card(item,img_path,dest,size,kind,subtitle="",number=0):
    from PIL import Image,ImageDraw,ImageFont,ImageOps
    w,h=size
    picture=Image.open(img_path).convert("RGB")
    picture=ImageOps.fit(picture,(w,int(h*.73)),method=Image.Resampling.LANCZOS,centering=(.5,.4))
    canvas=Image.new("RGB",(w,h),"#e8dfd1")
    canvas.paste(picture,(0,int(h*.16)))
    draw=ImageDraw.Draw(canvas,"RGBA")
    draw.rectangle((0,0,w,int(h*.16)),fill=(232,223,209,255))
    draw.rectangle((0,int(h*.89),w,h),fill=(25,25,25,255))
    # Caption is deliberately 70% opaque to preserve imagery.
    if subtitle:
        # Blend an actual semi-transparent panel over the underlying photograph.
        overlay=Image.new("RGBA",(w,h),(0,0,0,0))
        ImageDraw.Draw(overlay).rounded_rectangle((32,int(h*.66),w-32,int(h*.85)),radius=14,fill=(232,223,209,178))
        canvas=Image.alpha_composite(canvas.convert("RGBA"),overlay).convert("RGB")
        draw=ImageDraw.Draw(canvas,"RGBA")
    titlefont=ImageFont.truetype(font(),46 if w==1080 else 36)
    smallfont=ImageFont.truetype(font(),27)
    draw.text((w-40,46),"گرد گیتی",anchor="ra",font=titlefont,fill=(25,25,25,255),direction="rtl")
    draw.text((w-40,105),"اخباری از جهان که احتمالا نمیشنوید!",anchor="ra",font=smallfont,fill=(25,25,25,255),direction="rtl")
    if subtitle:
        words=subtitle.split();lines=[];current=""
        for word in words:
            proposed=(current+" "+word).strip()
            if draw.textlength(proposed,font=titlefont,direction="rtl")>w-125 and current:
                lines.append(current);current=word
            else:current=proposed
        if current:lines.append(current)
        for j,line in enumerate(lines[:3]):
            draw.text((w-55,int(h*.685)+j*64),line,anchor="ra",font=titlefont,fill=(25,25,25,255),direction="rtl")
    draw.text((w-40,h-105),"فالو کن تا بگردیم به گرد گیتی",anchor="ra",font=smallfont,fill=(255,255,255,255),direction="rtl")
    draw.text((45,h-65),"GERDE GITI",font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",22),fill=(210,203,194,255))
    canvas.convert("RGB").save(dest,quality=91,subsampling=0)

def call_tts(client,text):
    from google import genai
    result=client.interactions.create(
        model="gemini-3.8-flash-tts",
        input=[{"type":"user_input","content":[{"type":"text","text":text,"annotations":[{"type":"speech_metadata","style":"Young adult woman. Read only the text in fully colloquial Iranian Persian. Natural expressive friendly newsroom storyteller delivery, balanced pace and natural pauses."}]}]}],
        response_format={"type":"audio"},generation_config={"speech_config":[{"voice":"Kore"}]})
    data=getattr(getattr(result,"output_audio",None),"data",None)
    if not data:raise RuntimeError("Gemini returned no audio")
    audio=base64.b64decode(data) if isinstance(data,str) else bytes(data)
    with wave.open(io.BytesIO(audio),"rb") as f:
        if f.getframerate()!=24000 or f.getnchannels()!=1 or f.getsampwidth()!=2:raise ValueError("Unexpected TTS WAV format")
        pcm=f.readframes(f.getnframes())
    if not pcm:raise ValueError("Empty spoken audio")
    return pcm

def synthesize(item,out):
    from google import genai
    key=os.environ.get("GEMINI_API_KEY")
    if not key:raise RuntimeError("GEMINI_API_KEY missing; no silent fallback")
    client=genai.Client(api_key=key)
    allpcm=bytearray(b"\0"*(24000*2)) # one-second visual hook
    cues=[]
    for i,text in enumerate(item["sentences"]):
        start=len(allpcm)//2/24000
        allpcm+=call_tts(client,text)
        end=len(allpcm)//2/24000
        cues.append({"text":text,"start":start,"end":end})
        if i<len(item["sentences"])-1:allpcm+=b"\0"*int(24000*.22)*2
    allpcm+=b"\0"*(24000*2)
    duration=len(allpcm)//2/24000
    if not 30<=duration<=180:raise ValueError(f"Reel narration duration {duration:.1f}s out of range")
    with wave.open(str(out),"wb") as w:
        w.setnchannels(1);w.setframerate(24000);w.setsampwidth(2);w.writeframes(allpcm)
    return cues,duration

def prepare(item,directory):
    directory.mkdir(parents=True,exist_ok=True)
    sources=[]
    for img in item["images"]:
        p=(ROOT/img["path"]).resolve()
        if not p.is_relative_to((ROOT/"input").resolve()) or not p.is_file():raise ValueError("Missing or unsafe reviewed asset")
        sources.append(p)
    return sources

def render_item(item,out):
    path=out/item["id"]
    sources=prepare(item,path)
    image=path/("feed.jpg" if item["kind"]=="photo" else "cover.jpg")
    render_card(item,sources[0],image,(1080,1350) if item["kind"]=="photo" else (1080,1920),item["kind"],item["headline"])
    if item["kind"]=="photo":
        # Story uses same reviewed visual, editorial image and CTA.
        render_card(item,sources[0],path/"story.jpg",(1080,1920),"story",item["headline"])
        return {"id":item["id"],"kind":"photo","preview":str(image),"status":"generated_for_review"}
    wav=path/"narration.wav";cues,duration=synthesize(item,wav)
    # Avoid baking overlapping captions into an unrelated visual; each frame uses
    # exact spoken sentence text, and the timeline follows measured segment durations.
    partfiles=[]
    boundaries=[0]+[c["end"] for c in cues]
    for i,cue in enumerate(cues):
        frame=path/f"frame-{i:02d}.jpg"
        src=sources[i%len(sources)]
        render_card(item,src,frame,(1080,1920),"reel",cue["text"])
        clip=path/f"clip-{i:02d}.mp4"
        t0=0 if i==0 else cues[i-1]["end"]
        length=max(.25,cue["end"]-t0)
        run("ffmpeg","-nostdin","-y","-hide_banner","-loglevel","error","-loop","1","-framerate","25","-i",str(frame),"-vf","scale=1080:1920,format=yuv420p","-t",str(length),"-an","-c:v","libx264","-preset","veryfast","-crf","24",str(clip))
        partfiles.append(clip)
    # Outro extends to the real voice length.
    if duration>cues[-1]["end"]:
        frame=path/"outro.jpg";render_card(item,sources[0],frame,(1080,1920),"reel",item["headline"])
        clip=path/"outro.mp4";run("ffmpeg","-nostdin","-y","-hide_banner","-loglevel","error","-loop","1","-framerate","25","-i",str(frame),"-t",str(duration-cues[-1]["end"]),"-an","-c:v","libx264","-preset","veryfast","-crf","24",str(clip));partfiles.append(clip)
    concat=path/"concat.txt"
    concat.write_text("".join("file '"+p.name+"'\n" for p in partfiles),encoding="utf8")
    output=path/"reel.mp4"
    run("ffmpeg","-nostdin","-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",str(concat),"-i",str(wav),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",str(output))
    (path/"timings.json").write_text(json.dumps({"segments":cues,"seconds":duration},ensure_ascii=False,indent=2),encoding="utf8")
    return {"id":item["id"],"kind":"reel","preview":str(output),"duration":duration,"status":"generated_for_review"}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("manifest");p.add_argument("--validate",action="store_true")
    p.add_argument("--output",default="gardagard-giti/automation/output/media-preview")
    args=p.parse_args()
    data=check(json.loads(Path(args.manifest).read_text(encoding="utf8")))
    if args.validate:
        print("PASS: 5 format slots and editorial/image rights gates validated (no calls)")
        return
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    results=[render_item(item,out) for item in data["items"]]
    (out/"render-report.json").write_text(json.dumps({"production_live":False,"items":results},indent=2,ensure_ascii=False),encoding="utf8")
    print("Produced five review assets; NO posting, hosting or rights auto-approval.")

if __name__=="__main__":main()

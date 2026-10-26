"""Gerde Giti isolated editorial media builder.
Creates feed JPEG, Story JPEG, narrated Reel MP4, captions and review manifest.
ZERO Instagram calls; NEVER approves facts, licenses, voice or publication.
Requires: pillow, google-genai (for reels), ffmpeg/ffprobe in PATH.
"""
from __future__ import annotations
import argparse, base64, io, json, math, os, random, re, shutil, subprocess, sys, tempfile, urllib.request, wave
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont, features

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
BRAND="گرد گیتی"
LINE="اخباری از جهان که احتمالا نمیشنوید!"
TAG="فالو کن تا بگردیم به گرد گیتی"
CREAM=(233,225,213)
INK=(24,24,25)
RED=(204,50,62)
WHITE=(255,255,255)
SAFE_LICENSES={"CC0","Public domain","Public Domain","CC BY 4.0","CC BY 3.0","CC BY 2.0"}
DEFAULT_STYLE="Read only the provided Iranian Persian sentence in a youthful, warm, friendly and lively female storyteller voice. Every sentence must be fully colloquial Iranian Persian, no formal newsroom cadence, no added words. Pronounce all names accurately."

def font(size,bold=True):
    candidates=(
       [os.getenv("GITI_FONT_BOLD","")] if bold else [os.getenv("GITI_FONT_REGULAR","")]
    )+([
        "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ] if bold else [
        "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ])
    for p in candidates:
        if p and Path(p).exists():
            return ImageFont.truetype(p,size,layout_engine=ImageFont.Layout.RAQM if features.check_feature("raqm") else ImageFont.Layout.BASIC)
    raise RuntimeError("No Arabic/Persian-capable font on runner")

def draw_rtl(d,xy,s,f,fill,**k):
    # Pillow with librAqm correctly shapes Farsi, including ezafe/Arabic ligatures.
    if not features.check_feature("raqm"):
        raise RuntimeError("RTL shaping needs Pillow built with libraqm; won't ship broken Persian typography")
    d.text(xy,s,font=f,fill=fill,direction="rtl",**k)

def wrap(d,s,f,max_width,max_lines=5):
    words=str(s).split()
    rows=[];line=""
    for w in words:
        candidate=(line+" "+w).strip()
        box=d.textbbox((0,0),candidate,font=f,direction="rtl")
        if box[2]-box[0]>max_width and line:
            rows.append(line);line=w
        else: line=candidate
    if line:rows.append(line)
    if len(rows)>max_lines: raise ValueError("Too many Persian lines to fit layout")
    return rows

def bg_photo(image,w,h,offset=0):
    if image is None:
        # Abstract gradients and geometric contours are clearly decorative, NOT event imagery.
        canvas=Image.new("RGB",(w,h),INK)
        px=canvas.load()
        for y in range(h):
            for x in range(w):
                t=(y/h*.55+x/w*.20)
                px[x,y]=(int(22+20*t),int(37+31*t),int(48+29*t))
        a=ImageDraw.Draw(canvas)
        for j in range(8):
            xx=int((w*.15+j*w*.13)%w)
            a.arc((xx-h*.40, int(h*.30+j*23), xx+h*.80,int(h*1.30+j*23)),180,360,fill=(75,77,73),width=4)
        return canvas
    p=Image.open(image).convert("RGB")
    ratio=max(w/p.width,h/p.height)
    p=p.resize((math.ceil(p.width*ratio),math.ceil(p.height*ratio)),Image.Resampling.LANCZOS)
    dx=max(0,p.width-w);dy=max(0,p.height-h)
    # Deterministic crop alternatives are still of the same licensed background image.
    x=int(dx*([.45,.55,.50][offset%3]));y=int(dy*([.42,.51,.58][offset%3]))
    return p.crop((x,y,x+w,y+h))

def masthead(canvas,w,h,country,label=None):
    d=ImageDraw.Draw(canvas,"RGBA")
    top=int(h*.13)
    d.rectangle((0,0,w,top),fill=(*CREAM,255))
    draw_rtl(d,(w-40,int(h*.038)),BRAND,font(int(w*.073)),INK,anchor="ra")
    draw_rtl(d,(w-40,int(h*.095)),LINE,font(int(w*.028),False),INK,anchor="ra")
    d.line((35,top-2,w-35,top-2),fill=(35,35,35,120),width=2)
    d.rounded_rectangle((35,int(h*.037),int(w*.31),int(h*.080)),radius=10,fill=(*INK,255))
    d.text((int(w*.17),int(h*.057)),str(country)[:4].upper(),font=font(int(w*.031),False),fill=WHITE,anchor="mm")
    if label:
        d.rounded_rectangle((38,int(h*.14),int(w*.40),int(h*.178)),radius=6,fill=(22,22,22,205))
        draw_rtl(d,(int(w*.38),int(h*.165)),label,font(int(w*.025),False),WHITE,anchor="ra")

def cover_image(story,image,w=720,h=1280,demo=True):
    image_layer=bg_photo(image,w,h)
    base=Image.new("RGB",(w,h),CREAM)
    photo_h=int(h*.64)
    base.paste(image_layer.crop((0,0,w,photo_h)),(0,int(h*.13)))
    d=ImageDraw.Draw(base,"RGBA")
    d.rectangle((0,int(h*.70),w,h),fill=(*INK,255))
    masthead(base,w,h,story.get("country","WORLD"),"تصویر آرشیوی" if image else "تصویرسازی گرافیکی")
    d=ImageDraw.Draw(base,"RGBA")
    # Editorial split photo: photography overlaps the crisp charcoal lower panel.
    d.line((24,int(h*.70),w-24,int(h*.70)),fill=(*CREAM,180),width=2)
    title=story["headline"]
    f=font(int(w*.066))
    rows=wrap(d,title,f,w-95,3)
    for i,line in enumerate(rows):
        draw_rtl(d,(w-42,int(h*.78)+i*int(w*.083)),line,f,WHITE,anchor="ra")
    draw_rtl(d,(w-42,int(h*.946)),TAG,font(int(w*.043)),CREAM,anchor="ra")
    d.rectangle((32,h-22,w-32,h-16),fill=RED)
    if demo:
        d.rectangle((0,h-82,w,h-42),fill=(200,40,50,225))
        draw_rtl(d,(w-30,h-68),"پیش‌نمایش آزمایشی — منتشر نشود",font(int(w*.027)),WHITE,anchor="ra")
    return base

def photo_post(story,image,w,h,demo=True):
    base=bg_photo(image,w,h).convert("RGBA")
    masthead(base,w,h,story.get("country","WORLD"),"تصویر آرشیوی" if image else "تصویرسازی گرافیکی")
    d=ImageDraw.Draw(base,"RGBA")
    panel_top=int(h*.68)
    d.rectangle((0,panel_top,w,h),fill=(*CREAM,232))
    d.rectangle((0,panel_top,w,panel_top+5),fill=(*RED,255))
    ff=font(int(w*.057));title_lines=wrap(d,story["headline"],ff,w-95,4)
    for i,line in enumerate(title_lines):
        draw_rtl(d,(w-42,panel_top+int(w*.11)+i*int(w*.080)),line,ff,INK,anchor="ra")
    draw_rtl(d,(w-42,int(h*.938)),TAG,font(int(w*.039)),INK,anchor="ra")
    if demo:
        d.rectangle((0,h-45,w,h),fill=(151,22,32,235))
        draw_rtl(d,(w-30,h-30),"پیش‌نمایش — منتشر نشود",font(int(w*.03)),WHITE,anchor="ra")
    return base.convert("RGB")

def subtitle_overlay(story,text,w,h,scene_idx,image_present,demo):
    ov=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(ov,"RGBA")
    panel_top=int(h*.735);panel_bot=int(h*.90)
    # 70% opaque, 30% transparent to keep underlying photo visible.
    d.rounded_rectangle((25,panel_top,w-25,panel_bot),radius=14,fill=(*CREAM,179),outline=(*INK,65),width=2)
    ff=font(int(w*.046))
    lines=wrap(d,text,ff,w-108,3)
    if len(lines)>3:
        raise ValueError("Sentence too long for stable lower-third; split sentence first")
    line_h=int(w*.067);y=panel_top+(panel_bot-panel_top-len(lines)*line_h)//2+line_h//2
    for line in lines:
        draw_rtl(d,(w-51,y),line,ff,INK,anchor="ra")
        y+=line_h
    d.rectangle((0,0,w,int(h*.08)),fill=(*CREAM,249))
    draw_rtl(d,(w-29,int(h*.052)),BRAND,font(int(w*.052)),INK,anchor="ra")
    d.text((35,int(h*.045)),str(story.get("country","WORLD"))[:4].upper(),font=font(int(w*.026),False),fill=INK)
    d.rectangle((0,int(h*.91),w,h),fill=(*INK,249))
    draw_rtl(d,(w-30,int(h*.957)),TAG,font(int(w*.041)),WHITE,anchor="ra")
    if not image_present:
        draw_rtl(d,(w-28,int(h*.123)),"تصویرسازی مفهومی",font(int(w*.025),False),WHITE,anchor="ra")
    else:
        d.rounded_rectangle((24,int(h*.110),int(w*.35),int(h*.147)),radius=6,fill=(25,25,25,190))
        draw_rtl(d,(int(w*.33),int(h*.134)),"تصویر آرشیوی",font(int(w*.024),False),WHITE,anchor="ra")
    if demo:
        d.rectangle((0,int(h*.148),w,int(h*.18)),fill=(178,26,42,232))
        draw_rtl(d,(w-28,int(h*.17)),"نسخه بازبینی — منتشر نشود",font(int(w*.025)),WHITE,anchor="ra")
    return ov

def source_image(item,assets,outdir):
    choices=assets.get(item["id"],[])
    for i,c in enumerate(choices):
        if c.get("license") not in SAFE_LICENSES or not c.get("illustrative_only"):
            continue
        if not c.get("creator") and c["license"].startswith("CC BY"):
            continue
        try:
            host=__import__("urllib.parse",fromlist=["urlsplit"]).urlsplit(c["image_url"]).hostname or ""
            if not (host.endswith(".wikimedia.org") or host.endswith(".wikipedia.org")):continue
            req=urllib.request.Request(c["image_url"],headers={"User-Agent":"GerdeGitiPreview/1.0 (https://github.com/aliasgharhatami/mahgpt-affiliate)"})
            with urllib.request.urlopen(req,timeout=12) as r:
                kind=r.headers.get("Content-Type","").split(";")[0].strip()
                if kind not in ("image/jpeg","image/png"):continue
                data=r.read(6_000_001)
            if len(data)>6_000_000:continue
            img=Image.open(io.BytesIO(data))
            if img.width<600 or img.height<450:continue
            path=outdir/f"licensed-{item['id']}-{i}.jpg"
            img.convert("RGB").save(path,quality=90)
            return path,{"creator":c.get("creator"),"license":c["license"],"file_page":c["original_file_page"],"license_url":c.get("license_url")}
        except Exception as e:
            print("Illustrative image candidate unavailable:",str(type(e).__name__),file=sys.stderr)
    return None,None

def audio_segments(sentences,client,voice,model,style,outdir):
    from google import genai
    if client is None:raise RuntimeError("Gemini API key missing: no fake or silent narration allowed")
    parsed=[]
    for i,text in enumerate(sentences):
        result=client.interactions.create(
            model=model,
            input=[{"type":"user_input","content":[{"type":"text","text":text,"annotations":[{"type":"speech_metadata","style":style}]}]}],
            response_format={"type":"audio"},
            generation_config={"speech_config":[{"voice":voice}]}
        )
        audio=getattr(result,"output_audio",None)
        if audio is None or not getattr(audio,"data",None):raise RuntimeError("No Gemini spoken audio for sentence "+str(i+1))
        payload=base64.b64decode(audio.data) if isinstance(audio.data,str) else bytes(audio.data)
        with wave.open(io.BytesIO(payload),"rb") as w:
            if w.getframerate()!=24000 or w.getsampwidth()!=2 or w.getnchannels()!=1:
                raise RuntimeError("Expected uncompressed mono PCM16 24000 Hz WAV")
            frames=w.readframes(w.getnframes())
        if not frames:raise RuntimeError("Audio was empty")
        parsed.append((text,frames))
    full=bytearray(b"\x00"*(24000*2*2)) # first 2 seconds = cover
    timings=[]
    for i,(text,pcm) in enumerate(parsed):
        start=len(full)//2/24000
        full.extend(pcm)
        end=len(full)//2/24000
        timings.append({"index":i+1,"text":text,"start":round(start,3),"end":round(end,3)})
        if i<len(parsed)-1:full.extend(b"\x00"*(int(24000*.18)*2))
    full.extend(b"\x00"*(24000*2)) # one-second tail
    f=outdir/"narration.wav"
    with wave.open(str(f),"wb") as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(full)
    duration=len(full)//2/24000
    if not 30<=duration<=180:raise ValueError("Reel must be 30–180 seconds; got "+str(duration))
    return f,timings,duration

def run(cmd):
    subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

def render_video(item,image,out,clips,timing,duration,wd,w=540,h=960,fps=18,demo=True):
    segments=[]
    logo=cover_image(item,image,w,h,demo);cover=wd/"cover.jpg";logo.save(cover,quality=92)
    def segment(still,overlay,seconds,dest):
        nframes=max(1,round(seconds*fps))
        # Motion is on the image only, captions and masthead remain stationary.
        filt=f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},zoompan=z='min(zoom+0.0005,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={w}x{h}:fps={fps}[bg];[bg][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
        run(["ffmpeg","-nostdin","-y","-hide_banner","-loglevel","error",
             "-loop","1","-framerate",str(fps),"-i",str(still),
             "-loop","1","-framerate",str(fps),"-i",str(overlay),
             "-filter_complex",filt,"-map","[v]", "-frames:v",str(nframes),
             "-c:v","libx264","-preset","veryfast","-crf","25",
             "-r",str(fps),"-pix_fmt","yuv420p","-movflags","+faststart",str(dest)])
    # Intro frame is stationary, with footer/branding integrated into the cover.
    empty=Image.new("RGBA",(w,h),(0,0,0,0));empty_path=wd/"clear.png";empty.save(empty_path)
    first=wd/"part-00.mp4";segment(cover,empty_path,2,first);segments.append(first)
    for i,t in enumerate(timing,1):
        start=t["start"]
        end=timing[i]["start"] if i<len(timing) else duration
        # Frame timing includes pause after sentence, preserving sync.
        seconds=end-start
        photo=wd/f"photo-{i:02d}.jpg"
        bg_photo(image,w,h,i).save(photo,quality=91)
        overlay=wd/f"overlay-{i:02d}.png"
        subtitle_overlay(item,t["text"],w,h,i,image is not None,demo).save(overlay)
        file=wd/f"part-{i:02d}.mp4"
        segment(photo,overlay,seconds,file)
        segments.append(file)
    concat=wd/"parts.txt"
    concat.write_text("".join("file '"+str(p.resolve()).replace("'","")+"'\n" for p in segments))
    # Self-composed gentle underscore uses mathematical sine waves, no borrowed recordings.
    # Volume kept much lower than narration. Never claim this is commercial library music.
    run(["ffmpeg","-nostdin","-y","-hide_banner","-loglevel","error",
        "-f","concat","-safe","0","-i",str(concat),
        "-i",str(clips),
        "-f","lavfi","-i",f"sine=frequency=174:sample_rate=24000:duration={duration}",
        "-filter_complex","[2:a]volume=0.012,lowpass=f=400[m];[1:a][m]amix=inputs=2:weights='1 0.24':duration=first:normalize=0[a]",
        "-map","0:v:0","-map","[a]", "-c:v","copy","-c:a","aac","-b:a","128k",
        "-t",str(duration),"-movflags","+faststart",str(out)])
    # Check both video and audio streams; never record publish-ready without actual media.
    probe=subprocess.check_output(["ffprobe","-v","error","-show_entries","stream=codec_type","-of","json",str(out)],text=True)
    kinds={s["codec_type"] for s in json.loads(probe)["streams"]}
    if not {"video","audio"}.issubset(kinds): raise RuntimeError("Video or voice missing from Reel")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--queue",required=True,help="JSON from draft queue, not a publishing instruction")
    ap.add_argument("--media",help="Research-only Commons candidate JSON")
    ap.add_argument("--out",default=str(ROOT/"output"/"daily-preview"))
    ap.add_argument("--max-items",type=int,default=5)
    ap.add_argument("--demo",action="store_true",help="Explicit visual demonstration with watermark")
    ap.add_argument("--quality",choices=["preview","production"],default="preview")
    args=ap.parse_args()
    data=json.loads(Path(args.queue).read_text(encoding="utf-8"))
    if data.get("schema")!="gerde-giti/queue/v1":raise ValueError("A valid separate Gerde Giti queue is required")
    if data.get("live") is True:raise ValueError("Do not render media from a live posting queue with this preview command")
    if args.max_items<1 or args.max_items>5:raise ValueError("max-items must be 1-5")
    output=Path(args.out);output.mkdir(parents=True,exist_ok=True)
    incoming=json.loads(Path(args.media).read_text(encoding="utf-8")) if args.media and Path(args.media).exists() else {"items":[]}
    assets={x["id"]:x.get("images",[]) for x in incoming.get("items",[])}
    items=data.get("items",[])[:args.max_items]
    key=os.environ.get("GEMINI_API_KEY","")
    if key:
        from google import genai
        client=genai.Client(api_key=key)
    else:client=None
    report={"brand":BRAND,"date":data["date"],"publication_enabled":False,
      "approval":"NO — no automated clearance of articles or media",
      "usage":"review_only","items":[]}
    q= (720,1280,24) if args.quality=="production" else (540,960,18)
    for idx,item in enumerate(items):
        if item.get("status")!="draft":
            raise ValueError("This media-building pipeline accepts only unapproved drafts")
        ident=item["id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]{4,90}",ident):raise ValueError("Unsafe source item id")
        target=output/(f"{idx+1:02d}-"+ident);target.mkdir(parents=True,exist_ok=True)
        img,license=source_image(item,assets,target)
        manifest={"id":ident,"kind":item["kind"],"country":item["country"],"source_url":item["source_url"],
                  "original_headline":item["headline"],"status":"preview_not_approved",
                  "image_attribution":license,"visual_label":"تصویر آرشیوی" if img else "تصویرسازی مفهومی",
                  "review_checks":{"article_facts":False,"media_relevance_and_rights":False,"native_persian":False,"caption_sync_listened":False},
                  "files":[]}
        if item["kind"]=="photo":
            for name,size in [("feed.jpg",(1080,1350)),("story.jpg",(1080,1920))]:
                f=target/name
                photo_post(item,img,*size,demo=True).save(f,quality=89,optimize=True)
                manifest["files"].append(name)
        else:
            lines=item.get("narration_sentences") or []
            if not 5<=len(lines)<=9 or any(not isinstance(x,str) or not x.strip() for x in lines):
                manifest["error"]="No complete reviewed-language draft (requires 5-9 lines)"
            elif not client:
                manifest["error"]="Missing Gemini API key (no silent fake narration)"
            else:
                try:
                    with tempfile.TemporaryDirectory() as t:
                        tmp=Path(t)
                        audio,timing,duration=audio_segments(lines,client,"Kore","gemini-3.8-flash-tts",DEFAULT_STYLE,tmp)
                        (target/"timing.json").write_text(json.dumps(timing,ensure_ascii=False,indent=2))
                        def fmt(v):
                            n=round(v*1000)
                            return f"{n//3600000:02d}:{(n//60000)%60:02d}:{(n//1000)%60:02d},{n%1000:03d}"
                        (target/"captions.srt").write_text("\n\n".join(f"{i+1}\n{fmt(x['start'])} --> {fmt(x['end'])}\n{x['text']}" for i,x in enumerate(timing))+"\n",encoding="utf-8")
                        reel=target/"reel.mp4"
                        render_video(item,img,reel,audio,timing,duration,tmp,*q,True)
                        cover_image(item,img,1080,1920,True).save(target/"cover.jpg",quality=90)
                        manifest.update(duration_seconds=round(duration,2),voice="Kore",model="gemini-3.8-flash-tts",
                            files=["reel.mp4","cover.jpg","captions.srt","timing.json"],
                            subtitle_timing="phrase measured audio segments; manual word alignment not asserted")
                except Exception as e:
                    manifest["error"]=type(e).__name__+": "+str(e)[:220]
        (target/"review.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        report["items"].append(manifest)
        print(f"Item {idx+1}/{len(items)}: {item['kind']} | files={len(manifest['files'])} | reason={manifest.get('error','none')}",flush=True)
    (output/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    completed=sum(1 for x in report["items"] if (x["kind"]=="photo" and len(x["files"])==2) or (x["kind"]=="reel" and "reel.mp4" in x["files"]))
    print(f"Created {completed} of {len(items)} editorial PREVIEWS. Automatic publishing still OFF.",flush=True)
    if completed!=len(items):sys.exit(2)

if __name__=="__main__":main()

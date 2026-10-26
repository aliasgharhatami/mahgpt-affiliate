"""Gerde Giti: exact-brand cloud editor, based on the first user-approved Reel.
No Instagram API, no image-generation billing, no automatic approval.
Input: a fully rights-cleared, event-relevant storyboard and a Kore WAV/timing.
Runs on GitHub-hosted Ubuntu even when the user's PC is off.
"""
from __future__ import annotations
import argparse, hashlib, io, json, math, os, pathlib, subprocess, sys, tempfile, urllib.request, wave
from PIL import Image,ImageDraw,ImageFont,ImageOps,features

BASE=pathlib.Path(__file__).resolve().parent
FIRST_REFERENCE="https://gerde-giti-media.onrender.com/media/2026-10-26/edirne-horses-first/reel.mp4"
W,H=1080,1920
INK=(29,29,29);CREAM=(235,227,213);RED=(190,54,63);WHITE=(255,255,255)
SAFE_LICENSES={"CC0","Public Domain","Public domain","CC BY 2.0","CC BY 3.0","CC BY 4.0","CC BY-SA 4.0"}

def cmd(args):
    result=subprocess.run(args,check=False,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError("FFmpeg operation failed: "+result.stderr.decode(errors="replace")[-400:])
    return result.stdout

def font(size,bold=True):
    paths=([os.environ.get("GITI_FONT_BOLD","")] if bold else [os.environ.get("GITI_FONT_REGULAR","")])
    paths+=([
       "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf",
       "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    ] if bold else [
       "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
       "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    ])
    for p in paths:
        if p and pathlib.Path(p).is_file():return ImageFont.truetype(p,size,layout_engine=ImageFont.Layout.RAQM)
    raise RuntimeError("Missing Persian font on build runner")

def ensure_rtl():
    if not features.check_feature("raqm"):raise RuntimeError("Persian font shaping via libraqm is mandatory")

def shape_lines(draw,txt,f,max_width):
    words=txt.split();lines=[];current=""
    for word in words:
        test=(current+" "+word).strip()
        extent=draw.textbbox((0,0),test,font=f,direction="rtl")
        if current and extent[2]-extent[0]>max_width:
            lines.append(current);current=word
        else:current=test
    if current:lines.append(current)
    return lines

def load_reference(reference):
    if reference.startswith("https://"):
        req=urllib.request.Request(reference,headers={"User-Agent":"GerdeGitiProduction/1.0"})
        with urllib.request.urlopen(req,timeout=25) as r:
            if not str(r.headers.get("Content-Type","")).startswith("video/mp4"):raise ValueError("Reference must be MP4")
            raw=r.read(18_000_001)
        if len(raw)>18_000_000:raise ValueError("Reference too large")
        with tempfile.NamedTemporaryFile(suffix=".mp4") as f:
            f.write(raw);f.flush()
            frame=cmd(["ffmpeg","-hide_banner","-loglevel","error","-ss","0.4","-i",f.name,
               "-frames:v","1","-f","image2pipe","-vcodec","png","-"])
    else:
        frame=cmd(["ffmpeg","-hide_banner","-loglevel","error","-ss","0.4","-i",reference,
                 "-frames:v","1","-f","image2pipe","-vcodec","png","-"])
    img=Image.open(io.BytesIO(frame)).convert("RGB")
    if img.size!=(W,H):raise ValueError("First approved reference must be exactly 1080x1920")
    return img

def make_crop(image,width,height,focus=0.5):
    image=Image.open(image).convert("RGB")
    r=max(width/image.width,height/image.height)
    image=image.resize((math.ceil(image.width*r),math.ceil(image.height*r)),Image.Resampling.LANCZOS)
    x=int((image.width-width)*.5)
    y=int((image.height-height)*min(.95,max(.05,focus)))
    return image.crop((x,y,x+width,y+height))

def download_image(scene,base,idx):
    """Only specifically authorized images are accepted. Never scrape random copyrighted news photographs."""
    kind=scene.get("kind")
    if kind not in ("actual","reconstruction"):raise ValueError("Every visual must be marked actual or reconstruction")
    if kind=="actual":
        if scene.get("license") not in SAFE_LICENSES and not scene.get("rights_permission",False):
            raise ValueError("Event photo has no redistributable license or recorded explicit permission")
        if not scene.get("rights_evidence_url","").startswith("https://"):
            raise ValueError("Actual news photo lacks provenance/rights evidence URL")
    else:
        if not scene.get("image_generator") or scene.get("human_subject_accuracy_reviewed") is not True:
            raise ValueError("AI scene needs a named generator and visual/factual review")
    if scene.get("story_relevance_checked") is not True:
        raise ValueError("Visual relevance is not checked: do not publish irrelevant stock photography")
    source=scene.get("path")
    if source:
        p=pathlib.Path(source).resolve()
        if not p.is_file():raise FileNotFoundError(str(p))
        data=p.read_bytes()
    else:
        url=scene.get("image_url","")
        from urllib.parse import urlsplit
        u=urlsplit(url)
        if u.scheme!="https" or u.username or u.password or not u.netloc:raise ValueError("Image requires HTTPS")
        with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"GerdeGitiProduction/1.0"}),timeout=25) as r:
            if r.headers.get("Content-Type","").split(";")[0] not in ("image/jpeg","image/png","image/webp"):
                raise ValueError("Not a photographic image")
            data=r.read(10_000_001)
    if len(data)>10_000_000:raise ValueError("Image file too large")
    with Image.open(io.BytesIO(data)) as im:
        if im.width<750 or im.height<500:raise ValueError("Scene image too small")
        dest=base/f"scene-{idx:02d}.jpg"
        im.convert("RGB").save(dest,quality=95)
    return dest

def render_slide(job,scene,src,other,ref,out,idx):
    canvas=Image.new("RGB",(W,H),CREAM)
    # These header/footer pixels come from the actual first approved published reel.
    canvas.paste(ref.crop((0,0,W,196)),(0,0))
    canvas.paste(ref.crop((0,1680,W,H)),(0,1680))
    canvas.paste(make_crop(src,W,730,0.48),(0,196))
    canvas.paste(make_crop(other,W,754,0.57),(0,926))
    d=ImageDraw.Draw(canvas,"RGBA")
    # Grounded geography, no EP / Local labels.
    location=(job.get("location_fa") or job.get("country_fa") or "خبر جهان").strip()
    f=font(31,True)
    left=30;tag=location[:48]
    tbox=d.textbbox((0,0),tag,font=f,direction="rtl")
    tw=tbox[2]-tbox[0]
    d.rounded_rectangle((left,217,left+tw+44,273),radius=7,fill=(*INK,237))
    d.text((left+tw+22,231),tag,font=f,anchor="ra",direction="rtl",fill=WHITE)
    visual="عکس واقعی خبر" if scene["kind"]=="actual" else "بازسازی تصویری"
    ff=font(28,False);vw=d.textbbox((0,0),visual,font=ff,direction="rtl")
    d.rounded_rectangle((36,963,36+vw[2]-vw[0]+38,1013),radius=6,fill=(*INK,216))
    d.text((54+vw[2]-vw[0],973),visual,font=ff,direction="rtl",anchor="ra",fill=WHITE)
    # 72% opacity, allowing actual image to remain visible through subtitle panel.
    x1,y1,x2,y2=34,1095,W-34,1478
    d.rounded_rectangle((x1,y1,x2,y2),radius=11,fill=(*CREAM,184),outline=(240,236,229,225),width=2)
    d.rectangle((69,1140,93,1164),fill=(*RED,255))
    d.text((W-65,1127),"خبر جهان",font=font(29,False),direction="rtl",anchor="ra",fill=INK)
    d.line((70,1182,W-70,1182),fill=(*INK,95),width=2)
    text=str(scene["narration"]).strip()
    for size in (64,60,56,52,48,44,40):
        body=font(size,True)
        lines=shape_lines(d,text,body,W-150)
        if len(lines)<=3:break
    if len(lines)>3:raise ValueError("Narration too long for 3-line subtitle; divide storyboard into shorter phrases")
    line_h=int(size*1.65)
    ty=int(1300-(len(lines)-1)*line_h/2)
    for line in lines:
        d.text((W-77,ty),line,font=body,anchor="ra",direction="rtl",fill=INK)
        ty+=line_h
    canvas.save(out,quality=93,subsampling=0)

def validate_job(job):
    if job.get("schema")!="gerde-giti/quality-cloud/v1":raise ValueError("Wrong storyboard schema")
    if not job.get("id") or not job.get("source_url","").startswith("https://"):
        raise ValueError("An identifiable sourced news story is required")
    if not job.get("caption") or len(job["caption"])>2200:raise ValueError("Original caption required")
    scenes=job.get("scenes",[])
    if len(scenes)<5 or len(scenes)>10:raise ValueError("Need 5–10 meaningful scene beats, not a repetitive one-image slideshow")
    if len({x.get("image_url") or x.get("path") for x in scenes})<4:
        raise ValueError("Need at least four distinct story-specific images")
    if any(not x.get("narration") or not str(x.get("narration")).strip() for x in scenes):
        raise ValueError("Every scene must have its own natural Persian narration")
    return scenes

def render(job_file,audio_file,timing_file,out_dir,reference):
    ensure_rtl()
    output=pathlib.Path(out_dir);output.mkdir(parents=True,exist_ok=True)
    job=json.loads(pathlib.Path(job_file).read_text(encoding="utf-8"))
    scenes=validate_job(job)
    timing=json.loads(pathlib.Path(timing_file).read_text(encoding="utf-8"))
    if isinstance(timing,dict):timing=timing.get("segments",[])
    if len(timing)!=len(scenes):raise ValueError("Voice and storyboard scene counts differ")
    starts=[float(x["start"]) for x in timing]
    if abs(starts[0]-1.0)>.06:raise ValueError("Voice must start at exactly second 1")
    if any(abs(float(x["end"])-float(x["start"]))<.5 for x in timing):
        raise ValueError("Empty/unusable narrated scene")
    for scene,seg in zip(scenes,timing):
        if scene["narration"].strip()!=seg["text"].strip():raise ValueError("Subtitle does not match spoken line")
    with wave.open(str(audio_file),"rb") as wav:
        if wav.getnchannels()!=1 or wav.getframerate()!=24000 or wav.getsampwidth()!=2:
            raise ValueError("Only authentic PCM16 mono 24kHz narration accepted")
        duration=wav.getnframes()/wav.getframerate()
        first_frames=wav.readframes(24000)
    if any(b!=0 for b in first_frames[:1000]):raise ValueError("Narration starts before one second")
    if not 25<=duration<=180:raise ValueError("Unacceptable Reel duration")
    reference_frame=load_reference(reference)
    visual_paths=[download_image(scene,output,i) for i,scene in enumerate(scenes)]
    slide_paths=[]
    # First second is visual preview with no subtitle, using the first beat.
    for i,scene in enumerate(scenes):
        dest=output/f"slide-{i:02d}.jpg"
        render_slide(job,scene,visual_paths[i],visual_paths[(i+1)%len(scenes)],reference_frame,dest,i)
        slide_paths.append(dest)
    concat=output/"playlist.txt"
    rows=[]
    intro=output/"intro.jpg"
    first=Image.open(slide_paths[0]).convert("RGB")
    # Do not let a frame from the Edirne news story leak into a new story.
    first.paste(make_crop(visual_paths[1],W,383,0.57),(0,1095))
    first.save(intro,quality=93,subsampling=0)
    rows+=["file '"+str(intro.resolve()).replace("'","")+"'","duration 1.0"]
    for i,seg in enumerate(timing):
        end=starts[i+1] if i<len(timing)-1 else duration
        seconds=end-float(seg["start"])
        if seconds<=0:raise ValueError("Bad narration segment timing")
        rows+=["file '"+str(slide_paths[i].resolve()).replace("'","")+"'","duration "+str(round(seconds,4))]
    rows.append("file '"+str(slide_paths[-1].resolve()).replace("'","")+"'")
    concat.write_text("\n".join(rows)+"\n")
    mp4=output/"reel.mp4"
    cmd(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y","-safe","0","-f","concat","-i",str(concat),
         "-i",str(audio_file),"-map","0:v:0","-map","1:a:0","-r","24",
         "-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p",
         "-c:a","aac","-b:a","160k","-t",str(round(duration,3)),
         "-movflags","+faststart",str(mp4)])
    (output/"caption.txt").write_text(job["caption"],encoding="utf-8")
    (output/"cover.jpg").write_bytes(slide_paths[0].read_bytes())
    manifest={
        "schema":"gerde-giti/quality-cloud-render/v1","id":job["id"],
        "source_url":job["source_url"],"live":False,"status":"review-only",
        "reference":reference,"output_sha256":hashlib.sha256(mp4.read_bytes()).hexdigest(),
        "audio_first_second":1.0,"video_width":W,"video_height":H,
        "scenes":len(scenes),"duration":duration,
        "photo_sources":[{"kind":x["kind"],"license":x.get("license"),"rights_evidence_url":x.get("rights_evidence_url")} for x in scenes],
        "requires_user_approval":True,
    }
    (output/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("QUALITY_REFERENCE_REEL_RENDERED: REVIEW ONLY",manifest["output_sha256"])
    return manifest

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--job",required=True);p.add_argument("--audio",required=True)
    p.add_argument("--timing",required=True);p.add_argument("--out",required=True)
    p.add_argument("--reference",default=FIRST_REFERENCE)
    a=p.parse_args();render(a.job,a.audio,a.timing,a.out,a.reference)

if __name__=="__main__":main()

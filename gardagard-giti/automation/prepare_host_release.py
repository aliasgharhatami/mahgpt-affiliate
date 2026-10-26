"""Prepare release of independently APPROVED Gerde Giti media to static Render host.

Preview artefacts are expressly refused. This script makes no Internet or Instagram
calls; the caller must deploy files and verify their public SHA-256 afterwards.
"""
from __future__ import annotations
import argparse,hashlib,json,re,shutil,subprocess
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image

QUEUE_SCHEMA="gerde-giti/queue/v1"
HEX_ID=re.compile(r"^[A-Za-z0-9_-]{4,90}$")
DATE=re.compile(r"^\d{4}-\d{2}-\d{2}$")
BASE="https://gerde-giti-media.onrender.com"
MUST_PASS=("article_facts","media_relevance_and_rights","native_persian","caption_sync_listened")

def fail(message):raise ValueError(message)
def confined(base,rel):
    if not isinstance(rel,str) or not rel or Path(rel).is_absolute() or ".." in Path(rel).parts:
        fail("Unsafe release path")
    dest=(base/rel).resolve()
    if not dest.is_relative_to(base.resolve()):fail("Release file escapes reviewed package")
    if not dest.is_file() or dest.is_symlink():fail("Missing or symlink release file: "+str(rel))
    return dest
def probe_mp4(path):
    if path.stat().st_size>95_000_000 or path.stat().st_size<1000:fail("MP4 size out of range")
    # Hosted Github runners are not guaranteed to include ffprobe.
    # imageio_ffmpeg provides an FFmpeg binary with a readable metadata report.
    import imageio_ffmpeg
    cmd=[imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-i",str(path)]
    p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    out=p.stderr
    if "Video:" not in out or "Audio:" not in out:fail("MP4 must contain video and real audio")
    match=re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)",out)
    if not match:fail("MP4 duration unavailable")
    seconds=int(match[1])*3600+int(match[2])*60+float(match[3])
    if not 30<=seconds<=180:fail("Reel must be 30-180 seconds")
    return seconds
def check_jpg(path,kind):
    if path.stat().st_size>14_000_000 or path.stat().st_size<4000:fail("JPEG size invalid")
    with Image.open(path) as img:
        if img.format!="JPEG":fail("Media must be JPEG")
        w,h=img.size
        if kind=="feed" and not (w>=720 and .75<=w/h<=1.91):fail("Invalid feed aspect/resolution")
        if kind in ("cover","story") and not (w>=720 and .53<=w/h<=.61):fail("Invalid 9:16 story/cover")
        img.verify()

def validate_and_copy(queue,render_root,host_public):
    if queue.get("schema")!=QUEUE_SCHEMA or not DATE.fullmatch(queue.get("date","")):
        fail("Invalid queue schema/date")
    if queue.get("live") is not False:fail("Prepare media before enabling LIVE queue")
    items=queue.get("items",[])
    if not 1<=len(items)<=5:fail("No approved items in queue")
    if any(item.get("status")!="approved" for item in items):
        fail("All selected items must be independently approved")
    render_root=Path(render_root).resolve()
    host_public=Path(host_public).resolve()
    if host_public.exists() and any(host_public.iterdir()):
        fail("Use a fresh empty staging destination")
    entries=[];used=set();assets=[]
    for item in items:
        ident=item.get("id","")
        if not HEX_ID.fullmatch(ident) or ident in used:fail("Unsafe/duplicate story id")
        used.add(ident)
        if item.get("kind") not in ("reel","photo"):fail("Unknown content kind")
        if not all(item.get(field) is True for field in ("reviewed_facts","media_rights_checked","native_persian_checked")):
            fail("Missing independent fact, rights, or Persian review: "+ident)
        address=urlparse(item.get("source_url",""))
        if address.scheme!="https" or not address.hostname:fail("Original source URL missing")
        # render_daily.py uses NN-id for human sorting; accept this exact
        # pattern as well as the future unprefixed id directory.
        possible=[ident]+[f"{n:02d}-{ident}" for n in range(1,6)]
        matches=[prefix for prefix in possible if (render_root/prefix/"review.json").is_file()]
        if len(matches)!=1:fail("Exactly one matching editorial review file is required")
        prefix=matches[0]
        review=confined(render_root,prefix+"/review.json")
        detail=json.loads(review.read_text(encoding="utf8"))
        if detail.get("id")!=ident or detail.get("kind")!=item["kind"]:fail("Review and queue mismatch")
        if detail.get("status")!="production_approved" or detail.get("demo") is not False:
            fail("Preview/watermarked media must never be promoted")
        checks=detail.get("review_checks") or {}
        if not all(checks.get(k) is True for k in MUST_PASS):fail("Incomplete independent editorial signoff")
        if detail.get("source_url")!=item["source_url"]:fail("The media does not match the approved source")
        if not detail.get("image_attribution") or not detail.get("image_attribution",{}).get("license"):
            fail("Approved image licensing and creator attribution missing")
        names=["reel.mp4","cover.jpg"] if item["kind"]=="reel" else ["feed.jpg","story.jpg"]
        if item["kind"]=="reel":
            if item.get("has_narration") is not True or item.get("subtitle_aligned") is not True:
                fail("Narration and subtitle listening approval is missing")
        media={}
        for name in names:
            src=confined(render_root,prefix+"/"+name)
            if src.suffix==".mp4":
                length=probe_mp4(src)
                if abs(length-float(item.get("duration_seconds") or 0))>1.5:fail("Queue and rendered duration disagree")
            else:check_jpg(src,name.split(".")[0])
            dest=host_public/"media"/queue["date"]/ident/name
            dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(src,dest)
            digest=hashlib.sha256(dest.read_bytes()).hexdigest()
            public=f"{BASE}/media/{queue['date']}/{ident}/{name}"
            media[name]={"url":public,"sha256":digest,"bytes":dest.stat().st_size}
        entries.append({"id":ident,"kind":item["kind"],"files":media,"approved":True})
    report={"schema":"gerde-giti/media-host-release/v1","date":queue["date"],"brand":"گرد گیتی","publicationActivated":False,"status":"staged_only","items":entries}
    meta=host_public/"media"/queue["date"]/"release.json"
    meta.parent.mkdir(parents=True,exist_ok=True)
    meta.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    return report

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--queue",required=True)
    ap.add_argument("--render-root",required=True)
    ap.add_argument("--out",required=True,help="Fresh temporary public subdirectory")
    args=ap.parse_args()
    queue=json.loads(Path(args.queue).read_text(encoding="utf8"))
    report=validate_and_copy(queue,args.render_root,args.out)
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":main()

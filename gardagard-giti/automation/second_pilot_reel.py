"""One-time, verified Gerde Giti editorial reel: China water motorcycle Guinness record.
Runs in Github Actions. No posting occurs in this file. All illustrative visuals
are explicitly labelled archival; never pretend imagery is event footage.
"""
import hashlib, html, importlib.util, io, json, os, pathlib, random, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request, wave
from datetime import datetime
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("giti_renderer",ROOT/"render_daily.py")
rd=importlib.util.module_from_spec(spec);spec.loader.exec_module(rd)
OUTPUT=ROOT/"output"/"second-pilot"
EVENT="china-water-motorcycle-20261025"
SOURCE="https://www.huaihua.gov.cn/huaihua/c101116/202610/1fe4455674234d938335f924c0758a42.shtml"
SECOND_SOURCE="https://www.upi.com/Odd_News/2026/10/26/guinness-world-records-motorcycle-water/9111793033790/"
LINES=[
"تو چین، یه نفر سوار موتورسیکلت شد و رفت روی آب! اونم نه چند متر؛ بیشتر از چهل کیلومتر!",
"اسمش ژانگ شوئه‌ست. بیست‌وپنجم اکتبر، روی رودخونهٔ جین‌جیانگ، تو استان هونان، رکورد جهانی ثبت کرد.",
"موتورش یه مدل ام ایکس چهارصد و پنجاه بود؛ البته با موتور معمولی خیلی فرق داشت.",
"زیر موتور، صفحه‌های مخصوص نصب کرده بودن که کمک می‌کرد روی آب بمونه.",
"لاستیک عقب هم با هل دادن آب به عقب، موتور رو به جلو می‌بُرد.",
"نتیجه؟ چهل ممیز هفتاد و چهار کیلومتر حرکت بدون توقف روی رودخونه! یه رکورد رسمی گینس.",
"جالب اینه که هفده سال پیش هم امتحان کرده بود، ولی اون موقع هر بار می‌افتاد تو آب!",
"تو حاضر بودی با چنین موتوری روی رودخونه رانندگی کنی؟ تو کامنت‌ها بگو!"
]
CAPTION="\n\n".join([
"🏍️ موتورسیکلت روی آب؟ بله، واقعاً!",
"ژانگ شوئه ۲۵ اکتبر ۲۰۲۶ در استان هونان چین با یک موتورسیکلت دستکاری‌شده ۴۰٫۷۴ کیلومتر روی رودخانه حرکت کرد و رکورد گینس ثبت شد. صفحه‌های ویژه زیر موتور و لاستیک عقبِ تغییریافته به حرکت روی آب کمک می‌کردن.",
"تو حاضر بودی سوارش بشی؟ 👇",
"📌 تصاویر ویدیو آرشیوی و برای توضیح موضوع هستن، نه فیلم واقعی رکورد.",
"منبع: دولت محلی هوای‌هوا (۲۶ اکتبر ۲۰۲۶) و UPI\n"+SOURCE+"\n"+SECOND_SOURCE,
"فالو کن تا بگردیم به گرد گیتی 🌍\n#گرد_گیتی #چین #موتورسیکلت #رکورد_گینس #اخبار_عجیب #reels"
])
UA="GerdeGitiEditorial/1.0 (source-attributed media review; contact via repository)"
PERMITTED=("CC0","Public domain","Public Domain","CC BY 4.0","CC BY 3.0","CC BY 2.0")
QUERIES=[
"motocross motorcycle",
"motorcycle riding off road",
"motorcycle engine wheel",
"river landscape China",
"river surface boats water",
"motorcycle motocross bike"
]
def load_url(url,timeout=20,limit=9000000):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        data=r.read(limit+1)
    if len(data)>limit:raise ValueError("oversized downloaded asset")
    return data
def valid_photo(item):
    ii=item.get("imageinfo",[])
    if not ii:return None
    info=ii[0];meta=info.get("extmetadata",{})
    l=html.unescape(re.sub("<[^>]+>","",meta.get("LicenseShortName",{}).get("value",""))).strip()
    if l not in PERMITTED:return None
    name=item.get("title","")
    if not re.search(r"\.(jpe?g|png)$",name,re.I):return None
    if int(info.get("width",0))<800 or int(info.get("height",0))<500:return None
    src=info.get("thumburl") or info.get("url")
    if not src or not src.startswith("https://"):return None
    page=info.get("descriptionurl")
    creator=html.unescape(re.sub("<[^>]+>","",meta.get("Artist",{}).get("value",""))).strip()[:180]
    if l.startswith("CC BY") and not creator:return None
    return dict(src=src,title=name,license=l,creator=creator,file_page=page)
def search_commons(query):
    args={"action":"query","generator":"search","gsrsearch":query,"gsrnamespace":"6",
        "gsrlimit":"40","prop":"imageinfo","iiprop":"url|size|extmetadata",
        "iiurlwidth":"1600","format":"json","formatversion":"2"}
    url="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode(args)
    data=json.loads(load_url(url,timeout=28,limit=3000000))
    return [p for p in (valid_photo(v) for v in data.get("query",{}).get("pages",[])) if p]
def images(folder):
    chosen=[];seen=set();seed=20261026
    for phrase in QUERIES:
        try: candidates=search_commons(phrase)
        except Exception as e:
            print("Commons query failed",phrase,type(e).__name__,flush=True);continue
        random.Random(seed+len(chosen)).shuffle(candidates)
        for c in candidates[:25]:
            if c["file_page"] in seen:continue
            try:
                raw=load_url(c["src"],timeout=18,limit=8000000)
                im=Image.open(io.BytesIO(raw)).convert("RGB")
                if im.width<800 or im.height<500:continue
                dest=folder/("photo-%02d.jpg"%(len(chosen)+1))
                im.thumbnail((1800,2100),Image.Resampling.LANCZOS);im.save(dest,quality=91)
                c["local"]=str(dest);chosen.append(c);seen.add(c["file_page"])
                print("Licensed illustrative photograph",len(chosen),c["license"],c["title"][:60],flush=True)
                break
            except Exception as e:continue
        if len(chosen)>=5:break
    if len(chosen)<3:raise RuntimeError("Fewer than three source-credited licensed relevant photos; do not render or publish")
    return chosen
def main():
    if not os.getenv("GEMINI_API_KEY"):raise RuntimeError("Missing free Gemini TTS key. No silent video allowed.")
    OUTPUT.mkdir(parents=True,exist_ok=True)
    files=images(OUTPUT)
    from google import genai
    client=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    scene=[pathlib.Path(x["local"]) for x in files]
    original=rd.bg_photo
    # Rotate independently licensed images, not repeated crops of one photo.
    rd.bg_photo=lambda image,w,h,offset=0:original(scene[offset%len(scene)],w,h,offset)
    story={"id":EVENT,"kind":"reel","headline":"این موتورسیکلت ۴۰ کیلومتر روی آب رفت!",
           "country":"چین","source_url":SOURCE}
    with tempfile.TemporaryDirectory() as t:
        wd=pathlib.Path(t)
        narration,timing,duration=rd.audio_segments(LINES,client,"Kore","gemini-3.8-flash-tts",rd.DEFAULT_STYLE,wd)
        if abs(timing[0]["start"]-1)>0.001:raise RuntimeError("Narration must begin at exactly 1.000 sec")
        reel=OUTPUT/"reel.mp4"
        rd.render_video(story,scene[0],reel,narration,timing,duration,wd,720,1280,24,False)
        # Keep 1080x1920 H.264 like the approved first post.
        full=OUTPUT/"reel-fullhd.mp4"
        subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(reel),
            "-vf","scale=1080:1920:flags=lanczos","-c:v","libx264","-preset","fast","-crf","21",
            "-c:a","copy","-movflags","+faststart",str(full)],check=True)
        full.replace(reel)
        rd.cover_image(story,scene[0],1080,1920,False).save(OUTPUT/"cover.jpg",quality=92)
    (OUTPUT/"caption.txt").write_text(CAPTION,encoding="utf-8")
    (OUTPUT/"timing.json").write_text(json.dumps(timing,ensure_ascii=False,indent=2),encoding="utf-8")
    sources=[{k:v for k,v in c.items() if k!="local" and k!="src"} for c in files]
    (OUTPUT/"attribution.json").write_text(json.dumps(sources,ensure_ascii=False,indent=2),encoding="utf-8")
    release={"schema":"gerde-giti/second-pilot/v1","id":EVENT,"published":False,
      "source_url":SOURCE,"other_source_url":SECOND_SOURCE,
      "image_source":"labelled_archival_cc_licensed","image_attribution":sources,
      "duration_seconds":round(duration,3),"narration_first_second":1,
      "image_count":len(scene),"sha256":hashlib.sha256((OUTPUT/"reel.mp4").read_bytes()).hexdigest(),
      "file_size":(OUTPUT/"reel.mp4").stat().st_size,"audio_voice":"Kore","quality":"1080x1920",
      "description":"One-time second test; images archival rather than actual event footage"}
    if not 30<=duration<=180:raise RuntimeError("Invalid duration")
    (OUTPUT/"release.json").write_text(json.dumps(release,ensure_ascii=False,indent=2),encoding="utf-8")
    print("SECOND_PILOT_MEDIA_BUILT",release["sha256"],release["file_size"],round(duration,2),flush=True)
if __name__=="__main__":main()

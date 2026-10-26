"""One-off editorial release: Edirne Selimiye horses, event 19 October 2026.

No Instagram calls. Uses the previously user-reviewed Gemini Kore audio, checks
the local event evidence and outputs a licensed/labelled, non-watermarked video.
Does not claim any illustrative photo depicts the event itself.
"""
import json,os,sys,wave,shutil,hashlib,urllib.request,urllib.parse,io
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from render_daily import (source_image,render_video,cover_image,SAFE_LICENSES)
from commons_media import query_commons

SOURCE="https://www.dha.com.tr/yerel-haberler/edirne/edirne-selimiye-camisi-meydaninda-basibos-3-at-2965688"
DATE="2026-10-19"
ID="edirne-horses-first"
def main():
    archive=Path(os.getenv("GITI_NARRATOR_ARTIFACT","gardagard-giti/output/cached-audio"))
    wav=archive/"gerde-giti-episode-001-narration.wav"
    jsonfile=archive/"timings.json"
    if not wav.is_file() or not jsonfile.is_file():
        raise RuntimeError("Missing trusted first-episode narrator and its actual timing")
    data=json.loads(jsonfile.read_text(encoding="utf8"))
    segments=data.get("segments",[])
    if len(segments)!=7:raise ValueError("First narrator requires seven timed sentences")
    times=[{"index":i+1,"text":part["text"],"start":float(part["start"]),"end":float(part["end"])} for i,part in enumerate(segments)]
    dur=float(data["duration"])
    if not 40<=dur<=90:raise ValueError("Voice duration outside checked first release range")
    with wave.open(str(wav),"rb") as w:
        if w.getnframes()<24_000*40 or w.getnchannels()!=1 or w.getframerate()!=24000:raise ValueError("Narration malformed")
    out=Path("gardagard-giti/output/first-live")/ID
    out.mkdir(parents=True,exist_ok=True)
    story={"id":ID,"kind":"reel","country":"TR","headline":"سه اسب وسط میدان تاریخی مسجد سلیمیه!","source_url":SOURCE}
    reviewed=[]
    try:
        # Commons licensing metadata is retrieved from Wikimedia API, NOT from a news agency.
        reviewed=query_commons("Selimiye Mosque Edirne Turkey courtyard")
    except Exception as error:
        print("Wikimedia archive lookup unavailable:",type(error).__name__)
    choices=[]
    for c in reviewed:
        if c.get("license") not in SAFE_LICENSES:continue
        if c.get("license","").startswith("CC BY") and not c.get("creator"):continue
        c["illustrative_only"]=True
        choices.append(c)
    photo,credit=source_image(story,{ID:choices},out)
    if not photo:
        # Independent rights verification: public-domain self-released Wikimedia
        # Commons images of the exact Selimiye Mosque, not of the Oct 19 event.
        # https://commons.wikimedia.org/wiki/File:Selimiye_camii.JPG
        from PIL import Image
        names=["Selimiye camii.JPG","Selimiye avlu.JPG"]
        for name in names:
            digest=hashlib.md5(name.encode("utf8")).hexdigest()
            url="https://upload.wikimedia.org/wikipedia/commons/"+digest[0]+"/"+digest[:2]+"/"+urllib.parse.quote(name)
            try:
                req=urllib.request.Request(url,headers={"User-Agent":"GerdeGiti/1.0 verified public-domain editorial media demo (support@wikimedia.org)","Accept":"image/jpeg"})
                with urllib.request.urlopen(req,timeout=18) as response:
                    body=response.read(4_000_001)
                    kind=response.headers.get("Content-Type","").split(";")[0].strip()
                if kind!="image/jpeg" or len(body)>4_000_000:continue
                pic=Image.open(io.BytesIO(body))
                if pic.width<1000 or pic.height<800:continue
                candidate=out/"selimiye-public-domain.jpg"
                pic.convert("RGB").save(candidate,quality=90)
                photo=candidate
                credit={"creator":"Filanca","license":"Public domain",
                        "file_page":"https://commons.wikimedia.org/wiki/File:"+urllib.parse.quote(name.replace(" ","_")),
                        "license_url":"https://commons.wikimedia.org/wiki/Template:PD-self"}
                print("Retrieved a verified public-domain location image:",name)
                break
            except Exception as e:
                print("Public-domain location photo download failed:",name,type(e).__name__)
    if photo and not credit:raise ValueError("Archival photograph missing credit")
    # The narration describes the event; any image is explicitly archival, not incident evidence.
    reel=out/"reel.mp4"
    render_video(story,photo,reel,wav,times,dur,out,w=720,h=1280,fps=24,demo=False)
    cover_image(story,photo,1080,1920,demo=False).save(out/"cover.jpg",quality=91)
    caption=("هفتهٔ پیش، ۱۹ اکتبر ۲۰۲۶، سه تا اسب سرگردون وسط میدان مسجد تاریخی سلیمیه در شهر ادرنهٔ ترکیه دیده شدن! 🐎\n\n"
       "گردشگرا عکس گرفتن؛ بعضیا این صحنه رو جالب دونستن و بعضیا هم گفتن مناسب این جای تاریخی نیست. "
       "بالاخره مأمورای شهرداری اسب‌ها رو از محوطه دور کردن.\n\n"
       "🎤 تو اگه اونجا بودی عکس می‌گرفتی یا اعتراض می‌کردی؟\n\n"
       "منبع خبر: DHA، گزارش ۱۹ اکتبر ۲۰۲۶\n"+SOURCE+"\n\n")
    if credit:
        caption+=("⚠️ تصویر آرشیوی از مسجد سلیمیه، نه عکس این اتفاق.\n"
                  f"عکس: {credit.get('creator','')}\nمجوز: {credit.get('license','')}\n"
                  f"منبع تصویر: {credit.get('file_page','')}\n\n")
    else:
        caption+="⚠️ تصاویر این ویدیو تصویرسازی گرافیکی و مفهومی هستن، نه فیلم واقعی حادثه.\n\n"
    caption+="فالو کن تا بگردیم به گرد گیتی\n#گرد_گیتی #ترکیه #ادرنه #خبر_محلی"
    if len(caption)>2200:raise ValueError("Instagram caption too long")
    (out/"caption.txt").write_text(caption,encoding="utf8")
    (out/"timings.json").write_text(json.dumps(times,ensure_ascii=False,indent=2),encoding="utf8")
    (out/"release.json").write_text(json.dumps({
      "schema":"gerde-giti/first-live/v1","event_date":DATE,"publish_day":"2026-10-26",
      "id":ID,"source_url":SOURCE,"created_for_review_from_approved_episode":True,
      "instagram_posted":False,"image_source":credit or "original_geometric_concept_art",
      "archival_labelled":True,"reel_duration_seconds":dur,
      "media_files":["reel.mp4","cover.jpg"],"audio_source":"Gemini Kore previously user-reviewed",
      "voice_text":[x["text"] for x in times]
    },ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("FIRST REAL NEWS MEDIA PRODUCED",ID,round(dur,2), "seconds; archival?",bool(credit))
    print("NO Instagram publishing happened in this step.")

if __name__=="__main__":main()

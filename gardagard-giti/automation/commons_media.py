"""Search Wikimedia Commons for illustrative media with explicit reuse metadata.

Finding media is not the same as proving it depicts an event. Never use pictures
of an unrelated incident as documentary images. This produces rights candidates
ONLY. All candidates require relevance review before image download or publishing.
"""
from __future__ import annotations
from html import unescape
import json,re,urllib.parse,urllib.request
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parent
API="https://commons.wikimedia.org/w/api.php"
UA="GerdeGitiNewsResearch/1.0 (https://github.com/aliasgharhatami/mahgpt-affiliate; editorial media rights audit)"
LICENSES={"CC0","Public domain","Public Domain","CC BY 4.0","CC BY 3.0","CC BY 2.0"}
def plain(x):
 return re.sub(r"\s+"," ",unescape(re.sub(r"<[^>]+>"," ",str(x or "")))).strip()
def pick_license(meta):
 license_name=plain(meta.get("LicenseShortName",{}).get("value",""))
 if license_name not in LICENSES:return None
 author=plain(meta.get("Artist",{}).get("value",""))
 title=plain(meta.get("ObjectName",{}).get("value",""))
 license_url=meta.get("LicenseUrl",{}).get("value","")
 if not isinstance(license_url,str) or not license_url.startswith("https://"):
  if license_name not in ("CC0","Public domain","Public Domain"):return None
 if license_name.startswith("CC BY") and (not author or author=="Unknown"):return None
 return {"license":license_name,"license_url":license_url,"author":author[:200],"title":title[:160]}
def query_commons(query,fetch=None):
 args={
  "action":"query","format":"json","generator":"search","gsrsearch":query,
  "gsrnamespace":"6","gsrlimit":"8","prop":"imageinfo",
  "iiprop":"url|size|extmetadata","iiurlwidth":"1400"
 }
 req=urllib.request.Request(API+"?"+urllib.parse.urlencode(args),headers={"User-Agent":UA})
 if fetch is None:
  with urllib.request.urlopen(req,timeout=18) as r:raw=r.read(850000)
 else:raw=fetch(req)
 data=json.loads(raw)
 candidates=[]
 for page in data.get("query",{}).get("pages",{}).values():
  for item in page.get("imageinfo",[])[:1]:
   link=item.get("thumburl") or item.get("url","")
   original=item.get("descriptionurl") or ""
   mime=item.get("mime") or ""
   meta=pick_license(item.get("extmetadata") or {})
   if not meta or not link.startswith("https://") or not original.startswith("https://"):continue
   if not (link.lower().endswith((".jpg",".jpeg",".png")) or ("wikipedia.org" in link and not link.endswith(".svg"))):continue
   if int(item.get("width",0))<700 or int(item.get("height",0))<500:continue
   candidates.append({
    "image_url":link,"original_file_page":original,
    "license":meta["license"],"license_url":meta["license_url"],
    "creator":meta["author"],"source_title":meta["title"],
    "illustrative_only":True,
    "required_label_fa":"تصویر آرشیوی / تزئینی",
    "editorial_review":"pending_image_relevance_and_rights_review",
    "can_publish_automatically":False,
    "usage_note":"Credit author, image source, license in caption, verify this depicts only general location/theme, not incident footage"
   })
 return candidates
def main():
 date=datetime.now(ZoneInfo("Europe/Istanbul")).strftime("%Y-%m-%d")
 file=ROOT/"output"/("composed-"+date+".json")
 if not file.exists():
  print("No Persian editorial drafts; media search skipped safely.");return
 draft=json.loads(file.read_text(encoding="utf-8"))
 output={"schema":"gerde-giti/media-research/v1","date":date,"items":[]}
 for item in draft.get("items",[])[:5]:
  images=[]
  for query in item.get("visual_queries_en",[])[:2]:
   try:images.extend(query_commons(query)[:3])
   except Exception as e:print("Commons query failed safely:",type(e).__name__)
  output["items"].append({"id":item["id"],"source_url":item["source_url"],"images":images,"status":"review_only_no_download"})
 dest=ROOT/"output"/("media-candidates-"+date+".json")
 dest.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("Found image-license candidates for",len(output["items"]),"articles, but NO media approved or published.")
if __name__=="__main__":main()

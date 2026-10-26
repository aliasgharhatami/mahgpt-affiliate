"""Discover recent local stories from independent publisher RSS feeds.

Uses feeds for discovery ONLY. Requires direct original-domain links; never republishes
RSS descriptions, article photos or copyright-protected copy. No artificial 5-story
quota: if sources fail or quality insufficient, create fewer candidates and pause.
"""
from __future__ import annotations
import hashlib, json, re, sys, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parent
USER_AGENT="GerdeGitiEditorialResearch/1.0 (+contact via project administrator)"
KEYWORDS={
 "unusual":("عجیب","شگفت","ساخت","insólit","inusual","sorpresa","curioso","raro","qiziq","необыч","удивител","奇","độc lạ","kỳ lạ","strange","rare","unusual","surprise","bizarre","unexpected"),
 "human":("saved","rescue","community","rescata","encuentra","finds","descubre","discover","animal","animales","живот","life","لحظه","نجات","خنده","festival","фестиваль","lễ hội","historia"),
 "local":("barrio","vecino","pueblo","ciudad","aldea","district","mahalla","район","город","community","village","local","mahalle","şehir","maydon","festival")
}
WIRE=("reuters","associated press","afp","efe","bbc","cnn","ap news","dpa")
STRIP=re.compile(r"<[^>]+>")
def clean(value):
 return re.sub(r"\s+"," ",unescape(STRIP.sub(" ",value or ""))).strip()
def publisher_host(url):
 try:return (urllib.parse.urlsplit(url).hostname or "").lower().removeprefix("www.")
 except:return ""
def is_original(url,domain):
 host=publisher_host(url)
 return host==domain or host.endswith("."+domain)
def published_date(value):
 if not value:return None
 try:
  dt=parsedate_to_datetime(value)
  return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
 except Exception:
  try:return datetime.fromisoformat(value.replace("Z","+00:00")).astimezone(timezone.utc)
  except:return None
def fetch_feed(url,opener=urllib.request.urlopen):
 request=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/xml,application/rss+xml,application/atom+xml"})
 with opener(request,timeout=18) as response:
  if int(getattr(response,"status",200))>=400:raise ValueError("HTTP feed failure")
  body=response.read(1_500_001)
 if len(body)>1_500_000:raise ValueError("RSS feed exceeds maximum bytes")
 return ET.fromstring(body)
def _value(el,name):
 child=el.find(name)
 return clean(child.text if child is not None else "")
def parse_rss(root,source,now,max_age_hours):
 out=[]
 if root.tag.endswith("rss") or root.find("channel") is not None:
  items=root.findall("./channel/item")
  for item in items:
   title=_value(item,"title");link=_value(item,"link")
   date=published_date(_value(item,"pubDate"))
   desc=_value(item,"description")
   if not title or not is_original(link,source["domain"]) or not date:continue
   age=(now-date).total_seconds()/3600
   if age < -2 or age > max_age_hours:continue
   out.append(dict(title=title,original_url=link,source=source["source"],country=source["country"],country_fa=source["countryFa"],published_at=date.isoformat(),discovery_excerpt=desc[:450],language=source["language"]))
 else:
  ns="{http://www.w3.org/2005/Atom}"
  for item in root.findall(f"{ns}entry"):
   title=clean(item.findtext(f"{ns}title"))
   links=[x.attrib.get("href","") for x in item.findall(f"{ns}link") if x.attrib.get("rel","alternate")=="alternate"]
   link=links[0] if links else ""
   date=published_date(item.findtext(f"{ns}published") or item.findtext(f"{ns}updated"))
   if not title or not is_original(link,source["domain"]) or not date:continue
   age=(now-date).total_seconds()/3600
   if age < -2 or age > max_age_hours:continue
   out.append(dict(title=title,original_url=link,source=source["source"],country=source["country"],country_fa=source["countryFa"],published_at=date.isoformat(),discovery_excerpt=clean(item.findtext(f"{ns}summary"))[:450],language=source["language"]))
 return out
def score(article,now):
 text=(article["title"]+" "+article["discovery_excerpt"]).casefold()
 total=0
 for group,terms in KEYWORDS.items():
  if any(t.casefold() in text for t in terms):total+={"unusual":5,"human":3,"local":2}[group]
 age=(now-datetime.fromisoformat(article["published_at"])).total_seconds()/3600
 total+=max(0,3-round(age/24))
 if any(w in text for w in WIRE):total-=7
 return total
def pick_diverse(stories,limit=20):
 # Round robin across countries and sources so a single nation cannot dominate
 by_country={}
 for article in stories:
  by_country.setdefault(article["country"],[]).append(article)
 for items in by_country.values():items.sort(key=lambda a:(-a["score"],a["published_at"]))
 result=[];countries=sorted(by_country)
 while len(result)<limit and any(by_country.values()):
  for country in countries:
   if by_country[country]:
    result.append(by_country[country].pop(0))
    if len(result)>=limit:break
 return result
def harvest(config,sources,now=None,fetcher=fetch_feed):
 now=now or datetime.now(timezone.utc)
 result=[];warnings=[];seen=set()
 for source in sources["sources"]:
  if source.get("manualOnly"):continue  # vendor RSS terms restrict automated commercial usage
  try:
   root=fetcher(source["url"])
   found=parse_rss(root,source,now,config["news"]["maxArticleAgeHours"])
   for article in found[:config["news"]["maxDiscoveriesPerFeed"]]:
    ident=hashlib.sha256(article["original_url"].encode()).hexdigest()[:16]
    if ident in seen:continue
    seen.add(ident);article["id"]=ident;article["score"]=score(article,now)
    article["content_verified"]=False
    article["media_rights_verified"]=False
    article["status"]="candidate_needs_article_check"
    result.append(article)
  except Exception as e: warnings.append({"source":source["source"],"country":source["country"],"error":type(e).__name__+":"+str(e)[:200]})
 chosen=pick_diverse(result)
 return {"schema":"gerde-giti/discovery/v1","created_at":now.isoformat(),"stories":chosen,"candidate_total":len(result),"warnings":warnings,"publishable":False}
def main():
 config=json.loads((ROOT/"config.json").read_text(encoding="utf8"))
 feeds=json.loads((ROOT/"sources.json").read_text(encoding="utf8"))
 output=harvest(config,feeds)
 date=datetime.now(ZoneInfo(config["timezone"])).strftime("%Y-%m-%d")
 dest=ROOT/"output";dest.mkdir(parents=True,exist_ok=True)
 p=dest/f"discovered-{date}.json";p.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print(f"Discovered {output['candidate_total']} recent local items; diversified shortlist {len(output['stories'])}; feeds with errors {len(output['warnings'])}.")
 print("Saved review-only candidate file",p)
 if not output["stories"]:print("WARNING: No qualifying original-source stories; do not publish anything.")
if __name__=="__main__":main()

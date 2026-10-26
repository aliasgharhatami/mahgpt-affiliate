"""Build original Persian news drafts from real local publisher article text.

Every factual claim must be grounded in a fetched original-domain article.
The Gemini response is checked for verbatim short evidence spans; drafts are never
automatically cleared for publication. Nothing calls Instagram in this module.
"""
from __future__ import annotations
import json,os,re,sys,time,urllib.request,urllib.parse
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parent
class ArticleParser(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True)
  self.body=[];self.inside_article=0;self.inside_main=0;self.block=0;self.description="";self.alltext=[]
 def handle_starttag(self,t,a):
  attrs=dict(a)
  if t in ("script","style","nav","footer","header","aside"):self.block+=1
  if t=="article":self.inside_article+=1
  if t=="main":self.inside_main+=1
  if t=="meta" and attrs.get("property") in ("og:description","description"):
   self.description=attrs.get("content","")[:600]
 def handle_endtag(self,t):
  if t in ("script","style","nav","footer","header","aside"):self.block=max(0,self.block-1)
  if t=="article":self.inside_article=max(0,self.inside_article-1)
  if t=="main":self.inside_main=max(0,self.inside_main-1)
 def handle_data(self,data):
  if self.block:return
  v=re.sub(r"\s+"," ",unescape(data)).strip()
  if len(v)<3:return
  if self.inside_article:self.body.append(v)
  elif self.inside_main:self.alltext.append(v)
def obtain_text(original_url, expected_domain):
 u=urllib.parse.urlparse(original_url)
 host=(u.hostname or "").lower().removeprefix("www.")
 if u.scheme!="https" or (host!=expected_domain and not host.endswith("."+expected_domain)):raise ValueError("Invalid original publisher link")
 req=urllib.request.Request(original_url,headers={"User-Agent":"Mozilla/5.0 (compatible; GerdeGitiResearch/1.0)","Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=9) as r:
  resolved=urllib.parse.urlparse(r.geturl())
  redirect=(resolved.hostname or "").lower().removeprefix("www.")
  if redirect!=expected_domain and not redirect.endswith("."+expected_domain):raise ValueError("Redirected away from original publisher")
  if "html" not in r.headers.get("content-type",""):raise ValueError("Not an HTML article")
  raw=r.read(950_001)
 if len(raw)>950_000:raise ValueError("Article HTML too large")
 charset="utf-8"
 mat=re.search(br"charset=['\"]?([a-zA-Z0-9-]+)",raw[:5000],re.I)
 if mat:
  v=mat.group(1).decode("ascii","ignore")
  if v.lower() in ("utf-8","iso-8859-1","windows-1252"):charset=v
 parser=ArticleParser()
 parser.feed(raw.decode(charset,errors="replace"))
 body=re.sub(r"\s+"," "," ".join(parser.body if len(" ".join(parser.body))>=600 else parser.alltext)).strip()
 if len(body)<800:raise ValueError("Not enough readable original article text to verify facts")
 return body[:14000]
def require_evidence(text,evidence):
 if not isinstance(evidence,list) or len(evidence)<2:raise ValueError("At least 2 source evidence snippets required")
 normalized=re.sub(r"\s+"," ",text).casefold()
 for e in evidence:
  if not isinstance(e,str) or not 15<=len(e)<=220:raise ValueError("Evidence span must be 15-220 characters")
  if re.sub(r"\s+"," ",e).casefold() not in normalized:raise ValueError("Source evidence was not found in original article")
def draft_prompt(article,original):
 return """You are a Persian-speaking editor of Gerde Giti, a world local-news magazine.
You are provided with one local publisher's ORIGINAL article. Be strictly factual.
Never add a witness quote, public reaction, time, quantity, cause, opinion, danger or official response unless the article states it.
Make the story genuinely interesting to Persian viewers; reject ordinary politics or irrelevant press releases.
Write every spoken line in NATURAL COLLOQUIAL IRANIAN PERSIAN, not standard written Persian.
Avoid mixed registers, artificial slang, made-up details, unverified suspense and sensational misinformation.
Return a JSON object ONLY with fields:
interesting (boolean), headline_fa (<=80 chars), reason (brief Persian),
narration_sentences (array of 5 to 9 standalone colloquial spoken lines if interesting, else empty),
caption_fa (colloquial Persian original summary, <=500 chars),
visual_queries_en (2 to 4 English search terms for royalty-cleared archival photos of same city/topic),
evidence (2 to 4 exact copied short strings, 15-220 chars each, present in article), notes (string).
Mention source attribution, city and country naturally. End in a tasteful viewer question.
No copyrighted verbatim passages from the article in narration or caption.
Limit narration to ~110-165 spoken Persian words; a 30-90 second reel.
Original local title: """+article["title"]+"\nOriginal publisher: "+article["source"]+"\nCountry: "+article["country_fa"]+"\nOriginal URL: "+article["original_url"]+"\nSource article text:\n"+original[:8500]
def generate_draft(client,article,article_text):
 from google.genai import types
 out=client.models.generate_content(
  model="gemini-3.8-flash",
  contents=draft_prompt(article,article_text),
  config=types.GenerateContentConfig(response_mime_type="application/json",temperature=0.45)
 )
 data=json.loads(out.text)
 require_evidence(article_text,data.get("evidence"))
 if not data.get("interesting"):raise ValueError("Local item not interesting enough")
 lines=data.get("narration_sentences")
 if not isinstance(lines,list) or not 5<=len(lines)<=9:raise ValueError("Requires 5-9 natural sentences")
 if any(not isinstance(x,str) or not 14<=len(x)<=200 for x in lines):raise ValueError("Invalid sentence length")
 if not isinstance(data.get("headline_fa"),str) or not 5<=len(data["headline_fa"])<=80:raise ValueError("Invalid headline")
 if not isinstance(data.get("caption_fa"),str) or len(data["caption_fa"])>500:raise ValueError("Invalid caption")
 # Concrete claims in Persian still require a separate human/second-source review.
 return {
  "id":article["id"],"country":article["country"],"country_fa":article["country_fa"],
  "source_name":article["source"],"source_url":article["original_url"],
  "headline":data["headline_fa"],"caption":data["caption_fa"],
  "narration_sentences":lines,"visual_queries_en":data.get("visual_queries_en",[]),
  "source_evidence_checked":True,"source_evidence_count":len(data["evidence"]),
  "original_article_checked":True,"reviewed_facts":False,
  "media_rights_checked":False,"native_persian_checked":False,
  "status":"draft_needs_review","editor_note":data.get("notes","")
 }
def main():
 candidates=sorted((ROOT/"output").glob("discovered-*.json"),reverse=True)
 if not candidates:raise SystemExit("No discovery file yet")
 original=json.loads(candidates[0].read_text(encoding="utf-8"))["stories"]
 index=json.loads((ROOT/"sources.json").read_text(encoding="utf-8"))
 domains={v["source"]:v["domain"] for v in index["sources"]}
 if not os.environ.get("GEMINI_API_KEY"):
  print("No Gemini key; article verification requires Gemini. No invented draft created.")
  return
 from google import genai
 client=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
 chosen=[];visited=set();warnings=[];attempts=0
 # Keep the daily workflow bounded: GitHub Actions and free Gemini can stall on individual sites.
 deadline=time.monotonic()+360
 for a in original:
  if time.monotonic()>deadline:
   warnings.append({"id":"daily-budget","cause":"Research time budget reached; preserve validated drafts instead of losing entire run"})
   break
  if len(chosen)>=5 or attempts>=12:break
  attempts+=1
  if a["country"] in visited and len(visited)<3:continue
  try:
   domain=domains[a["source"]]
   page=obtain_text(a["original_url"],domain)
   c=generate_draft(client,a,page)
   chosen.append(c);visited.add(a["country"])
   time.sleep(1)
  except Exception as e:warnings.append({"id":a["id"],"cause":type(e).__name__+":"+str(e)[:140]})
 date=datetime.now(ZoneInfo("Europe/Istanbul")).strftime("%Y-%m-%d")
 dest=ROOT/"output"/("composed-"+date+".json")
 result={"schema":"gerde-giti/editorial-review/v1","date":date,"items":chosen,"failures":warnings,"production_approved":False}
 dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("Composed "+str(len(chosen))+" original-source-grounded Persian story drafts; human rights and factual review still required.")
if __name__=="__main__":main()

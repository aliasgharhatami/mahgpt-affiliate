"""Extract REAL event-photo candidates from the original article, not unrelated
Wikimedia archive pictures. Metadata is evidence of a URL, NEVER proof of
redistribution rights. This script cannot license images or mark them approved.
"""
import argparse,html,json,pathlib,re,urllib.parse,urllib.request
from html.parser import HTMLParser

class Pictures(HTMLParser):
    def __init__(self):super().__init__();self.found=[]
    def handle_starttag(self,tag,attrs):
        a={k.lower():v for k,v in attrs if k and v}
        if tag=="meta" and a.get("property","").lower() in ("og:image","og:image:secure_url","twitter:image"):
            if a.get("content"):self.found.append((a["content"],"official article social preview"))
        elif tag=="img":
            u=a.get("data-src") or a.get("src") or a.get("data-original") or a.get("srcset","").split(",")[0].split(" ")[0]
            if u:self.found.append((u,(a.get("alt") or "article photograph")[:180]))

def scan(source,out):
    u=urllib.parse.urlsplit(source)
    if u.scheme!="https" or not u.hostname:raise ValueError("Original article must have HTTPS URL")
    req=urllib.request.Request(source,headers={"User-Agent":"Mozilla/5.0 (GerdeGitiEditorialPhotoDiscovery/1.0)"})
    with urllib.request.urlopen(req,timeout=18) as res:
        raw=res.read(2_000_001)
        charset=res.headers.get_content_charset() or "utf-8"
    try:htmlbody=raw.decode(charset,errors="replace")
    except LookupError:htmlbody=raw.decode("utf-8",errors="replace")
    parser=Pictures();parser.feed(htmlbody)
    photos=[];seen=set()
    for v,desc in parser.found:
        link=urllib.parse.urljoin(source,html.unescape(v))
        parsed=urllib.parse.urlsplit(link)
        if parsed.scheme!="https" or parsed.hostname is None or link in seen:continue
        if link.lower().split("?")[0].endswith((".svg",".gif",".webp")):continue
        if re.search(r"(logo|avatar|icon|favicon|banner|placeholder)",link+" "+desc,re.I):continue
        seen.add(link)
        photos.append({
            "kind":"actual","image_url":link,"description":desc,
            "original_article_url":source,
            "rights_evidence_url":None,"license":"UNKNOWN - NOT APPROVED",
            "rights_permission":False,"story_relevance_checked":False,
            "use_in_public_reel":False
        })
        if len(photos)>=24:break
    p=pathlib.Path(out);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps({"source":source,"rights_status":"NOT VERIFIED",
         "candidates":photos},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Actual article photo URLs found:",len(photos),"— none automatically licensed for republication")
if __name__=="__main__":
    a=argparse.ArgumentParser();a.add_argument("--article",required=True);a.add_argument("--out",required=True)
    x=a.parse_args();scan(x.article,x.out)

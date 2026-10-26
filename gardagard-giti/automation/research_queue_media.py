"""Prepare Wikimedia Commons archive-photo candidates for media PREVIEWS only.
No visual is automatically asserted to depict the reported event.
"""
import argparse,json,re
from pathlib import Path
from commons_media import query_commons
if __name__=="__main__":
 p=argparse.ArgumentParser()
 p.add_argument("--queue",required=True)
 p.add_argument("--out",required=True)
 args=p.parse_args()
 q=json.loads(Path(args.queue).read_text(encoding="utf-8"))
 if q.get("schema")!="gerde-giti/queue/v1" or q.get("live") is True:
  raise ValueError("Requires a non-live Gerde Giti draft queue")
 result={"schema":"gerde-giti/media-research/v1","date":q["date"],"items":[],"publishable":False}
 for item in q.get("items",[])[:5]:
  matches=[]
  for query in (item.get("visual_queries_en") or [])[:1]:
   if not isinstance(query,str) or len(query)>100:continue
   try:matches.extend(query_commons(query)[:3])
   except Exception as e:print("Commons lookup unavailable for",item["id"],type(e).__name__)
  result["items"].append({"id":item["id"],"images":matches,"status":"review_only_no_download"})
 Path(args.out).parent.mkdir(parents=True,exist_ok=True)
 Path(args.out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print("Media research completed for",len(result["items"]),"items; photo clearance NOT granted.")

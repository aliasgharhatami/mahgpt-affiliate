"""Attach externally verified Render URLs to an APPROVED, still-NON-LIVE Giti queue.

This step NEVER changes the item's approval status, queue.live or publisher config.
Accepts an approved release receipt only after CDN byte hash verification succeeded.
"""
from __future__ import annotations
import argparse,json
from pathlib import Path
from urllib.parse import urlparse

BASE="https://gerde-giti-media.onrender.com/media/"
def attach(queue,receipt):
    if queue.get("schema")!="gerde-giti/queue/v1" or queue.get("live") is not False:
        raise ValueError("Only a non-live Gerde Giti queue is permitted")
    if receipt.get("schema")!="gerde-giti/media-host-release/v1" or receipt.get("publicationActivated") is not False or receipt.get("status")!="staged_only":
        raise ValueError("Untrusted host-release receipt")
    if receipt.get("date")!=queue.get("date"):
        raise ValueError("Receipt and queue dates mismatch")
    updates={x.get("id"):x for x in receipt.get("items",[])}
    if not updates or len(updates)!=len(receipt.get("items",[])):
        raise ValueError("Invalid or duplicate release IDs")
    if set(updates)!={x.get("id") for x in queue.get("items",[])}:
        raise ValueError("Release and queue must contain identical story IDs")
    out=json.loads(json.dumps(queue))
    for item in out["items"]:
        if item.get("status")!="approved" or not all(item.get(k) is True for k in ("reviewed_facts","media_rights_checked","native_persian_checked")):
            raise ValueError("Queue approval changed")
        media=updates[item["id"]]
        if media.get("kind")!=item.get("kind") or media.get("approved") is not True:
            raise ValueError("Receipt media status mismatch")
        files=media.get("files") or {}
        required=["reel.mp4","cover.jpg"] if item["kind"]=="reel" else ["feed.jpg","story.jpg"]
        if set(files)!=set(required):raise ValueError("Unexpected media files")
        for name in required:
            obj=files[name]
            u=obj.get("url","")
            expected=BASE+queue["date"]+"/"+item["id"]+"/"+name
            if u!=expected or not isinstance(obj.get("sha256"),str) or len(obj["sha256"])!=64:
                raise ValueError("Untrusted media URL or checksum")
        item["media_url"]=files["reel.mp4"]["url"] if item["kind"]=="reel" else files["feed.jpg"]["url"]
        if item["kind"]=="reel":item["cover_url"]=files["cover.jpg"]["url"]
        else:item["story_media_url"]=files["story.jpg"]["url"]
        item["hosted_media_reviewed"]=True
    # Intentionally retain live=false; Instagram requires separate explicit enablement.
    assert out["live"] is False
    return out
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--queue",required=True)
    parser.add_argument("--receipt",required=True)
    parser.add_argument("--out",required=True)
    args=parser.parse_args()
    q=json.loads(Path(args.queue).read_text(encoding="utf8"))
    r=json.loads(Path(args.receipt).read_text(encoding="utf8"))
    validated=attach(q,r)
    Path(args.out).write_text(json.dumps(validated,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("Attached vetted Render URLs to NON-LIVE queue. No Instagram calls.")
if __name__=="__main__":main()

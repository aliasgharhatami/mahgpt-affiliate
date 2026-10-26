import importlib.util,unittest
from pathlib import Path

FILE=Path(__file__).resolve().parents[1]/"automation"/"apply_host_urls.py"
spec=importlib.util.spec_from_file_location("apply",FILE)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def fixture():
 item={"id":"reel-paraguay-123","kind":"reel","status":"approved","reviewed_facts":True,"media_rights_checked":True,"native_persian_checked":True}
 queue={"schema":"gerde-giti/queue/v1","date":"2026-10-26","live":False,"items":[item]}
 base="https://gerde-giti-media.onrender.com/media/2026-10-26/reel-paraguay-123/"
 receipt={"schema":"gerde-giti/media-host-release/v1","date":"2026-10-26","publicationActivated":False,"status":"staged_only","items":[{"id":item["id"],"kind":"reel","approved":True,"files":{"reel.mp4":{"url":base+"reel.mp4","sha256":"a"*64},"cover.jpg":{"url":base+"cover.jpg","sha256":"b"*64}}}]}
 return queue,receipt

class ApplyHostUrlsTests(unittest.TestCase):
 def test_attaches_links_but_keeps_publication_off(self):
  q,r=fixture();v=module.attach(q,r)
  self.assertEqual(v["items"][0]["media_url"],r["items"][0]["files"]["reel.mp4"]["url"])
  self.assertTrue(v["items"][0]["hosted_media_reviewed"])
  self.assertFalse(v["live"])
  self.assertIsNone(q["items"][0].get("media_url"))
 def test_cannot_import_into_live_queue(self):
  q,r=fixture();q["live"]=True
  with self.assertRaisesRegex(ValueError,"non-live"):module.attach(q,r)
 def test_cannot_guess_other_urls(self):
  q,r=fixture();r["items"][0]["files"]["reel.mp4"]["url"]="https://outside.example.com/foo.mp4"
  with self.assertRaisesRegex(ValueError,"Untrusted"):module.attach(q,r)
 def test_cannot_reintroduce_unapproved_media(self):
  q,r=fixture();q["items"][0]["media_rights_checked"]=False
  with self.assertRaisesRegex(ValueError,"approval changed"):module.attach(q,r)
 def test_cannot_change_story_or_date(self):
  q,r=fixture();r["date"]="2026-10-25"
  with self.assertRaisesRegex(ValueError,"dates mismatch"):module.attach(q,r)
if __name__=="__main__":unittest.main()

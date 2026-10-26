import importlib.util,json,tempfile,unittest
from pathlib import Path
from PIL import Image

MODULE=Path(__file__).resolve().parents[1]/"automation"/"prepare_host_release.py"
spec=importlib.util.spec_from_file_location("promote",MODULE)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def queue():
 return {"schema":"gerde-giti/queue/v1","date":"2026-10-26","live":False,"items":[{
    "id":"test-licensed-story","kind":"photo","status":"approved",
    "source_url":"https://example.org/original-local-news","reviewed_facts":True,
    "media_rights_checked":True,"native_persian_checked":True}]}
def setup(root):
 p=root/"render"/"test-licensed-story";p.mkdir(parents=True)
 Image.new("RGB",(1080,1350),"#E8DFD1").save(p/"feed.jpg",quality=94)
 Image.new("RGB",(1080,1920),"#E8DFD1").save(p/"story.jpg",quality=94)
 meta={"id":"test-licensed-story","kind":"photo","status":"production_approved","demo":False,
       "source_url":"https://example.org/original-local-news",
       "image_attribution":{"creator":"Owner provided","license":"Owner provided"},
       "review_checks":{k:True for k in module.MUST_PASS}}
 (p/"review.json").write_text(json.dumps(meta))
 return p,meta

class ReleaseTests(unittest.TestCase):
 def test_hosting_labeled_media_never_auto_publishes(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);setup(root)
   report=module.validate_and_copy(queue(),root/"render",root/"staged")
   self.assertFalse(report["publicationActivated"])
   self.assertEqual(report["status"],"staged_only")
   self.assertEqual(len(report["items"]),1)
   self.assertTrue((root/"staged/media/2026-10-26/test-licensed-story/feed.jpg").exists())
   self.assertEqual(report["items"][0]["files"]["story.jpg"]["url"],"https://gerde-giti-media.onrender.com/media/2026-10-26/test-licensed-story/story.jpg")
 def test_preview_prohibited(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p,meta=setup(root);meta["status"]="preview_not_approved"
   (p/"review.json").write_text(json.dumps(meta))
   with self.assertRaisesRegex(ValueError,"Preview/watermarked"):module.validate_and_copy(queue(),root/"render",root/"stage")
 def test_unapproved_or_missing_rights_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);setup(root);q=queue();q["items"][0]["media_rights_checked"]=False
   with self.assertRaisesRegex(ValueError,"independent fact"):module.validate_and_copy(q,root/"render",root/"stage")
   q=queue();q["items"][0]["status"]="draft"
   with self.assertRaisesRegex(ValueError,"independently approved"):module.validate_and_copy(q,root/"render",root/"stage")
 def test_private_or_symlink_file_prohibited(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p,m=setup(root)
   (p/"story.jpg").unlink();(p/"story.jpg").symlink_to(p/"feed.jpg")
   with self.assertRaisesRegex(ValueError,"symlink"):module.validate_and_copy(queue(),root/"render",root/"stage")
 def test_not_copying_without_all_editorial_checks(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p,meta=setup(root);meta["review_checks"]["native_persian"]=False
   (p/"review.json").write_text(json.dumps(meta))
   with self.assertRaisesRegex(ValueError,"editorial signoff"):module.validate_and_copy(queue(),root/"render",root/"stage")

if __name__=="__main__":unittest.main()

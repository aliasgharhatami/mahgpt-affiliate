"""No paid calls and no publishing: validate safeguards for the 5-post renderer."""
import importlib.util, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("giti_renderer",ROOT/"automation"/"render_media.py")
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

def fake():
    x=[]
    for idx,kind in enumerate(("reel","photo","reel","photo","reel")):
        x.append({
          "id":f"test-story-{idx}","kind":kind,"headline":"یک اتفاق عجیب!",
          "source_url":"https://example.org/story/"+str(idx),
          "editor_fact_checked":True,
          "spoken_fa_checked":True,
          "sentences":["امروز یه اتفاق عجیب افتاده!"]*5,
          "images":[{"path":"input/licensed/image.jpg","credit":"Artist, Wikimedia Commons",
                     "license":"CC BY 4.0","rights_checked":True,"illustrative":True}]
        })
    return {"schema":mod.SCHEMA,"items":x}

class RenderSafety(unittest.TestCase):
    def test_five_ready_candidate_shapes(self):self.assertEqual(len(mod.check(fake())["items"]),5)
    def test_fact_check_required(self):
        q=fake();q["items"][1]["editor_fact_checked"]=False
        with self.assertRaisesRegex(ValueError,"Facts"):mod.check(q)
    def test_rights_check_required(self):
        q=fake();q["items"][0]["images"][0]["rights_checked"]=False
        with self.assertRaisesRegex(ValueError,"rights"):mod.check(q)
    def test_forbid_traversal(self):
        q=fake();q["items"][2]["images"][0]["path"]="input/../../private.jpg"
        with self.assertRaisesRegex(ValueError,"traversal"):mod.check(q)
    def test_wrong_order(self):
        q=fake();q["items"][0]["kind"]="photo"
        with self.assertRaisesRegex(ValueError,"slot"):mod.check(q)
    def test_no_falsely_documentary_visual(self):
        q=fake();q["items"][1]["images"][0]["illustrative"]=False
        with self.assertRaisesRegex(ValueError,"Documentary"):mod.check(q)
    def test_original_articles_mandatory(self):
        q=fake();q["items"][1]["source_url"]="http://example.com"
        with self.assertRaisesRegex(ValueError,"source"):mod.check(q)

if __name__=="__main__":unittest.main()

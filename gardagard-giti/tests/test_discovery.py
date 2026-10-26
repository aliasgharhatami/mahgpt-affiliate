import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

path=Path(__file__).resolve().parents[1]/"automation"/"discover.py"
spec=importlib.util.spec_from_file_location("giti_discover",path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class DiscoveryTests(unittest.TestCase):
 def test_original_domain_required(self):
  xml="""<rss><channel>
  <item><title>Insólito suceso en un pueblo</title><link>https://www.abc.com.py/local/weird</link><pubDate>Mon, 26 Oct 2026 04:00:00 GMT</pubDate><description>Un caballo apareció junto a la estación local.</description></item>
  <item><title>Not local</title><link>https://bbc.com/news/123</link><pubDate>Mon, 26 Oct 2026 04:00:00 GMT</pubDate></item>
  </channel></rss>"""
  src={"domain":"abc.com.py","country":"PY","countryFa":"پاراگوئه","source":"ABC","language":"es"}
  results=module.parse_rss(ET.fromstring(xml),src,datetime(2026,10,26,6,tzinfo=timezone.utc),72)
  self.assertEqual(len(results),1)
  self.assertIn("Insólito",results[0]["title"])
  self.assertGreater(module.score(results[0],datetime(2026,10,26,6,tzinfo=timezone.utc)),5)
 def test_stale_and_future_filtered(self):
  src={"domain":"gazeta.uz","country":"UZ","countryFa":"ازبکستان","source":"Gazeta","language":"ru"}
  rss=ET.fromstring('<rss><channel><item><title>Old story</title><link>https://gazeta.uz/ru/old</link><pubDate>Mon, 19 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>')
  self.assertEqual(module.parse_rss(rss,src,datetime(2026,10,26,6,tzinfo=timezone.utc),72),[])
 def test_diversity_round_robin(self):
  articles=[]
  for country in ("PY","UZ","VN"):
   for i in range(7):
    articles.append({"country":country,"score":10-i,"published_at":"2026-10-26T00:00:00+00:00"})
  result=module.pick_diverse(articles,limit=5)
  self.assertEqual([x["country"] for x in result[:3]],["PY","UZ","VN"])
 def test_failed_feed_never_invents_stories(self):
  config={"news":{"maxArticleAgeHours":72,"maxDiscoveriesPerFeed":40}}
  feeds={"sources":[{"url":"https://invalid.test/feed","domain":"invalid.test","source":"Test","country":"ZZ","countryFa":"آزمایشی","language":"en"}]}
  def failed(_):raise OSError("not reachable")
  x=module.harvest(config,feeds,datetime(2026,10,26,tzinfo=timezone.utc),failed)
  self.assertEqual(x["stories"],[])
  self.assertFalse(x["publishable"])
  self.assertEqual(len(x["warnings"]),1)
if __name__=="__main__":unittest.main()

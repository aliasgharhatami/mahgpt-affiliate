# گرد گیتی | Gerde Giti

An isolated, **non-publishing** branding and sample-cover package. No changes to MahGPT website, Telegram automation or Instagram workflows.

## Editorial identity
- Official name: **گرد گیتی**
- Permanent sentence — spell exactly: **فالو کن تا بگردیم به گرد گیتی**
- Persian, right-to-left, dark navy + teal + gold, with Vazirmatn/Noto Sans Arabic fallback.
- Five daily slots **after activation**: three narrated Reels and two photographic posts; repost the two photographic posts as Stories.
- Feed image: 1080 × 1350. Reels cover and Stories: 1080 × 1920. The tagline uses the same **relative position (50% width, 75% height)** in all three templates.
- For real events: distinguish actual footage from stock, composites and illustrations; verify the event and image rights first.

## Preview (requires Node >=20 and existing repo dependency `sharp`)
```bash
npm install --no-audit --no-fund
node gardagard-giti/scripts/render-covers.mjs gardagard-giti/stories/2026-10-19-edirne-horses.json
node --test gardagard-giti/tests/brand.test.mjs
```

Preview files are written under `gardagard-giti/output/` by default and **are not uploaded or published**. If an image is absent, the cover renders a deliberate abstract illustration instead; it must not be passed off as documentary footage.

The original source for the first verified test article is DHA (19 October 2026). Its photographs/video are not included because permission was not obtained. Use approved stock only with the right license and label it illustrative; include asset credits in the final published caption.

The existing Instagram publisher in `scripts/instagram-publisher.mjs` is currently image-oriented. Reel upload, queue routing, credential checks, public MP4 hosting and safe deployment must be tested separately before any publishing migration.

## Safety
This project is staged for preview only (`publishing_enabled=false`). Do not reuse MahGPT's active queue, its posting schedule or its social publishing history. Do not modify the site's existing news/affiliate publishing logic to implement this pilot.

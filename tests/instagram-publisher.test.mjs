import assert from "node:assert/strict";
import { instagramCaption, resolveInstagramMedia } from "../scripts/instagram-publisher.mjs";

const post={story_id:"story-1",headline:"A concise AI headline",summary:"A factual summary of the development.",mahgpt_url:"https://mahgpt.com/news/story.html?id=story-1",image_mode:"fallback_card",fallback_image_instagram:"assets/social-cards/2026-08-24/story-1-instagram.png",instagram:{status:"pending"}};
assert.match(instagramCaption(post),/#AI #ArtificialIntelligence #TechNews/);
assert.equal(resolveInstagramMedia(post).url,"https://mahgpt.com/assets/social-cards/2026-08-24/story-1-instagram.png");
assert.equal(resolveInstagramMedia({...post,image_mode:"source",image_url:"https://example.com/editorial.jpg"}).kind,"source");
assert.equal(instagramCaption({...post,summary:"x".repeat(3000)}).length<=2200,true);
console.log("Instagram publisher tests passed");

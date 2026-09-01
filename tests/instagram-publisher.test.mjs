import assert from "node:assert/strict";
import { instagramCaption, resolveInstagramMedia, INSTAGRAM_API_HOST, instagramApiEndpoint } from "../scripts/instagram-publisher.mjs";
import { isInstagramAspectRatioSupported } from "../scripts/social-card.mjs";

const post={story_id:"story-1",headline:"A concise AI headline",summary:"A factual summary of the development.",mahgpt_url:"https://mahgpt.com/news/story.html?id=story-1",image_mode:"fallback_card",fallback_image_instagram:"assets/social-cards/2026-08-24/story-1-instagram.png",instagram:{status:"pending"}};
assert.match(instagramCaption(post),/#AI #ArtificialIntelligence #TechNews/);
assert.equal(resolveInstagramMedia(post).url,"https://mahgpt.com/assets/social-cards/2026-08-24/story-1-instagram.png");
assert.equal(resolveInstagramMedia({...post,image_mode:"source",image_url:"https://example.com/editorial.jpg"}).kind,"source");
assert.equal(resolveInstagramMedia({...post,image_mode:"source",image_url:"https://example.com/editorial.jpg",instagram_media_source:"fallback_card"}).kind,"fallback-card");
assert.equal(isInstagramAspectRatioSupported(1.91),true);
assert.equal(isInstagramAspectRatioSupported(0.8),true);
assert.equal(isInstagramAspectRatioSupported(2),false);
assert.equal(instagramCaption({...post,summary:"x".repeat(3000)}).length<=2200,true);
console.log("Instagram publisher tests passed");

assert.equal(INSTAGRAM_API_HOST,"graph.instagram.com");
assert.match(instagramApiEndpoint("/me"),/^https:\/\/graph\.instagram\.com\/v26\.0\/me$/);
assert.equal(instagramApiEndpoint("/123/media_publish").includes("graph.facebook.com"),false);
console.log("Instagram Login API family tests passed");

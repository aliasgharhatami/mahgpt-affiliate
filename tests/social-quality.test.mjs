import assert from "node:assert/strict";
import { cleanHeadline, editorialSummary, inferSourceName, isRejectedImage, validateSocialPost, detectPartner } from "../scripts/social-content.mjs";

const adobe={title:"Adobe's Firefly Audio Tools Exit Beta - The AI Economy | Ken Yeung",summary:"Adobe's Firefly Audio Tools Exit Beta &nbsp;&nbsp; The AI Economy | Ken Yeung",source:"https://news.google.com/rss/articles/example",image:"https://lh3.googleusercontent.com/J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc=s0-w300",tool:"adobe",toolName:"Adobe"};
const repaired=validateSocialPost({...adobe,detected_partner:detectPartner(adobe),product_url:"https://www.adobe.com/products/firefly.html"});
assert.equal(repaired.post.headline,"Adobe's Firefly Audio Tools Exit Beta");
assert.equal(repaired.post.source_name,"The AI Economy");
assert.notEqual(repaired.post.summary,"The AI Economy | Ken");
assert.match(repaired.post.summary,/Adobe has moved its Firefly audio tools out of beta/i);
assert.equal(repaired.post.image_mode,"fallback_card");
assert.equal(isRejectedImage(adobe.image),true);

assert.equal(cleanHeadline("Adobe's Firefly Audio Tools Exit Beta - The AI Economy | Ken Yeung",adobe),"Adobe's Firefly Audio Tools Exit Beta");
assert.equal(inferSourceName(adobe),"The AI Economy");
assert.equal(isRejectedImage("https://example.com/story-large.jpg"),false);
assert.equal(isRejectedImage("https://example.com/favicon-32x32.png"),true);
assert.equal(isRejectedImage("https://example.com/google-news-logo.png"),true);
assert.equal(isRejectedImage(""),true);

const generic=validateSocialPost({title:"New AI regulations in Europe",summary:"European lawmakers debate new rules for artificial intelligence.",source:"https://example.com/regulations",detected_partner:null,product_url:""});
assert.equal(generic.post.detected_partner,null);
assert.equal(generic.post.product_url,"");

console.log("social quality regression tests passed");

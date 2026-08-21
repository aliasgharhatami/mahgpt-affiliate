import fs from "node:fs";
const now=new Date().toISOString();
const data={updatedAt:now,frequency:"weekly",sections:{
 "image-design":["/guides/image-design-best-2026.html","/guides/image-design-new-tools-2026.html","/guides/free-image-design-tools-2026.html"],
 "text-writing":["/guides/text-writing-best-2026.html","/guides/text-writing-new-tools-2026.html","/guides/free-text-writing-tools-2026.html"],
   "video-motion":["/guides/video-motion-best-2026.html","/guides/video-motion-new-tools-2026.html","/guides/free-video-motion-tools-2026.html"]
}};
fs.writeFileSync("assets/guide-refresh.json",JSON.stringify(data,null,2)+"\n");
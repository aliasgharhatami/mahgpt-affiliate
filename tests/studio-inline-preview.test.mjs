import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const account=readFileSync(new URL('../ai-video-studio/studio-account.js',import.meta.url),'utf8');
const media=readFileSync(new URL('../ai-video-studio/studio-media.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../ai-video-studio/index.html',import.meta.url),'utf8');
const config=readFileSync(new URL('../ai-video-studio/studio-config.js',import.meta.url),'utf8');

test('one contextual primary CTA replaces the extra founder render button',()=>{
 assert.ok(account.includes("function hasDraftChanges()"));
 assert.ok(account.includes("function pilotReady()"));
 assert.ok(account.includes("if(pilotReady()&&!hasDraftChanges()){"));
 assert.ok(account.includes("await startPilotRender();return;"));
 assert.ok(account.includes("action.textContent=hasDraftChanges()?'Save request changes':'Create free 8-second test preview'"));
 assert.ok(!account.includes("const renderPreview=document.createElement('button')"));
 assert.ok(account.includes("oracleTester"));
 assert.ok(config.includes("paymentsReady: false"));
 assert.ok(config.includes("aiRenderingReady: false"));
});

test('private completed MP4 is also previewed securely above the original composer',()=>{
 assert.ok(account.includes("thread?.insertAdjacentElement('afterend',resultPanel)"));
 assert.ok(account.includes("await window.MAH_STUDIO_MEDIA.getFileBlob({api,projectId,asset})"));
 assert.ok(account.includes("video.controls=true"));
 assert.ok(account.includes("downloadFile({api,projectId,asset})"));
 assert.ok(account.includes("edit.textContent='Edit brief / new version'"));
 assert.ok(account.includes("await refreshProjects();"));
 assert.ok(account.includes("URL.revokeObjectURL(inlinePreviewUrl)"));
 assert.ok(media.includes("async function getFileBlob({api,projectId,asset})"));
 assert.ok(media.includes("return request(api,"));
 assert.ok(html.includes(".studio-result-panel video"));
});

test('finished project archive is read-only and UX copy avoids false paid AI claims',()=>{
 assert.ok(media.includes("panel.append(quota,note,mediaList)"));
 assert.ok(!media.includes("Save a text draft first, then attach media to that project."));
 assert.ok(html.includes("Full AI editing, price estimates, and payments are not available yet."));
 assert.ok(!html.includes('\\n  <p id="my-project-notice"'));
 assert.ok(html.includes("studio-account.js?v=20261106-quote-chat1"));
 assert.ok(html.includes("studio-media.js?v=20261106-inline-player1"));
});

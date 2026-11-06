import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const r=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=r('ai-video-studio/studio-account.js');
const html=r('ai-video-studio/index.html');
const config=r('ai-video-studio/studio-config.js');
const sql=r('ai-video-studio/backend/supabase/010_private_ai_quote_columns.sql');
const pricing=r('ai-video-studio/backend/pricing/verified-quote-pipeline.mjs');

test('staged new chat flow does not change working Production or auto-enable payment',()=>{
 assert.match(config,/quoteConversationPilotEnabled: false/);
 assert.match(config,/aiAnalysisPilotEnabled: true/);
 assert.match(config,/paymentsReady: false/);
 assert.match(config,/aiRenderingReady: false/);
 assert.ok(js.includes("quoteConversationMode=Boolean(config.quoteConversationPilotEnabled"));
});
test('only the original green button is used after saving a brief',()=>{
 assert.ok(js.includes("analysisButton.hidden=true"));
 assert.ok(js.includes("thread.append(analysisPanel)"));
 assert.ok(js.includes("if(quoteConversationMode&&pilotReady()"));
 assert.ok(js.includes("action.textContent='Estimate the cost of your request'"));
 assert.ok(js.includes("analysisConsent.checked"));
 assert.ok(js.includes("analysisConsent.addEventListener('change',showPreviewAction)"));
 assert.ok(html.includes("studio-account.js?v=20261106-quote-chat1"));
 assert.ok(html.includes(".studio-quote-quality-options"));
 assert.ok(html.includes(".studio-actions .action.is-estimating::before"));
});
test('three tiers and AI consent are inside chat, not a detached panel',()=>{
 for(const label of ['Normal','Semi-professional','Professional'])assert.ok(js.includes(label));
 assert.ok(js.includes("radio.type='radio'"));
 assert.ok(js.includes("analysisQuality.value=value"));
 assert.ok(js.includes("analysisPanel.className='studio-thread-line from-system studio-quote-chat'"));
 assert.ok(js.includes("tierChoices.hidden=Boolean(currentQuoteAnalysisId)"));
});
test('quote browser flow never presents internal AI methods or token cost',()=>{
 assert.ok(js.includes("if(quoteConversationMode)return; // AI tokens/method/cost"));
 assert.ok(js.includes("const columns=quoteConversationMode?'id,status,error_code'"));
 assert.ok(js.includes("await showCustomerQuote(projectId,jobId)"));
 assert.ok(js.includes(".from('studio_quotes')"));
 assert.ok(js.includes(".eq('analysis_job_id',jobId)"));
 assert.ok(js.includes(".eq('quality',analysisQuality.value)"));
 assert.ok(js.includes("q.currency==='USD'"));
 assert.ok(js.includes("Number.isSafeInteger(q.amount_minor)"));
 assert.ok(!pricing.includes('window.'));
});
test('no fake payment button, links or charge exists before checkout integration',()=>{
 assert.ok(js.includes("action.textContent=config.paymentsReady?"));
 assert.ok(js.includes("action.disabled=true;"));
 assert.ok(js.includes("No checkout sessions are implemented"));
 assert.ok(!js.includes('stripe.com/checkout'));
 assert.ok(!html.includes('href="https://checkout.stripe.com/'));
});
test('SQL stage limits browser access to public columns; cost, tokens and AI plan are private',()=>{
 for(const s of [
 'revoke select on public.studio_ai_analysis_jobs from authenticated',
 'grant select(id,project_id,quality,status,error_code,created_at,completed_at)',
 'analysis_job_id uuid','grant select(id,project_id,status,currency,amount_minor',
 'from public.studio_quotes to authenticated'
 ])assert.ok(sql.includes(s),s);
 assert.ok(!sql.includes('grant select(analysis,input_tokens'));
 assert.ok(!sql.includes('grant update'));
});

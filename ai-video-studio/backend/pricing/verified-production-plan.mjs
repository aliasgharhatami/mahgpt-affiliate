/**
 * Server-only conversion of a completed Luna classification into a priced,
 * auditable production plan. NEVER import into customer JavaScript.
 *
 * A free tool is only assigned a $0 marginal rate by an explicitly approved
 * server rate-card. A classification by itself is NOT evidence of capability.
 */
const TIERS=new Set(['normal','semi_professional','professional']);
const COMPLEXITY=new Set(['simple','moderate','advanced','specialist_3d']);
const APPROACH=new Set(['ffmpeg_text_motion','template_motion_graphics',
  'custom_2d_animation','specialist_3d','generative_media_required']);
const MODELS=['gpt-6-luna','gpt-6.1-terra','gpt-6.1-sol','gpt-6-astra'];
const safeInt=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function buildVerifiedProductionPlan(job,capabilities,context={}){
  if(!plain(job)||job.status!=='completed'||!TIERS.has(job.quality)||
      !plain(job.analysis)||!plain(capabilities))return null;
  const a=job.analysis;
  if(!COMPLEXITY.has(a.complexity)||!APPROACH.has(a.productionApproach)||
      !safeInt(a.estimatedDurationSeconds,600)||
      a.estimatedDurationSeconds<1||
      typeof a.needsReview!=='boolean'||typeof a.needsVoiceover!=='boolean'||
      a.needsReview||!safeInt(job.input_tokens,4000)||
      !safeInt(job.output_tokens,900))return null;

  // All current commercial quote eligibility is explicitly text-only.
  // External footage, uploaded media, template references, licensing and
  // AI-generated assets must go through a separately audited capability.
  if(context.hasAssets||context.hasReference||context.hasStyle)return null;
  const capability=capabilities[job.quality]?.[a.productionApproach];
  if(!plain(capability)||capability.verified!==true||
      capability.assetPolicy!=='text_only'||capability.needsReview===true||
      !Array.isArray(capability.complexities)||
      !capability.complexities.includes(a.complexity)||
      !safeInt(capability.maxSeconds,600)||capability.maxSeconds<1||
      a.estimatedDurationSeconds>capability.maxSeconds||
      (a.needsVoiceover&&!capability.verifiedVoiceover))return null;
  if(!Array.isArray(capability.plannedModelCalls)||
      capability.plannedModelCalls.length>12)return null;
  if(!safeInt(capability.storageUnits,1000000)||
      !safeInt(capability.downloadUnits,1000000))return null;
  const operations=[{
    type:'model',model:'gpt-6-luna',
    inputTokens:job.input_tokens,outputTokens:job.output_tokens
  }];
  for(const step of capability.plannedModelCalls){
    if(!plain(step)||!MODELS.includes(step.model)||
        !safeInt(step.inputTokens,1000000)||
        !safeInt(step.outputTokens,1000000))return null;
    operations.push({type:'model',model:step.model,
      inputTokens:step.inputTokens,outputTokens:step.outputTokens});
  }
  // Explicit resources/rates are required even when the founder has
  // verified a zero-marginal-cost Oracle Free Tier allocation.
  operations.push({type:'render',units:a.estimatedDurationSeconds});
  operations.push({type:'storage',units:capability.storageUnits});
  operations.push({type:'download',units:capability.downloadUnits});
  if(a.needsVoiceover){
    if(!safeInt(capability.voiceoverUnits,1000000)||
        capability.voiceoverUnits<1)return null;
    operations.push({type:'audio_generation',units:capability.voiceoverUnits});
  }
  return {operations,quality:job.quality,
    capabilityRevision:typeof capability.revision==='string'?
      capability.revision.slice(0,80):'',
    durationSeconds:a.estimatedDurationSeconds};
}

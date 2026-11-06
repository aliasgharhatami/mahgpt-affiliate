/** MAH GPT Studio · server-only estimate release gate.
 *
 * The AI classifier never sets the sale price; user quality selection never
 * sets a rate or authorizes production. A quote requires an auditable, backed
 * production plan plus measured internal rates for EVERY operation.
 * Never import this module into client JS.
 */
import {calculateStudioQuote} from './quote-engine.mjs';

const TIERS=new Set(['normal','semi_professional','professional']);
const COMPLEXITIES=new Set(['simple','moderate','advanced','specialist_3d']);
const METHODS=new Set(['ffmpeg_text_motion','template_motion_graphics',
 'custom_2d_animation','specialist_3d','generative_media_required']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const status=(reason)=>Object.freeze({status:'manual_review_required',reason,publicQuote:null});

/**
 * Evidence for each required source asset must be reviewed on the server:
 * rights, commercial-use license, and cost allowance for this specific order.
 * Generated media cost is a separate operation; no free stock assumption.
 */
export function calculateVerifiedStudioOffer({
 projectId,quality,analysis,verifiedPlan,rateCard,
 productionEnabled=false,commercialTermsApproved=false
}={}){
 if(!uuid.test(projectId||''))throw Error('Owned project identifier required');
 if(!TIERS.has(quality)||!analysis||!COMPLEXITIES.has(analysis.complexity)||
   !METHODS.has(analysis.productionApproach))
  throw Error('Validated analysis and quality tier required');
 if(!Number.isSafeInteger(analysis.estimatedDurationSeconds)||
   analysis.estimatedDurationSeconds<1||analysis.estimatedDurationSeconds>600)
  throw Error('Invalid analyzed duration');
 if(!commercialTermsApproved||!productionEnabled)
  return status('The requested production workflow is not commercially available yet');
 if(analysis.needsReview||analysis.complexity==='specialist_3d'||
    analysis.productionApproach==='specialist_3d')
  return status('Production feasibility needs a human review');
 if(!verifiedPlan||verifiedPlan.reviewed!==true||
    verifiedPlan.projectId!==projectId||
    verifiedPlan.quality!==quality||
    verifiedPlan.durationSeconds!==analysis.estimatedDurationSeconds||
    verifiedPlan.method!==analysis.productionApproach||
    verifiedPlan.availableInCloud!==true)
  return status('No verified executable production plan matches this request');
 if(!Array.isArray(verifiedPlan.operations)||!verifiedPlan.operations.length)
  return status('Required production operations have not been measured');
 if(!Array.isArray(verifiedPlan.mediaSources)||
    !Array.isArray(verifiedPlan.requiredMediaSourceIds))
  return status('Source-media and licensing evidence is missing');
 if((analysis.productionApproach==='template_motion_graphics'||
     analysis.productionApproach==='generative_media_required')&&
     verifiedPlan.requiredMediaSourceIds.length<1)
  return status('Required media sources have not been inventoried');
 if(verifiedPlan.requiredMediaSourceIds.some(id=>
     typeof id!=='string'||!verifiedPlan.mediaSources.some(s=>s?.sourceId===id)))
  return status('Production plan has media sources without cost or rights evidence');
 if(verifiedPlan.mediaSources.some(s=>!s||s.commercialRightsVerified!==true||
     s.costCoveredByOperations!==true||typeof s.sourceId!=='string'||
     !s.sourceId.trim()))
  return status('Media license or sourcing cost is not verified');
 if(!rateCard?.version||!rateCard.models||!rateCard.operations||
   !rateCard.business)
  return status('Audited supplier rates or business margin settings are missing');

 try{
  const internal=calculateStudioQuote({
    operations:verifiedPlan.operations
  },rateCard);
  // A versioned, reviewed server price; never the model's guessed number.
  const cents=Math.round(internal.customerPriceUSD*100);
  if(!Number.isSafeInteger(cents)||cents<100||cents>1000000)
   return status('Selling-price safety bounds were not satisfied');
  return Object.freeze({
   status:'quote_ready',
   publicQuote:Object.freeze({
    projectId,currency:'USD',amountMinor:cents,quality,
    // Not a payment request until an audited payment session exists.
    payable:false,checkoutUrl:null
   }),
   internalAudit:Object.freeze({
    vendorCostUSD:internal.costUSD,
    coveredCostsUSD:internal.coveredCostsUSD,
    rateCardVersion:internal.rateCardVersion,
    operations:internal.operations
   })
  });
 }catch(err){
  // No internal rate data, exception details or supplier names to client.
  return status('One or more production cost items are not yet measured');
 }
}

/**
 * MAH GPT Studio · audited, cost-aware AI director routing.
 *
 * SERVER SIDE ONLY. A user's quality choice is a constraint, never an API
 * model name, dollar amount or grant of access. Price/rates must come from
 * rateCard loaded on the trusted backend, not from any browser payload.
 *
 * This is a decision aid, NOT a model execution or payment integration.
 * Complexity must eventually be assessed by a validated AI planning pass
 * (not guessed from natural-language keywords). A 3D plan requires real 3D
 * rendering capabilities and measured infrastructure rates separately.
 */
const TIER_RULES=Object.freeze({
  normal:Object.freeze({label:'Normal',minimumRank:1,maxComplexity:2,reviewPasses:1}),
  semi_professional:Object.freeze({label:'Semi-professional',minimumRank:2,maxComplexity:3,reviewPasses:2}),
  professional:Object.freeze({label:'Professional',minimumRank:3,maxComplexity:4,reviewPasses:3})
});
const COMPLEXITY_RANK=Object.freeze({
  simple:1,moderate:2,advanced:3,specialist_3d:4
});
export const STUDIO_QUALITY_TIERS=TIER_RULES;

/**
 * Only vetted models are candidates; a future model needs explicit capability
 * review, enablement, documented availability and a trusted price entry.
 * Capability rank refers to PLANNING/CODING, not direct pixel generation.
 */
export const STUDIO_DIRECTOR_CATALOG=Object.freeze([
  Object.freeze({id:'gpt-6-luna',capabilityRank:1,enabled:true}),
  Object.freeze({id:'gpt-6.1-terra',capabilityRank:2,enabled:true}),
  Object.freeze({id:'gpt-6.1-sol',capabilityRank:3,enabled:true}),
  Object.freeze({id:'gpt-6-astra',capabilityRank:4,enabled:true})
]);

function safeTokens(value,name){
  if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid '+name);
  return value;
}
function measuredRate(value,name){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)
    throw new Error('Missing or unsafe rate: '+name);
  return value;
}
function verifiedCatalogEntry(value){
  return Boolean(value&&typeof value.id==='string'&&
    /^[a-z0-9][a-z0-9.-]{2,80}$/.test(value.id)&&
    Number.isSafeInteger(value.capabilityRank)&&
    value.capabilityRank>=1&&value.capabilityRank<=4&&
    value.enabled===true);
}

export function selectStudioDirector({
  quality,complexity,rateCard,catalog=STUDIO_DIRECTOR_CATALOG,
  estimatedInputTokens,estimatedOutputTokens,cloud3dReady=false
}={}){
  const tier=TIER_RULES[quality];
  const rank=COMPLEXITY_RANK[complexity];
  if(!tier||!rank)throw new Error('Quality and validated complexity are required');
  const inTokens=safeTokens(estimatedInputTokens,'estimatedInputTokens');
  const outTokens=safeTokens(estimatedOutputTokens,'estimatedOutputTokens');
  if(!inTokens&&!outTokens)throw new Error('A measured token usage forecast is required');
  if(!rateCard?.models||!rateCard?.version)
    throw new Error('A versioned server rate card is required');
  if(!Array.isArray(catalog)||catalog.length<1||catalog.length>30)
    throw new Error('A vetted server model catalog is required');

  if(rank>tier.maxComplexity)return Object.freeze({
    status:'upgrade_required',quality,complexity,
    requiredTier:rank===4?'professional':'semi_professional',
    reason:'The requested production complexity exceeds this quality tier'
  });
  if(complexity==='specialist_3d'&&!cloud3dReady)return Object.freeze({
    status:'capability_unavailable',quality,complexity,
    reason:'Actual 3D production and its rendering costs are not yet verified'
  });

  const requiredRank=Math.max(rank,tier.minimumRank);
  const candidates=[];
  const seen=new Set();
  for(const c of catalog){
    if(!verifiedCatalogEntry(c)||seen.has(c.id))continue;
    seen.add(c.id);
    if(c.capabilityRank<requiredRank)continue;
    const rates=rateCard.models[c.id];
    if(!rates)continue; // Unknown prices MUST NOT be assumed to be zero.
    const inputRate=measuredRate(rates.inputUSDPerMTok,c.id+' input');
    const outputRate=measuredRate(rates.outputUSDPerMTok,c.id+' output');
    candidates.push({
      id:c.id,capabilityRank:c.capabilityRank,
      estimatedDirectorCostUSD:(inTokens*inputRate+outTokens*outputRate)/1e6
    });
  }
  if(!candidates.length)return Object.freeze({
    status:'model_unavailable',quality,complexity,
    reason:'No enabled, audited and priced planning model meets the requirement'
  });
  // Prefer the cheapest qualified model for THIS expected input/output mix.
  candidates.sort((a,b)=>a.estimatedDirectorCostUSD-b.estimatedDirectorCostUSD||
    a.capabilityRank-b.capabilityRank||a.id.localeCompare(b.id));
  const chosen=candidates[0];
  return Object.freeze({
    status:'ready',quality,complexity,
    modelId:chosen.id,
    capabilityRank:chosen.capabilityRank,
    reviewPasses:tier.reviewPasses,
    estimatedDirectorCostUSD:Number(chosen.estimatedDirectorCostUSD.toFixed(8)),
    rateCardVersion:String(rateCard.version),
    // This is only the AI director cost. Never treat it as a sellable quote.
    customerPriceUSD:null,payable:false
  });
}

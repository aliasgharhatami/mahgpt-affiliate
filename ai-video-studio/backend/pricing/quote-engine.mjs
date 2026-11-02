/**
 * MAH GPT Studio · server-side quote calculator.
 * Prepared but NOT connected to the public site. Requires a trusted server.
 * Rates MUST be loaded from server-controlled configuration, never the user's request.
 * If an operation has no trusted measured rate, no numeric quote is returned.
 */
export function calculateStudioQuote(plan, rateCard) {
  if (!plan || !Array.isArray(plan.operations) || !plan.operations.length) {
    throw new Error('A validated operation plan is required');
  }
  if (!rateCard || !rateCard.models || !rateCard.operations || !rateCard.business) {
    throw new Error('Server-controlled rate card is missing');
  }

  const money = (n, name) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
      throw new Error('Invalid or missing rate: ' + name);
    }
    return n;
  };
  const units = (n, name) => {
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new Error('Invalid or missing usage: ' + name);
    }
    return n;
  };

  let costUSD = 0;
  const breakdown = [];
  for (const [index, op] of plan.operations.entries()) {
    if (!op || !['model', 'render', 'storage', 'download', 'image_generation', 'video_generation', 'audio_generation', 'other'].includes(op.type)) {
      throw new Error('Unsupported operation at ' + index);
    }
    let subtotal;
    if (op.type === 'model') {
      const price = rateCard.models[op.model];
      if (!price) throw new Error('Unknown or unpriced model: ' + String(op.model));
      const inTokens = units(op.inputTokens, 'inputTokens');
      const outTokens = units(op.outputTokens, 'outputTokens');
      subtotal =
        (inTokens * money(price.inputUSDPerMTok, 'model input') +
         outTokens * money(price.outputUSDPerMTok, 'model output')) / 1000000;
    } else {
      const rate = rateCard.operations[op.type];
      if (typeof rate === 'undefined' || rate === null) {
        throw new Error('No measured rate for ' + op.type);
      }
      subtotal = units(op.units, 'operation units') *
        money(rate, op.type);
    }
    costUSD += subtotal;
    breakdown.push({type: op.type, costUSD: Number(subtotal.toFixed(6))});
  }

  const config = rateCard.business;
  const reserveFraction = money(config.reserveFraction, 'reserveFraction');
  const targetMargin = money(config.targetGrossMargin, 'targetGrossMargin');
  const processorRate = money(config.paymentFeeFraction, 'paymentFeeFraction');
  const processorFixed = money(config.paymentFeeFixedUSD, 'paymentFeeFixedUSD');
  const overheadUSD = money(config.overheadUSDPerOrder, 'overheadUSDPerOrder');
  const minimum = money(config.minimumSaleUSD, 'minimumSaleUSD');

  if (reserveFraction > 1 || targetMargin >= 1 || processorRate >= 1 ||
      targetMargin + processorRate >= 1) {
    throw new Error('Unsafe quote economics');
  }

  const coveredCosts = costUSD * (1 + reserveFraction) + overheadUSD;
  // Selling price P satisfies:
  // P - paymentFeeFraction*P - paymentFeeFixed - coveredCosts = targetMargin*P
  const rawSale = (coveredCosts + processorFixed) / (1 - targetMargin - processorRate);
  const priceUSD = Math.ceil(Math.max(rawSale, minimum) * 100) / 100;

  if (!Number.isFinite(priceUSD) || priceUSD <= 0) throw new Error('Invalid calculated price');
  return {
    currency: 'USD',
    costUSD: Number(costUSD.toFixed(6)),
    coveredCostsUSD: Number(coveredCosts.toFixed(6)),
    customerPriceUSD: priceUSD,
    operations: breakdown,
    rateCardVersion: String(rateCard.version || ''),
    // This does not create a payable invoice; client and server
    // must enforce caps, quote expiration and payment confirmation.
    payable: false
  };
}

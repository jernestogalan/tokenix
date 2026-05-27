/**
 * Tokenia — src/lib/pricing.js
 *
 * Core cost calculation functions.
 *
 *  calculateCost({ inputTokens, outputTokensEstimate, modelId, modelConfig })
 *  calculateSavings({ originalTokens, cleanedTokens, retrievedTokens, modelId, modelConfig })
 *  buildSavingsMessage({ originalCost, bestOptimizedCost, savingsPercent })
 */
'use strict';

const MODELS = require('../config/models');

/**
 * Look up a model config by "provider:modelId" or just "modelId".
 * Returns { provider, modelId, config } or null.
 */
function resolveModel(modelKey) {
  // Try "provider:modelId" format first
  if (modelKey && modelKey.includes(':')) {
    const [provider, id] = modelKey.split(':', 2);
    if (MODELS[provider] && MODELS[provider].models[id]) {
      return { provider, modelId: id, config: MODELS[provider].models[id], providerConfig: MODELS[provider] };
    }
  }

  // Scan all providers for matching model id
  for (const [provider, providerConfig] of Object.entries(MODELS)) {
    if (providerConfig.models && providerConfig.models[modelKey]) {
      return { provider, modelId: modelKey, config: providerConfig.models[modelKey], providerConfig };
    }
  }

  return null;
}

/**
 * Calculate input+output cost for a single model.
 *
 * @param {object} opts
 * @param {number} opts.inputTokens
 * @param {number} [opts.outputTokensEstimate=0]  - if 0, only input is costed
 * @param {string} opts.modelKey                  - "provider:modelId" or "modelId"
 * @returns {object} { inputCost, outputCost, totalCost, currency, precision, disclaimer, modelName }
 */
function calculateCost({ inputTokens, outputTokensEstimate = 0, modelKey }) {
  if (!modelKey) return null;

  const resolved = resolveModel(modelKey);
  if (!resolved) return null;

  const { config, providerConfig } = resolved;
  const inputPer1M  = config.inputPer1M  || config.inputPerMillion  || 0;
  const outputPer1M = config.outputPer1M || config.outputPerMillion || 0;

  const inputCost  = (inputTokens / 1_000_000) * inputPer1M;
  const outputCost = (outputTokensEstimate / 1_000_000) * outputPer1M;
  const totalCost  = inputCost + outputCost;

  const tokenizer  = providerConfig.tokenizer || 'estimated';
  const precision  = tokenizer === 'exact' ? 'exact' : 'estimated';

  const disclaimer = precision === 'estimated'
    ? `${providerConfig.tokenizerNote || 'Token count is an approximation.'} Cost is an estimate.`
    : 'Token count uses the official tokenizer. Cost calculated from public pricing.';

  return {
    inputCost:      +inputCost.toFixed(6),
    outputCost:     +outputCost.toFixed(6),
    totalCost:      +totalCost.toFixed(6),
    inputPer1M,
    outputPer1M,
    currency:       'USD',
    precision,
    disclaimer,
    modelName:      config.name || config.displayName || modelKey,
    contextWindow:  config.contextWindow,
  };
}

/**
 * Calculate cost savings from cleaning and/or retrieval.
 *
 * @param {object} opts
 * @param {number}  opts.originalTokens
 * @param {number}  [opts.cleanedTokens]    - omit if cleaning not done
 * @param {number}  [opts.retrievedTokens]  - omit if retrieval not done
 * @param {string}  opts.modelKey
 * @returns {object} savings breakdown
 */
function calculateSavings({ originalTokens, cleanedTokens, retrievedTokens, modelKey }) {
  const resolved = resolveModel(modelKey);
  if (!resolved) return null;

  const { config, providerConfig } = resolved;
  const inputPer1M = config.inputPer1M || config.inputPerMillion || 0;

  const originalCost  = (originalTokens  / 1_000_000) * inputPer1M;
  const cleanedCost   = cleanedTokens  != null ? (cleanedTokens  / 1_000_000) * inputPer1M : null;
  const retrievedCost = retrievedTokens != null ? (retrievedTokens / 1_000_000) * inputPer1M : null;

  // Best optimized = lowest of cleaned / retrieved / combined
  const candidates = [cleanedCost, retrievedCost].filter(v => v != null);
  const bestOptimizedCost = candidates.length ? Math.min(...candidates) : originalCost;
  const bestOptimizedTokens = bestOptimizedCost === retrievedCost
    ? retrievedTokens
    : (bestOptimizedCost === cleanedCost ? cleanedTokens : originalTokens);

  const savingsAmount  = originalCost - bestOptimizedCost;
  const savingsPercent = originalCost > 0
    ? Math.round(((savingsAmount / originalCost) * 100) * 10) / 10
    : 0;

  const precision = (providerConfig.tokenizer || 'estimated') === 'exact' ? 'exact' : 'estimated';

  return {
    originalTokens,
    cleanedTokens:      cleanedTokens  ?? null,
    retrievedTokens:    retrievedTokens ?? null,
    bestOptimizedTokens,
    originalCost:       +originalCost.toFixed(6),
    cleanedCost:        cleanedCost != null  ? +cleanedCost.toFixed(6)   : null,
    retrievedCost:      retrievedCost != null ? +retrievedCost.toFixed(6) : null,
    bestOptimizedCost:  +bestOptimizedCost.toFixed(6),
    savingsAmount:      +savingsAmount.toFixed(6),
    savingsPercent,
    currency:           'USD',
    precision,
    inputPer1M,
    modelName:          config.name || modelKey,
    message:            buildSavingsMessage({ originalCost, bestOptimizedCost, savingsPercent }),
  };
}

/**
 * Build the flagship savings message.
 * e.g. "This full document would cost $8.40 to process. Using cleaning + relevant
 *       chunks, you could send it for $1.25. Estimated savings: 85.1%."
 */
function buildSavingsMessage({ originalCost, bestOptimizedCost, savingsPercent }) {
  const fmt = n => n < 0.01 ? `$${(n * 100).toFixed(4)}¢` : `$${n.toFixed(4)}`;
  const orig = fmt(originalCost);
  const opt  = fmt(bestOptimizedCost);

  if (savingsPercent <= 0) {
    return `This document would cost ${orig} to process with the selected model.`;
  }

  return `This full document would cost ${orig} to process. Using cleaning + relevant chunks, you could send it for ${opt}. Estimated savings: ${savingsPercent}%.`;
}

/**
 * Format a dollar amount for display (rounds to 4 sig figs).
 */
function formatCost(amount) {
  if (amount === 0) return '$0.0000';
  if (amount < 0.0001) return `<$0.0001`;
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(4)}`;
}

module.exports = { resolveModel, calculateCost, calculateSavings, buildSavingsMessage, formatCost };

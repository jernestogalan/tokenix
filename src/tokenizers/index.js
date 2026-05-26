'use strict';
/**
 * Tokenix - tokenizers/index.js
 *
 * OpenAI models: exact token count via gpt-tokenizer (pure-JS tiktoken port).
 * All others:    calibrated character/word heuristic, clearly labelled "estimated".
 *
 * gpt-tokenizer CJS paths are used explicitly so this works on Node 18-22
 * regardless of how the runtime resolves ESM vs CJS conditional exports.
 */
const path   = require('path');
const MODELS = require('../config/models');

// ── Lazy-load encoders once, cache for the lifetime of the process ────────────
let encoders = null;
let gptOk    = null;

function loadEncoders() {
  if (gptOk !== null) return;
  try {
    // Use explicit CJS entry points — safe on Node 18/20/22
    const base = path.dirname(require.resolve('gpt-tokenizer/package.json'));
    encoders = {
      cl100k: require(path.join(base, 'cjs', 'main.js')),
      o200k:  require(path.join(base, 'cjs', 'encoding', 'o200k_base.js')),
    };
    gptOk = true;
    console.log('  [tokenix] gpt-tokenizer loaded — OpenAI counts are exact');
  } catch (e) {
    gptOk = false;
    console.warn('  [tokenix] gpt-tokenizer not found — OpenAI counts will also be estimated.');
    console.warn('            Run "npm install" to fix this.');
  }
}

function countExact(text, encoding) {
  loadEncoders();
  if (!gptOk) return null;
  try {
    const enc = (encoding === 'o200k_base') ? encoders.o200k : encoders.cl100k;
    return enc.encode(text).length;
  } catch (e) {
    return null;
  }
}

// ── Heuristic estimation (non-OpenAI, or OpenAI fallback) ─────────────────────
// Blends character-density and word-density estimates.
// Ratio tuned per model family (chars per token, English prose):
//   Anthropic BPE   ~3.8  |  Google SentencePiece ~4.0
//   Meta BPE        ~3.9  |  Mistral SentencePiece ~4.0
// Code is denser (~20% more tokens per char) — detected by special-char ratio.
function estimateTokens(text, provider) {
  if (!text || text.length === 0) return 0;
  const chars  = text.length;
  const words  = text.split(/\s+/).filter(Boolean).length;
  const specials = (text.match(/[{}()[\]<>:;=+\-*\/\\|&^%$#@!~`]/g) || []).length;
  const isCode   = specials / chars > 0.08;
  const ratioMap = {
    anthropic: isCode ? 3.1 : 3.8,
    google:    isCode ? 3.4 : 4.0,
    meta:      isCode ? 3.2 : 3.9,
    mistral:   isCode ? 3.3 : 4.0,
  };
  const ratio = ratioMap[provider] || 3.8;
  return Math.ceil(((chars / ratio) + (words * 1.3)) / 2);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function tokenizeAll(text) {
  const results = [];
  for (const [providerKey, provider] of Object.entries(MODELS)) {
    for (const [modelKey, model] of Object.entries(provider.models)) {
      let tokenCount, isExact;

      if (provider.tokenizer === 'exact' && model.encoding) {
        const exact = countExact(text, model.encoding);
        if (exact !== null) {
          tokenCount = exact; isExact = true;
        } else {
          // Fallback if gpt-tokenizer unavailable
          tokenCount = Math.ceil(text.length / 4.0); isExact = false;
        }
      } else {
        tokenCount = estimateTokens(text, providerKey); isExact = false;
      }

      const inputCost  = (tokenCount / 1e6) * model.inputPer1M;
      const outputCost = (tokenCount / 1e6) * model.outputPer1M;
      const contextPct = (tokenCount / model.contextWindow) * 100;

      results.push({
        provider: providerKey, providerName: provider.name, providerColor: provider.color,
        model: modelKey,       modelName: model.name,
        tokens: tokenCount,    exact: isExact,
        inputCost,             outputCost,
        inputPer1M:    model.inputPer1M,
        outputPer1M:   model.outputPer1M,
        contextWindow: model.contextWindow,
        contextPct:    Math.min(contextPct, 200),
        fitsContext:   tokenCount <= model.contextWindow,
        note:          model.note || null,
        tokenizerNote: provider.tokenizerNote,
      });
    }
  }
  return results;
}

module.exports = { tokenizeAll };

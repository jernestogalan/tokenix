'use strict';
/**
 * Tokenix - tokenizers/deepseek.js
 *
 * EXACT DeepSeek token counting using the real DeepSeek-V3 tokenizer (128k BPE),
 * same "exact, not estimated" tier as tiktoken gives us for OpenAI.
 *
 * Covers the current API models: deepseek-chat and deepseek-reasoner (V3 family).
 * Legacy DeepSeek V1/V2 used a different ~100k tokenizer — not this file.
 *
 * Assets (server-side only, never served over HTTP):
 *   src/tokenizers/models/deepseek/tokenizer.json        (~7.5 MB)
 *   src/tokenizers/models/deepseek/tokenizer_config.json (few KB)
 *
 * @huggingface/transformers is loaded via dynamic import() (it's ESM-only),
 * lazily and memoized — the ~MB runtime never loads unless DeepSeek is counted.
 * If anything fails (missing dep, missing files), countDeepSeekTokens resolves
 * to null and the caller falls back to the heuristic estimate — mirrors the
 * gptOk/countExact fallback pattern used for OpenAI in index.js.
 */
const path = require('path');

let _tokenizerPromise = null; // memoized load (cleared on failure so we can retry)
let _failed = false;          // sticky after first failure to avoid log spam

/**
 * Lazily load the DeepSeek tokenizer exactly once (memoized).
 */
function loadDeepSeekTokenizer() {
  if (_tokenizerPromise) return _tokenizerPromise;
  _tokenizerPromise = (async () => {
    const { env, AutoTokenizer } = await import('@huggingface/transformers');
    env.allowRemoteModels = false; // never hit the HF hub; use our local files
    env.localModelPath = path.join(__dirname, 'models'); // -> models/deepseek/tokenizer.json
    const tok = await AutoTokenizer.from_pretrained('deepseek'); // tokenizer-only, no onnx weights
    console.log('  [tokenix] DeepSeek-V3 tokenizer loaded — DeepSeek counts are exact');
    return tok;
  })();
  // if the load fails, don't cache the rejection forever
  _tokenizerPromise.catch(() => { _tokenizerPromise = null; });
  return _tokenizerPromise;
}

/**
 * Exact DeepSeek token count. Async because the tokenizer loads on first use.
 * add_special_tokens:false counts the user's content only — BOS/EOS are added
 * by the API per message, not part of the pasted text (matches the reference).
 *
 * Returns a number, or null if the tokenizer is unavailable (caller falls back
 * to the heuristic estimate).
 */
async function countDeepSeekTokens(text) {
  if (!text) return 0;
  try {
    const tok = await loadDeepSeekTokenizer();
    return tok.encode(text, { add_special_tokens: false }).length;
  } catch (e) {
    if (!_failed) {
      _failed = true;
      console.warn('  [tokenix] DeepSeek tokenizer unavailable — falling back to estimates.');
      console.warn(`            ${e.message}`);
    }
    return null;
  }
}

/**
 * Optional: warm the tokenizer (e.g. at server boot) so the first exact count
 * is instant. Fire-and-forget.
 */
function warmDeepSeekTokenizer() {
  loadDeepSeekTokenizer().catch(() => {});
}

module.exports = { loadDeepSeekTokenizer, countDeepSeekTokens, warmDeepSeekTokenizer };

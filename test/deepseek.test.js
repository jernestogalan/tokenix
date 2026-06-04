'use strict';
/**
 * Tokenix — test/deepseek.test.js
 * Verifies the DeepSeek-V3 exact tokenizer integration.
 *
 * The 7 test vectors were generated with the reference DeepSeek-V3 tokenizer
 * (add_special_tokens: false). If any of them fails, the tokenizer files or
 * the encode options are wrong — do NOT "adjust" the expected numbers.
 *
 * Run with:  node --test test/deepseek.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { countDeepSeekTokens } = require('../src/tokenizers/deepseek');
const { tokenizeAll }         = require('../src/tokenizers');

// ── Reference vectors (DeepSeek-V3 tokenizer, add_special_tokens:false) ───────
const VECTORS = [
  ['The token counter sits between the user and the model.', 11],
  ['El contador de tokens vive entre el usuario y el modelo, y nunca debería afirmar que es exacto.', 24],
  ['function f(x){ return x.map(v => v*2).filter(v => v>0).reduce((a,b)=>a+b,0); }', 31],
  ['{ "provider": "deepseek", "exact": false }', 14],
  ['Mañana, niño: ¿cuántos años tienes? —Veintiún, señor. 🚀', 24],
  ['import torch\nfrom transformers import AutoModel\nmodel = AutoModel.from_pretrained(\'x\')', 20],
  ['Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.', 17],
];

test('countDeepSeekTokens — reproduces all 7 reference vectors exactly', async () => {
  for (const [text, expected] of VECTORS) {
    const got = await countDeepSeekTokens(text);
    assert.equal(
      got, expected,
      `vector mismatch for ${JSON.stringify(text.slice(0, 40))}…: expected ${expected}, got ${got}`
    );
  }
});

test('countDeepSeekTokens — empty input returns 0', async () => {
  assert.equal(await countDeepSeekTokens(''), 0);
});

test('tokenizeAll — DeepSeek models report exact counts', async () => {
  const results  = await tokenizeAll(VECTORS[0][0]);
  const deepseek = results.filter(r => r.provider === 'deepseek');
  assert.ok(deepseek.length > 0, 'should include deepseek models');
  for (const r of deepseek) {
    assert.equal(r.exact, true,          `${r.model} should be exact`);
    assert.equal(r.tokens, VECTORS[0][1], `${r.model} should match the reference count`);
  }
});

test('tokenizeAll — estimate families remain estimated (untouched)', async () => {
  const results = await tokenizeAll(VECTORS[0][0]);
  for (const r of results.filter(x => ['anthropic', 'google', 'meta', 'mistral'].includes(x.provider))) {
    assert.equal(r.exact, false, `${r.provider}:${r.model} must stay exact:false`);
  }
});

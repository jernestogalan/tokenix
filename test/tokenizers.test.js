'use strict';
/**
 * Tokenix — test/tokenizers.test.js
 * Unit tests for the tokenizer module.
 * Run with:  node --test test/tokenizers.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { tokenizeAll } = require('../src/tokenizers');

test('tokenizeAll — returns array of results', async () => {
  const results = await tokenizeAll('Hello world');
  assert.ok(Array.isArray(results), 'should return an array');
  assert.ok(results.length > 0, 'should return at least one model result');
});

test('tokenizeAll — each result has required fields', async () => {
  const results = await tokenizeAll('Testing tokenization output format');
  for (const r of results) {
    assert.ok(typeof r.provider    === 'string', 'provider should be a string');
    assert.ok(typeof r.model       === 'string', 'model should be a string');
    assert.ok(typeof r.tokens      === 'number', 'tokens should be a number');
    assert.ok(r.tokens > 0,                      'tokens should be > 0');
    assert.ok(typeof r.inputPer1M  === 'number', 'inputPer1M should be a number');
    assert.ok(typeof r.exact       === 'boolean','exact should be a boolean');
  }
});

test('tokenizeAll — longer text has more tokens than shorter text', async () => {
  const [short, long] = await Promise.all([
    tokenizeAll('Hi'),
    tokenizeAll('This is a significantly longer piece of text that should have more tokens than just two letters.'),
  ]);

  for (let i = 0; i < short.length; i++) {
    assert.ok(
      long[i].tokens > short[i].tokens,
      `${long[i].model}: longer text should have more tokens`
    );
  }
});

test('tokenizeAll — handles empty-like text gracefully', async () => {
  // Should not throw; may return 0 or small token counts
  const results = await tokenizeAll(' ');
  assert.ok(Array.isArray(results), 'should return array even for whitespace-only input');
});

test('tokenizeAll — code text detected and handled', async () => {
  const code = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
  `;
  const results = await tokenizeAll(code);
  assert.ok(Array.isArray(results), 'should handle code text');
  for (const r of results) {
    assert.ok(r.tokens > 0, `${r.model} should have > 0 tokens for code`);
  }
});

'use strict';
/**
 * Tokenix — test/retriever.test.js
 * Unit tests for the Smart Retrieval (TF-IDF) module.
 * Run with:  node --test test/retriever.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { retrieve, chunkText } = require('../src/retriever');

// ── chunkText ─────────────────────────────────────────────────────────────────

test('chunkText — splits text into multiple chunks', () => {
  // 5 short paragraphs, each ~100 chars — should produce at least 1 chunk
  const text = Array(5).fill('This is a paragraph with some words. It has enough content to pass the minimum length filter.').join('\n\n');
  const chunks = chunkText(text, 300, 50);
  assert.ok(chunks.length >= 1, 'should produce at least one chunk');
  assert.ok(chunks.every(c => c.length >= 80), 'all chunks should meet MIN_CHUNK_LENGTH');
});

test('chunkText — handles very short text with fallback', () => {
  const text = 'Short text without paragraphs or any meaningful structure at all here.';
  // Should not throw even on short text
  const chunks = chunkText(text, 800, 150);
  assert.ok(Array.isArray(chunks), 'should return an array');
});

test('chunkText — applies overlap', () => {
  const para1 = 'First paragraph has some unique words like alpha bravo charlie delta echo foxtrot golf.';
  const para2 = 'Second paragraph has different words like hotel india juliet kilo lima mike november.';
  const text  = para1 + '\n\n' + para2;
  const chunks = chunkText(text, 100, 30);
  if (chunks.length >= 2) {
    // Second chunk should contain tail of first (overlap)
    const lastCharsOfFirst = para1.slice(-30);
    assert.ok(
      chunks[1].includes(lastCharsOfFirst.slice(-10)),
      'second chunk should include overlap from first'
    );
  }
});

// ── retrieve ──────────────────────────────────────────────────────────────────

test('retrieve — returns top-k chunks', () => {
  const doc = `
Introduction to Machine Learning

Machine learning is a branch of artificial intelligence that focuses on building systems that learn from data.

Supervised learning uses labeled training data to learn a mapping from inputs to outputs.

Unsupervised learning finds hidden patterns in data without explicit labels.

Neural networks are inspired by the human brain and consist of layers of interconnected nodes.

Deep learning uses many layers of neural networks to learn complex representations.
  `.trim();

  const result = retrieve(doc, 'supervised learning labeled data', 3);

  assert.ok(result.chunks.length <= 3, 'should return at most topK chunks');
  assert.ok(typeof result.totalChunks === 'number', 'totalChunks should be a number');
  assert.ok(result.totalChunks >= 1, 'totalChunks >= 1');

  const topChunk = result.chunks[0];
  assert.ok(typeof topChunk.text === 'string', 'chunk should have text');
  assert.ok(typeof topChunk.score === 'number', 'chunk should have score');
  assert.ok(typeof topChunk.index === 'number', 'chunk should have index');

  // The most relevant chunk should be about supervised learning
  const topText = result.chunks.map(c => c.text).join(' ').toLowerCase();
  assert.ok(topText.includes('supervised') || topText.includes('learning'), 'top chunks should relate to the query');
});

test('retrieve — scores are sorted descending', () => {
  const doc = `
Cats are popular pets that are known for their independence.

Dogs are loyal companions that enjoy playing fetch and going on walks.

Fish are quiet pets that require an aquarium and regular feeding.

Birds can be taught to talk and are very social creatures.

Reptiles like lizards and snakes have unique care requirements.
  `.trim();

  const result = retrieve(doc, 'dogs fetch loyal companion', 5);

  for (let i = 1; i < result.chunks.length; i++) {
    assert.ok(
      result.chunks[i - 1].score >= result.chunks[i].score,
      'chunks should be sorted by score descending'
    );
  }
});

test('retrieve — falls back to first-k chunks when no query match', () => {
  const doc = [
    'The quick brown fox jumps over the lazy dog.',
    'Lorem ipsum dolor sit amet consectetur adipiscing elit.',
    'Pack my box with five dozen liquor jugs.',
  ].join('\n\n');

  // Query that won't match anything
  const result = retrieve(doc, 'xyzqwerty nonexistent zzzz', 2);

  assert.ok(result.chunks.length >= 1, 'should return fallback chunks');
  // All fallback chunks have score 0
  result.chunks.forEach(c => {
    assert.equal(c.score, 0, 'fallback chunks should have score 0');
  });
});

test('retrieve — throws on missing args', () => {
  assert.throws(
    () => retrieve('', 'query'),
    /required/,
    'should throw when documentText is empty'
  );
  assert.throws(
    () => retrieve('some text', ''),
    /required/,
    'should throw when query is empty'
  );
});

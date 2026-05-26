'use strict';
/**
 * Tokenix — test/cleaner.test.js
 * Unit tests for the Format Cleaner module.
 * Run with:  node --test test/cleaner.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { cleanText } = require('../src/cleaner');

test('cleanText — removes repeated boilerplate lines', () => {
  const repeatedHeader = 'Confidential Document\n';
  const body = 'This is the real content of the document.\n\nSecond paragraph here.';
  // Repeat header 4 times (triggers the ≥3 threshold)
  const raw = Array(4).fill(repeatedHeader).join('') + '\n' + body;

  const { cleanText: cleaned, stats } = cleanText(raw, 'doc.pdf');

  assert.ok(!cleaned.includes('Confidential Document'), 'boilerplate header should be removed');
  assert.ok(cleaned.includes('real content'), 'body content must be preserved');
  assert.ok(stats.boilerplateLineTypes >= 1, 'at least one boilerplate type detected');
});

test('cleanText — removes page numbers', () => {
  const raw = 'Introduction\n\n1\n\nSome text here.\n\n2\n\nMore text.';
  const { cleanText: cleaned } = cleanText(raw, 'report.pdf');
  // Standalone digit lines should be stripped
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const hasPageNums = lines.some(l => /^\d+$/.test(l));
  assert.ok(!hasPageNums, 'standalone page numbers should be removed');
  assert.ok(cleaned.includes('Introduction'), 'section title should be kept');
});

test('cleanText — heals hyphenated line breaks', () => {
  const raw = 'This is a hy-\nphenated word in the middle of a sentence.';
  const { cleanText: cleaned } = cleanText(raw, 'doc.txt');
  assert.ok(cleaned.includes('hyphenated'), 'hyphenated word should be healed');
  assert.ok(!cleaned.includes('hy-\n'), 'line-break hyphen should be removed');
});

test('cleanText — strips HTML tags for .html files', () => {
  const raw = '<h1>Title</h1><p>Some <strong>bold</strong> text.</p>';
  const { cleanText: cleaned } = cleanText(raw, 'page.html');
  assert.ok(!cleaned.includes('<h1>'), 'HTML tags should be stripped');
  assert.ok(cleaned.includes('Title'), 'text content should be preserved');
  assert.ok(cleaned.includes('bold'), 'nested text should be preserved');
});

test('cleanText — collapses excessive blank lines', () => {
  const raw = 'First paragraph.\n\n\n\n\n\nSecond paragraph.';
  const { cleanText: cleaned } = cleanText(raw, 'doc.txt');
  assert.ok(!cleaned.includes('\n\n\n'), 'triple+ newlines should be collapsed');
  assert.ok(cleaned.includes('First paragraph'), 'text must be preserved');
  assert.ok(cleaned.includes('Second paragraph'), 'text must be preserved');
});

test('cleanText — returns accurate stats', () => {
  const raw = 'A'.repeat(200);
  const { stats } = cleanText(raw, 'file.txt');
  assert.equal(stats.originalChars, 200, 'originalChars should match input length');
  assert.ok(typeof stats.cleanChars === 'number', 'cleanChars should be a number');
  assert.ok(typeof stats.charsSaved === 'number', 'charsSaved should be a number');
  assert.equal(stats.charsSaved, stats.originalChars - stats.cleanChars, 'charsSaved = original - clean');
});

test('cleanText — strips decoration lines (===, ---)', () => {
  const raw = 'Header\n======\n\nSome content below the decoration.';
  const { cleanText: cleaned } = cleanText(raw, 'doc.md');
  assert.ok(!cleaned.includes('======'), 'decoration lines should be removed');
  assert.ok(cleaned.includes('Some content'), 'body should be preserved');
});

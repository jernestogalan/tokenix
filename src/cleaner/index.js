'use strict';
/**
 * Tokenix — src/cleaner/index.js
 *
 * Format Cleaner (Pro feature)
 * Removes layout artifacts from extracted text WITHOUT touching semantic content:
 *  - Page numbers and running headers/footers
 *  - Repeated short lines (footer boilerplate detected by frequency)
 *  - Excessive blank lines
 *  - Line-break hyphenation ("hy-\nphen" → "hyphen")
 *  - Carriage returns, zero-width characters, BOM
 *  - Double/triple spaces within lines
 *  - HTML tags (for HTML input)
 *
 * What we do NOT do:
 *  - Remove sentences or paragraphs
 *  - Summarise or paraphrase
 *  - Any operation that could lose meaning
 *
 * Expected savings: 10–40% for PDF/HTML with heavy layout; 5–15% for clean DOCX.
 */

/**
 * Clean extracted text. The `ext` parameter (e.g. ".pdf", ".html") lets us
 * apply source-specific transforms before the shared pipeline.
 *
 * @param {string} rawText   – text as returned by the parser
 * @param {string} filename  – original filename, used to detect extension
 * @returns {{ cleanText: string, stats: object }}
 */
function cleanText(rawText, filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();

  let text = rawText;

  // ── 1. Source-specific pre-cleaning ───────────────────────────────────────

  if (ext === 'html' || ext === 'htm') {
    // Strip HTML tags
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#039;/gi, "'")
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&hellip;/gi, '…');
  }

  // ── 2. Universal cleaning pipeline ───────────────────────────────────────

  // 2a. Normalize line endings and remove carriage returns / BOM / zero-width chars
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/﻿/g, '')                       // BOM
    .replace(/[​‌‍­]/g, ''); // zero-width, soft-hyphen

  // 2b. Heal hyphenated line-breaks ("re-\nsult" → "result")
  //     Only when the word before the hyphen is lowercase (not abbreviations)
  text = text.replace(/([a-z])-\n([a-z])/g, '$1$2');

  // 2c. Detect and remove repeated boilerplate lines
  //     A line that appears ≥3 times in the document and is short (<120 chars)
  //     is almost certainly a running header/footer.
  const lineFreq = {};
  text.split('\n').forEach(ln => {
    const key = ln.trim();
    if (key.length > 2 && key.length < 120) {
      lineFreq[key] = (lineFreq[key] || 0) + 1;
    }
  });
  const boilerplate = new Set(
    Object.entries(lineFreq)
      .filter(([, count]) => count >= 3)
      .map(([line]) => line)
  );

  // 2d. Page-number patterns
  const pageNumRe = /^[\s•\-–—]*(?:page\s+)?(?:\d+\s*(?:of\s*\d+)?|\d+)\s*[\s•\-–—]*$/i;

  // 2e. Process line by line
  const lines = text.split('\n');
  const cleaned = [];
  for (const line of lines) {
    const trimmed = line.trim();

    // Drop boilerplate lines
    if (boilerplate.has(trimmed)) continue;

    // Drop page numbers
    if (pageNumRe.test(trimmed)) continue;

    // Drop lines that are purely decoration (e.g. "─────────" or "=====")
    if (/^[\-=_*#~]{4,}\s*$/.test(trimmed)) continue;

    // Collapse multiple spaces within the line (but preserve indentation? No — keep flat)
    cleaned.push(line.replace(/[^\S\n]{2,}/g, ' ').trimEnd());
  }

  // 2f. Collapse runs of more than 2 consecutive blank lines to a single blank line
  text = cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  // 2g. Trim leading/trailing whitespace
  text = text.trim();

  // ── 3. Compute stats ──────────────────────────────────────────────────────
  const originalLines = rawText.split('\n').length;
  const cleanLines    = text.split('\n').length;
  const originalChars = rawText.length;
  const cleanChars    = text.length;

  return {
    cleanText: text,
    stats: {
      originalChars,
      cleanChars,
      charsSaved: originalChars - cleanChars,
      // boilerplate lines found (informational)
      boilerplateLineTypes: boilerplate.size,
    },
  };
}

module.exports = { cleanText };

/**
 * Tokenia — src/lib/reports.js
 *
 * CSV report generation.
 * PDF export scaffold (requires additional library in production).
 */
'use strict';

/**
 * Escape a CSV cell value.
 */
function csvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to a CSV string.
 * @param {object[]} rows
 * @param {string[]} [columns]  - column order; defaults to Object.keys(rows[0])
 */
function toCsv(rows, columns) {
  if (!rows || rows.length === 0) return '';
  const cols = columns || Object.keys(rows[0]);
  const header = cols.map(csvCell).join(',');
  const body = rows.map(row => cols.map(c => csvCell(row[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/**
 * Build a token analysis report from a tokenize/clean/retrieve result.
 *
 * @param {object} opts
 * @param {string}   opts.filename
 * @param {string}   opts.modelId
 * @param {number}   opts.originalTokens
 * @param {number}   [opts.cleanedTokens]
 * @param {number}   [opts.retrievedTokens]
 * @param {number}   opts.originalCost
 * @param {number}   [opts.cleanedCost]
 * @param {number}   [opts.retrievedCost]
 * @param {number}   opts.savingsPercent
 * @param {string}   opts.precision
 * @returns {{ csv: string, rows: object[] }}
 */
function buildReport(opts) {
  const {
    filename, modelId,
    originalTokens, cleanedTokens, retrievedTokens,
    originalCost, cleanedCost, retrievedCost,
    savingsPercent, precision,
  } = opts;

  const fmt = n => (n != null ? `$${Number(n).toFixed(6)}` : 'N/A');

  const rows = [{
    timestamp:       new Date().toISOString(),
    filename:        filename || 'pasted text',
    model:           modelId  || 'N/A',
    originalTokens:  originalTokens  ?? 'N/A',
    cleanedTokens:   cleanedTokens   ?? 'N/A',
    retrievedTokens: retrievedTokens ?? 'N/A',
    originalCost:    fmt(originalCost),
    cleanedCost:     fmt(cleanedCost),
    retrievedCost:   fmt(retrievedCost),
    savingsPercent:  savingsPercent != null ? `${savingsPercent}%` : 'N/A',
    precision,
  }];

  const columns = [
    'timestamp', 'filename', 'model',
    'originalTokens', 'cleanedTokens', 'retrievedTokens',
    'originalCost', 'cleanedCost', 'retrievedCost',
    'savingsPercent', 'precision',
  ];

  return { csv: toCsv(rows, columns), rows };
}

/**
 * Build a multi-row comparison report (one row per model).
 * @param {object} opts
 * @param {string} opts.filename
 * @param {object[]} opts.comparisons  - array of per-model stats
 */
function buildComparisonReport(opts) {
  const { filename, comparisons } = opts;

  const rows = comparisons.map(c => ({
    timestamp:       new Date().toISOString(),
    filename:        filename || 'pasted text',
    provider:        c.providerName || c.provider || '',
    model:           c.modelName || c.model || '',
    originalTokens:  c.originalTokens ?? c.fullTokens ?? 'N/A',
    cleanedTokens:   c.cleanedTokens  ?? c.cleanTokens ?? 'N/A',
    retrievedTokens: c.retrievedTokens ?? 'N/A',
    tokensSaved:     c.tokensSaved ?? 'N/A',
    savingsPct:      c.pctSaved != null ? `${c.pctSaved}%` : 'N/A',
    moneySaved:      c.moneySaved != null ? `$${Number(c.moneySaved).toFixed(6)}` : 'N/A',
    precision:       c.exact ? 'exact' : 'estimated',
  }));

  const columns = [
    'timestamp', 'filename', 'provider', 'model',
    'originalTokens', 'cleanedTokens', 'retrievedTokens',
    'tokensSaved', 'savingsPct', 'moneySaved', 'precision',
  ];

  return { csv: toCsv(rows, columns), rows };
}

module.exports = { buildReport, buildComparisonReport, toCsv };

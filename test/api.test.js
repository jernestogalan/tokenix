'use strict';
/**
 * Tokenix — test/api.test.js
 * Integration tests for the HTTP API endpoints.
 * Uses Node's built-in http module — no test framework needed.
 * Run with:  node --test test/api.test.js
 *
 * NOTE: These tests start the actual Express server on a random port
 * so they require all dependencies to be installed.
 */

const { test, before, after } = require('node:test');
const assert  = require('node:assert/strict');
const http    = require('node:http');

// Temporarily set env so server.js doesn't crash
process.env.ENABLE_PAID_FEATURES = 'true';

const app    = require('../server');
let server, baseUrl;

// ── Setup / Teardown ──────────────────────────────────────────────────────────

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {  // port 0 = random available port
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const url  = new URL(path, baseUrl);
    const req  = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Multipart form helper (used for file upload endpoints)
function multipartRequest(path, fields) {
  return new Promise((resolve, reject) => {
    const BOUNDARY = '----TestBoundary' + Math.random().toString(36).slice(2);
    let body = '';

    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'string') {
        body += `--${BOUNDARY}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        body += `${value}\r\n`;
      } else if (value && value.buffer) {
        // File field: { buffer: Buffer, filename: string, contentType: string }
        body += `--${BOUNDARY}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n`;
        body += `Content-Type: ${value.contentType || 'application/octet-stream'}\r\n\r\n`;
      }
    }

    // Build binary body (text parts + file buffer if any)
    const fileField = Object.values(fields).find(v => v && v.buffer);
    let rawBody;
    if (fileField) {
      const prefix = Buffer.from(body, 'utf8');
      const suffix = Buffer.from(`\r\n--${BOUNDARY}--\r\n`, 'utf8');
      rawBody = Buffer.concat([prefix, fileField.buffer, suffix]);
    } else {
      rawBody = Buffer.from(body + `--${BOUNDARY}--\r\n`, 'utf8');
    }

    const opts = {
      method: 'POST',
      headers: {
        'Content-Type':   `multipart/form-data; boundary=${BOUNDARY}`,
        'Content-Length': rawBody.length,
      },
    };
    const url = new URL(path, baseUrl);
    const req = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

// ── Tests: Free routes ────────────────────────────────────────────────────────

test('GET /api/health → 200 with status ok', async () => {
  const { status, body } = await request('GET', '/api/health');
  assert.equal(status, 200, 'should return 200');
  assert.equal(body.status, 'ok', 'should return status: ok');
  assert.ok(typeof body.uptime === 'number', 'uptime should be a number');
});

test('GET /api/features → 200 with feature flags', async () => {
  const { status, body } = await request('GET', '/api/features');
  assert.equal(status, 200);
  assert.ok(typeof body.paidFeaturesEnabled === 'boolean', 'paidFeaturesEnabled should be boolean');
  assert.ok(typeof body.features === 'object', 'features should be an object');
});

test('GET /api/models → 200 with model data', async () => {
  const { status, body } = await request('GET', '/api/models');
  assert.equal(status, 200);
  assert.ok(typeof body === 'object' && body !== null, 'should return model config object');
  // Should have at least one provider
  assert.ok(Object.keys(body).length > 0, 'should have at least one provider');
});

test('POST /api/tokenize → 200 with token counts', async () => {
  const { status, body } = await request('POST', '/api/tokenize', { text: 'Hello, world!' });
  assert.equal(status, 200, 'should return 200');
  assert.ok(Array.isArray(body.results), 'results should be an array');
  assert.ok(body.results.length > 0, 'results should not be empty');
  assert.ok(typeof body.charCount === 'number', 'should include charCount');
});

test('POST /api/tokenize → 400 when text is missing', async () => {
  const { status, body } = await request('POST', '/api/tokenize', {});
  assert.equal(status, 400, 'should return 400 for missing text');
  assert.ok(body.error, 'should include error message');
});

test('POST /api/tokenize → 400 for empty text', async () => {
  const { status, body } = await request('POST', '/api/tokenize', { text: '   ' });
  assert.equal(status, 400, 'should return 400 for empty text');
  assert.ok(body.error, 'should include error message');
});

// ── Tests: File upload ────────────────────────────────────────────────────────

test('POST /api/tokenize/file → 200 for plain text file', async () => {
  const fileContent = Buffer.from('Hello from a text file. This is some content.');
  const { status, body } = await multipartRequest('/api/tokenize/file', {
    file: { buffer: fileContent, filename: 'test.txt', contentType: 'text/plain' },
  });
  assert.equal(status, 200, 'should return 200 for valid text file');
  assert.ok(Array.isArray(body.results), 'results should be an array');
});

// ── Tests: Pro routes ─────────────────────────────────────────────────────────

test('POST /api/clean → 200 for valid text file', async () => {
  // Build a text with repeated headers (boilerplate)
  const text = [
    'Company Report Q1',
    'Company Report Q1',
    'Company Report Q1',
    '',
    'The earnings increased significantly in Q1.',
    '',
    '1',
    '',
    'Revenue grew by 25% compared to the previous quarter.',
  ].join('\n');

  const fileContent = Buffer.from(text);
  const { status, body } = await multipartRequest('/api/clean', {
    file: { buffer: fileContent, filename: 'report.txt', contentType: 'text/plain' },
  });
  assert.equal(status, 200, 'should return 200 for valid file');
  assert.ok(typeof body.cleanText   === 'string',  'cleanText should be a string');
  assert.ok(typeof body.originalText === 'string', 'originalText should be a string');
  assert.ok(Array.isArray(body.tokenComparison),   'tokenComparison should be an array');
  assert.ok(typeof body.cleanerStats === 'object', 'cleanerStats should be an object');
});

test('POST /api/retrieve → 200 for valid text + query (JSON body)', async () => {
  const text = [
    'Machine learning algorithms learn patterns from training data.',
    '',
    'Deep learning uses multiple layers of neural networks.',
    '',
    'Natural language processing enables computers to understand text.',
    '',
    'Computer vision allows machines to interpret images and video.',
    '',
    'Reinforcement learning trains agents through reward signals.',
  ].join('\n');

  const { status, body } = await request('POST', '/api/retrieve', {
    text,
    query: 'neural networks deep learning',
    topK:  3,
  });
  assert.equal(status, 200, 'should return 200');
  assert.ok(Array.isArray(body.chunks), 'chunks should be an array');
  assert.ok(body.chunks.length <= 3, 'should return at most topK chunks');
  assert.ok(typeof body.retrievedText   === 'string', 'retrievedText should be a string');
  assert.ok(Array.isArray(body.tokenComparison),      'tokenComparison should be an array');
  assert.ok(typeof body.totalChunks     === 'number', 'totalChunks should be a number');
});

test('POST /api/retrieve → 400 when query is missing', async () => {
  const { status, body } = await request('POST', '/api/retrieve', {
    text: 'Some text about various topics.',
  });
  assert.equal(status, 400, 'should return 400 when query is missing');
  assert.ok(body.error, 'should include error message');
});

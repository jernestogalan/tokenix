#!/usr/bin/env node
/**
 * Tokenia Smoke Tests
 * Usage: node scripts/smoke-test.js [baseUrl]
 * Example: node scripts/smoke-test.js https://tokenia.live
 */
'use strict';

const BASE = process.argv[2] || 'http://localhost:3000';
let pass = 0, fail = 0;

async function check(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log('✅');
    pass++;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    fail++;
  }
}

async function get(path, expectedStatus = 200) {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(8000) });
  if (res.status !== expectedStatus) throw new Error(`HTTP ${res.status} (expected ${expectedStatus})`);
  return res;
}

async function postJson(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

(async () => {
  console.log(`\n🔥 Tokenia Smoke Tests → ${BASE}\n`);

  console.log('── Pages ──────────────────────────');
  await check('Homepage loads (200)',         () => get('/'));
  await check('Security page (200)',          () => get('/security.html'));
  await check('Embed page (200)',             () => get('/embed.html'));
  await check('API docs (200)',               () => get('/api-docs.html'));
  await check('Status page (200)',            () => get('/status.html'));
  await check('Changelog (200)',              () => get('/changelog.html'));
  await check('Blog index (200)',             () => get('/blog'));
  await check('Blog EN post 1 (200)',         () => get('/blog/en/reduce-llm-costs.html'));
  await check('Blog ES post 1 (200)',         () => get('/blog/es/reducir-costos-llm.html'));
  await check('Blog PT post 1 (200)',         () => get('/blog/pt/reduzir-custos-llm.html'));
  await check('Privacy page (200)',           () => get('/privacy.html'));
  await check('Offline page (200)',           () => get('/offline.html'));
  await check('llms.txt (200)',              () => get('/llms.txt'));
  await check('openapi.yaml (200)',           () => get('/openapi.yaml'));
  await check('Postman collection (200)',     () => get('/tokenia.postman_collection.json'));
  await check('Sitemap (200)',               () => get('/sitemap.xml'));
  await check('Robots.txt (200)',            () => get('/robots.txt'));
  await check('Manifest JSON (200)',         () => get('/manifest.json'));
  await check('Service Worker (200)',        () => get('/sw.js'));
  await check('Blog RSS feed (200)',         () => get('/blog/feed.xml'));
  await check('Blog sitemap (200)',          () => get('/blog/sitemap.xml'));

  console.log('\n── API Endpoints ──────────────────');
  await check('GET /api/health returns ok', async () => {
    const data = await (await get('/api/health')).json();
    if (data.ok !== true) throw new Error('ok !== true');
  });
  await check('GET /api/health-detail returns status', async () => {
    const data = await (await get('/api/health-detail')).json();
    if (!data.status) throw new Error('missing status field');
    if (!data.uptime_seconds) throw new Error('missing uptime_seconds');
  });
  await check('POST /api/v1/count returns tokens', async () => {
    const data = await postJson('/api/v1/count', { text: 'Hello world from Tokenia smoke test' });
    if (!data.tokens || data.tokens < 1) throw new Error(`bad tokens: ${data.tokens}`);
    if (!data.results || !data.results.length) throw new Error('missing results');
  });
  await check('POST /api/v1/count with provider filter', async () => {
    const data = await postJson('/api/v1/count', { text: 'Test', provider: 'openai' });
    if (!data.results.every(r => r.provider === 'openai')) throw new Error('provider filter failed');
  });
  await check('POST /api/track accepts events', async () => {
    const res = await fetch(BASE + '/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'smoke_test', page: '/', lang: 'en' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  await check('Pricing page redirects (301)', () => get('/pricing', 301));

  console.log('\n── Redirects ──────────────────────');
  await check('/pricing → / (301)',     () => get('/pricing', 301));
  await check('/pricing/pro → / (301)', () => get('/pricing/pro', 301));

  console.log('\n── Content Checks ─────────────────');
  await check('Homepage has "Tokenia"', async () => {
    const html = await (await get('/')).text();
    if (!html.includes('Tokenia')) throw new Error('missing brand name');
  });
  await check('Homepage has Inter font', async () => {
    const html = await (await get('/')).text();
    if (!html.includes('Inter')) throw new Error('missing Inter font');
  });
  await check('Sitemap has tokenia.live', async () => {
    const xml = await (await get('/sitemap.xml')).text();
    if (!xml.includes('tokenia.live')) throw new Error('sitemap missing domain');
  });

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${pass} passed · ${fail} failed`);
  if (fail === 0) console.log('🎉 All smoke tests passed!\n');
  else            console.log(`⚠️  ${fail} test(s) failed\n`);
  process.exit(fail > 0 ? 1 : 0);
})();

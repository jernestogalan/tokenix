/**
 * Tokenia — server.js (v3 — Phase 3: Supabase + Redis)
 * Express server with plans, pricing, feature gates, auth, and Redis rate limiting.
 */
'use strict';

require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const multer      = require('multer');
const cors        = require('cors');
const path        = require('path');
const fs          = require('fs');

const { tokenizeAll } = require('./src/tokenizers');
const { extractText } = require('./src/parsers');
const { cleanText }   = require('./src/cleaner');
const { retrieve }    = require('./src/retriever');
const MODELS          = require('./src/config/models');
const { sendContactEmail } = require('./src/lib/email');

const { getAllPlans }            = require('./src/config/plans');
const { checkEntitlement }      = require('./src/lib/entitlements');
const { calculateCost }         = require('./src/lib/pricing');
const { buildComparisonReport } = require('./src/lib/reports');
const { getCreditsSummary }     = require('./src/lib/credits');

// Phase 3: Auth + Redis
const { attachUser, requireAuth, buildAuthStatus } = require('./src/middleware/auth');
const { getUsageHistory }                                  = require('./src/lib/supabase');
const { createRateLimiter, isRedisReady }           = require('./src/middleware/rateLimitRedis');
const { checkUsageQuota, recordUsage, buildUsageSummary } = require('./src/middleware/usageLimits');

// ── Env flags ─────────────────────────────────────────────────────────────────
const PORT                  = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV              = process.env.NODE_ENV || 'development';
const IS_PRODUCTION         = NODE_ENV === 'production';
const PAID_FEATURES_ENABLED = process.env.ENABLE_PAID_FEATURES === 'true';
const BILLING_ENABLED       = process.env.ENABLE_BILLING === 'true';
const CREDITS_ENABLED       = process.env.ENABLE_CREDITS === 'true';
const AI_OPT_ENABLED        = process.env.ENABLE_AI_OPTIMIZATION === 'true';
const ALLOW_USER_KEYS       = process.env.ALLOW_USER_API_KEYS === 'true';
const AUTH_ENABLED          = process.env.ENABLE_AUTH === 'true';
const HISTORY_ENABLED       = process.env.ENABLE_HISTORY !== 'false';   // default true
const PROJECTS_ENABLED      = process.env.ENABLE_PROJECTS !== 'false';  // default true
const API_KEY               = process.env.API_KEY || null;

// ── In-memory lead store ─────────────────────────────────────────────────────
const _leads = [];

// ── Stripe (optional, disabled by default) ───────────────────────────────────
let stripe = null;
if (BILLING_ENABLED) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[startup] ENABLE_BILLING=true but STRIPE_SECRET_KEY not set.');
  } else {
    try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); }
    catch { console.warn('[startup] stripe package not installed.'); }
  }
}

const app = express();

// ── Stripe webhook MUST be before express.json() ──────────────────────────────
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!BILLING_ENABLED || !stripe) return res.status(503).json({ error: 'Billing not configured.' });
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).json({ error: 'Webhook error: ' + err.message });
  }
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('[billing] Checkout completed:', event.data.object.customer_details?.email);
      break;
    case 'customer.subscription.deleted':
      console.log('[billing] Subscription cancelled:', event.data.object.customer);
      break;
    case 'invoice.payment_failed':
      console.warn('[billing] Payment failed:', event.data.object.customer);
      break;
    default: break;
  }
  res.json({ received: true });
});

// ── Helmet with Tailwind CDN + Supabase CSP ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  [
        "'self'",
        // Allow Supabase auth + REST API calls from the browser
        process.env.SUPABASE_URL || '',
        '*.supabase.co',
      ].filter(Boolean),
      fontSrc:     ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    },
  },
}));

app.use(compression());
app.use(IS_PRODUCTION ? morgan('combined') : morgan('dev'));

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin:         corsOrigin,
  methods:        ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Plan'],
}));

app.use(express.json({ limit: '10mb' }));

// ── Auth pages — inject Supabase config server-side ──────────────────────────
app.get('/auth/signup', (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'public/auth/signup.html'), 'utf8');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    html = html.replace(/{{ SUPABASE_URL }}/g,      supabaseUrl);
    html = html.replace(/{{ SUPABASE_ANON_KEY }}/g, supabaseKey);
    console.log('✅ signup.html served | SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET', '| ANON_KEY:', supabaseKey ? 'SET' : 'NOT SET');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('❌ Error serving signup:', err.message);
    res.status(500).send('Error loading sign up page');
  }
});

app.get('/auth/signin', (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'public/auth/signin.html'), 'utf8');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    html = html.replace(/{{ SUPABASE_URL }}/g,      supabaseUrl);
    html = html.replace(/{{ SUPABASE_ANON_KEY }}/g, supabaseKey);
    console.log('✅ signin.html SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('❌ Error serving signin:', err.message);
    res.status(500).send('Error loading sign in page');
  }
});
app.get('/auth/callback',  (_req, res) => res.sendFile(path.join(__dirname, 'public/auth/callback.html')));
app.get('/dashboard',      (_req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/pricing/pro',    (_req, res) => res.sendFile(path.join(__dirname, 'public/pricing/pro.html')));
app.get('/pricing/team',   (_req, res) => res.sendFile(path.join(__dirname, 'public/pricing/team.html')));

app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiters (Redis-backed with in-memory fallback) ─────────────────────
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  prefix:   'rl:general',
  byUser:   true,
});
const heavyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_HEAVY_MAX || '30', 10),
  prefix:   'rl:heavy',
  byUser:   true,
});

// ── Auth middleware (attaches req.user, req.userPlan) ────────────────────────
// Apply to all API routes so plan is always resolved before entitlements.
app.use('/api', attachUser);
app.use('/api', generalLimiter);
app.use('/api/clean',    heavyLimiter);
app.use('/api/retrieve', heavyLimiter);
app.use('/api/count',    heavyLimiter);

// ── Multer ────────────────────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.pdf', '.docx', '.doc',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.cs', '.php', '.sh', '.bash', '.zsh',
  '.sql', '.html', '.htm', '.css', '.scss',
  '.json', '.yaml', '.yml', '.xml', '.toml', '.env', '.r', '.ipynb',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    ALLOWED_EXTENSIONS.has(ext)
      ? cb(null, true)
      : cb(new Error('File type not supported: ' + ext), false);
  },
});

// ── API key auth (for internal endpoints) ─────────────────────────────────────
function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers['x-api-key'] || req.query.api_key;
  if (!provided) return res.status(401).json({ error: 'API key required.' });
  if (provided !== API_KEY) return res.status(403).json({ error: 'Invalid API key.' });
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function textStats(text) {
  return {
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    lineCount: text.split('\n').length,
  };
}

function fmtMoney(n) {
  if (n === 0) return '$0.000000';
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function buildTokenComparison(origResults, newResults, key = 'clean') {
  return origResults.map((orig, i) => {
    const upd   = newResults[i];
    const origT = orig.tokens;
    const newT  = upd.tokens;
    const saved = origT - newT;
    const pct   = origT > 0 ? Math.round((saved / origT) * 1000) / 10 : 0;
    return {
      provider:     orig.provider,
      providerName: orig.providerName,
      model:        orig.model,
      modelName:    orig.modelName,
      originalTokens: origT,
      [key === 'clean' ? 'cleanTokens' : 'retrievedTokens']: newT,
      tokensSaved:  saved,
      pctSaved:     pct,
      moneySaved:   +((saved / 1e6) * (orig.inputPer1M || 0)).toFixed(6),
      exact:        orig.exact,
      inputPer1M:   orig.inputPer1M,
      precision:    orig.precision || (orig.exact ? 'exact' : 'estimated'),
    };
  });
}

/**
 * savingsMessage — produce a human-readable cost comparison.
 *
 * @param {Array}  origResults       - tokenizeAll() results for the original text
 * @param {Array}  optimizedResults  - tokenizeAll() results for the processed text
 * @param {'clean'|'retrieve'} type  - 'clean'    = noise removal, full meaning preserved
 *                                     'retrieve' = only relevant chunks, NOT the full doc
 */
function savingsMessage(origResults, optimizedResults, type = 'clean') {
  if (!origResults || !optimizedResults || !origResults.length) return null;
  const first    = origResults[0];
  const opt      = optimizedResults[0];
  const origCost = (first.tokens / 1e6) * (first.inputPer1M || 0);
  const optCost  = (opt.tokens   / 1e6) * (first.inputPer1M || 0);
  const pct      = origCost > 0 ? Math.round(((origCost - optCost) / origCost) * 1000) / 10 : 0;

  if (type === 'retrieve') {
    // Retrieval is partial context — explicitly call that out
    return `Sending only the relevant passages saves ${pct}% vs the full document `
         + `(${fmtMoney(origCost)} → ${fmtMoney(optCost)}). `
         + `Note: this is a subset, not the complete text — the AI will not see the rest.`;
  }

  // type === 'clean': noise removal, lossless in terms of meaning
  return `Removing layout noise reduced cost by ${pct}% `
       + `(${fmtMoney(origCost)} → ${fmtMoney(optCost)}). `
       + `Full meaning is preserved — this is the same document, just cleaner.`;
}

// ════════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/health
app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    version: require('./package.json').version,
    env:     NODE_ENV,
    uptime:  Math.round(process.uptime()),
    flags: {
      auth:            AUTH_ENABLED,
      paidFeatures:    PAID_FEATURES_ENABLED,
      billing:         BILLING_ENABLED && !!stripe,
      credits:         CREDITS_ENABLED,
      aiOptimization:  AI_OPT_ENABLED,
      allowUserApiKeys: ALLOW_USER_KEYS,
      redis:           isRedisReady(),
    },
  });
});

// GET /api/features
app.get('/api/features', (_req, res) => {
  res.json({
    authEnabled:         AUTH_ENABLED,
    paidFeaturesEnabled: PAID_FEATURES_ENABLED,
    billingEnabled:      BILLING_ENABLED && !!stripe,
    creditsEnabled:      CREDITS_ENABLED,
    aiOptimization:      AI_OPT_ENABLED,
    allowUserApiKeys:    ALLOW_USER_KEYS,
    supabaseConfigured:  !!process.env.SUPABASE_URL,
    redisConnected:      isRedisReady(),
    features: {
      cleaner:    true,
      retriever:  true,
      batch:      PAID_FEATURES_ENABLED,
      csvExport:  PAID_FEATURES_ENABLED,
      auth:       AUTH_ENABLED,
      history:    HISTORY_ENABLED && AUTH_ENABLED,
      projects:   PROJECTS_ENABLED && AUTH_ENABLED,
    },
  });
});

// GET /api/config — public client-side config (supabase url + anon key are safe to expose)
app.get('/api/config', (_req, res) => {
  res.json({
    supabaseUrl:      process.env.SUPABASE_URL      || null,
    supabaseAnonKey:  process.env.SUPABASE_ANON_KEY || null,
    authEnabled:      AUTH_ENABLED,
    allowPlanOverride: process.env.ALLOW_PLAN_QUERY_OVERRIDE === 'true' && !IS_PRODUCTION,
  });
});

// GET /api/models
app.get('/api/models', (_req, res) => res.json(MODELS));

// GET /api/plans
app.get('/api/plans', (_req, res) => res.json(getAllPlans()));

// ── Auth routes ───────────────────────────────────────────────────────────────

// GET /api/auth/user — return current auth status + plan info
app.get('/api/auth/user', (req, res) => {
  res.json(buildAuthStatus(req));
});

// POST /api/auth/logout — client-side logout hint (actual token invalidation
// happens in Supabase, this is just for server-side session cleanup if needed)
app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true, message: 'Sign out from the Supabase client on the frontend.' });
});

// GET /api/history — usage history for authenticated user
app.get('/api/history', requireAuth, async (req, res) => {
  // Guard: requireAuth passes through when AUTH_ENABLED=false (dev mode).
  // Still reject unauthenticated requests — history always requires a real user.
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.', code: 'auth_required' });
  }
  if (!HISTORY_ENABLED) {
    return res.status(503).json({ error: 'History is not enabled.', code: 'HISTORY_DISABLED' });
  }
  try {
    const limit  = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const events = await getUsageHistory(req.user.id, limit);
    res.json({
      ok:     true,
      count:  events.length,
      events: events.map(e => ({
        id:            e.id,
        date:          e.created_at,
        type:          e.event_type,
        model:         e.model          || null,
        inputTokens:   e.input_tokens   || 0,
        estimatedCost: e.estimated_cost || 0,
        planAtTime:    e.plan_at_time   || 'free',
        filename:      e.filename       || null,
      })),
    });
  } catch (err) {
    console.error('[/api/history]', err.message);
    res.status(500).json({ error: 'Could not fetch history.' });
  }
});

// ── Core API routes ────────────────────────────────────────────────────────────

// POST /api/count — accepts text body or file upload
app.post('/api/count', upload.single('file'), checkUsageQuota, async (req, res) => {
  try {
    let text, filename, filesize;

    if (req.file) {
      const gate = checkEntitlement({ req, feature: 'countFile', fileSizeBytes: req.file.size });
      if (!gate.allowed) return res.status(402).json({ error: gate.reason, code: gate.code, upgrade: gate.upgrade });

      text     = await extractText(req.file.buffer, req.file.originalname);
      filename = req.file.originalname;
      filesize = req.file.size;
      if (!text || text.trim().length === 0)
        return res.status(422).json({ error: 'Could not extract any text from this file.' });
    } else {
      const { text: bodyText } = req.body || {};
      if (!bodyText || typeof bodyText !== 'string')
        return res.status(400).json({ error: '"text" field is required (or upload a file).' });
      if (bodyText.trim().length === 0)
        return res.status(400).json({ error: 'Text is empty.' });
      if (bodyText.length > 5_000_000)
        return res.status(400).json({ error: 'Text too long — max 5,000,000 chars.' });

      const gate = checkEntitlement({ req, feature: 'countText' });
      if (!gate.allowed) return res.status(402).json({ error: gate.reason, code: gate.code });

      text = bodyText;
    }

    const plan       = checkEntitlement({ req, feature: 'countText' }).plan;
    const rawResults = await tokenizeAll(text);

    const results = rawResults.map(r => {
      const cost = calculateCost({ inputTokens: r.tokens, outputTokensEstimate: r.tokens, modelKey: `${r.provider}:${r.model}` });
      return {
        ...r,
        inputCost:  cost ? cost.inputCost  : null,
        outputCost: cost ? cost.outputCost : null,
        totalCost:  cost ? cost.totalCost  : null,
        precision:  cost ? cost.precision  : (r.exact ? 'exact' : 'estimated'),
      };
    });

    // Record usage (async, non-blocking)
    const totalTokens = results.reduce((s, r) => Math.max(s, r.tokens || 0), 0);
    recordUsage(req, {
      feature:     req.file ? 'countFile' : 'countText',
      inputTokens: totalTokens,
      modelKey:    results[0] ? `${results[0].provider}:${results[0].model}` : null,
      filename,
    });

    res.json({
      ...textStats(text),
      filename,
      filesize,
      plan:  plan.id,
      usage: buildUsageSummary(req),
      results,
    });
  } catch (err) {
    console.error('[/api/count]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tokenize — legacy compat (text only)
app.post('/api/tokenize', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: '"text" field is required.' });
    if (text.length > 1_000_000) return res.status(400).json({ error: 'Text too long — max 1,000,000 chars.' });
    if (text.trim().length === 0) return res.status(400).json({ error: 'Text is empty.' });
    const results = await tokenizeAll(text);
    res.json({ ...textStats(text), results });
  } catch (err) {
    console.error('[/api/tokenize]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tokenize/file — legacy compat (file)
app.post('/api/tokenize/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const text = await extractText(req.file.buffer, req.file.originalname);
    if (!text || text.trim().length === 0)
      return res.status(422).json({ error: 'Could not extract any text.' });
    const results = await tokenizeAll(text);
    res.json({ filename: req.file.originalname, filesize: req.file.size, ...textStats(text), results });
  } catch (err) {
    console.error('[/api/tokenize/file]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clean
app.post('/api/clean', upload.single('file'), checkUsageQuota, async (req, res) => {
  try {
    let rawText, filename, filesize;

    if (req.file) {
      const gate = checkEntitlement({ req, feature: 'cleanDemo', fileSizeBytes: req.file.size });
      if (!gate.allowed) return res.status(402).json({ error: gate.reason, code: gate.code, upgrade: gate.upgrade });
      rawText  = await extractText(req.file.buffer, req.file.originalname);
      filename = req.file.originalname;
      filesize = req.file.size;
    } else if (req.body && req.body.text) {
      const gate = checkEntitlement({ req, feature: 'cleanDemo' });
      if (!gate.allowed) return res.status(402).json({ error: gate.reason, code: gate.code, upgrade: gate.upgrade });
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: 'Send a file (multipart) or { text } (JSON).' });
    }

    if (!rawText || rawText.trim().length === 0)
      return res.status(422).json({ error: 'Could not extract text from this file.' });

    const gate     = checkEntitlement({ req, feature: 'cleanDemo' });
    const demo     = gate.demoMode || false;
    const demoLimit = gate.demoLimit || 5000;
    const textToClean = demo ? rawText.slice(0, demoLimit) : rawText;

    const { cleanText: cleaned, stats: cleanerStats } = cleanText(textToClean, filename || 'input.txt');

    const [origResults, cleanResults] = await Promise.all([
      tokenizeAll(rawText),
      tokenizeAll(cleaned),
    ]);

    const tokenComparison = buildTokenComparison(origResults, cleanResults, 'clean');
    const msg             = savingsMessage(origResults, cleanResults, 'clean');

    const cleanedTokens = cleanResults.reduce((s, r) => Math.max(s, r.tokens || 0), 0);
    recordUsage(req, { feature: 'cleanFull', inputTokens: cleanedTokens, filename });

    res.json({
      demo,
      demoMessage: demo ? `Preview shows first ${demoLimit.toLocaleString()} characters. Upgrade to Pro for full document cleaning.` : null,
      filename,
      filesize,
      originalText:  rawText.slice(0, 500),
      cleanedText:   cleaned,
      canDownload:   !demo,
      originalStats: textStats(rawText),
      cleanStats:    textStats(cleaned),
      cleanerStats,
      tokenComparison,
      savingsMessage: msg,
      usage:         buildUsageSummary(req),
    });
  } catch (err) {
    console.error('[/api/clean]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/retrieve
app.post('/api/retrieve', upload.single('file'), checkUsageQuota, async (req, res) => {
  try {
    let documentText, query, topK, filename;

    if (req.file) {
      documentText = await extractText(req.file.buffer, req.file.originalname);
      filename     = req.file.originalname;
      query        = (req.body.query || '').trim();
      topK         = parseInt(req.body.topK, 10) || 5;
    } else if (req.body && req.body.text) {
      documentText = req.body.text;
      query        = (req.body.query || '').trim();
      topK         = parseInt(req.body.topK, 10) || 5;
    } else {
      return res.status(400).json({ error: 'Send a file (multipart) or { text, query } (JSON).' });
    }

    if (!documentText || documentText.trim().length === 0)
      return res.status(422).json({ error: 'Could not extract text from the document.' });
    if (!query)
      return res.status(400).json({ error: '"query" is required.' });

    const gate = checkEntitlement({ req, feature: 'ragDemo', docChars: documentText.length });
    if (!gate.allowed) return res.status(402).json({ error: gate.reason, code: gate.code, upgrade: gate.upgrade });

    const demo    = gate.demoMode || false;
    const maxTopK = demo ? 3 : Math.min(topK, gate.plan.limits.maxRetrievalChunks || 50);

    const { chunks, totalChunks, chunkSize, overlap } = retrieve(documentText, query, maxTopK);
    const retrievedText = chunks.map(c => c.text).join('\n\n---\n\n');

    const [fullResults, retrievedResults] = await Promise.all([
      tokenizeAll(documentText),
      tokenizeAll(retrievedText),
    ]);

    const tokenComparison = buildTokenComparison(fullResults, retrievedResults, 'retrieve');
    const msg             = savingsMessage(fullResults, retrievedResults, 'retrieve');

    const retrievedTokens = retrievedResults.reduce((s, r) => Math.max(s, r.tokens || 0), 0);
    recordUsage(req, { feature: 'ragFull', inputTokens: retrievedTokens, filename });

    res.json({
      query,
      demo,
      demoMessage: demo ? 'Preview shows top 3 chunks. Upgrade to Pro to retrieve up to 50 chunks.' : null,
      disclaimer:  'Retrieval uses TF-IDF keyword similarity, not semantic embeddings. Best for focused queries.',
      filename,
      totalChunks,
      returnedChunks: chunks.length,
      chunkSize,
      overlap,
      retrievedText,
      chunks,
      tokenComparison,
      savingsMessage: msg,
      usage:          buildUsageSummary(req),
    });
  } catch (err) {
    console.error('[/api/retrieve]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/report — CSV download
app.post('/api/report', async (req, res) => {
  const gate = checkEntitlement({ req, feature: 'csvExport' });
  if (!gate.allowed) return res.status(402).json({ error: gate.reason, code: gate.code, upgrade: gate.upgrade });

  try {
    const { filename = 'report', comparisons = [] } = req.body || {};
    if (!Array.isArray(comparisons) || comparisons.length === 0)
      return res.status(400).json({ error: '"comparisons" array is required.' });

    const { csv } = buildComparisonReport({ filename, comparisons });
    const outName = `${filename.replace(/[^a-z0-9_-]/gi, '_')}_tokenia_report.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    res.send(csv);
  } catch (err) {
    console.error('[/api/report]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lead — lead capture (also used by FAQ chatbot contact form)
app.post('/api/lead', (req, res) => {
  const { email, desiredPlan, featureClicked, name, message } = req.body || {};
  if (!email || !email.includes('@'))
    return res.status(400).json({ error: 'Valid email required.' });

  _leads.push({
    email,
    name:           name           || null,
    message:        message        || null,
    desiredPlan:    desiredPlan    || 'pro',
    featureClicked: featureClicked || null,
    createdAt:      new Date().toISOString(),
  });
  console.log(`[lead] ${email} — plan: ${desiredPlan} — feature: ${featureClicked}${name ? ` — from: ${name}` : ''}`);
  res.json({ ok: true, message: "You're on the list! We'll reach out when Pro launches." });
});

// GET /api/leads — internal, requires API_KEY
app.get('/api/leads', requireApiKey, (req, res) => {
  if (!API_KEY) return res.status(403).json({ error: 'API_KEY not configured.' });
  res.json({ count: _leads.length, leads: _leads });
});

// POST /api/parse-file — extract plain text from uploaded file (PDF, DOCX, TXT, etc.)
app.post('/api/parse-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const text = await extractText(req.file.buffer, req.file.originalname);
    if (!text || !text.trim()) return res.status(422).json({ error: 'Could not extract text from this file.' });

    // Free-tier cap: 100k chars
    const capped = text.length > 100_000
      ? text.slice(0, 100_000) + '\n\n[Truncated — upgrade to Pro for full processing]'
      : text;

    res.json({ text: capped, chars: capped.length, truncated: text.length > 100_000 });
  } catch (err) {
    console.error('[/api/parse-file]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contact — contact form (sends email via Resend if configured)
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2)
      return res.status(400).json({ error: 'Name is required.' });
    if (!email || !email.includes('@'))
      return res.status(400).json({ error: 'Valid email is required.' });
    if (!message || typeof message !== 'string' || message.trim().length < 5)
      return res.status(400).json({ error: 'Message is required.' });

    const result = await sendContactEmail(name.trim(), email.trim(), message.trim());
    if (result.success) {
      res.json({ ok: true, message: "Message received! We'll get back to you soon." });
    } else {
      console.error('[/api/con
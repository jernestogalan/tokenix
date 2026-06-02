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
const crypto      = require('crypto');

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

// ── Helmet — hardened security headers ───────────────────────────────────────
app.use(helmet({
  // Content-Security-Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  [
        "'self'",
        process.env.SUPABASE_URL || '',
        '*.supabase.co',
      ].filter(Boolean),
      fontSrc:     ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      frameAncestors: ["'none'"],   // replaces X-Frame-Options for modern browsers
    },
  },
  // HSTS — 1 year, include subdomains, preload-ready
  hsts: {
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
  },
  // Referrer policy — don't leak path to third parties
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Permissions-Policy — disable features we don't use
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  next();
});

// ── Force HTTPS in production ─────────────────────────────────────────────────
if (IS_PRODUCTION) {
  app.use((req, res, next) => {
    // Railway sets X-Forwarded-Proto; trust the first proxy
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto.split(',')[0].trim() !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(compression({ level: 6, threshold: 1024 }));
app.use(IS_PRODUCTION ? morgan('combined') : morgan('dev'));

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin:         corsOrigin,
  methods:        ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Plan'],
}));

app.use(express.json({ limit: '10mb' }));

// ── Auth pages — inject Supabase config server-side ──────────────────────────
function serveAuthPage(filePath, res) {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'public', filePath), 'utf8');
    html = html.replace(/\{\{ SUPABASE_URL \}\}/g,      process.env.SUPABASE_URL      || '');
    html = html.replace(/\{\{ SUPABASE_ANON_KEY \}\}/g, process.env.SUPABASE_ANON_KEY || '');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[auth] serveAuthPage error:', err.message);
    res.status(404).send('Page not found');
  }
}

app.get('/auth/signin',    (_req, res) => serveAuthPage('auth/signin.html',  res));
app.get('/auth/signup',    (_req, res) => serveAuthPage('auth/signup.html',  res));
app.get('/auth/callback',  (_req, res) => res.sendFile(path.join(__dirname, 'public/auth/callback.html')));
app.get('/dashboard',      (_req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
// Redirect old pricing routes to home (Free Forever strategy)
app.get('/pricing',        (_req, res) => res.redirect(301, '/'));
app.get('/pricing/pro',    (_req, res) => res.redirect(301, '/'));
app.get('/pricing/team',   (_req, res) => res.redirect(301, '/'));

// Pages (clean URLs — no .html extension needed)
app.get('/security',   (_req, res) => res.sendFile(path.join(__dirname, 'public/security.html')));
app.get('/privacy',    (_req, res) => res.sendFile(path.join(__dirname, 'public/privacy.html')));
app.get('/embed',      (_req, res) => res.sendFile(path.join(__dirname, 'public/embed.html')));
app.get('/api-docs',   (_req, res) => res.sendFile(path.join(__dirname, 'public/api-docs.html')));
app.get('/status',     (_req, res) => res.sendFile(path.join(__dirname, 'public/status.html')));
app.get('/changelog',  (_req, res) => res.sendFile(path.join(__dirname, 'public/changelog.html')));
app.get('/sitemap.xml',(_req, res) => res.sendFile(path.join(__dirname, 'public/sitemap.xml')));
app.get('/robots.txt', (_req, res) => res.sendFile(path.join(__dirname, 'public/robots.txt')));

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, version: '7.0.0', ts: Date.now() }));

// Aggressive cache headers for static assets
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    } else if (filePath.match(/\.(css|js)$/)) {
      // Versioned assets — long cache
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

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

// POST /api/newsletter — newsletter subscription via Resend Contacts (global API, no audience_id)
const RESEND_API_KEY      = process.env.RESEND_API_KEY || '';
const NEWSLETTER_CSV_PATH = path.join(__dirname, 'data', 'newsletter-subscribers.csv');

// Ensure CSV file exists
try {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(NEWSLETTER_CSV_PATH)) fs.writeFileSync(NEWSLETTER_CSV_PATH, 'email,createdAt,lang\n');
} catch {}

app.post('/api/newsletter', async (req, res) => {
  const { email, lang } = req.body || {};
  if (!email || !email.includes('@'))
    return res.status(400).json({ error: 'Valid email required.' });

  // Add to Resend global contacts (no audience_id required)
  let resendOk = false;
  try {
    const resendRes = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    resendOk = resendRes.ok;
    if (!resendOk) {
      const errBody = await resendRes.text().catch(() => '');
      console.warn('[newsletter] Resend error:', resendRes.status, errBody);
    }
  } catch (err) {
    console.warn('[newsletter] Resend fetch failed:', err.message);
  }

  // CSV fallback — only on Resend failure (API error or network issue)
  if (!resendOk) {
    try {
      fs.appendFileSync(NEWSLETTER_CSV_PATH, `${email},${new Date().toISOString()},${lang || 'en'}\n`);
    } catch {}
  }

  _leads.push({ email, source: 'newsletter', lang: lang || 'en', createdAt: new Date().toISOString() });
  console.log(`[newsletter] ${email} — resend:${resendOk}`);
  res.json({ ok: true, message: 'Subscribed! Check your inbox.' });
});

// ── Public API v1: GET/POST /api/v1/count ────────────────────────────────────
// Rate limited to 100 req/hr per IP. No auth required.
const publicApiLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.PUBLIC_API_LIMIT || '100', 10),
  prefix: 'rl:public-api',
  byUser: false,
});

const CLIENT_MODELS = {
  openai: [
    { id: 'gpt-4.1',       name: 'GPT-4.1',       inputPer1M: 2.00,  outputPer1M: 8.00  },
    { id: 'gpt-4o',        name: 'GPT-4o',         inputPer1M: 2.50,  outputPer1M: 10.00 },
    { id: 'gpt-4o-mini',   name: 'GPT-4o mini',    inputPer1M: 0.15,  outputPer1M: 0.60  },
    { id: 'o4-mini',       name: 'o4-mini',         inputPer1M: 1.10,  outputPer1M: 4.40  },
    { id: 'o1',            name: 'o1',              inputPer1M: 15.00, outputPer1M: 60.00 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo',  inputPer1M: 0.50,  outputPer1M: 1.50  },
  ],
  anthropic: [
    { id: 'claude-opus-4-6',   name: 'Claude Opus 4.6',   inputPer1M: 15.00, outputPer1M: 75.00 },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', inputPer1M: 3.00,  outputPer1M: 15.00 },
    { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5',  inputPer1M: 0.80,  outputPer1M: 4.00  },
  ],
  google: [
    { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   inputPer1M: 1.25,  outputPer1M: 10.00 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', inputPer1M: 0.15,  outputPer1M: 0.60  },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', inputPer1M: 0.10,  outputPer1M: 0.40  },
  ],
  meta: [
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', inputPer1M: 0.59, outputPer1M: 0.79 },
    { id: 'llama-3.1-8b',  name: 'Llama 3.1 8B',  inputPer1M: 0.18, outputPer1M: 0.18 },
  ],
  mistral: [
    { id: 'mistral-large-2', name: 'Mistral Large 2', inputPer1M: 2.00, outputPer1M: 6.00 },
    { id: 'mistral-small-3', name: 'Mistral Small 3', inputPer1M: 0.10, outputPer1M: 0.30 },
  ],
  deepseek: [
    { id: 'deepseek-v3',       name: 'DeepSeek V3',       inputPer1M: 0.27, outputPer1M: 1.10 },
    { id: 'deepseek-v3-flash', name: 'DeepSeek V3 Flash', inputPer1M: 0.07, outputPer1M: 0.28 },
    { id: 'deepseek-r1',       name: 'DeepSeek R1',       inputPer1M: 0.55, outputPer1M: 2.19 },
  ],
};

function estimateTokensPublic(text) {
  if (!text) return 0;
  const specials = (text.match(/[{}()[\]<>:;=+\-*\/\\|&^%$#@!~`]/g) || []).length;
  const ratio = specials / text.length > 0.08 ? 3.5 : 4.0;
  return Math.ceil(text.length / ratio);
}

app.post('/api/v1/count', publicApiLimiter, (req, res) => {
  const { text, provider, model: modelFilter } = req.body || {};
  if (!text || typeof text !== 'string')
    return res.status(400).json({ error: '"text" string required.' });
  if (text.length > 100_000)
    return res.status(400).json({ error: 'Text too long — max 100,000 characters.' });

  const tokens = estimateTokensPublic(text);
  const chars  = text.length;
  const words  = text.trim() ? text.trim().split(/\s+/).length : 0;

  const providers = provider && CLIENT_MODELS[provider]
    ? { [provider]: CLIENT_MODELS[provider] }
    : CLIENT_MODELS;

  const results = [];
  for (const [provId, models] of Object.entries(providers)) {
    for (const m of models) {
      if (modelFilter && m.id !== modelFilter) continue;
      results.push({
        provider:       provId,
        model:          m.name,
        modelId:        m.id,
        tokens,
        inputCostPer1M: m.inputPer1M,
        outputCostPer1M:m.outputPer1M,
        inputCost:      parseFloat(((tokens / 1e6) * m.inputPer1M).toFixed(8)),
        outputCost:     parseFloat(((tokens / 1e6) * m.outputPer1M).toFixed(8)),
        totalCost:      parseFloat(((tokens / 1e6) * (m.inputPer1M + m.outputPer1M)).toFixed(8)),
        precision:      'estimated',
      });
    }
  }

  res.json({ tokens, chars, words, results, rateLimit: { remaining: 99, resetIn: '3600s' } });
});

// GET /api/v1/count (for quick browser testing)
app.get('/api/v1/count', publicApiLimiter, (req, res) => {
  const text = req.query.text || '';
  if (!text) return res.status(400).json({ error: '"text" query param required.' });
  req.body = { text, provider: req.query.provider, model: req.query.model };
  // Re-invoke logic inline
  const tokens = estimateTokensPublic(text);
  res.json({ tokens, chars: text.length, message: 'Use POST for full results.' });
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
      console.error('[/api/contact] email send failed:', result.error);
      res.status(500).json({ error: 'Failed to send message. Please email info@tokenia.live directly.' });
    }
  } catch (err) {
    console.error('[/api/contact]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/credits/check
app.post('/api/credits/check', (req, res) => {
  const { userId = 'anonymous', planId = 'free' } = req.body || {};
  const summary = getCreditsSummary(userId, planId);
  const { getPlan, CREDIT_COSTS } = require('./src/config/plans');
  const plan = getPlan(planId);
  res.json({
    plan:           planId,
    planName:       plan.name,
    monthlyCredits: plan.limits.monthlyCredits,
    creditsEnabled: CREDITS_ENABLED,
    features:       plan.features,
    limits:         plan.limits,
    creditCosts:    CREDIT_COSTS,
    ...summary,
  });
});

// POST /api/billing/checkout
app.post('/api/billing/checkout', async (req, res) => {
  if (!BILLING_ENABLED || !stripe)
    return res.status(503).json({ error: 'Billing not configured.', code: 'BILLING_DISABLED' });
  try {
    const {
      priceId    = process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      successUrl = `${req.protocol}://${req.get('host')}/?checkout=success`,
      cancelUrl  = `${req.protocol}://${req.get('host')}/?checkout=cancel`,
    } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId is required.' });
    const session = await stripe.checkout.sessions.create({
      mode:       'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      billing_address_collection: 'auto',
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[/api/billing/checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large — max 50 MB.' });
  if (err.type === 'entity.too.large')  return res.status(413).json({ error: 'Request body too large.' });
  console.error('[unhandled]', err.message);
  res.status(500).json({ error: IS_PRODUCTION ? 'Internal server error.' : (err.message || 'Internal server error.') });
});

// ══════════════════════════════════════════════════════════════════════════════
// TOKENIA V8 — INTERNAL ANALYTICS + MONITORING (No third-party dependencies)
// ══════════════════════════════════════════════════════════════════════════════

const LOGS_DIR     = path.join(__dirname, 'logs');
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'tokenia-admin-2026';
const _serverStart = Date.now();

// Ensure logs directory exists
try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch {}

// ── Anonymous session hash ────────────────────────────────────────────────────
function anonHash(req) {
  const date = new Date().toISOString().split('T')[0];
  const raw  = (req.ip || '') + (req.headers['user-agent'] || '') + date;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

// ── Append to daily JSONL log ─────────────────────────────────────────────────
function appendLog(filename, obj) {
  try {
    const date  = new Date().toISOString().split('T')[0];
    const fpath = path.join(LOGS_DIR, `${filename}-${date}.jsonl`);
    fs.appendFileSync(fpath, JSON.stringify(obj) + '\n');
  } catch {}
}

// ── Rotate logs older than 30 days ───────────────────────────────────────────
function rotateLogs() {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    fs.readdirSync(LOGS_DIR).forEach(f => {
      const fp = path.join(LOGS_DIR, f);
      const st = fs.statSync(fp);
      if (st.mtimeMs < cutoff) fs.unlinkSync(fp);
    });
  } catch {}
}
setInterval(rotateLogs, 24 * 60 * 60 * 1000); // daily rotation check

// ── POST /api/track — privacy-first analytics ────────────────────────────────
app.post('/api/track', (req, res) => {
  const { event, props = {}, page, lang } = req.body || {};
  if (!event) return res.status(400).json({ error: 'event required' });

  // Strip query strings from page + referrer
  const cleanPage = (page || '/').split('?')[0].slice(0, 120);
  const referrer  = (req.headers.referer || '').replace(/\?.*/, '').slice(0, 120);

  appendLog('analytics', {
    ts:       new Date().toISOString(),
    event:    String(event).slice(0, 60),
    session:  anonHash(req),
    page:     cleanPage,
    lang:     String(lang || 'en').slice(0, 5),
    ref:      referrer,
    country:  req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || null,
    props:    Object.fromEntries(Object.entries(props || {}).map(([k,v]) => [k, String(v).slice(0, 80)])),
  });

  res.json({ ok: true });
});

// ── POST /api/log-error — client-side error tracking ─────────────────────────
app.post('/api/log-error', (req, res) => {
  const { message, stack, page } = req.body || {};
  appendLog('errors', {
    ts:      new Date().toISOString(),
    session: anonHash(req),
    page:    (page || '/').split('?')[0].slice(0, 120),
    message: String(message || '').slice(0, 200),
    stack:   String(stack || '').slice(0, 500),
  });
  res.json({ ok: true });
});

// ── GET /api/analytics — aggregated data for admin dashboard ─────────────────
app.get('/api/analytics', (req, res) => {
  // Basic auth check
  const auth = req.headers.authorization || '';
  const b64  = auth.replace('Basic ', '');
  let pass   = '';
  try { pass = Buffer.from(b64, 'base64').toString().split(':')[1] || ''; } catch {}
  if (pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const days    = parseInt(req.query.days || '7', 10);
    const cutoff  = Date.now() - days * 24 * 60 * 60 * 1000;
    const events  = {};     // event → count
    const pages   = {};     // page → count
    const langs   = {};     // lang → count
    const byDay   = {};     // date → count
    const countries = {};   // country → count
    let   totalSessions = new Set();

    fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('analytics-') && f.endsWith('.jsonl'))
      .forEach(f => {
        const date = f.replace('analytics-', '').replace('.jsonl', '');
        if (new Date(date).getTime() < cutoff) return;
        const lines = fs.readFileSync(path.join(LOGS_DIR, f), 'utf8').split('\n').filter(Boolean);
        lines.forEach(line => {
          try {
            const obj = JSON.parse(line);
            events[obj.event]       = (events[obj.event] || 0) + 1;
            pages[obj.page]         = (pages[obj.page] || 0) + 1;
            langs[obj.lang]         = (langs[obj.lang] || 0) + 1;
            byDay[date]             = (byDay[date] || 0) + 1;
            if (obj.country) countries[obj.country] = (countries[obj.country] || 0) + 1;
            if (obj.session) totalSessions.add(obj.session);
          } catch {}
        });
      });

    res.json({
      days,
      totalEvents: Object.values(events).reduce((a,b)=>a+b, 0),
      uniqueSessions: totalSessions.size,
      events:    sortDesc(events),
      pages:     sortDesc(pages),
      langs:     sortDesc(langs),
      byDay:     byDay,
      countries: sortDesc(countries),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function sortDesc(obj) {
  return Object.entries(obj).sort(([,a],[,b])=>b-a).slice(0, 20).reduce((acc,[k,v])=>({...acc,[k]:v}), {});
}

// ── GET /admin/stats — protected HTML dashboard ───────────────────────────────
function requireAdminAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Tokenia Admin"');
    return res.status(401).send('Authentication required');
  }
  try {
    const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString();
    const pass    = decoded.split(':')[1] || '';
    if (pass !== ADMIN_PASS) throw new Error('bad pass');
  } catch {
    res.setHeader('WWW-Authenticate', 'Basic realm="Tokenia Admin"');
    return res.status(401).send('Wrong password');
  }
  next();
}

app.get('/admin/stats', requireAdminAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'stats.html'));
});

// ── Enhanced GET /api/health ──────────────────────────────────────────────────
// Override the previous simple /api/health from server setup routes section
app.get('/api/health-detail', (_req, res) => {
  const mem    = process.memoryUsage();
  const limit  = 512;
  const memMB  = Math.round(mem.rss / 1024 / 1024);
  const models = Object.values(MODELS).reduce((a, p) => a + Object.keys(p.models || p).length, 0);

  res.json({
    status:              memMB < limit * 0.9 ? 'ok' : 'degraded',
    uptime_seconds:      Math.round((Date.now() - _serverStart) / 1000),
    uptime_human:        formatUptime(Date.now() - _serverStart),
    memory_mb:           memMB,
    memory_limit_mb:     limit,
    memory_percent:      Math.round((memMB / limit) * 100),
    models_loaded:       models,
    last_pricing_update: '2026-05-31T00:00:00Z',
    version:             'v8.0.0',
    environment:         NODE_ENV,
    response_time_ms:    0, // measured client-side
    node_version:        process.version,
  });
});

function formatUptime(ms) {
  const s = Math.floor(ms/1000);
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return [d&&`${d}d`, h&&`${h}h`, m&&`${m}m`, `${s%60}s`].filter(Boolean).join(' ');
}

// ── Internal heartbeat — self-monitoring every 5 minutes ─────────────────────
let _heartbeatFails = 0;
const _heartbeatInterval = setInterval(async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _heartbeatFails = 0;
  } catch (err) {
    _heartbeatFails++;
    console.error(`[heartbeat] FAIL ${_heartbeatFails}/3: ${err.message}`);
    if (_heartbeatFails >= 3) {
      appendLog('alerts', { ts: new Date().toISOString(), type: 'health_degraded', msg: err.message });
      // Send email via Resend (if configured)
      if (process.env.RESEND_API_KEY) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Tokenia Alerts <noreply@mail.tokenia.live>', to: ['info@tokenia.live'],
            replyTo: 'info@tokenia.live',
            subject: `⚠️ Tokenia health degraded — ${new Date().toISOString()}`,
            html: `<p>Tokenia health check failed 3 consecutive times.</p><p>Error: ${err.message}</p><p>Time: ${new Date().toISOString()}</p>`,
          }),
        }).catch(() => {});
      }
      _heartbeatFails = 0;
    }
  }
}, 5 * 60 * 1000);

// ── Blog routes ───────────────────────────────────────────────────────────────
app.get('/blog',          (_req, res) => res.sendFile(path.join(__dirname, 'public/blog/index.html')));
app.get('/blog/feed.xml', (_req, res) => res.sendFile(path.join(__dirname, 'public/blog/feed.xml')));

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  // isRedisReady() from rateLimitRedis — non-blocking, best-effort flush
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Tokenia listening on port ${PORT} (${NODE_ENV})`);
  console.log('[server] Flags:', {
    auth:     AUTH_ENABLED,
    billing:  BILLING_ENABLED,
    stripe:   BILLING_ENABLED && !!stripe,
    credits:  CREDITS_ENABLED,
    history:  HISTORY_ENABLED,
    projects: PROJECTS_ENABLED,
    redis:    isRedisReady(),
    paid:     PAID_FEATURES_ENABLED,
  });
});

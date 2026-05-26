/**
 * Tokenix — server.js  (production-hardened)
 */
'use strict';

require('dotenv').config();

const REQUIRED_VARS = [];
const MISSING = REQUIRED_VARS.filter(v => !process.env[v]);
if (MISSING.length) {
  console.error(`[startup] Missing required env vars: ${MISSING.join(', ')}`);
  process.exit(1);
}

const express      = require('express');
const helmet       = require('helmet');
const morgan       = require('morgan');
const compression  = require('compression');
// Simple in-memory rate limiter — no external dependency needed
function rateLimit({ windowMs, max, message }) {
  const store = new Map(); // ip -> { count, resetAt }
  return function rateLimitMiddleware(req, res, next) {
    const ip  = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let rec   = store.get(ip);
    if (!rec || now > rec.resetAt) {
      rec = { count: 0, resetAt: now + windowMs };
      store.set(ip, rec);
    }
    rec.count++;
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - rec.count));
    res.setHeader('RateLimit-Reset', Math.ceil(rec.resetAt / 1000));
    if (rec.count > max) {
      return res.status(429).json(message || { error: 'Too many requests.' });
    }
    // Cleanup old entries periodically (every ~1000 requests)
    if (Math.random() < 0.001) {
      for (const [k, v] of store) if (now > v.resetAt) store.delete(k);
    }
    next();
  };
}
const multer       = require('multer');
const cors         = require('cors');
const path         = require('path');

const { tokenizeAll } = require('./src/tokenizers');
const { extractText } = require('./src/parsers');
const { cleanText }   = require('./src/cleaner');
const { retrieve }    = require('./src/retriever');
const MODELS          = require('./src/config/models');

const PORT                  = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV              = process.env.NODE_ENV || 'development';
const IS_PRODUCTION         = NODE_ENV === 'production';
const PAID_FEATURES_ENABLED = process.env.ENABLE_PAID_FEATURES === 'true';
const BILLING_ENABLED       = process.env.ENABLE_BILLING === 'true';
const API_KEY               = process.env.API_KEY || null;

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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(compression());
app.use(IS_PRODUCTION ? morgan('combined') : morgan('dev'));

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-API-Key'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: parseInt(process.env.RATE_LIMIT_MAX||'200',10), standardHeaders:true, legacyHeaders:false, message:{error:'Too many requests.'} });
const heavyLimiter   = rateLimit({ windowMs: 15*60*1000, max: parseInt(process.env.RATE_LIMIT_HEAVY_MAX||'30',10), standardHeaders:true, legacyHeaders:false, message:{error:'Too many requests to this endpoint.'} });
app.use('/api', generalLimiter);
app.use('/api/clean',    heavyLimiter);
app.use('/api/retrieve', heavyLimiter);
app.use('/api/tokenize', heavyLimiter);

const ALLOWED_EXTENSIONS = new Set([
  '.txt','.md','.pdf','.docx','.doc',
  '.js','.ts','.jsx','.tsx','.py','.rb','.go','.rs','.java','.kt','.swift',
  '.c','.cpp','.cs','.php','.sh','.bash','.zsh',
  '.sql','.html','.htm','.css','.scss',
  '.json','.yaml','.yml','.xml','.toml','.env','.r','.ipynb',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10*1024*1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    ALLOWED_EXTENSIONS.has(ext) ? cb(null, true) : cb(new Error('File type not supported: '+ext), false);
  },
});

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers['x-api-key'] || req.query.api_key;
  if (!provided) return res.status(401).json({ error: 'API key required.' });
  if (provided !== API_KEY) return res.status(403).json({ error: 'Invalid API key.' });
  next();
}

function requirePaid(req, res, next) {
  if (!PAID_FEATURES_ENABLED)
    return res.status(402).json({ error: 'This feature requires Pro. Set ENABLE_PAID_FEATURES=true.', code: 'FEATURE_LOCKED' });
  next();
}

app.use('/api', requireApiKey);

function textStats(text) {
  return { charCount: text.length, wordCount: text.split(/\s+/).filter(Boolean).length, lineCount: text.split('\n').length };
}

// ── FREE routes ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status:'ok', version: require('./package.json').version, env: NODE_ENV, uptime: Math.round(process.uptime()) });
});

app.get('/api/features', (_req, res) => {
  res.json({ paidFeaturesEnabled: PAID_FEATURES_ENABLED, billingEnabled: BILLING_ENABLED && !!stripe, features: { cleaner: PAID_FEATURES_ENABLED, retriever: PAID_FEATURES_ENABLED } });
});

app.get('/api/models', (_req, res) => res.json(MODELS));

app.post('/api/tokenize', async (req, res) => {
  try {
    const { text } = req.body;
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

// ── PRO routes ───────────────────────────────────────────────────────────────

app.post('/api/clean', requirePaid, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const rawText = await extractText(req.file.buffer, req.file.originalname);
    if (!rawText || rawText.trim().length === 0)
      return res.status(422).json({ error: 'Could not extract text from this file.' });

    const { cleanText: cleaned, stats: cleanerStats } = cleanText(rawText, req.file.originalname);
    const [origResults, cleanResults] = await Promise.all([ tokenizeAll(rawText), tokenizeAll(cleaned) ]);

    const tokenComparison = origResults.map((orig, i) => {
      const cl = cleanResults[i];
      const saved = orig.tokens - cl.tokens;
      const pctSaved = orig.tokens > 0 ? (saved / orig.tokens) * 100 : 0;
      return {
        provider: orig.provider, providerName: orig.providerName,
        model: orig.model, modelName: orig.modelName,
        originalTokens: orig.tokens, cleanTokens: cl.tokens,
        tokensSaved: saved, pctSaved: Math.round(pctSaved*10)/10,
        moneySaved: (saved/1e6)*orig.inputPer1M,
        exact: orig.exact, inputPer1M: orig.inputPer1M,
      };
    });

    res.json({ filename: req.file.originalname, filesize: req.file.size, originalText: rawText, cleanText: cleaned, originalStats: textStats(rawText), cleanStats: textStats(cleaned), tokenComparison, cleanerStats });
  } catch (err) {
    console.error('[/api/clean]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/retrieve', requirePaid, upload.single('file'), async (req, res) => {
  try {
    let documentText, query, topK;
    if (req.file) {
      documentText = await extractText(req.file.buffer, req.file.originalname);
      query = (req.body.query || '').trim();
      topK  = parseInt(req.body.topK, 10) || 5;
    } else if (req.body && req.body.text) {
      documentText = req.body.text;
      query = (req.body.query || '').trim();
      topK  = parseInt(req.body.topK, 10) || 5;
    } else {
      return res.status(400).json({ error: 'Send a file (multipart) or { text, query } (JSON).' });
    }

    if (!documentText || documentText.trim().length === 0)
      return res.status(422).json({ error: 'Could not extract text from the document.' });
    if (!query)
      return res.status(400).json({ error: '"query" is required.' });
    if (topK < 1 || topK > 20) topK = 5;

    const { chunks, totalChunks, chunkSize, overlap } = retrieve(documentText, query, topK);
    const retrievedText = chunks.map(c => c.text).join('\n\n---\n\n');
    const [fullResults, retrievedResults] = await Promise.all([ tokenizeAll(documentText), tokenizeAll(retrievedText) ]);

    const tokenComparison = fullResults.map((full, i) => {
      const ret = retrievedResults[i];
      const saved = full.tokens - ret.tokens;
      const pctSaved = full.tokens > 0 ? (saved / full.tokens) * 100 : 0;
      return {
        provider: full.provider, providerName: full.providerName,
        model: full.model, modelName: full.modelName,
        fullTokens: full.tokens, retrievedTokens: ret.tokens,
        tokensSaved: saved, pctSaved: Math.round(pctSaved*10)/10,
        moneySaved: (saved/1e6)*full.inputPer1M,
        exact: full.exact, inputPer1M: full.inputPer1M,
      };
    });

    res.json({ query, filename: req.file ? req.file.originalname : null, totalChunks, returnedChunks: chunks.length, chunkSize, overlap, retrievedText, chunks, tokenComparison });
  } catch (err) {
    console.error('[/api/retrieve]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── BILLING routes (Stripe scaffold) ────────────────────────────────────────

app.post('/api/billing/checkout', async (req, res) => {
  if (!BILLING_ENABLED || !stripe)
    return res.status(503).json({ error: 'Billing not configured.', code: 'BILLING_DISABLED' });
  try {
    const { priceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID, successUrl = `${req.protocol}://${req.get('host')}/?checkout=success`, cancelUrl = `${req.protocol}://${req.get('host')}/?checkout=cancel` } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId is required.' });
    const session = await stripe.checkout.sessions.create({ mode:'subscription', line_items:[{price:priceId,quantity:1}], success_url:successUrl, cancel_url:cancelUrl, billing_address_collection:'auto' });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[/api/billing/checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/billing/webhook', express.raw({ type:'application/json' }), async (req, res) => {
  if (!BILLING_ENABLED || !stripe) return res.status(503).json({ error: 'Billing not configured.' });
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = secret ? stripe.webhooks.constructEvent(req.body, sig, secret) : JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).json({ error: 'Webhook error: ' + err.message });
  }
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('[billing] Checkout completed — email:', event.data.object.customer_details?.email);
      // TODO: provision Pro access for this customer
      break;
    case 'customer.subscription.deleted':
      console.log('[billing] Subscription cancelled — customer:', event.data.object.customer);
      // TODO: revoke Pro access for this customer
      break;
    case 'invoice.payment_failed':
      console.warn('[billing] Payment failed — customer:', event.data.object.customer);
      break;
    default: break;
  }
  res.json({ received: true });
});

// ── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large — max 10 MB.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
  console.error('[unhandled]', err.message);
  res.status(500).json({ error: IS_PRODUCTION ? 'Internal server error.' : (err.message || 'Internal server error.') });
});

// Catch-all SPA
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));


// Graceful shutdown
function gracefulShutdown(signal) {
  console.log('[shutdown] ' + signal + ' received - closing server...');
  server.close(function() {
    console.log('[shutdown] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(function() {
    console.error('[shutdown] Forced exit after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', function() { gracefulShutdown('SIGTERM'); });
process.on('SIGINT',  function() { gracefulShutdown('SIGINT'); });

// Start server
var server = app.listen(PORT, function() {
  console.log('[tokenix] Server running on port ' + PORT + ' (' + NODE_ENV + ')');
  console.log('[tokenix] Paid features: ' + PAID_FEATURES_ENABLED);
  console.log('[tokenix] Billing: ' + BILLING_ENABLED);
});

module.exports = app;

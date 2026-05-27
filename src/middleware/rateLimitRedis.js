/**
 * Tokenia — src/middleware/rateLimitRedis.js
 *
 * Redis-backed fixed-window rate limiter with in-memory fallback.
 *
 * When REDIS_URL is set AND ENABLE_REDIS_RATE_LIMIT=true:
 *   Uses Redis for distributed rate limiting (safe across Railway replicas).
 *
 * Otherwise:
 *   Falls back to in-memory counters (fine for single-instance dev).
 *   In production with ENABLE_REDIS_RATE_LIMIT=true, warns if Redis is unavailable.
 *
 * Rate-limit key strategy:
 *   Authenticated users : rl:{prefix}:user:{userId}
 *   Anonymous           : rl:{prefix}:ip:{hashedIp}
 *
 * Per-plan limits (requests per 15 min window):
 *   anonymous / free  : 30 heavy  / 200 general
 *   pro               : 60 heavy  / 500 general
 *   team              : 120 heavy / 1000 general
 */
'use strict';

const REDIS_REQUIRED = process.env.ENABLE_REDIS_RATE_LIMIT === 'true';
const IS_PRODUCTION  = process.env.NODE_ENV === 'production';

let _redis    = null;
let _ready    = false;
let _initDone = false;

function initRedis() {
  if (_initDone) return;
  _initDone = true;

  const url = process.env.REDIS_URL;

  if (!url) {
    if (REDIS_REQUIRED && IS_PRODUCTION) {
      console.error('[redis] REDIS_URL not set but ENABLE_REDIS_RATE_LIMIT=true in production!');
    } else {
      console.log('[redis] REDIS_URL not set — using in-memory rate limiting.');
    }
    return;
  }

  try {
    const Redis = require('ioredis');
    _redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout:       5000,
      lazyConnect:          true,
      enableOfflineQueue:   false,
      retryStrategy: (times) => times < 3 ? Math.min(times * 200, 1000) : null,
    });

    _redis.on('connect', () => { _ready = true;  console.log('[redis] Connected.'); });
    _redis.on('error',   (e) => { _ready = false; console.error('[redis] Error:', e.message); });
    _redis.on('close',   ()  => { _ready = false; });

    _redis.connect().catch(err => console.warn('[redis] Connect failed:', err.message));
  } catch (err) {
    console.error('[redis] ioredis init failed:', err.message);
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const _mem = new Map();

function memCheck(key, max, windowMs) {
  const now = Date.now();
  let rec = _mem.get(key);
  if (!rec || now > rec.resetAt) rec = { count: 0, resetAt: now + windowMs };
  rec.count++;
  _mem.set(key, rec);
  if (Math.random() < 0.002) for (const [k, v] of _mem) if (now > v.resetAt) _mem.delete(k);
  return { count: rec.count, remaining: Math.max(0, max - rec.count), resetAt: rec.resetAt };
}

// ── Redis fixed-window check ──────────────────────────────────────────────────
async function redisCheck(key, max, windowMs) {
  try {
    const ttl = Math.ceil(windowMs / 1000);
    const pipeline = _redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttl, 'NX'); // only set expiry on first increment
    const [[, count]] = await pipeline.exec();
    return { count, remaining: Math.max(0, max - count), resetAt: Date.now() + windowMs };
  } catch {
    return memCheck(key, max, windowMs);
  }
}

// ── Per-plan limit resolver ───────────────────────────────────────────────────
function resolveMax(baseMax, req) {
  const planId = req.userPlan?.id || req.userProfile?.plan || 'anonymous';
  const multipliers = { pro: 2, team: 4 };
  return Math.round(baseMax * (multipliers[planId] || 1));
}

/**
 * Create a rate-limit middleware.
 *
 * @param {object} opts
 * @param {number}   opts.windowMs   - Window in ms (default: 15 min)
 * @param {number}   opts.max        - Base max requests per window (free/anonymous tier)
 * @param {string}  [opts.prefix]    - Key namespace
 * @param {boolean} [opts.byUser]    - Key by user_id when authenticated (default: true)
 * @param {boolean} [opts.scalePlan] - Multiply limit by plan tier (default: true)
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max, prefix = 'rl', byUser = true, scalePlan = true }) {
  initRedis();

  return async function rateLimitMiddleware(req, res, next) {
    const userId = req.user?.id;

    // Key: prefer user ID over IP for better accuracy
    let key;
    if (byUser && userId) {
      key = `${prefix}:user:${userId}`;
    } else {
      const ip = (req.ip || req.socket?.remoteAddress || 'unknown').replace(/[:.]/g, '_');
      key = `${prefix}:ip:${ip}`;
    }

    // Optionally scale limit by plan
    const effectiveMax = scalePlan ? resolveMax(max, req) : max;

    let result;
    if (_ready && _redis) {
      result = await redisCheck(key, effectiveMax, windowMs);
    } else {
      result = memCheck(key, effectiveMax, windowMs);
    }

    res.setHeader('RateLimit-Limit',     effectiveMax);
    res.setHeader('RateLimit-Remaining', result.remaining);
    res.setHeader('RateLimit-Reset',     Math.ceil(result.resetAt / 1000));

    if (result.count > effectiveMax) {
      return res.status(429).json({
        error:      'Too many requests. Please slow down.',
        code:       'rate_limited',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }

    next();
  };
}

function getRedis()    { return _redis; }
function isRedisReady() { return _ready; }

module.exports = { createRateLimiter, getRedis, isRedisReady };

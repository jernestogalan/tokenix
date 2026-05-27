/**
 * Tokenia — src/middleware/usageLimits.js
 *
 * Monthly token quota enforcement + usage recording.
 *
 * Request pipeline (applied to every paid endpoint):
 *   1. identify user (req.user) or IP (anonymous)
 *   2. get plan from req.userPlan (set by auth.js)
 *   3. checkUsageQuota() — block if monthly limit exceeded
 *   4. [handler processes request, computes tokens]
 *   5. recordUsage() — logs to Supabase + increments counter (async, non-blocking)
 *
 * Plan monthly token limits:
 *   free  →    50,000 tokens
 *   pro   → 1,000,000 tokens
 *   team  → 5,000,000 tokens (Infinity in practice)
 *
 * When ENABLE_AUTH=false (dev / no Supabase):
 *   - checkUsageQuota() always passes through
 *   - recordUsage() no-ops
 */
'use strict';

const { getProfile, incrementUsage, logUsageEvent } = require('../lib/supabase');
const { getPlan } = require('../config/plans');

const AUTH_ENABLED = process.env.ENABLE_AUTH === 'true';

// Authoritative monthly token limits per plan (tokens, not credits)
const MONTHLY_TOKEN_LIMITS = {
  free: 50_000,
  pro:  1_000_000,
  team: Infinity,    // Team has no hard cap in this phase
};

/**
 * checkUsageQuota — Express middleware.
 *
 * Reads the user's monthly_tokens_used from their profile (already fetched
 * by auth.js into req.userProfile) and blocks with 429 if over limit.
 * Anonymous users always pass through.
 */
async function checkUsageQuota(req, res, next) {
  // No-op when auth is disabled (dev mode)
  if (!AUTH_ENABLED) return next();
  // Anonymous users are not quota-checked here (rate limiter handles abuse)
  if (!req.user || !req.userProfile) return next();

  try {
    const profile = req.userProfile;
    const planId  = profile.plan || 'free';
    const limit   = MONTHLY_TOKEN_LIMITS[planId] ?? MONTHLY_TOKEN_LIMITS.free;

    if (limit === Infinity) return next();

    const used = profile.monthly_tokens_used || 0;

    if (used >= limit) {
      const plan = getPlan(planId);
      return res.status(429).json({
        error:    `Monthly token limit reached. Your ${plan.name} plan allows ${limit.toLocaleString()} tokens/month. Resets next month.`,
        code:     'monthly_limit_reached',
        used,
        limit,
        plan:     planId,
        planName: plan.name,
        upgrade:  planId === 'free' ? 'pro' : 'team',
        message:  planId === 'free'
          ? 'Tu límite mensual gratuito ha sido alcanzado. Próximamente: upgrade a Pro.'
          : 'Tu límite mensual ha sido alcanzado. Próximamente: upgrade a Team.',
      });
    }

    // Attach for response enrichment
    req.usageInfo = { used, limit, planId };
  } catch (err) {
    // Never block on error — log and continue
    console.error('[usageLimits] checkUsageQuota error:', err.message);
  }

  next();
}

/**
 * recordUsage — call AFTER the route handler has computed token counts.
 * Fire-and-forget: does NOT block the response.
 *
 * @param {object} req            - Express request (provides user + plan context)
 * @param {object} opts
 * @param {string}  opts.eventType     - 'count_text' | 'count_file' | 'clean' | 'retrieve' | 'export'
 * @param {number}  opts.inputTokens   - tokens processed (for quota tracking)
 * @param {number} [opts.outputTokens]
 * @param {number} [opts.estimatedCost]
 * @param {string} [opts.model]        - 'openai:gpt-4o' etc.
 * @param {string} [opts.filename]
 * @param {object} [opts.metadata]
 */
function recordUsage(req, opts) {
  if (!AUTH_ENABLED) return;

  const userId    = req.user?.id    || null;
  const planAtTime = req.userPlan?.id || req.userProfile?.plan || 'free';
  const {
    eventType, inputTokens = 0, outputTokens = 0,
    estimatedCost = 0, model, filename, metadata,
  } = opts;

  // Log usage event (async, never await)
  logUsageEvent({
    userId,
    sessionId:     req.sessionId || null,
    eventType,
    model,
    inputTokens,
    outputTokens,
    estimatedCost,
    planAtTime,
    filename,
    metadata,
  }).catch(err => console.error('[usageLimits] logUsageEvent failed:', err.message));

  // Increment monthly counter for logged-in users
  if (userId && inputTokens > 0) {
    incrementUsage(userId, inputTokens)
      .catch(err => console.error('[usageLimits] incrementUsage failed:', err.message));
  }
}

/**
 * buildUsageSummary — include in API responses for logged-in users.
 * Returns null for anonymous users or when auth is disabled.
 */
function buildUsageSummary(req) {
  if (!AUTH_ENABLED || !req.user || !req.usageInfo) return null;
  const { used, limit, planId } = req.usageInfo;
  const pct = limit !== Infinity && limit > 0
    ? Math.min(100, Math.round((used / limit) * 100))
    : null;
  return {
    plan:               planId,
    monthlyTokensUsed:  used,
    monthlyTokensLimit: limit === Infinity ? null : limit,
    percentUsed:        pct,
    message: pct !== null && pct >= 80
      ? `${pct}% of monthly limit used.`
      : null,
  };
}

module.exports = { checkUsageQuota, recordUsage, buildUsageSummary };

/**
 * Tokenia — src/lib/entitlements.js
 *
 * Feature gate. Call checkEntitlement() before any paid operation.
 *
 * Plan resolution priority:
 *   1. req.userPlan — set by auth.js after JWT verification (production)
 *   2. ?plan= query param or X-Plan header — only if ALLOW_PLAN_QUERY_OVERRIDE=true
 *      AND NODE_ENV !== 'production' (development testing only)
 *   3. ENABLE_PAID_FEATURES flag — global dev override
 *   4. Default: 'free'
 */
'use strict';

const { getPlan, CREDIT_COSTS } = require('../config/plans');

const IS_PRODUCTION       = process.env.NODE_ENV === 'production';
const ALLOW_PLAN_OVERRIDE = process.env.ALLOW_PLAN_QUERY_OVERRIDE === 'true';
const CAN_OVERRIDE_PLAN   = ALLOW_PLAN_OVERRIDE && !IS_PRODUCTION;

/**
 * Infer the plan for a given request.
 *
 * Priority:
 *   1. req.userPlan (set by auth middleware from Supabase JWT)
 *   2. ?plan= / X-Plan header (dev only, requires ALLOW_PLAN_QUERY_OVERRIDE=true)
 *   3. ENABLE_PAID_FEATURES toggle
 *   4. 'free' default
 */
function getPlanForRequest(req) {
  // 1. Auth middleware resolved a real plan from Supabase
  if (req && req.userPlan) {
    return req.userPlan;
  }

  // 2. Dev override via query param or header
  if (CAN_OVERRIDE_PLAN) {
    const planParam = (req && req.query && req.query.plan)
      || (req && req.headers && req.headers['x-plan'])
      || null;
    if (planParam && ['free', 'pro', 'team'].includes(planParam)) {
      return getPlan(planParam);
    }
  }

  // 3. Global paid features flag
  const paidEnabled = process.env.ENABLE_PAID_FEATURES === 'true';
  return getPlan(paidEnabled ? 'pro' : 'free');
}

/**
 * Check whether a request is entitled to run a feature.
 *
 * @param {object} opts
 * @param {object}  opts.req               - Express request (for plan inference)
 * @param {string}  opts.feature           - Feature name (matches CREDIT_COSTS keys)
 * @param {number}  [opts.fileSizeBytes]   - File size if uploading
 * @param {number}  [opts.docChars]        - Document char count for retrieval
 * @param {number}  [opts.estimatedCost]   - Estimated dollar cost (future use)
 *
 * @returns {{ allowed: boolean, plan: object, reason?: string, code?: string, upgrade?: string }}
 */
function checkEntitlement(opts) {
  const { req, feature, fileSizeBytes, docChars } = opts;

  const plan = getPlanForRequest(req);

  // ── File size check ────────────────────────────────────────────────────────
  if (fileSizeBytes != null) {
    const limit = plan.limits.maxFileSizeBytes;
    if (fileSizeBytes > limit) {
      const limitMB = (limit / (1024 * 1024)).toFixed(0);
      return {
        allowed: false,
        plan,
        code: 'file_too_large',
        reason: `File exceeds the ${limitMB} MB limit for your plan.`,
        upgrade: plan.id === 'free' ? 'pro' : 'team',
      };
    }
  }

  // ── Feature-specific checks ────────────────────────────────────────────────
  switch (feature) {

    case 'countText':
    case 'countFile':
      // Always allowed — just check file size (done above)
      return { allowed: true, plan };

    case 'cleanDemo':
      if (!plan.features.cleaningDemo)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'Document cleaning requires a paid plan.', upgrade: 'pro' };
      return { allowed: true, plan, demoMode: !plan.features.cleaningFull, demoLimit: plan.limits.maxCleaningChars };

    case 'cleanFull':
      if (!plan.features.cleaningFull)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'Full document cleaning requires Pro or Team.', upgrade: 'pro' };
      if (process.env.ENABLE_CREDITS === 'true' && CREDIT_COSTS.cleanFull > 0) {
        // TODO: check credits ledger
      }
      return { allowed: true, plan };

    case 'ragDemo':
      if (!plan.features.ragDemo)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'RAG retrieval requires a paid plan.', upgrade: 'pro' };
      return { allowed: true, plan, demoMode: !plan.features.ragFull, demoTopK: plan.limits.maxRetrievalChunks };

    case 'ragFull':
      if (!plan.features.ragFull)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'Full RAG retrieval requires Pro or Team.', upgrade: 'pro' };
      if (docChars != null && plan.limits.maxRetrievalCharsDoc !== Infinity && docChars > plan.limits.maxRetrievalCharsDoc)
        return { allowed: false, plan, code: 'document_too_large', reason: `Document too large for your plan (max ${(plan.limits.maxRetrievalCharsDoc / 1000).toFixed(0)}K chars).`, upgrade: 'pro' };
      return { allowed: true, plan };

    case 'csvExport':
      if (!plan.features.csvExport)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'CSV export requires Pro or Team.', upgrade: 'pro' };
      return { allowed: true, plan };

    case 'pdfExport':
      if (!plan.features.pdfExport)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'PDF export requires Pro or Team.', upgrade: 'pro' };
      return { allowed: true, plan };

    case 'apiAccess':
      if (!plan.features.apiAccess)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'REST API access requires Pro or Team.', upgrade: 'pro' };
      return { allowed: true, plan };

    case 'batchUpload':
      if (!plan.features.batchUpload)
        return { allowed: false, plan, code: 'upgrade_required', reason: 'Batch file upload requires Pro or Team.', upgrade: 'pro' };
      return { allowed: true, plan };

    default:
      // Unknown feature — deny by default
      return { allowed: false, plan, code: 'unknown_feature', reason: `Unknown feature: ${feature}` };
  }
}

/**
 * Express middleware that checks entitlement and returns 402/403 if denied.
 * Usage: app.post('/api/clean', requireEntitlement('cleanFull'), handler)
 */
function requireEntitlement(feature, opts = {}) {
  return function entitlementMiddleware(req, res, next) {
    const fileSizeBytes = req.file ? req.file.size : (opts.fileSizeBytes || null);
    const result = checkEntitlement({ req, feature, fileSizeBytes, ...opts });

    if (!result.allowed) {
      const billingDisabled = process.env.ENABLE_BILLING !== 'true';
      return res.status(402).json({
        error: result.reason || 'This feature requires a paid plan.',
        code: result.code,
        upgrade: result.upgrade,
        billingDisabled,
        plan: result.plan.id,
      });
    }

    // Attach entitlement context to req for downstream handlers
    req.entitlement = result;
    next();
  };
}

module.exports = { checkEntitlement, getPlanForRequest, requireEntitlement };

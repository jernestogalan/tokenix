/**
 * Tokenia — src/middleware/auth.js
 *
 * Optional Supabase JWT authentication middleware.
 *
 * When ENABLE_AUTH=true:
 *   - Reads Bearer token from Authorization header
 *   - Verifies JWT with Supabase
 *   - Fetches the user's profile (plan, credits, usage)
 *   - Attaches req.user and req.userPlan to the request
 *
 * When ENABLE_AUTH=false (or Supabase not configured):
 *   - req.user  = null
 *   - req.userPlan falls through to entitlements.js plan detection
 *     (?plan= param or ENABLE_PAID_FEATURES flag)
 *
 * SECURITY NOTE:
 *   ?plan= query override is only allowed in development when
 *   ALLOW_PLAN_QUERY_OVERRIDE=true. Never enable this in production.
 */
'use strict';

const { verifyJwt, getProfile } = require('../lib/supabase');
const { getPlan }               = require('../config/plans');

const AUTH_ENABLED           = process.env.ENABLE_AUTH === 'true';
const ALLOW_PLAN_OVERRIDE    = process.env.ALLOW_PLAN_QUERY_OVERRIDE === 'true';
const IS_PRODUCTION          = process.env.NODE_ENV === 'production';

// Block override in production regardless of env flag
const CAN_OVERRIDE_PLAN = ALLOW_PLAN_OVERRIDE && !IS_PRODUCTION;

/**
 * attachUser — middleware that optionally authenticates and always attaches
 * req.user and req.userPlan so downstream handlers have a consistent interface.
 */
async function attachUser(req, _res, next) {
  req.user     = null;
  req.userPlan = null;  // will be set by entitlements.js if still null

  if (!AUTH_ENABLED) {
    return next();
  }

  try {
    const authHeader = req.headers['authorization'] || '';
    const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return next();  // anonymous request — entitlements will decide plan

    const user = await verifyJwt(token);
    if (!user) return next();   // invalid token — treat as anonymous

    req.user = user;

    // Fetch profile for plan + usage info
    const profile = await getProfile(user.id);
    if (profile) {
      req.userProfile = profile;
      req.userPlan    = getPlan(profile.plan || 'free');
    } else {
      // Profile row doesn't exist yet (race with trigger) — default to free
      req.userPlan = getPlan('free');
    }
  } catch (err) {
    console.error('[auth] Error in attachUser:', err.message);
    // Don't block the request — degrade gracefully to anonymous
  }

  next();
}

/**
 * requireAuth — middleware that returns 401 if the user is not authenticated.
 * Use on routes that always need a logged-in user (e.g. history, projects).
 */
function requireAuth(req, res, next) {
  if (!AUTH_ENABLED) return next();  // auth disabled — always allow in dev
  if (!req.user) {
    return res.status(401).json({
      error:   'Authentication required.',
      code:    'auth_required',
      message: 'Please sign in to access this feature.',
    });
  }
  next();
}

/**
 * Build an auth status object for /api/auth/user response.
 *
 * Field names match the actual Supabase DB schema (profiles table):
 *   credits_remaining    (not credits_balance)
 *   monthly_tokens_used  (not monthly_tokens)
 *   monthly_token_limit  (the per-plan cap)
 */
function buildAuthStatus(req) {
  const profile = req.userProfile || null;
  const plan    = req.userPlan    || getPlan('free');

  return {
    authenticated: !!req.user,
    authEnabled:   AUTH_ENABLED,
    user: req.user ? {
      id:    req.user.id,
      email: req.user.email,
    } : null,
    profile: profile ? {
      plan:              profile.plan,
      creditsRemaining:  profile.credits_remaining   ?? 0,
      monthlyTokensUsed: profile.monthly_tokens_used  ?? 0,
      monthlyTokenLimit: profile.monthly_token_limit  ?? 50000,
      billingMonth:      profile.billing_month,
      role:              profile.role || 'user',
    } : null,
    plan: {
      id:         plan.id,
      name:       plan.name,
      badge:      plan.badge,
      badgeColor: plan.badgeColor,
    },
    devOverride: CAN_OVERRIDE_PLAN ? (req.query?.plan || null) : null,
  };
}

module.exports = { attachUser, requireAuth, buildAuthStatus };

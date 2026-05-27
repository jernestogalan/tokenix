/**
 * Tokenia — src/lib/credits.js
 *
 * Credits ledger module.
 *
 * MVP: In-memory ledger (resets on restart).
 * Production: Replace with Supabase/Postgres table `credits_ledger`.
 *
 * Schema (production):
 *   credits_ledger(id, user_id, amount, type, reason, metadata, created_at)
 *   type: 'grant' | 'consume' | 'refund' | 'purchase'
 */
'use strict';

const { CREDIT_COSTS, getPlan } = require('../config/plans');

// ── In-memory store (MVP only) ───────────────────────────────────────────────
// { userId -> { balance: number, entries: CreditsEntry[] } }
const _ledger = new Map();

// Monthly grants tracker: { userId -> { month: 'YYYY-MM', granted: boolean } }
const _monthlyGrants = new Map();

function _getUserRecord(userId) {
  if (!_ledger.has(userId)) {
    _ledger.set(userId, { balance: 0, entries: [] });
  }
  return _ledger.get(userId);
}

/**
 * Grant monthly credits to a user based on their plan.
 * In production: run as a cron job at billing period start.
 */
function grantMonthlyCred(userId, planId) {
  const plan = getPlan(planId);
  const credits = plan.limits.monthlyCredits;
  if (credits <= 0) return { granted: 0 };

  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const key = `${userId}:${month}`;

  if (_monthlyGrants.has(key)) {
    return { granted: 0, reason: 'Already granted this month' };
  }

  _monthlyGrants.set(key, true);
  return addCredits({ userId, amount: credits, type: 'grant', reason: `Monthly grant for ${plan.name} plan` });
}

/**
 * Add credits to a user's balance.
 */
function addCredits({ userId, amount, type = 'grant', reason = '', metadata = {} }) {
  const rec = _getUserRecord(userId);
  rec.balance += amount;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    amount,
    type,
    reason,
    metadata,
    createdAt: new Date().toISOString(),
  };
  rec.entries.push(entry);
  return { balance: rec.balance, entry };
}

/**
 * Get a user's current balance.
 */
function getBalance(userId) {
  const rec = _getUserRecord(userId);
  return rec.balance;
}

/**
 * Get a user's ledger entries.
 */
function getLedger(userId, limit = 50) {
  const rec = _getUserRecord(userId);
  return rec.entries.slice(-limit).reverse();
}

/**
 * Check if a user can afford a feature.
 *
 * @param {string} userId
 * @param {string} feature  - key in CREDIT_COSTS
 * @returns {{ canAfford: boolean, cost: number, balance: number }}
 */
function canAfford(userId, feature) {
  const cost = CREDIT_COSTS[feature] || 0;
  if (cost === 0) return { canAfford: true, cost: 0, balance: getBalance(userId) };

  if (process.env.ENABLE_CREDITS !== 'true') {
    // Credits disabled — always allow (soft enforcement only)
    return { canAfford: true, cost, balance: Infinity };
  }

  const balance = getBalance(userId);
  return { canAfford: balance >= cost, cost, balance };
}

/**
 * Consume credits for a feature.
 * Returns the ledger entry or an error object.
 *
 * Usage:
 *   const result = await consumeCredits(userId, 'cleanFull', { docId: '...' });
 *   if (!result.ok) return res.status(402).json({ error: result.reason });
 */
function consumeCredits(userId, feature, metadata = {}) {
  const { canAfford: affordable, cost, balance } = canAfford(userId, feature);

  if (!affordable) {
    return { ok: false, code: 'credits_required', reason: `Not enough credits. Needed: ${cost}, available: ${balance}.`, cost, balance };
  }

  if (cost === 0) return { ok: true, cost: 0, balance };

  const rec = _getUserRecord(userId);
  rec.balance -= cost;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    amount: -cost,
    type: 'consume',
    reason: `Used feature: ${feature}`,
    metadata,
    createdAt: new Date().toISOString(),
  };
  rec.entries.push(entry);

  return { ok: true, cost, balance: rec.balance, entry };
}

/**
 * Refund credits (e.g., on error).
 */
function refundCredits(userId, amount, reason = 'Refund', metadata = {}) {
  return addCredits({ userId, amount, type: 'refund', reason, metadata });
}

/**
 * Get a summary for the API response.
 */
function getCreditsSummary(userId, planId) {
  const plan = getPlan(planId);
  const balance = getBalance(userId);
  return {
    balance,
    monthlyLimit: plan.limits.monthlyCredits,
    plan: plan.id,
    creditsEnabled: process.env.ENABLE_CREDITS === 'true',
  };
}

module.exports = {
  addCredits,
  grantMonthlyCred,
  getBalance,
  getLedger,
  canAfford,
  consumeCredits,
  refundCredits,
  getCreditsSummary,
  CREDIT_COSTS,
};

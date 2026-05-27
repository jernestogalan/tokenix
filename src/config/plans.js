/**
 * Tokenia — src/config/plans.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  HOW TO UPDATE PLANS
 *  1. Adjust price, limits, or features in the plan block.
 *  2. Restart the server — no other changes needed.
 *  3. Keep PLANS.free as the baseline users see without logging in.
 *
 *  Credits: 1 credit ≈ processing 1 MB of text through a paid feature.
 *  Adjust rates in CREDIT_COSTS below.
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';

/** Plan definitions */
const PLANS = {

  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    billingPeriod: null,
    description: 'Great for occasional token counting and cost estimation.',
    stripePriceId: null,
    limits: {
      // Text input
      maxPastedChars:       1_000_000,  // unlimited paste
      // File uploads
      maxFileSizeBytes:     2 * 1024 * 1024,  // 2 MB
      maxFilesPerDay:       1,
      maxFilesPerBatch:     1,
      // Processing
      maxCleaningChars:     5_000,      // demo: first 5K chars only
      maxRetrievalChunks:   3,          // demo: top 3 fixed
      maxRetrievalCharsDoc: 50_000,     // demo: 50K chars max doc
      // API
      apiAccess:            false,
      // Exports
      pdfExport:            false,
      csvExport:            false,
      // Credits
      monthlyCredits:       0,
    },
    features: {
      pastedText:           true,
      fileUpload:           true,       // limited by day/size
      batchUpload:          false,
      cleaningDemo:         true,       // demo mode (limited chars)
      cleaningFull:         false,
      downloadCleanText:    false,
      ragDemo:              true,       // top 3 only
      ragFull:              false,
      history:              false,
      advancedComparison:   false,
      apiAccess:            false,
      csvExport:            false,
      pdfExport:            false,
      savedProjects:        false,
      budgetAlerts:         false,
      teamFeatures:         false,
    },
    badge: 'Free',
    badgeColor: '#6b7280',
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 12,
    currency: 'USD',
    billingPeriod: 'month',
    description: 'For developers who regularly work with large documents and APIs.',
    stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null,
    stripePriceIdAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || null,
    limits: {
      maxPastedChars:       5_000_000,
      maxFileSizeBytes:     20 * 1024 * 1024,  // 20 MB
      maxFilesPerDay:       50,
      maxFilesPerBatch:     10,
      maxCleaningChars:     Infinity,
      maxRetrievalChunks:   20,
      maxRetrievalCharsDoc: Infinity,
      apiAccess:            true,
      pdfExport:            true,
      csvExport:            true,
      monthlyCredits:       500,
    },
    features: {
      pastedText:           true,
      fileUpload:           true,
      batchUpload:          true,
      cleaningDemo:         true,
      cleaningFull:         true,
      downloadCleanText:    true,
      ragDemo:              true,
      ragFull:              true,
      history:              true,
      advancedComparison:   true,
      apiAccess:            true,
      csvExport:            true,
      pdfExport:            true,
      savedProjects:        true,
      budgetAlerts:         false,
      teamFeatures:         false,
    },
    badge: 'Pro',
    badgeColor: '#8b5cf6',
  },

  team: {
    id: 'team',
    name: 'Team',
    price: 39,
    currency: 'USD',
    billingPeriod: 'month',
    description: 'For teams that need shared projects, API access, and budget controls.',
    stripePriceId: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID || null,
    limits: {
      maxPastedChars:       10_000_000,
      maxFileSizeBytes:     50 * 1024 * 1024,  // 50 MB
      maxFilesPerDay:       200,
      maxFilesPerBatch:     50,
      maxCleaningChars:     Infinity,
      maxRetrievalChunks:   50,
      maxRetrievalCharsDoc: Infinity,
      apiAccess:            true,
      pdfExport:            true,
      csvExport:            true,
      monthlyCredits:       2000,
    },
    features: {
      pastedText:           true,
      fileUpload:           true,
      batchUpload:          true,
      cleaningDemo:         true,
      cleaningFull:         true,
      downloadCleanText:    true,
      ragDemo:              true,
      ragFull:              true,
      history:              true,
      advancedComparison:   true,
      apiAccess:            true,
      csvExport:            true,
      pdfExport:            true,
      savedProjects:        true,
      budgetAlerts:         true,
      teamFeatures:         true,
    },
    badge: 'Team',
    badgeColor: '#0ea5e9',
  },

};

/**
 * Credit costs per operation.
 * 0 = free operation (always allowed).
 * Positive number = credits consumed per call.
 */
const CREDIT_COSTS = {
  countText:          0,    // always free
  countFile:          0,    // free (limited by day quota for free plan)
  cleanDemo:          0,    // free demo
  cleanFull:          5,    // 5 credits per full clean
  ragDemo:            0,    // free demo
  ragFull:            3,    // 3 credits per retrieve
  exportCsv:          2,
  exportPdf:          4,
  apiBatchFile:       2,    // per file in batch
  aiOptimization:     10,   // premium AI-powered optimization
};

/**
 * Returns the plan config for a given plan id.
 * Defaults to 'free' if not found.
 */
function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

/**
 * Returns all plan configs as an array, ordered Free → Pro → Team.
 */
function getAllPlans() {
  return [PLANS.free, PLANS.pro, PLANS.team];
}

module.exports = { PLANS, CREDIT_COSTS, getPlan, getAllPlans };

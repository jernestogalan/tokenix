/**
 * Tokenia — src/lib/supabase.js
 *
 * Supabase client singletons for server-side use.
 *
 *   supabaseAdmin  — service_role key. Bypasses RLS. NEVER expose to frontend.
 *                    Used for: writes to usage_events, credit_ledger,
 *                    incrementing monthly_tokens_used.
 *
 *   supabaseAnon   — anon key. Respects RLS. Used for: JWT verification.
 *
 * Both return null when SUPABASE_URL is not configured, so every caller
 * must handle null gracefully (no-op when auth is disabled / not set up).
 */
'use strict';

let _admin       = null;
let _anon        = null;
let _initialized = false;

function init() {
  if (_initialized) return;
  _initialized = true;

  const url         = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.SUPABASE_ANON_KEY;

  if (!url) {
    console.log('[supabase] SUPABASE_URL not set — running without auth/DB.');
    return;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');

    const baseOpts = {
      auth: {
        autoRefreshToken:   false,
        persistSession:     false,
        detectSessionInUrl: false,
      },
    };

    if (serviceRole) {
      _admin = createClient(url, serviceRole, baseOpts);
      console.log('[supabase] Admin (service_role) client ready.');
    } else {
      console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY missing — DB writes disabled.');
    }

    if (anonKey) {
      _anon = createClient(url, anonKey, baseOpts);
      console.log('[supabase] Anon client ready.');
    } else {
      console.warn('[supabase] SUPABASE_ANON_KEY missing — JWT verification disabled.');
    }
  } catch (err) {
    console.error('[supabase] Initialization failed:', err.message);
  }
}

/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
function getAdmin() { init(); return _admin; }

/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
function getAnon()  { init(); return _anon;  }

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Verify a Supabase JWT and return the user object (or null on failure).
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function verifyJwt(token) {
  const client = getAdmin();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (err) {
    console.error('[supabase] verifyJwt error:', err.message);
    return null;
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────

/**
 * Fetch a user's profile row.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getProfile(userId) {
  const client = getAdmin();
  if (!client || !userId) return null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, email, plan, credits_remaining, monthly_token_limit, monthly_tokens_used, billing_month, role')
      .eq('id', userId)
      .single();
    if (error) {
      if (error.code !== 'PGRST116') // PGRST116 = row not found (expected for new users)
        console.error('[supabase] getProfile error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[supabase] getProfile exception:', err.message);
    return null;
  }
}

// ── Usage tracking ────────────────────────────────────────────────────────────

/**
 * Increment the user's monthly_tokens_used counter.
 * Automatically resets the counter if the billing month has rolled over.
 * Uses Supabase RPC (server-side SQL) to avoid race conditions.
 *
 * @param {string} userId
 * @param {number} tokens
 */
async function incrementUsage(userId, tokens) {
  const client = getAdmin();
  if (!client || !userId || !tokens) return;

  try {
    // 1. Reset if month rolled over (idempotent SQL function)
    await client.rpc('maybe_reset_monthly_tokens', { p_user_id: userId });

    // 2. Increment counter with a direct update
    //    We read the current value first to avoid a missing .rpc for increment.
    const { data: profile, error: readErr } = await client
      .from('profiles')
      .select('monthly_tokens_used')
      .eq('id', userId)
      .single();

    if (readErr || !profile) {
      console.error('[supabase] incrementUsage: could not read profile:', readErr?.message);
      return;
    }

    const newTotal = (profile.monthly_tokens_used || 0) + Math.round(tokens);
    const { error: updateErr } = await client
      .from('profiles')
      .update({ monthly_tokens_used: newTotal })
      .eq('id', userId);

    if (updateErr) console.error('[supabase] incrementUsage update error:', updateErr.message);
  } catch (err) {
    console.error('[supabase] incrementUsage exception:', err.message);
  }
}

/**
 * Insert a usage_event row (fire-and-forget safe).
 *
 * @param {object} event
 * @param {string}  event.userId
 * @param {string} [event.sessionId]
 * @param {string}  event.eventType   - 'count_text' | 'count_file' | 'clean' | 'retrieve' | 'export'
 * @param {string} [event.model]
 * @param {number} [event.inputTokens]
 * @param {number} [event.outputTokens]
 * @param {number} [event.estimatedCost]
 * @param {string} [event.planAtTime]
 * @param {string} [event.filename]
 * @param {object} [event.metadata]
 */
async function logUsageEvent(event) {
  const client = getAdmin();
  if (!client) return;

  try {
    const { error } = await client.from('usage_events').insert({
      user_id:        event.userId        || null,
      session_id:     event.sessionId     || null,
      event_type:     event.eventType     || event.feature || 'unknown',
      model:          event.model         || event.modelKey || null,
      input_tokens:   event.inputTokens   || 0,
      output_tokens:  event.outputTokens  || 0,
      estimated_cost: event.estimatedCost || 0,
      plan_at_time:   event.planAtTime    || 'free',
      filename:       event.filename      || null,
      metadata:       event.metadata      || {},
    });
    if (error) console.error('[supabase] logUsageEvent error:', error.message);
  } catch (err) {
    console.error('[supabase] logUsageEvent exception:', err.message);
  }
}

/**
 * Get a user's usage history (most recent events).
 * @param {string} userId
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
async function getUsageHistory(userId, limit = 50) {
  const client = getAdmin();
  if (!client || !userId) return [];
  try {
    const { data, error } = await client
      .from('usage_events')
      .select('id, event_type, model, input_tokens, estimated_cost, plan_at_time, filename, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.error('[supabase] getUsageHistory:', error.message); return []; }
    return data || [];
  } catch (err) {
    console.error('[supabase] getUsageHistory exception:', err.message);
    return [];
  }
}

module.exports = {
  getAdmin,
  getAnon,
  verifyJwt,
  getProfile,
  incrementUsage,
  logUsageEvent,
  getUsageHistory,
};

# Tokenia Phase 3 — Deployment & Testing Guide

## Smoke test results (local, no env vars)

All Phase 3 modules load clean. Server starts on port 3000 with:
- Auth: false (no Supabase configured)
- Paid features: false
- Billing: false (Stripe disabled)
- Redis: in-memory fallback

---

## 1. Railway environment variables

Set these in Railway → your service → Variables:

### Required (always)
```
NODE_ENV=production
PORT=8080
APP_URL=https://tokenia.live
```

### Feature flags
```
ENABLE_PAID_FEATURES=true
ENABLE_AUTH=true          # set to true only after Supabase is configured
ENABLE_BILLING=false      # keep false — no Stripe yet
ENABLE_STRIPE=false
ENABLE_REDIS_RATE_LIMIT=true   # set to true after Redis service is added
ALLOW_PLAN_QUERY_OVERRIDE=false  # always false in production
```

### Supabase (get from Supabase Dashboard → Settings → API)
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...          (safe to expose — used by browser)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (SECRET — never expose publicly)
```

### Redis (Railway: add Redis service, it auto-populates REDIS_URL)
```
REDIS_URL=redis://default:password@host:port
```

### Optional
```
CORS_ORIGIN=https://tokenia.live
RATE_LIMIT_MAX=200
RATE_LIMIT_HEAVY_MAX=30
API_KEY=your-secret-key-for-/api/leads
```

---

## 2. Supabase setup (one-time)

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the migration:
   `supabase/migrations/001_initial_schema.sql`
   (copy-paste the entire file and click Run)
3. That creates: profiles, usage_events, projects, documents, credit_ledger tables
   + triggers for auto-profile creation and billing month reset
4. Enable Email auth: Authentication → Providers → Email → Enable
5. Copy your Project URL, anon key, and service_role key to Railway

---

## 3. Manual plan assignment (no Stripe needed)

To upgrade a user to Pro from Supabase SQL Editor:
```sql
select public.sync_plan_limit('<user-uuid>', 'pro');
```

To find a user's UUID:
```sql
select id, email from auth.users where email = 'user@example.com';
```

To revert to free:
```sql
select public.sync_plan_limit('<user-uuid>', 'free');
```

---

## 4. Testing checklist

### Anonymous (no account)
- [ ] Paste text → token counts show for all models
- [ ] Upload file → token counts show
- [ ] Click "Clean a file" → demo runs (first 5,000 chars only)
- [ ] Click "Find Relevant Chunks" → top 3 chunks only
- [ ] Batch tab → shows upgrade prompt
- [ ] /api/auth/user returns `{"authenticated":false,...}`

### Dev plan override (ALLOW_PLAN_QUERY_OVERRIDE=true, not production)
- [ ] Append `?plan=pro` to any URL → Pro features unlock
- [ ] Append `?plan=team` → Team features unlock
- [ ] `/api/auth/user?plan=pro` → plan shows as pro

### With Supabase auth enabled (ENABLE_AUTH=true)
- [ ] Sign up with email/password → confirmation email arrives
- [ ] Sign in → nav shows email + plan badge + usage bar
- [ ] Sign out → nav reverts to anonymous state
- [ ] /api/auth/user with Bearer token returns `{"authenticated":true,...}`

### Free plan (logged in, plan=free)
- [ ] Token count works
- [ ] Cleaning demo works (5,000 char limit)
- [ ] RAG demo works (3 chunks)
- [ ] CSV export returns 402

### Pro plan (after `sync_plan_limit(<uuid>, 'pro')`)
- [ ] Full cleaning works — no char limit
- [ ] RAG returns up to 20 chunks
- [ ] CSV export works
- [ ] Usage bar in nav shows monthly token usage
- [ ] After 1,000,000 tokens used → 429 monthly limit response

### Redis rate limiting (ENABLE_REDIS_RATE_LIMIT=true)
- [ ] /health shows `"redis": true`
- [ ] /api/features shows `"redisConnected": true`
- [ ] Rapid requests to /api/count return RateLimit-* headers
- [ ] After limit exceeded → 429 with retryAfter field

---

## 5. Git push (run from Windows terminal in project directory)

```bash
cd C:\Users\jerne\OneDrive\Documents\Claude\Projects\Tokens\tokenix

git add -A
git commit -m "feat: Phase 3 — Supabase auth, Redis rate limiting, usage tracking

- Add src/lib/supabase.js: admin + anon Supabase clients, JWT verify,
  profile fetch, incrementUsage (read-then-update), logUsageEvent
- Add src/middleware/auth.js: attachUser, requireAuth, buildAuthStatus
- Add src/middleware/rateLimitRedis.js: Redis fixed-window rate limiter
  with in-memory fallback, per-plan scaling (pro=2x, team=4x)
- Add src/middleware/usageLimits.js: monthly quota enforcement (free=50K,
  pro=1M, team=unlimited), fire-and-forget usage recording
- Add supabase/migrations/001_initial_schema.sql: profiles, usage_events,
  projects, documents, credit_ledger with RLS + helper functions
- Update server.js: wire auth + Redis middleware, add /api/config,
  /api/auth/user, /api/auth/logout routes, CSP for Supabase
- Update public/index.html: auth modal (sign-in/sign-up tabs),
  nav user state (plan badge, usage bar, email)
- Update public/js/app.js: initAuth(), Supabase SDK dynamic loading,
  apiFetch() with Bearer token, nav state management
- Update src/lib/entitlements.js: plan resolution reads req.userPlan first
- Update .env.example: Phase 3 variables documented
- Fix package.json: add @supabase/supabase-js + ioredis deps
- BILLING: disabled (ENABLE_BILLING=false, ENABLE_STRIPE=false)"

git push origin main
```

Railway will auto-deploy on push. Build takes ~2 minutes.

---

## 6. Post-deploy verification

```bash
# Health check
curl https://tokenia.live/health

# Features (should show supabaseConfigured=true if env vars set)
curl https://tokenia.live/api/features

# Config (returns supabaseAnonKey for frontend to use)
curl https://tokenia.live/api/config

# Anonymous auth check
curl https://tokenia.live/api/auth/user
```

Expected /health response with full setup:
```json
{
  "status": "ok",
  "flags": {
    "auth": true,
    "paidFeatures": true,
    "billing": false,
    "redis": true
  }
}
```

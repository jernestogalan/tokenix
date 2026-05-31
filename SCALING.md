# Scaling Tokenia to 100K Developers/Month

## Current Baseline (May 2026)
- Platform: Railway (1 container, auto-scale)
- Storage: No database for anonymous users
- Analytics: JSONL log files (in-container)
- Rate limits: Redis-backed (or in-memory fallback)

## Scaling Tiers

### Tier 1: 0–10K visitors/month (Current)
**Infrastructure:** Railway free/hobby tier
**Cost:** ~$5/month
**Actions needed:** None — current setup handles this comfortably

### Tier 2: 10K–50K visitors/month
**Infrastructure:**
- Railway Pro ($20/month, more RAM)
- Cloudflare CDN (free) — reduces origin load by 80%
- Consider Redis Cloud (free tier: 30MB) for proper rate limiting

**Key optimizations:**
1. Activate Cloudflare (see SETUP-CLOUDFLARE.md) — most important step
2. Ensure static assets have 1-year cache headers (already done in v7)
3. Cloudflare's cache will serve CSS/JS/images from 300+ global edge nodes

**Cost:** ~$25/month total

### Tier 3: 50K–100K visitors/month
**Infrastructure:**
- Railway Pro with horizontal scaling (2–3 instances)
- Cloudflare Pro ($20/month) — more rules, WAF, better analytics
- Redis Cloud ($15/month, 100MB) — proper distributed rate limiting
- Move analytics logs to PostgreSQL (Supabase free tier: 500MB)

**Key optimizations:**
1. Move analytics from JSONL files to database (files don't scale across instances)
2. Add CDN for large files (og-image.png, PDFs)
3. Consider Redis caching for /api/v1/count responses (TTL: 1 hour per text hash)

**Cost:** ~$60/month total

### Tier 4: 100K+ visitors/month
**Infrastructure:**
- Railway Pro + autoscaling (min 2, max 10 instances)
- Cloudflare Business ($200/month) — dedicated IP, advanced caching
- Dedicated PostgreSQL (Railway Postgres or Neon)
- Redis Cluster for rate limiting

**Key optimizations:**
1. Cache token count results: `sha256(text) → {tokens, results, ts}` in Redis, TTL 6hrs
2. Move to streaming responses for large file analysis
3. Consider separate microservice for file parsing
4. Implement CDN-level API rate limiting (Cloudflare Workers)

**Cost:** ~$300/month total (well worth it at 100K+ users)

## Database Migration Plan
When you need to move analytics from JSONL → PostgreSQL:

```sql
CREATE TABLE analytics (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event VARCHAR(60),
  session CHAR(16),
  page VARCHAR(120),
  lang CHAR(5),
  country CHAR(2),
  ref VARCHAR(120),
  props JSONB
);
CREATE INDEX idx_analytics_ts ON analytics(ts);
CREATE INDEX idx_analytics_event ON analytics(event);
```

Update `/api/track` to `INSERT INTO analytics (...)` instead of file append.

## Traffic Sources Priority
1. **SEO blog posts** — highest ROI, scales infinitely
2. **GitHub** — developers share tools in READMEs
3. **Twitter/X** — AI developers are very active
4. **Hacker News** — single HN front page = 5K–20K visits in 24h
5. **Product Hunt** — 500–2K visits on launch day
6. **Developer newsletters** — TLDR, Bytes, JavaScript Weekly

## The 100K Formula
- 15 blog posts × 500 organic visits/month each = 7,500/month from SEO
- 1 HN front page / quarter = 10K spikes, keeps 3K recurring
- Newsletter 5K subscribers × 15% click rate monthly = 750/month
- Word of mouth at 20% monthly compounding = base traffic × 1.2 each month

At current growth rate, 100K/month is achievable by Q1 2027.

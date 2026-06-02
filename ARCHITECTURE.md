# Tokenia Architecture

## Overview
Tokenia is a server-rendered SPA (Single Page App) with a Node.js/Express backend. The UI is pure HTML/CSS/JS with no framework. Token counting is primarily client-side for privacy.

## Stack

### Frontend
- **HTML5** — semantic, accessible markup
- **CSS3** — CSS custom properties (design tokens), no utility framework
- **Vanilla JS** — no React/Vue/Angular; keeps bundle size minimal
- **Inter** — typography (Google Fonts)
- **JetBrains Mono** — monospace for code/numbers

### Backend
- **Node.js 20** — runtime
- **Express 4** — HTTP server, routing, middleware
- **Helmet** — security headers (CSP, HSTS, etc.)
- **Compression** — gzip/deflate (level 6)
- **Multer** — file upload handling
- **Morgan** — request logging

### Infrastructure
- **Railway** — hosting (auto-deploy from GitHub main branch)
- **Supabase** — PostgreSQL + auth (optional, only for logged-in users)
- **Redis** — rate limiting (falls back to in-memory if unavailable)
- **Resend** — transactional email (newsletter, alerts)

## Key Directories
```
tokenia/
├── public/           # Static files served directly
│   ├── css/          # style.css (1 file, no preprocessor)
│   ├── js/           # app.js + i18n-client.js
│   ├── blog/         # 15 SEO blog posts
│   ├── admin/        # Protected admin dashboard
│   ├── og-image.png  # Social share image
│   ├── sw.js         # Service Worker (PWA)
│   └── manifest.json # PWA manifest
├── src/
│   ├── config/       # models.js (pricing data), plans.js
│   ├── data/         # pricing-history.json
│   ├── emails/       # HTML email templates
│   ├── i18n/         # en.json, es.json, pt.json, zh.json, de.json
│   ├── lib/          # email, credits, pricing, reports, supabase
│   ├── middleware/    # auth, rateLimitRedis, usageLimits
│   ├── parsers/      # PDF, DOCX text extraction
│   ├── cleaner/      # text cleaning/optimization
│   ├── retriever/    # RAG chunk retrieval
│   └── tokenizers/   # tiktoken integration
├── logs/             # JSONL analytics logs (gitignored)
├── data/             # newsletter CSV backup (gitignored)
├── scripts/          # generate-og.js, smoke-test.js, build-prod.js
└── server.js         # Main Express application
```

## Token Counting Strategy
1. **Client-side estimate** (instant): `~4 chars/token` heuristic, displayed immediately
2. **Server-side exact** (async): tiktoken for OpenAI models, updates the UI silently

## Analytics Architecture
- No third-party cookies or tracking pixels
- `POST /api/track` → writes to `logs/analytics-YYYY-MM-DD.jsonl`
- Session hash: `sha256(ip + userAgent + date).slice(0,16)` — non-reversible
- Query params stripped from URLs before logging
- Logs rotate after 30 days
- `/admin/stats` reads logs and aggregates in-process (no database)

## Rate Limiting
- General API: 200 req/15min per user/IP
- Heavy API (/api/count, /api/clean): 30 req/15min
- Public API v1: 100 req/hr per IP
- Backed by Redis; falls back to in-memory if Redis unavailable

## Security
- CSP headers via Helmet
- HTTPS enforced (Railway handles TLS)
- No cookies for anonymous users
- Supabase JWT for authenticated users (optional)
- Input validation on all API endpoints
- File upload size limit: 10MB

## Deployment
Push to `main` branch → Railway auto-deploys → ~2 minute redeploy time.
See DEPLOY.md for details.

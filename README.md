# Tokenia — Token Calculator & Cost Optimizer for LLM APIs

> **Know what your AI calls will cost before you make them.**

Count tokens, estimate API costs, and reduce what you send — across all major LLM providers. No signup required.

---

## Features

- **Exact token counts** for OpenAI models via `gpt-tokenizer` (the official tiktoken JS port)
- **Calibrated estimates** for Anthropic, Google, Meta, and Mistral — clearly labelled "~Estimated"
- **Real-time cost projection** — input and output cost per model, per million tokens
- **Multi-model comparison** — compare GPT-4o, Claude Sonnet 4, Gemini 2.5 Flash, Llama and more side-by-side
- **Format Cleaner** (Pro) — strips layout noise from PDFs, DOCX and HTML; typical savings 10–40%
- **Smart Retrieval** (Pro) — TF-IDF keyword search; returns only relevant document chunks
- **Plan gates** — Free / Pro / Team tiers with enforceable limits (file size, chunk count, etc.)
- **CSV export** (Pro) — download token and cost comparison reports
- **No data stored** — text processed in-memory and discarded immediately

---

## Quick start

```bash
git clone <repo>
cd tokenix
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**

For production:
```bash
npm start
```

---

## Environment variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `NODE_ENV` | `development` | No | Set `production` for production deploys |
| `PORT` | `3000` | No | HTTP server port |
| `ENABLE_PAID_FEATURES` | `false` | No | Unlocks cleaning and retrieval endpoints |
| `ENABLE_BILLING` | `false` | No | Activates Stripe checkout + webhook routes |
| `ENABLE_CREDITS` | `true` | No | Soft-enforces credit costs per operation |
| `ENABLE_AI_OPTIMIZATION` | `false` | No | Reserved for future AI-powered prompt optimization |
| `ALLOW_USER_API_KEYS` | `false` | No | Reserved for BYOK (bring your own key) feature |
| `API_KEY` | _(empty)_ | No | If set, all `/api/*` routes require `X-API-Key` header |
| `CORS_ORIGIN` | `*` | No | CORS allowed origin. Set to your domain in production |
| `RATE_LIMIT_MAX` | `200` | No | General rate limit: requests per 15 min per IP |
| `RATE_LIMIT_HEAVY_MAX` | `30` | No | Heavy route limit (tokenize, clean, retrieve) |
| `STRIPE_SECRET_KEY` | _(empty)_ | Billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | _(empty)_ | Billing | Stripe webhook signing secret |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | _(empty)_ | Billing | Pro monthly Stripe Price ID |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | _(empty)_ | Billing | Pro annual Stripe Price ID |
| `STRIPE_TEAM_MONTHLY_PRICE_ID` | _(empty)_ | Billing | Team monthly Stripe Price ID |
| `SUPABASE_URL` | _(empty)_ | Production | Supabase project URL (future auth/DB) |
| `SUPABASE_ANON_KEY` | _(empty)_ | Production | Supabase anon key |
| `OPENAI_API_KEY` | _(empty)_ | Optional | Official token count API / AI optimization |
| `ANTHROPIC_API_KEY` | _(empty)_ | Optional | Official Anthropic API |
| `GEMINI_API_KEY` | _(empty)_ | Optional | Official Google API |

---

## How to update model prices

1. Open `src/config/models.js`
2. Find the provider and model
3. Update `inputPer1M` and `outputPer1M` (USD per million tokens)
4. Restart the server — no other changes needed

```js
'gpt-4o': {
  name: 'GPT-4o',
  inputPer1M:  2.50,   // ← update this
  outputPer1M: 10.00,  // ← and this
  contextWindow: 128_000,
  encoding: 'o200k_base',
  precision: 'exact',
  active: true,
},
```

---

## How to test plans locally

Append `?plan=free|pro|team` to any URL to simulate a plan tier without authentication:

```
http://localhost:3000/?plan=pro
http://localhost:3000/?plan=team
http://localhost:3000/?plan=free
```

The frontend reads this parameter and passes it as the `X-Plan` header on all API requests. The server's entitlements module uses it to gate features.

---

## How to enable paid features

In your `.env`:

```
ENABLE_PAID_FEATURES=true
```

This sets the default plan to `pro` for all requests that don't specify `X-Plan`. Use this for local development and self-hosting.

---

## How to activate billing

1. Create a Stripe account at https://dashboard.stripe.com
2. Create products and prices (Pro Monthly, Pro Annual, Team Monthly)
3. Set up a webhook pointing to `https://yourdomain.com/api/billing/webhook`
4. Copy the keys to your `.env`:

```
ENABLE_BILLING=true
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
```

5. Restart the server. The "Upgrade to Pro" buttons will now redirect to Stripe Checkout.

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Server health, version, uptime, feature flags |
| `GET` | `/api/features` | None | Feature flag state |
| `GET` | `/api/models` | None | All model configs with pricing |
| `GET` | `/api/plans` | None | All plan definitions |
| `POST` | `/api/count` | None | Count tokens + calculate cost; accepts text or file |
| `POST` | `/api/tokenize` | None | Legacy compat — text only |
| `POST` | `/api/tokenize/file` | None | Legacy compat — file upload |
| `POST` | `/api/clean` | Plan gate | Clean a document; demo for free, full for Pro |
| `POST` | `/api/retrieve` | Plan gate | TF-IDF retrieval; demo (top 3) for free, full for Pro |
| `POST` | `/api/report` | Pro | Download CSV comparison report |
| `POST` | `/api/lead` | None | Store email + plan interest for waitlist |
| `GET` | `/api/leads` | API_KEY | View all captured leads |
| `POST` | `/api/credits/check` | None | Get credits summary for a user/plan |
| `POST` | `/api/billing/checkout` | None | Create Stripe checkout session |
| `POST` | `/api/billing/webhook` | Stripe sig | Stripe webhook receiver |

### POST /api/count

Accepts multipart (file upload) or JSON body:

```json
{ "text": "your text here" }
```

Returns:
```json
{
  "charCount": 1234,
  "wordCount": 234,
  "lineCount": 12,
  "plan": "free",
  "results": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "tokens": 312,
      "inputCost": 0.000780,
      "outputCost": 0.003120,
      "precision": "exact"
    }
  ]
}
```

### POST /api/clean

Accepts multipart file or `{ text }` JSON. Returns cleaned text with token comparison.

Add `X-Plan: pro` header to get full cleaning. Without it, free plan gets demo (first 5,000 chars).

### POST /api/retrieve

Accepts multipart file + form fields `query` and `topK`, or JSON `{ text, query, topK }`.

---

## Database schema (future production)

```sql
-- Users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  plan_id     TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Credits ledger
CREATE TABLE credits_ledger (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  amount     INTEGER NOT NULL,
  type       TEXT NOT NULL,  -- grant | consume | refund | purchase
  reason     TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  desired_plan   TEXT,
  feature_clicked TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Deployment (Railway)

1. Push to GitHub
2. Create a new Railway project → Deploy from GitHub repo
3. Add environment variables in Railway dashboard
4. Set `NODE_ENV=production`
5. Railway auto-detects Node.js and runs `npm start`

For custom domain: add in Railway → Settings → Domains.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+ | Zero build step, universal deployment |
| Framework | Express 4 | Minimal, well-understood, easy to self-host |
| OpenAI tokenizer | `gpt-tokenizer` | Pure-JS tiktoken port — exact counts, no WASM |
| Anthropic / Google / Meta / Mistral | Calibrated heuristic | Proprietary tokenizers not public; estimate clearly labelled |
| PDF parsing | `pdf-parse` | Extracts text layer reliably |
| DOCX parsing | `mammoth` | Clean text from Word documents |
| File uploads | `multer` (memoryStorage) | No disk writes |
| TF-IDF retrieval | Custom (zero deps) | No API keys, no model downloads, works offline |
| Frontend | Tailwind CDN + Vanilla JS | No build step, loads instantly |
| Styling | Tailwind CDN + custom CSS | Zero tooling overhead |
| Payments | Stripe | Industry standard; well-documented |

---

## Limitations / MVP gaps

- Token counts for non-OpenAI models are estimates (±5–15%)
- No user authentication — plan is determined by query param or ENABLE_PAID_FEATURES flag
- Credits are in-memory and reset on server restart
- No saved history or projects
- TF-IDF retrieval is keyword-based, not semantic
- PDF extraction works on text-layer PDFs only (not scanned/image PDFs)
- No batch upload UI (endpoint not built — only the gate exists)
- Rate limiting is in-memory (resets on restart); use Redis for production

---

## What is needed for production

- **Auth**: Supabase Auth or Clerk for email/OAuth login
- **Database**: Supabase/Postgres for users, credits, and lead storage
- **Redis**: Upstash for distributed rate limiting
- **Stripe webhooks**: Verify signatures, provision Pro access on `checkout.session.completed`
- **Plan enforcement**: Replace `X-Plan` header with real JWT session lookup
- **Monitoring**: Sentry for error tracking, Datadog or Grafana for metrics

---

## Technical risks

| Risk | Impact | Mitigation |
|---|---|---|
| `pdf-parse` hangs on malformed PDFs | High | Add timeout wrapper; validate MIME type |
| Non-OpenAI token estimates diverge | Medium | Label estimates clearly; offer BYOK for exact counts |
| Stripe webhook replay attacks | Medium | Validate webhook signatures; idempotent handlers |
| Memory pressure from large files | Medium | 50 MB hard limit; stream parsing in production |
| Rate limit bypass via proxies | Low | Switch to Redis + IP header validation in production |

---

## Monetization recommendations

1. **Free tier as marketing** — generous free tier builds trust; users who count tokens are developers who ship
2. **Pro at $12/mo** — targets individual developers; cleaning + retrieval reduce their API bills more than the subscription cost
3. **Team at $39/mo** — shared projects and budget alerts justify team adoption
4. **Metered add-ons** — sell credit packs for burst usage; low marginal cost, high perceived value
5. **API access** — charge for high-volume API usage; teams running token checks in CI pipelines
6. **White-label** — sell a self-hosted license to larger companies

---

## Disclaimer

Not affiliated with OpenAI, Anthropic, Google, Meta, Mistral, or any LLM provider. Pricing information is sourced from public pricing pages and may be outdated. Always verify costs with your provider before making financial decisions.

---

## License

MIT

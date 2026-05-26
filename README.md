# <T> tokenix

**LLM Token Calculator, Cost Estimator & Pro Optimizer**

Count tokens, estimate API costs, and reduce what you send — across all major LLM providers.

---

## Stack rationale

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+ | Zero build step, universal deployment |
| Framework | Express | Minimal, well-understood, easy to self-host |
| OpenAI tokenizer | `gpt-tokenizer` | Pure-JS tiktoken port — exact counts, no WASM |
| Anthropic / Google / others | Calibrated heuristic | Proprietary tokenizers not public; estimate clearly labelled |
| PDF parsing | `pdf-parse` | Extracts text layer reliably |
| DOCX parsing | `mammoth` | Clean markdown from Word documents |
| File uploads | `multer` (memoryStorage) | No disk writes, 10 MB limit |
| TF-IDF retrieval | Custom (zero deps) | No API keys, no model downloads, works offline |
| Frontend | Vanilla HTML/CSS/JS | No build step, loads instantly, zero framework overhead |

---

## Quick start

```bash
git clone <repo>
cd tokenix
npm install
cp .env.example .env
npm start
```

Open **http://localhost:3000**

For development with auto-reload:
```bash
npm run dev
```

---

## Project structure

```
tokenix/
├── server.js                     # Express server (all routes, production-hardened)
├── src/
│   ├── config/
│   │   └── models.js             # ★ Edit this to update prices
│   ├── tokenizers/
│   │   └── index.js              # Exact (OpenAI) + heuristic counts
│   ├── parsers/
│   │   └── index.js              # PDF / DOCX / HTML / text extraction
│   ├── cleaner/
│   │   └── index.js              # Format cleaning (Pro feature)
│   └── retriever/
│       └── index.js              # TF-IDF chunking + retrieval (Pro feature)
├── test/
│   ├── cleaner.test.js           # Unit tests — cleaner
│   ├── retriever.test.js         # Unit tests — retriever
│   ├── tokenizers.test.js        # Unit tests — tokenizers
│   └── api.test.js               # Integration tests — all HTTP endpoints
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── .github/workflows/ci.yml      # GitHub Actions CI (Node 18/20/22 + Docker)
├── Dockerfile                    # Multi-stage production image
├── docker-compose.yml            # Local docker-compose
├── nginx.conf                    # nginx reverse-proxy template
├── .dockerignore
├── .env.example
└── README.md
```

---

## Updating model prices

**Only edit `src/config/models.js`** — nowhere else.

```js
// Example: update GPT-4o pricing
'gpt-4o': {
  name: 'GPT-4o',
  inputPer1M:  2.50,   // ← USD per 1M input tokens
  outputPer1M: 10.00,  // ← USD per 1M output tokens
  contextWindow: 128000,
  encoding: 'o200k_base',
},
```

Restart the server after edits. The frontend fetches `/api/models` on first use.

---

## Tokenizer accuracy

| Provider | Method | Accuracy |
|---|---|---|
| OpenAI (all models) | `gpt-tokenizer` (tiktoken) | **Exact** |
| Anthropic | Char/word heuristic (ratio ~3.8) | ~Estimated ±5–10% |
| Google | Char/word heuristic (ratio ~4.0) | ~Estimated ±5–10% |
| Meta / Llama | Char/word heuristic (ratio ~3.9) | ~Estimated ±5–10% |
| Mistral | Char/word heuristic (ratio ~4.0) | ~Estimated ±5–10% |

Code detection: if special-char ratio > 8%, the heuristic switches to a denser ratio (~20% more tokens per character). Always labelled in the UI.

---

## REST API

All endpoints return `Content-Type: application/json`.  
Errors return `{ "error": "message" }` with an appropriate HTTP status.

### Free endpoints

#### `GET /api/health`
```json
{ "status": "ok", "version": "1.0.0", "env": "production", "uptime": 42 }
```

#### `GET /api/features`
```json
{
  "paidFeaturesEnabled": true,
  "features": { "cleaner": true, "retriever": true }
}
```

#### `GET /api/models`
Returns the full pricing config from `src/config/models.js`.

#### `POST /api/tokenize`
Count tokens for pasted text.

**Request** (JSON body):
```json
{ "text": "Your prompt or document text here…" }
```

**Response:**
```json
{
  "charCount": 44,
  "wordCount": 9,
  "lineCount": 1,
  "results": [
    {
      "provider": "openai",
      "providerName": "OpenAI",
      "providerColor": "#10b981",
      "model": "gpt-4o",
      "modelName": "GPT-4o",
      "tokens": 10,
      "exact": true,
      "inputCost": 0.000025,
      "outputCost": 0.0001,
      "inputPer1M": 2.5,
      "outputPer1M": 10,
      "contextWindow": 128000,
      "contextPct": 0.0078,
      "fitsContext": true,
      "note": null,
      "tokenizerNote": "Uses the official tiktoken tokenizer. Token counts are exact."
    }
    // … 17 more models
  ]
}
```

```bash
curl -X POST http://localhost:3000/api/tokenize \
  -H "Content-Type: application/json" \
  -d '{"text":"The quick brown fox jumps over the lazy dog."}'
```

#### `POST /api/tokenize/file`
Count tokens for an uploaded file.

**Request** (multipart/form-data, field name `file`):
```bash
curl -X POST http://localhost:3000/api/tokenize/file \
  -F "file=@/path/to/document.pdf"
```

**Response:** same as `/api/tokenize` plus `filename` and `filesize`.

---

### Pro endpoints (require `ENABLE_PAID_FEATURES=true`)

Calling these when the flag is off returns:
```json
{ "error": "This feature requires Pro. Set ENABLE_PAID_FEATURES=true…", "code": "FEATURE_LOCKED" }
```

#### `POST /api/clean`
Extract clean text from a PDF/DOCX/HTML file, stripping layout noise without touching content.

**What gets removed:**
- Page numbers (`Page 1`, `- 1 -`, lone integers on a line)
- Repeated headers/footers (any short line appearing ≥ 3 times)
- Decorative separators (`────`, `====`)
- Redundant blank lines (collapsed to max 1 blank line)
- Hyphenated line-breaks (`hy-\nphen` → `hyphen`)
- HTML tags and entities (for `.html` input)

**What is preserved:** all semantic content.

**Expected savings:** 10–40% depending on how much layout noise the source file has.

**Request** (multipart/form-data):
```bash
curl -X POST http://localhost:3000/api/clean \
  -F "file=@/path/to/report.pdf"
```

**Response:**
```json
{
  "filename": "report.pdf",
  "filesize": 245000,
  "originalText": "Page 1\n\nCompany Confidential\n\nActual content…",
  "cleanText": "Actual content…",
  "originalStats": { "charCount": 12000, "wordCount": 2100, "lineCount": 480 },
  "cleanStats":    { "charCount": 8800,  "wordCount": 1900, "lineCount": 310 },
  "cleanerStats": {
    "originalChars": 12000,
    "cleanChars": 8800,
    "charsSaved": 3200,
    "boilerplateLineTypes": 3
  },
  "tokenComparison": [
    {
      "provider": "openai",
      "providerName": "OpenAI",
      "model": "gpt-4o",
      "modelName": "GPT-4o",
      "originalTokens": 3100,
      "cleanTokens": 2200,
      "tokensSaved": 900,
      "pctSaved": 29.0,
      "moneySaved": 0.00225,
      "exact": true,
      "inputPer1M": 2.5
    }
    // … one row per model
  ]
}
```

---

#### `POST /api/retrieve`
Split a large document into chunks and return only the passages most relevant to your query (TF-IDF cosine similarity).

**Important:** this returns *only the content relevant to your specific question* — not a summary of the whole document. Use it when you have a focused query against a large document.

**Parameters:**
- `file` — the document (multipart field)
- `query` — your question or search string (form field or JSON field)
- `topK` — number of chunks to return, 1–20 (default 5)

**Request** (multipart/form-data):
```bash
curl -X POST http://localhost:3000/api/retrieve \
  -F "file=@/path/to/large_doc.pdf" \
  -F "query=What are the termination clauses?" \
  -F "topK=5"
```

**Request** (JSON body with pre-extracted text):
```bash
curl -X POST http://localhost:3000/api/retrieve \
  -H "Content-Type: application/json" \
  -d '{"text":"Full document text…","query":"termination clauses","topK":5}'
```

**Response:**
```json
{
  "query": "What are the termination clauses?",
  "filename": "contract.pdf",
  "totalChunks": 47,
  "returnedChunks": 5,
  "chunkSize": 800,
  "overlap": 150,
  "retrievedText": "Chunk 1 text…\n\n---\n\nChunk 2 text…",
  "chunks": [
    { "text": "Either party may terminate…", "index": 12, "score": 0.4821 },
    { "text": "Termination for cause requires…", "index": 13, "score": 0.3904 }
    // … up to topK
  ],
  "tokenComparison": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "modelName": "GPT-4o",
      "fullTokens": 18400,
      "retrievedTokens": 850,
      "tokensSaved": 17550,
      "pctSaved": 95.4,
      "moneySaved": 0.0439,
      "exact": true,
      "inputPer1M": 2.5
    }
    // … one row per model
  ]
}
```

---

## Enabling Pro features locally

```bash
# .env
ENABLE_PAID_FEATURES=true
```

Then restart the server. No payment required — the flag exists to mark the billing boundary before going to production.

---

## Running tests

```bash
npm test                   # all 29 tests (unit + integration)
npm run test:unit          # cleaner + retriever + tokenizers only
npm run test:api           # HTTP endpoint integration tests
```

Tests use Node's built-in `node:test` runner — no extra packages needed.

---

## Deployment

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Set `production` in prod |
| `ENABLE_PAID_FEATURES` | `false` | Unlock `/api/clean` and `/api/retrieve` |
| `ENABLE_BILLING` | `false` | Activate Stripe billing routes |
| `STRIPE_SECRET_KEY` | — | Stripe secret key (billing only) |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | — | Stripe price ID for Pro subscription |
| `API_KEY` | — | Optional API key gate for all `/api` routes |
| `CORS_ORIGIN` | `*` | Restrict CORS in production (e.g. `https://yourdomain.com`) |
| `RATE_LIMIT_MAX` | `200` | General rate limit per 15 min |
| `RATE_LIMIT_HEAVY_MAX` | `30` | Heavy-route limit per 15 min |

### Docker (recommended for production)

```bash
# Build
docker build -t tokenix .

# Run
docker run -d --name tokenix   -p 3000:3000   -e NODE_ENV=production   -e ENABLE_PAID_FEATURES=true   tokenix

# Or with docker-compose (reads from .env automatically)
docker-compose up -d
```

The multi-stage `Dockerfile` runs as a non-root user (`tokenix`) and includes a health check at `/api/health`.

### Railway / Render / Fly.io

These platforms auto-detect `package.json` and run `npm start`. Set environment variables in the platform dashboard:

```
NODE_ENV=production
PORT=3000
ENABLE_PAID_FEATURES=true
```

### VPS with PM2 + nginx

```bash
npm install
NODE_ENV=production npm install -g pm2
pm2 start server.js --name tokenix
pm2 save && pm2 startup

# Place nginx.conf at /etc/nginx/conf.d/tokenix.conf
# (edit yourdomain.com and upstream IP first)
sudo nginx -t && sudo systemctl reload nginx
```

### Stripe billing (when ready)

1. Create a product and price in the Stripe dashboard
2. Set `ENABLE_BILLING=true` and `STRIPE_SECRET_KEY` in your env
3. Set `STRIPE_PRO_MONTHLY_PRICE_ID` to your price ID
4. Point the Stripe webhook to `https://yourdomain.com/api/billing/webhook`
5. Set `STRIPE_WEBHOOK_SECRET` from the webhook dashboard
6. Add database logic to `server.js` where the `// TODO: provision` comments are

---

## What's done vs. what's left for production

### ✅ Done (works locally)

| Feature | Status |
|---|---|
| Token counting — pasted text | ✅ |
| Token counting — file upload | ✅ |
| Exact counts for all OpenAI models (tiktoken) | ✅ |
| Calibrated estimates for Anthropic, Google, Meta, Mistral | ✅ |
| Per-model cost breakdown (input + output) | ✅ |
| Context window usage visualisation | ✅ |
| Provider filter pills | ✅ |
| Supported file types: PDF, DOCX, TXT, MD, HTML, 25+ code formats | ✅ |
| **Format Cleaner** — strips layout noise, token/cost comparison, copy/download | ✅ |
| **Smart Retrieval** — TF-IDF chunking, top-k relevant passages, token savings | ✅ |
| Feature flag (`ENABLE_PAID_FEATURES`) gates Pro routes | ✅ |
| REST API for all four endpoints | ✅ |
| Prices in a single config file (`src/config/models.js`) | ✅ |

### 🔲 Left for production

| Item | Notes |
|---|---|
| **Stripe billing — wire DB** | Routes + scaffold are in `server.js`. Add a database call at the `// TODO: provision` comments to persist subscription state |
| **Auth — database-backed** | `API_KEY` env-var gate is live; for per-user auth add JWT or sessions with a user table |
| **Semantic embeddings** | Swap `src/retriever/index.js` for `@xenova/transformers` or OpenAI `text-embedding-3-small` for paraphrase recall |
| **Persistent vector store** | Cache embeddings in Chroma, pgvector, or Pinecone for large-doc use-cases |
| **Batch processing** | `POST /api/tokenize/batch` — zip of files → CSV output |
| **Prompt optimizer (LLM-based)** | Call target LLM API to abstractively compress; show exact savings |
| **Usage history** | Store analyses in SQLite / PostgreSQL for history + comparison |
| **Input validation** | Add `zod` schema validation on all request bodies |
| **Error monitoring** | Add Sentry or Datadog APM |
| **Anthropic / Google official tokenizers** | Switch when SDK tokenizer support ships for exact counts |

---

## Retrieval: TF-IDF vs. neural embeddings

The current retrieval uses **TF-IDF cosine similarity** — zero extra dependencies, works offline, good for keyword queries.

For production with paraphrase or semantic queries, swap `src/retriever/index.js`'s `retrieve()` function to use embeddings:

```js
// Drop-in upgrade example (OpenAI embeddings):
const { OpenAI } = require('openai');
const client = new OpenAI();

async function embedText(text) {
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}
```

Everything else (chunking, top-k selection, token comparison) stays the same.

---

*Prices and counts are for estimation purposes only. Not affiliated with any LLM provider.*

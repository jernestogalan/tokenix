# dev.to / Hashnode Article

> **Status:** Draft — do NOT publish.
> - dev.to: paste as-is, add cover image (og-image.png works)
> - Hashnode: same content works
> - Add canonical URL pointing to tokenia.live if you want SEO credit to go to your site

---

**Title:** I built a free, private token calculator for LLM developers

**Tags:** ai, webdev, javascript, productivity

**Cover image:** Use /og-image.png from tokenia.live

---

## Body

Every time I evaluated a new LLM for a project, I ran into the same friction: I needed to answer "what will this actually cost?" before I could make a decision, and the math was tedious. Convert tokens to characters, look up the price per million, multiply by expected request volume, account for both input and output.

I built [Tokenia](https://tokenia.live) to automate that calculation — and along the way, made some choices I think are worth documenting.

---

### What it does

You paste text (or upload a PDF, DOCX, or code file) and get instant token counts and cost estimates across 30+ models — OpenAI, Anthropic, Google, Meta/Llama, Mistral, DeepSeek — all in one view.

There's also:
- **Side-by-side comparison** — pick any two models, see the cost difference immediately
- **Monthly projection** — enter your request volume, get your AI budget
- **Token visualizer** — see how the text actually gets split into tokens
- **Prompt optimizer** — identifies whitespace and redundancy you can strip
- **Free public API** — `/api/v1/count`, 100 requests/hour, no key required
- **5 languages** — EN, ES, PT, ZH, DE

---

### The privacy architecture (being precise)

I wanted "private" to mean something, so let me be specific rather than vague.

When you submit text, it travels over HTTPS to an Express server on Railway. The server runs the actual tokenizers in memory — I use [tiktoken](https://github.com/openai/tiktoken) for OpenAI models, not a `text.length / 4` heuristic. The result is returned and the text is discarded. No database write, no log of the request body.

What the server **does** log: HTTP method, path, status code, response size (standard morgan `combined` format). Nothing about your content.

For file uploads: multer uses `memoryStorage()` — files never touch disk. PDF parsing via `pdf-parse`, DOCX via `mammoth`, both in memory, result returned, buffer discarded.

I originally wanted to say "processed entirely in your browser" — which sounds better and is better for privacy. But the accurate tokenizers require server-side execution, and I'd rather be honest than reassuring. The tradeoff: more accurate counts in exchange for a server hop over HTTPS.

---

### The tech stack

```
Node.js + Express
├── tiktoken (OpenAI exact counts)
├── mammoth (DOCX parsing)
├── pdf-parse (PDF parsing)
├── helmet (security headers: HSTS, CSP, Permissions-Policy)
├── multer (memory-only file handling)
└── morgan (access logs, no body logging)

Hosting: Railway
Auth (optional): Supabase
Email: Resend
```

No third-party analytics scripts. First-party event logging (event name + page URL, no content).

---

### What I removed

Early versions had:
- Free/Pro/Team pricing tiers — removed because the tool is more useful when everyone has full access
- "Trusted by 1,200+ developers in 40+ countries" — removed because it wasn't true yet
- "Processed 100% in your browser" — removed because it wasn't accurate
- GDPR Friendly / CCPA Compliant badges — removed because I don't have the legal infrastructure to back them up

I think launch marketing tends toward exaggeration, and I'm trying to go the other direction: say exactly what's true and nothing more.

---

### What's next

- A `/history` feature for logged-in users to see their past analyses
- Better API documentation
- Potentially a CLI tool (`npx tokenia count my-prompt.txt`)

If you find it useful or spot something broken, [email me](mailto:info@tokenia.live) or use the contact form on the site. Feedback from developers is the only metric I care about at this stage.

[Try Tokenia →](https://tokenia.live)

# Hacker News — Show HN

> **Status:** Draft — do NOT post until you're ready to actively respond to comments for at least 2 hours after posting.
> Best time: 9–11 AM EST on a weekday.

---

## Title
Show HN: Tokenia – Free token counter for 30+ LLMs, text never stored

---

## Body

I built Tokenia (https://tokenia.live) because I kept needing to answer "how much will this prompt cost?" before committing to a model — and every existing tool either required a signup, gave rough estimates, or made me wonder what they were doing with my text.

**What it does:**
- Counts tokens and estimates costs across 30+ models (OpenAI, Anthropic, Google, Meta/Llama, Mistral, DeepSeek)
- Side-by-side comparison of any two models
- Upload PDF/DOCX/TXT/code files — parsed server-side, content never stored
- Monthly cost projections at your request volume
- Token visualizer (lets you see how tokenization actually works)
- Prompt optimizer with measurable token savings
- Free public API at /api/v1/count (100 req/hr, no key required)
- Embeddable iframe widget for blogs
- Available in 5 languages (EN/ES/PT/ZH/DE)

**On the privacy claim:** I want to be precise here, because "private" is often marketing fluff. Your text travels to our server via HTTPS for tokenization — we use the actual tiktoken library, not a heuristic. The server processes it in memory and discards it immediately. No database writes, no log of your content (morgan logs method/path/status, not body). First-party event analytics (event name, page, country) but no text content. I'd rather say "text never stored" than "processed in your browser" when it isn't.

**Stack:** Node.js/Express on Railway, tiktoken + mammoth + pdf-parse, Supabase for optional auth, Resend for email.

It's genuinely free with no plans to paywall the core features. Happy to answer questions about the implementation or the privacy architecture.

---

## Anticipated questions (prepare your answers before posting)

**Q: How is this different from [other token counter]?**
A: Most use a character-count heuristic (chars/4). We use the actual tiktoken library for OpenAI models, so the count is exact — same number the API will bill you. We also cover more providers and have cost projection + side-by-side comparison built in.

**Q: What about server-side processing — can you guarantee you don't log text?**
A: The server code is straightforward Express + morgan. Morgan logs HTTP metadata only (no body). The /api/count handler passes text to tokenizeAll() in memory and returns the result with no writes anywhere. I can't publish the full source right now but happy to discuss the architecture in detail.

**Q: Why not WebAssembly/client-side?**
A: The accurate tokenizers (tiktoken, Claude's algorithm) require server-side execution. A client-side heuristic would be faster but less accurate. I chose accuracy and "text never stored" over "never leaves device."

**Q: Free forever — what's the business model?**
A: Honest answer: I don't have one yet. The tool is useful and costs very little to run. If it gets traction I'd consider a Pro tier for history/API/batch features — but the core calculator will stay free.

# Reddit Launch Posts

> **Status:** Draft — do NOT post. Read each subreddit's rules before posting.
> - r/SideProject: self-posts allowed, mention it's your project
> - r/LocalLLaMA: stay technically focused; mention the cost comparison angle
> - r/OpenAI: read rules carefully — no spam, add genuine value

---

## r/SideProject

**Title:** I built a free token calculator for LLMs — 30+ models, no signup, text never stored

**Body:**

Hey r/SideProject! I've been building Tokenia (https://tokenia.live) on the side and wanted to share it here.

**What it does:**
It counts tokens and estimates costs across 30+ AI models — GPT-4o, Claude, Gemini, Llama, Mistral, DeepSeek. You paste text or upload a file and instantly see what it would cost per provider.

Features I'm most proud of:
- Side-by-side model comparison (pick any two)
- Monthly cost projection (how much at 1,000 req/day?)
- Token visualizer — actually shows you how the text gets split
- Free embeddable widget if you run a blog
- 5 languages (EN/ES/PT/ZH/DE)

**The privacy bit** (being upfront): The text goes to my server over HTTPS for accurate tokenization — I use the real tiktoken library, not a chars/4 heuristic. It's discarded immediately, never stored. No GA, no ad trackers.

**Stack:** Node.js + Express + Railway + Supabase (optional auth) + tiktoken.

It's new so there are probably rough edges. Feedback very welcome — especially if something's broken or confusing.

---

## r/LocalLLaMA

**Title:** Built a cost comparison tool — useful for deciding when local vs. API makes economic sense

**Body:**

One of the things I think about a lot when choosing between local models and API providers is the break-even: at what request volume does running a local model start saving money?

I built a tool that helps with part of that calculation: https://tokenia.live

It counts tokens and shows costs across 30+ models — including Llama 3.3 70B and Llama 3.1 8B via hosted APIs. You can use the monthly projection feature to enter your request volume and get a rough cost comparison.

A few things that might be useful to this community:
- Side-by-side comparison of any two models (e.g. GPT-4o vs Llama 3.3 70B hosted)
- Cost per token breakdown for both input and output
- Upload a file to see real token counts (uses actual tiktoken/official tokenizers, not approximations)
- Free API at /api/v1/count if you want to automate this

**Not what it does:** It doesn't account for hardware/electricity costs for local inference — that's a different calculation. It's specifically about API pricing for cloud inference.

It's new and free. Happy to hear what other comparisons or features would be useful.

---

## r/OpenAI

**Title:** I made a free token calculator — useful for comparing GPT model costs before you commit

**Body:**

I found myself constantly doing the same mental math: "if I run this prompt 500 times a day, what's the monthly cost on GPT-4o vs GPT-4o mini vs o4-mini?"

So I built a tool: https://tokenia.live

What it does:
- Exact token counts using tiktoken (same tokenizer OpenAI uses)
- Cost estimates for all current OpenAI models (GPT-4.1, GPT-4o, GPT-4o mini, o4-mini, o1, GPT-3.5)
- Monthly projection: enter your request volume → see your budget
- Side-by-side comparison of any two models
- File upload (PDF, DOCX, TXT, code) — useful for estimating RAG chunk costs

Pricing data is updated for May 2026. You can also compare OpenAI models against Anthropic, Google, Meta, Mistral, and DeepSeek in the same view if you're evaluating alternatives.

No signup, no API key, free. Text is processed server-side for accurate tokenization and immediately discarded.

Happy to take feedback.

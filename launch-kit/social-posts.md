# Social Media Posts

> **Status:** Draft — do NOT publish. Review and personalize before posting.
> Add a screenshot or screen recording for maximum reach.

---

## X (Twitter) — 3 Posts

### Post 1 — Launch announcement (EN)
```
I built a free token calculator for LLMs.

→ 30+ models (OpenAI, Claude, Gemini, Llama, Mistral, DeepSeek)
→ Side-by-side comparison
→ Monthly cost projection
→ Exact counts using official tokenizers, not guesses
→ Text never stored
→ No signup

tokenia.live

New — feedback welcome 🙏
```

---

### Post 2 — Technical angle (EN)
```
Hot take: most "token calculators" are just doing text.length / 4.

For OpenAI models, the actual count can be 20–30% different from that estimate.

Built a tool that uses real tiktoken under the hood:
tokenia.live/api/v1/count

Free API, 100 req/hr, no key needed. Try it:
curl -s -X POST tokenia.live/api/v1/count \
  -H "Content-Type: application/json" \
  -d '{"text":"your prompt here","provider":"openai"}'
```

---

### Post 3 — Cost angle, bilingual hook (ES + EN)
```
¿Cuánto cuesta en realidad tu prompt?

GPT-4o: $0.0030
Claude Sonnet: $0.0024
Gemini 2.5 Flash: $0.0003

Mismo texto. Muy diferente precio.

Calcula el tuyo en tokenia.live — gratis, sin registro, 5 idiomas.

---

How much does your prompt actually cost?
Same text. Very different prices across providers.
Calculate yours → tokenia.live
```

---

## LinkedIn — 1 Post

```
I've been quietly building a side project for the past few months and it's finally live: Tokenia — a free LLM token calculator.

The problem it solves: before committing to a model or architecture, you need to know what your AI costs will look like at scale. But converting "tokens per million" into actual dollars across multiple providers is tedious mental math.

Tokenia automates it. Paste a prompt, get exact token counts and cost estimates for 30+ models — GPT-4o, Claude, Gemini, Llama, Mistral, DeepSeek — side by side.

A few things I'm proud of:

▸ Accuracy: Uses official tokenizers (tiktoken for OpenAI), not heuristics. The number you see is the number you'll be billed.

▸ Honesty: The tool is genuinely free with no plans to paywall the core features. I also removed claims I couldn't back up ("trusted by X developers in Y countries") because that kind of marketing erodes trust before you've earned it.

▸ Cost projection: Enter your request volume → see your monthly AI budget across all providers. Useful before you scale.

▸ 5 languages: English, Spanish, Portuguese, Chinese, German.

It's new, so I'm still finding rough edges. If you try it and something's broken or confusing, I'd genuinely appreciate hearing about it.

tokenia.live

#AITools #LLM #DeveloperTools #SideProject #MachineLearning
```

---

## ES Versions

### X Post 1 — ES
```
Construí una calculadora de tokens para LLMs.

→ 30+ modelos (OpenAI, Claude, Gemini, Llama, Mistral, DeepSeek)
→ Comparación lado a lado
→ Proyección mensual de costos
→ Conteos exactos con tokenizadores oficiales
→ Texto nunca almacenado
→ Sin registro

tokenia.live

Nuevo — feedback bienvenido 🙏
```

### X Post 2 — Technical (ES)
```
La mayoría de calculadoras de tokens hacen text.length / 4.

Para modelos de OpenAI, el conteo real puede diferir 20–30%.

Hice una que usa tiktoken real por debajo:
tokenia.live/api/v1/count

API gratis, 100 req/hr, sin clave.
```

---

## PT Version

### X Post 1 — PT
```
Criei uma calculadora de tokens gratuita para LLMs.

→ 30+ modelos (OpenAI, Claude, Gemini, Llama, Mistral, DeepSeek)
→ Comparação lado a lado
→ Projeção de custos mensais
→ Contagens exatas com tokenizadores oficiais
→ Texto nunca armazenado
→ Sem cadastro

tokenia.live

Novo — feedback bem-vindo 🙏
```

---

## Notes on posting

- **Add a screenshot** — the results table with multiple providers is visually clear and shareable
- **Pin the launch tweet** on your profile on launch day
- **Don't post all at once** — space them 2–3 days apart
- **Reply to every comment** in the first 24 hours — engagement in early hours determines algorithmic reach
- **LinkedIn timing:** Tuesday–Thursday, 8–10 AM or 12–1 PM local time

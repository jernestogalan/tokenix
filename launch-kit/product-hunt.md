# Product Hunt Launch Kit

> **Status:** Draft — do NOT publish until you have a PH account and choose a launch day.
> Best launch days: Tuesday–Thursday. Schedule 12:01 AM PST.

---

## EN — English

### Name
Tokenia

### Tagline
Free LLM token calculator — 30+ models, text never stored, 5 languages

### Description (≈250 words)
Tokenia counts tokens and estimates costs across 30+ AI models — GPT-4o, Claude Sonnet, Gemini 2.5, Llama, Mistral, DeepSeek — instantly. No signup. No API key. Free forever.

**What it does:**
- Paste text or upload a file (PDF, DOCX, TXT, code) and get exact token counts + cost estimates for every major LLM provider side by side
- Compare any two models head-to-head
- Monthly cost projection: enter your request volume, get your AI budget
- Token visualizer: see exactly how your text gets tokenized
- Prompt optimizer: identifies noise you can strip to cut costs
- Export results as CSV or Markdown

**On privacy:** Your text travels over HTTPS to our server for accurate counting (we use official tokenizers — tiktoken, Claude's algorithm, etc.) and is immediately discarded. We don't store, log, or retain your prompts. No Google Analytics. No ad trackers. First-party event analytics only.

**Why I built it:** Every time I evaluated a new model, I had to mentally convert "this costs $X per million tokens" into "what does that actually mean for my use case?" I wanted a tool that does that math instantly, honestly, and without asking me to sign up first.

**Stack:** Node.js / Express, real tokenizer libraries, Railway, Supabase (optional auth), Resend.

Available in English, Spanish, Portuguese, Chinese, and German.

### Topics
developer-tools, artificial-intelligence, productivity, open-source, privacy

### First Comment (Maker)
Hey PH! 👋

I'm Ernesto, the maker of Tokenia. I built this because I was tired of guessing how much a prompt would cost before running it at scale.

A few things I'm proud of that aren't obvious from the listing:
- **Exact counts:** We use the actual tiktoken library for OpenAI, not a rough character-count heuristic. The number you see is the number you'll be billed for.
- **Honest privacy:** I want to be upfront — your text does travel to our server for processing (that's how accurate tokenization works). What we guarantee is that it's discarded immediately and never stored. You can verify this in the code.
- **No pricing tiers:** I removed Pro/Team plans during development because the tool is genuinely more useful when everyone has full access. It's free, and I intend to keep it that way.

Happy to answer any questions about the tech or the roadmap. Feedback welcome — especially if something's broken or confusing! 🙏

---

## ES — Español

### Tagline
Calculadora de tokens para LLMs — 30+ modelos, texto nunca almacenado, 5 idiomas

### Descripción (≈250 palabras)
Tokenia cuenta tokens y estima costos en más de 30 modelos de IA — GPT-4o, Claude Sonnet, Gemini 2.5, Llama, Mistral, DeepSeek — al instante. Sin registro. Sin clave API. Gratis para siempre.

**Qué hace:**
- Pega texto o sube un archivo (PDF, DOCX, TXT, código) y obtén conteos exactos de tokens + estimaciones de costo para cada proveedor importante, lado a lado
- Compara dos modelos cabeza a cabeza
- Proyección mensual de costos: ingresa tu volumen de solicitudes, obtén tu presupuesto de IA
- Visualizador de tokens: ve exactamente cómo se tokeniza tu texto
- Optimizador de prompts: identifica ruido que puedes eliminar para reducir costos
- Exporta resultados como CSV o Markdown

**Sobre privacidad:** Tu texto viaja por HTTPS a nuestro servidor para el conteo preciso y se descarta de inmediato. No almacenamos, registramos ni retenemos tus prompts. Sin Google Analytics. Sin trackers de anuncios.

**Por qué lo construí:** Cada vez que evaluaba un modelo nuevo, tenía que convertir mentalmente "esto cuesta $X por millón de tokens" en "¿qué significa eso para mi caso de uso?" Quería una herramienta que hiciera ese cálculo al instante, honestamente y sin pedirme que me registrara.

Disponible en inglés, español, portugués, chino y alemán.

### Primer comentario (Maker)
¡Hola PH! 👋

Soy Ernesto, el creador de Tokenia. Lo construí porque me cansé de adivinar cuánto costaría un prompt antes de ejecutarlo a escala.

Precios reales de tokenizadores oficiales, sin planes de pago, sin trackers. Feliz de responder preguntas sobre la tecnología o el roadmap. ¡El feedback es bienvenido! 🙏

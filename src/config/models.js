/**
 * Tokenia — src/config/models.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  HOW TO UPDATE PRICES
 *  1. Find the provider block below.
 *  2. Change `inputPer1M` / `outputPer1M` to the new USD price per 1M tokens.
 *  3. Save the file and restart the server — no other changes needed.
 *
 *  Prices last verified: May 2026
 *  Source: official pricing pages of each provider.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  tokenizer field values:
 *    "exact"     — uses tiktoken (official tokenizer) → shown as "Exact" in UI
 *    "estimated" — character/word heuristic           → shown as "~Estimated" in UI
 *
 *  precision field per model:
 *    "exact"        — OpenAI models with tiktoken
 *    "official_api" — provider offers an official token count API
 *    "estimated"    — our calibrated heuristic
 *
 *  encoding field: tiktoken encoding name (only when tokenizer === "exact")
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MODELS = {

  // ── Anthropic ──────────────────────────────────────────────────────────────
  anthropic: {
    name: 'Anthropic',
    color: '#cc785c',
    tokenizer: 'estimated',
    tokenizerPrecision: 'estimated',
    tokenizerNote: 'Anthropic uses a proprietary BPE tokenizer. Counts are heuristic approximations.',
    models: {
      'claude-opus-4-6': {
        name: 'Claude Opus 4.6',
        inputPer1M:  15.00,
        outputPer1M: 75.00,
        contextWindow: 200_000,
        precision: 'estimated',
        active: true,
        released: '2026-03',
      },
      'claude-sonnet-4-6': {
        name: 'Claude Sonnet 4.6',
        inputPer1M:   3.00,
        outputPer1M: 15.00,
        contextWindow: 200_000,
        precision: 'estimated',
        active: true,
        released: '2026-03',
      },
      'claude-opus-4-5': {
        name: 'Claude Opus 4.5',
        inputPer1M:  15.00,
        outputPer1M: 75.00,
        contextWindow: 200_000,
        precision: 'estimated',
        active: true,
        released: '2025-05',
      },
      'claude-opus-4': {
        name: 'Claude Opus 4',
        inputPer1M:  15.00,
        outputPer1M: 75.00,
        contextWindow: 200_000,
        precision: 'estimated',
        active: true,
        released: '2025-05',
      },
      'claude-sonnet-4': {
        name: 'Claude Sonnet 4',
        inputPer1M:   3.00,
        outputPer1M: 15.00,
        contextWindow: 200_000,
        precision: 'estimated',
        active: true,
        released: '2025-05',
      },
      'claude-haiku-4-5': {
        name: 'Claude Haiku 4.5',
        inputPer1M:  0.80,
        outputPer1M: 4.00,
        contextWindow: 200_000,
        precision: 'estimated',
        active: true,
        released: '2025-05',
      },
      'claude-sonnet-3-7': {
        name: 'Claude Sonnet 3.7',
        inputPer1M:   3.00,
        outputPer1M: 15.00,
        contextWindow: 200_000,
        precision: 'estimated',
        active: true,
        released: '2025-02',
      },
    },
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    name: 'OpenAI',
    color: '#10b981',
    tokenizer: 'exact',
    tokenizerPrecision: 'exact',
    tokenizerNote: 'Uses the official tiktoken tokenizer. Token counts are exact.',
    models: {
      'gpt-4o': {
        name: 'GPT-4o',
        inputPer1M:              2.50,
        outputPer1M:            10.00,
        cachedInputPerMillion:   1.25,
        contextWindow: 128_000,
        encoding: 'o200k_base',
        precision: 'exact',
        active: true,
        released: '2024-05',
      },
      'gpt-4o-mini': {
        name: 'GPT-4o mini',
        inputPer1M:              0.15,
        outputPer1M:             0.60,
        cachedInputPerMillion:   0.075,
        contextWindow: 128_000,
        encoding: 'o200k_base',
        precision: 'exact',
        active: true,
        released: '2024-07',
      },
      'gpt-4.1': {
        name: 'GPT-4.1',
        inputPer1M:              2.00,
        outputPer1M:             8.00,
        cachedInputPerMillion:   0.50,
        contextWindow: 1_047_576,
        encoding: 'o200k_base',
        precision: 'exact',
        active: true,
        released: '2025-04',
      },
      'o4-mini': {
        name: 'o4-mini',
        inputPer1M:   1.10,
        outputPer1M:  4.40,
        contextWindow: 200_000,
        encoding: 'o200k_base',
        precision: 'exact',
        active: true,
        released: '2025-04',
        note: 'Reasoning model. Output tokens include chain-of-thought tokens.',
      },
      'o1': {
        name: 'o1',
        inputPer1M:  15.00,
        outputPer1M: 60.00,
        contextWindow: 200_000,
        encoding: 'o200k_base',
        precision: 'exact',
        active: true,
        released: '2024-12',
        note: 'Reasoning model. Output tokens include hidden chain-of-thought tokens.',
      },
      'o3-mini': {
        name: 'o3-mini',
        inputPer1M:  1.10,
        outputPer1M: 4.40,
        contextWindow: 200_000,
        encoding: 'o200k_base',
        precision: 'exact',
        active: true,
        released: '2025-01',
        note: 'Reasoning model. Output tokens include hidden chain-of-thought tokens.',
      },
      'gpt-4-turbo': {
        name: 'GPT-4 Turbo',
        inputPer1M:  10.00,
        outputPer1M: 30.00,
        contextWindow: 128_000,
        encoding: 'cl100k_base',
        precision: 'exact',
        active: true,
        released: '2024-04',
      },
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        inputPer1M:  0.50,
        outputPer1M: 1.50,
        contextWindow: 16_385,
        encoding: 'cl100k_base',
        precision: 'exact',
        active: true,
        released: '2023-03',
      },
    },
  },

  // ── Google ────────────────────────────────────────────────────────────────
  google: {
    name: 'Google',
    color: '#4285f4',
    tokenizer: 'estimated',
    tokenizerPrecision: 'estimated',
    tokenizerNote: 'Google uses a SentencePiece tokenizer. Counts are heuristic approximations.',
    models: {
      'gemini-2.5-pro': {
        name: 'Gemini 2.5 Pro',
        inputPer1M:  1.25,
        outputPer1M: 10.00,
        contextWindow: 1_048_576,
        precision: 'estimated',
        active: true,
        released: '2025-09',
      },
      'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        inputPer1M:  0.15,
        outputPer1M: 0.60,
        contextWindow: 1_048_576,
        precision: 'estimated',
        active: true,
        released: '2025-05',
      },
      'gemini-2.0-flash': {
        name: 'Gemini 2.0 Flash',
        inputPer1M:  0.10,
        outputPer1M: 0.40,
        contextWindow: 1_000_000,
        precision: 'estimated',
        active: true,
        released: '2025-02',
      },
      'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        inputPer1M:  1.25,
        outputPer1M: 5.00,
        contextWindow: 2_000_000,
        precision: 'estimated',
        active: true,
        released: '2024-05',
        note: 'Price shown for ≤128K context. Longer prompts billed at 2× rate.',
      },
      'gemini-1.5-flash': {
        name: 'Gemini 1.5 Flash',
        inputPer1M:  0.075,
        outputPer1M: 0.30,
        contextWindow: 1_000_000,
        precision: 'estimated',
        active: true,
        released: '2024-05',
      },
    },
  },

  // ── Meta (via third-party providers) ─────────────────────────────────────
  meta: {
    name: 'Meta / Llama',
    color: '#1877f2',
    tokenizer: 'estimated',
    tokenizerPrecision: 'estimated',
    tokenizerNote: 'Llama uses a BPE tokenizer similar to GPT but with a different vocabulary. Counts are approximations. Prices shown are for Together.ai — check your provider for exact rates.',
    models: {
      'llama-3.3-70b': {
        name: 'Llama 3.3 70B',
        inputPer1M:  0.59,
        outputPer1M: 0.79,
        contextWindow: 128_000,
        precision: 'estimated',
        active: true,
        released: '2024-12',
        note: 'Prices vary by provider. Shown: Together.ai rates.',
      },
      'llama-3.1-8b': {
        name: 'Llama 3.1 8B',
        inputPer1M:  0.18,
        outputPer1M: 0.18,
        contextWindow: 128_000,
        precision: 'estimated',
        active: true,
        released: '2024-07',
        note: 'Prices vary by provider. Shown: Together.ai rates.',
      },
    },
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  mistral: {
    name: 'Mistral',
    color: '#ff7000',
    tokenizer: 'estimated',
    tokenizerPrecision: 'estimated',
    tokenizerNote: 'Mistral uses a SentencePiece tokenizer. Counts are heuristic approximations.',
    models: {
      'mistral-large-2': {
        name: 'Mistral Large 2',
        inputPer1M:  2.00,
        outputPer1M: 6.00,
        contextWindow: 131_072,
        precision: 'estimated',
        active: true,
        released: '2024-07',
      },
      'mistral-small-3': {
        name: 'Mistral Small 3',
        inputPer1M:  0.10,
        outputPer1M: 0.30,
        contextWindow: 32_768,
        precision: 'estimated',
        active: true,
        released: '2025-01',
      },
      'codestral': {
        name: 'Codestral',
        inputPer1M:  0.30,
        outputPer1M: 0.90,
        contextWindow: 262_144,
        precision: 'estimated',
        active: true,
        released: '2024-05',
      },
    },
  },

  // ── DeepSeek ───────────────────────────────────────────────────────────────
  deepseek: {
    name: 'DeepSeek',
    color: '#4d9de0',
    tokenizer: 'estimated',
    tokenizerPrecision: 'estimated',
    tokenizerNote: 'DeepSeek uses a custom BPE tokenizer. Counts are heuristic approximations.',
    models: {
      'deepseek-v3-flash': {
        name: 'DeepSeek V3 Flash',
        inputPer1M:  0.07,
        outputPer1M: 0.28,
        contextWindow: 128_000,
        precision: 'estimated',
        active: true,
        released: '2025-03',
      },
      'deepseek-v3': {
        name: 'DeepSeek V3',
        inputPer1M:  0.27,
        outputPer1M: 1.10,
        contextWindow: 128_000,
        precision: 'estimated',
        active: true,
        released: '2024-12',
      },
      'deepseek-r1': {
        name: 'DeepSeek R1',
        inputPer1M:  0.55,
        outputPer1M: 2.19,
        contextWindow: 128_000,
        precision: 'estimated',
        active: true,
        released: '2025-01',
        note: 'Reasoning model.',
      },
    },
  },

};

module.exports = MODELS;

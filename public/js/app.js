/**
 * Tokenia — app.js (v5)
 * Client-side token analyzer: instant estimates + server-enhanced exact counts.
 * Works fully offline/standalone; server call is a non-blocking enhancement.
 */

/* ── Provider colors ──────────────────────────────────────────────────────── */
const PROVIDER_META = {
  openai:    { name: 'OpenAI',        color: '#10b981' },
  anthropic: { name: 'Anthropic',     color: '#cc785c' },
  google:    { name: 'Google',        color: '#4285f4' },
  meta:      { name: 'Meta / Llama',  color: '#1877f2' },
  mistral:   { name: 'Mistral',       color: '#ff7000' },
  deepseek:  { name: 'DeepSeek',      color: '#4d9de0' },
};

/* ── Models database (May 2026) ───────────────────────────────────────────── */
const MODELS = {
  openai: [
    { id: 'gpt-4.1',      name: 'GPT-4.1',      inputPrice: 2.00,  outputPrice: 8.00  },
    { id: 'gpt-4o',       name: 'GPT-4o',        inputPrice: 2.50,  outputPrice: 10.00 },
    { id: 'gpt-4o-mini',  name: 'GPT-4o mini',   inputPrice: 0.15,  outputPrice: 0.60  },
    { id: 'o4-mini',      name: 'o4-mini',        inputPrice: 1.10,  outputPrice: 4.40  },
    { id: 'o1',           name: 'o1',             inputPrice: 15.00, outputPrice: 60.00 },
    { id: 'o3-mini',      name: 'o3-mini',        inputPrice: 1.10,  outputPrice: 4.40  },
    { id: 'gpt-3.5-turbo',name: 'GPT-3.5 Turbo', inputPrice: 0.50,  outputPrice: 1.50  },
  ],
  anthropic: [
    { id: 'claude-opus-4-6',    name: 'Claude Opus 4.6',    inputPrice: 15.00, outputPrice: 75.00 },
    { id: 'claude-sonnet-4-6',  name: 'Claude Sonnet 4.6',  inputPrice: 3.00,  outputPrice: 15.00 },
    { id: 'claude-haiku-4-5',   name: 'Claude Haiku 4.5',   inputPrice: 0.80,  outputPrice: 4.00  },
    { id: 'claude-opus-4',      name: 'Claude Opus 4',      inputPrice: 15.00, outputPrice: 75.00 },
    { id: 'claude-sonnet-4',    name: 'Claude Sonnet 4',    inputPrice: 3.00,  outputPrice: 15.00 },
    { id: 'claude-sonnet-3-7',  name: 'Claude Sonnet 3.7',  inputPrice: 3.00,  outputPrice: 15.00 },
  ],
  google: [
    { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',    inputPrice: 1.25,  outputPrice: 10.00 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash',  inputPrice: 0.15,  outputPrice: 0.60  },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash',  inputPrice: 0.10,  outputPrice: 0.40  },
    { id: 'gemini-1.5-pro',   name: 'Gemini 1.5 Pro',    inputPrice: 1.25,  outputPrice: 5.00  },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash',  inputPrice: 0.075, outputPrice: 0.30  },
  ],
  meta: [
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', inputPrice: 0.59, outputPrice: 0.79 },
    { id: 'llama-3.1-8b',  name: 'Llama 3.1 8B',  inputPrice: 0.18, outputPrice: 0.18 },
  ],
  mistral: [
    { id: 'mistral-large-2',  name: 'Mistral Large 2',  inputPrice: 2.00, outputPrice: 6.00 },
    { id: 'mistral-small-3',  name: 'Mistral Small 3',  inputPrice: 0.10, outputPrice: 0.30 },
    { id: 'codestral',        name: 'Codestral',         inputPrice: 0.30, outputPrice: 0.90 },
  ],
  deepseek: [
    { id: 'deepseek-v3',       name: 'DeepSeek V3',        inputPrice: 0.27, outputPrice: 1.10 },
    { id: 'deepseek-v3-flash', name: 'DeepSeek V3 Flash',  inputPrice: 0.07, outputPrice: 0.28 },
    { id: 'deepseek-r1',       name: 'DeepSeek R1',        inputPrice: 0.55, outputPrice: 2.19 },
  ],
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function fmt(n)  { return Number(n).toLocaleString(); }

function fmtMoney(n) {
  if (n == null) return '—';
  n = Number(n);
  if (n === 0)     return '$0.0000';
  if (n < 0.0001)  return '<$0.0001';
  if (n < 0.01)    return '$' + n.toFixed(6);
  if (n < 1)       return '$' + n.toFixed(4);
  return '$' + n.toFixed(2);
}

/* ── Client-side token estimation ────────────────────────────────────────── */
// Calibrated heuristic: ~4 chars/token for English prose, ~3.5 for code
function estimateTokens(text) {
  if (!text) return 0;
  const chars    = text.length;
  const specials = (text.match(/[{}()[\]<>:;=+\-*\/\\|&^%$#@!~`]/g) || []).length;
  const isCode   = specials / chars > 0.08;
  const ratio    = isCode ? 3.5 : 4.0;
  return Math.ceil(chars / ratio);
}

/* ── State ────────────────────────────────────────────────────────────────── */
let _activeProvider = 'all';
let _lastTokenCount = 0;

/* ── Init ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const textInput      = $('text-input');
  const btnAnalyze     = $('btn-analyze');
  const btnClear       = $('btn-clear');
  const providerFilter = $('provider-filter');

  if (textInput) {
    textInput.addEventListener('input', updateStats);
    // Enable/disable analyze button based on content
    textInput.addEventListener('input', () => {
      if (btnAnalyze) btnAnalyze.disabled = !textInput.value.trim();
    });
  }

  if (btnAnalyze) {
    btnAnalyze.disabled = true; // starts disabled until text entered
    btnAnalyze.addEventListener('click', analyzeTokens);
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (textInput) textInput.value = '';
      updateStats();
      hideResults();
      if (btnAnalyze) btnAnalyze.disabled = true;
    });
  }

  if (providerFilter) {
    providerFilter.addEventListener('change', () => {
      _activeProvider = providerFilter.value;
      // Re-render if results are shown
      const rs = $('results-section');
      if (rs && rs.style.display !== 'none' && _lastTokenCount > 0) {
        renderResults(_lastTokenCount);
      }
    });
  }

  console.log('✅ Tokenia Token Analyzer v5 ready');
});

/* ── Update stats bar ─────────────────────────────────────────────────────── */
function updateStats() {
  const text  = ($('text-input') || {}).value || '';
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split('\n').length : 0;
  const cc = $('char-count'); if (cc) cc.textContent = fmt(chars);
  const wc = $('word-count'); if (wc) wc.textContent = fmt(words);
  const lc = $('line-count'); if (lc) lc.textContent = fmt(lines);
}

/* ── Hide results ─────────────────────────────────────────────────────────── */
function hideResults() {
  const rs = $('results-section');
  if (rs) rs.style.display = 'none';
}

/* ── Main analyze function ────────────────────────────────────────────────── */
function analyzeTokens() {
  const textInput = $('text-input');
  const text = textInput ? textInput.value.trim() : '';
  if (!text) return;

  const tokens = estimateTokens(text);
  _lastTokenCount = tokens;

  renderResults(tokens);

  // Optional server-side enhancement (exact tiktoken for OpenAI)
  tryServerEnhancement(text);
}

/* ── Render results table ─────────────────────────────────────────────────── */
function renderResults(tokenCount) {
  const providers = _activeProvider === 'all'
    ? Object.keys(MODELS)
    : [_activeProvider];

  // Summary bar
  const summaryEl = $('results-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span><strong>~${fmt(tokenCount)}</strong> tokens estimated</span>
      <span style="color:var(--border-md)">|</span>
      <span style="color:var(--muted);font-size:var(--text-xs)">Based on ~4 chars/token heuristic · OpenAI models show exact counts when server is available</span>
    `;
  }

  // Tables per provider
  let html = '';
  for (const provId of providers) {
    if (!MODELS[provId]) continue;
    const meta  = PROVIDER_META[provId] || { name: provId, color: '#888' };
    const rows  = MODELS[provId];

    const tableRows = rows.map(m => {
      const inputCost  = (tokenCount / 1_000_000) * m.inputPrice;
      const outputCost = (tokenCount / 1_000_000) * m.outputPrice;
      const totalCost  = inputCost + outputCost;
      return `<tr data-model="${m.id}">
        <td><strong>${m.name}</strong></td>
        <td>${fmt(tokenCount)}</td>
        <td>${fmtMoney(inputCost)}</td>
        <td>${fmtMoney(outputCost)}</td>
        <td class="cost-total">${fmtMoney(totalCost)}</td>
        <td><span class="badge-estimated">~Est.</span></td>
      </tr>`;
    }).join('');

    html += `
      <div class="provider-block">
        <div class="provider-block-title">
          <span class="provider-dot" style="background:${meta.color}"></span>
          ${meta.name}
        </div>
        <div class="results-table-outer">
          <table class="results-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Tokens</th>
                <th>Input Cost</th>
                <th>Output Cost</th>
                <th>Total</th>
                <th>Precision</th>
              </tr>
            </thead>
            <tbody id="tbody-${provId}">${tableRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  const content = $('results-content');
  if (content) content.innerHTML = html;

  // Show section
  const rs = $('results-section');
  if (rs) {
    rs.style.display = '';
    setTimeout(() => rs.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
}

/* ── Server enhancement (non-blocking, optional) ─────────────────────────── */
async function tryServerEnhancement(text) {
  try {
    const res = await fetch('/api/count', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return; // silent fail — client estimates already shown
    const data = await res.json();
    if (!data.results || !data.results.length) return;

    // Update token count display with more accurate server count
    const maxTokens = Math.max(...data.results.map(r => r.tokens || 0));
    if (maxTokens > 0) _lastTokenCount = maxTokens;

    // Update summary
    const summaryEl = $('results-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <span><strong>${fmt(maxTokens)}</strong> tokens</span>
        <span style="color:var(--border-md)">|</span>
        <span style="color:var(--muted);font-size:var(--text-xs)">Server-enhanced · OpenAI = exact (tiktoken) · Others = ~estimated</span>
      `;
    }

    // Update each row with server data
    data.results.forEach(r => {
      const row = document.querySelector(`tr[data-model="${r.model}"]`);
      if (!row) return;
      const cells = row.querySelectorAll('td');
      if (cells.length < 6) return;

      const inputCost  = r.inputCost  ?? (r.tokens / 1_000_000) * 0;
      const outputCost = r.outputCost ?? 0;
      const totalCost  = r.totalCost  ?? (inputCost + outputCost);

      cells[1].textContent = fmt(r.tokens);
      cells[2].textContent = fmtMoney(r.inputCost);
      cells[3].textContent = fmtMoney(r.outputCost);
      cells[4].innerHTML   = `<span class="cost-total">${fmtMoney(totalCost)}</span>`;
      cells[5].innerHTML   = r.precision === 'exact'
        ? '<span class="badge-exact">Exact</span>'
        : '<span class="badge-estimated">~Est.</span>';
    });
  } catch {
    // Server unavailable — client estimates remain. No UI disruption.
  }
}

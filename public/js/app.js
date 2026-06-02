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
let _activeTab      = 'paste';

/* ── Init ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const textInput      = $('text-input');
  const btnAnalyze     = $('btn-analyze');
  const btnClear       = $('btn-clear');
  const providerFilter = $('provider-filter');

  if (textInput) {
    textInput.addEventListener('input', updateStats);
    textInput.addEventListener('input', () => {
      if (btnAnalyze) btnAnalyze.disabled = !textInput.value.trim();
    });
  }

  if (btnAnalyze) {
    btnAnalyze.disabled = true;
    btnAnalyze.addEventListener('click', analyzeTokens);
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (textInput) textInput.value = '';
      updateStats();
      hideResults();
      resetUploadUI();
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

  // Analyzer tabs (Paste / Upload)
  document.querySelectorAll('.atab').forEach(btn => {
    btn.addEventListener('click', () => switchAnalyzerTab(btn.dataset.atab));
  });

  // File upload wiring
  setupFileUpload();

  // Populate compare model selects immediately
  populateCompareSelects();

  console.log('✅ Tokenia Token Analyzer v7 ready');
});

/* ── Analyzer tabs ────────────────────────────────────────────────────────── */
function switchAnalyzerTab(tabName) {
  _activeTab = tabName;
  document.querySelectorAll('.atab').forEach(b => {
    b.classList.toggle('atab-active', b.dataset.atab === tabName);
    b.setAttribute('aria-selected', b.dataset.atab === tabName);
  });
  document.querySelectorAll('.atab-panel').forEach(p => {
    p.style.display = p.id === `atab-${tabName}` ? '' : 'none';
  });
}

/* ── File upload ──────────────────────────────────────────────────────────── */
const ALLOWED_EXTENSIONS = new Set([
  'txt','md','pdf','doc','docx','csv','json',
  'py','js','ts','jsx','tsx','html','css','rb','go','rs','java','kt','swift',
  'c','cpp','cs','php','sh','sql','yaml','yml','toml','r','ipynb',
]);

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function setupFileUpload() {
  const dropZone    = $('drop-zone');
  const fileInput   = $('file-input');
  const browseBtn   = $('btn-browse-file');
  const removeBtn   = $('btn-remove-file');
  const uploadStatus= $('upload-status');
  const btnAnalyze  = $('btn-analyze');

  if (!dropZone || !fileInput) return;

  // Click → browse
  dropZone.addEventListener('click', () => fileInput.click());
  browseBtn && browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });

  // Keyboard accessibility
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

  // Drag over
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drop-zone-active');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone-active'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone-active');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  removeBtn && removeBtn.addEventListener('click', () => {
    resetUploadUI();
    const textInput = $('text-input');
    if (textInput) textInput.value = '';
    updateStats();
    if (btnAnalyze) btnAnalyze.disabled = true;
    fileInput.value = '';
  });
}

async function handleFile(file) {
  const ext = getExt(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    showUploadError(`File type ".${ext}" is not supported.`); return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showUploadError('File too large — max 10 MB.'); return;
  }

  // Show status
  const uploadStatus = $('upload-status');
  const filename     = $('upload-filename');
  const progressFill = $('upload-progress-fill');
  const btnAnalyze   = $('btn-analyze');

  if (uploadStatus) uploadStatus.style.display = '';
  if (filename)     filename.textContent = file.name;
  if (progressFill) { progressFill.style.width = '0%'; progressFill.style.background = 'var(--orange)'; }

  // Client-side reading for text files (no server round-trip)
  if (['txt','md','json','csv','py','js','ts','jsx','tsx','html','css',
       'rb','go','rs','java','kt','swift','c','cpp','cs','php','sh',
       'sql','yaml','yml','toml','r','xml','toml'].includes(ext)) {
    const text = await file.text();
    if (progressFill) progressFill.style.width = '100%';
    loadTextIntoAnalyzer(text);
    return;
  }

  // Server-side parsing for PDF/DOCX
  try {
    // Animate progress
    let pct = 0;
    const interval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 25, 85);
      if (progressFill) progressFill.style.width = pct + '%';
    }, 150);

    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/parse-file', { method: 'POST', body: fd });

    clearInterval(interval);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Parse failed' }));
      showUploadError(err.error || 'Could not parse file.');
      return;
    }

    if (progressFill) progressFill.style.width = '100%';
    const data = await res.json();
    loadTextIntoAnalyzer(data.text || '');
  } catch (err) {
    showUploadError('Network error — please try again.');
  }
}

function loadTextIntoAnalyzer(text) {
  const textInput  = $('text-input');
  const btnAnalyze = $('btn-analyze');
  if (textInput) {
    textInput.value = text;
    updateStats();
  }
  if (btnAnalyze) btnAnalyze.disabled = !text.trim();
  // Switch to paste tab so user sees the text
  switchAnalyzerTab('paste');
}

function resetUploadUI() {
  const uploadStatus = $('upload-status');
  const progressFill = $('upload-progress-fill');
  if (uploadStatus) uploadStatus.style.display = 'none';
  if (progressFill) progressFill.style.width = '0%';
}

function showUploadError(msg) {
  resetUploadUI();
  const dropZone = $('drop-zone');
  if (dropZone) {
    const hint = dropZone.querySelector('.drop-zone-hint');
    if (hint) {
      const orig = hint.textContent;
      hint.style.color = 'var(--error)';
      hint.textContent = msg;
      setTimeout(() => { hint.style.color = ''; hint.textContent = orig; }, 3000);
    }
  }
}

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
  showPostAnalysisFeatures(text, tokens);

  // Check if compare toggle is on — re-render comparison
  const toggle = $('compare-toggle');
  if (toggle && toggle.checked) renderComparison();

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

/* ── Extended model data (context windows, for compare) ──────────────────── */
const MODEL_META = {
  // OpenAI
  'gpt-4.1':       { ctx: '1M', quality: '★★★★★' },
  'gpt-4o':        { ctx: '128K', quality: '★★★★★' },
  'gpt-4o-mini':   { ctx: '128K', quality: '★★★☆☆' },
  'o4-mini':       { ctx: '200K', quality: '★★★★☆' },
  'o1':            { ctx: '200K', quality: '★★★★★' },
  'o3-mini':       { ctx: '200K', quality: '★★★★☆' },
  'gpt-3.5-turbo': { ctx: '16K',  quality: '★★★☆☆' },
  // Anthropic
  'claude-opus-4-6':   { ctx: '200K', quality: '★★★★★' },
  'claude-sonnet-4-6': { ctx: '200K', quality: '★★★★☆' },
  'claude-haiku-4-5':  { ctx: '200K', quality: '★★★☆☆' },
  'claude-opus-4':     { ctx: '200K', quality: '★★★★★' },
  'claude-sonnet-4':   { ctx: '200K', quality: '★★★★☆' },
  'claude-sonnet-3-7': { ctx: '200K', quality: '★★★★☆' },
  // Google
  'gemini-2.5-pro':   { ctx: '1M',   quality: '★★★★★' },
  'gemini-2.5-flash': { ctx: '1M',   quality: '★★★★☆' },
  'gemini-2.0-flash': { ctx: '1M',   quality: '★★★☆☆' },
  'gemini-1.5-pro':   { ctx: '2M',   quality: '★★★★☆' },
  'gemini-1.5-flash': { ctx: '1M',   quality: '★★★☆☆' },
  // Meta
  'llama-3.3-70b': { ctx: '128K', quality: '★★★★☆' },
  'llama-3.1-8b':  { ctx: '128K', quality: '★★★☆☆' },
  // Mistral
  'mistral-large-2': { ctx: '128K', quality: '★★★★☆' },
  'mistral-small-3': { ctx: '32K',  quality: '★★★☆☆' },
  'codestral':       { ctx: '32K',  quality: '★★★☆☆' },
  // DeepSeek
  'deepseek-v3':       { ctx: '128K', quality: '★★★★☆' },
  'deepseek-v3-flash': { ctx: '64K',  quality: '★★★☆☆' },
  'deepseek-r1':       { ctx: '64K',  quality: '★★★★☆' },
};

/* ── Populate compare model selects ──────────────────────────────────────── */
function populateCompareSelects() {
  const selA = $('compare-model-a');
  const selB = $('compare-model-b');
  if (!selA || !selB) return;

  let optionsHtml = '<option value="">Select model…</option>';
  for (const [provId, models] of Object.entries(MODELS)) {
    const provName = PROVIDER_META[provId]?.name || provId;
    for (const m of models) {
      optionsHtml += `<option value="${m.id}" data-prov="${provId}" data-input="${m.inputPrice}" data-output="${m.outputPrice}">${provName} — ${m.name}</option>`;
    }
  }
  selA.innerHTML = optionsHtml;
  selB.innerHTML = optionsHtml;

  [selA, selB].forEach(sel => sel.addEventListener('change', renderComparison));
}

/* ── Side-by-side model comparison renderer ──────────────────────────────── */
function renderComparison() {
  const selA = $('compare-model-a');
  const selB = $('compare-model-b');
  const container = $('compare-result');

  if (!selA || !selB || !selA.value || !selB.value) {
    if (container) container.style.display = 'none';
    return;
  }

  const tokens = _lastTokenCount || 1000;
  const optA = selA.options[selA.selectedIndex];
  const optB = selB.options[selB.selectedIndex];

  const inA  = parseFloat(optA.dataset.input)  || 0;
  const outA = parseFloat(optA.dataset.output) || 0;
  const inB  = parseFloat(optB.dataset.input)  || 0;
  const outB = parseFloat(optB.dataset.output) || 0;

  const costA = (tokens / 1e6) * (inA + outA);
  const costB = (tokens / 1e6) * (inB + outB);
  const cheaper = costA <= costB ? 'A' : 'B';
  const diff    = Math.abs(costA - costB);
  const pct     = costA && costB ? Math.round((diff / Math.max(costA, costB)) * 100) : 0;

  const metaA = MODEL_META[selA.value] || { ctx: '—', quality: '—' };
  const metaB = MODEL_META[selB.value] || { ctx: '—', quality: '—' };

  const cardStyle = (isCheaper) => isCheaper
    ? 'border:2px solid var(--success);background:#f0fdf4;'
    : 'border:1.5px solid var(--border);';

  const html = `
    <div class="compare-result-grid">
      <div class="compare-card" style="${cardStyle(cheaper==='A')}">
        ${cheaper==='A' ? '<span class="best-value-badge">🏆 Best Value</span>' : ''}
        <div class="compare-card-name">${optA.text.split(' — ')[0]}</div>
        <div class="compare-card-model">${optA.text.split(' — ')[1]||optA.text}</div>
        <div class="compare-card-cost">${fmtMoney(costA)}</div>
        <div class="compare-card-meta">
          <span>Input: $${inA}/1M</span>
          <span>Output: $${outA}/1M</span>
          <span>Ctx: ${metaA.ctx}</span>
          <span>${metaA.quality}</span>
        </div>
      </div>
      <div class="compare-vs-col">
        <div class="compare-vs-badge">VS</div>
        <div class="compare-diff">
          <div class="compare-diff-num">${fmtMoney(diff)}</div>
          <div class="compare-diff-pct">${pct}% cheaper</div>
        </div>
      </div>
      <div class="compare-card" style="${cardStyle(cheaper==='B')}">
        ${cheaper==='B' ? '<span class="best-value-badge">🏆 Best Value</span>' : ''}
        <div class="compare-card-name">${optB.text.split(' — ')[0]}</div>
        <div class="compare-card-model">${optB.text.split(' — ')[1]||optB.text}</div>
        <div class="compare-card-cost">${fmtMoney(costB)}</div>
        <div class="compare-card-meta">
          <span>Input: $${inB}/1M</span>
          <span>Output: $${outB}/1M</span>
          <span>Ctx: ${metaB.ctx}</span>
          <span>${metaB.quality}</span>
        </div>
      </div>
    </div>
    <p class="compare-note">Costs based on ${fmt(tokens)} input tokens. Output tokens assumed equal.</p>`;

  if (!container) {
    // Create container if missing
    const rs = $('results-section');
    if (!rs) return;
    const div = document.createElement('div');
    div.id = 'compare-result';
    div.className = 'compare-result-card';
    rs.querySelector('.section-container')?.prepend(div);
  }
  const cont = $('compare-result');
  if (cont) { cont.innerHTML = html; cont.style.display = 'block'; }
}

/* ── Token Visualizer ─────────────────────────────────────────────────────── */
function renderTokenVisualizer(text) {
  const section = $('token-viz-section');
  const container = $('token-viz-content');
  if (!section || !container) return;

  // Simple regex-based tokenization: split on word boundaries + punctuation
  // Approximate: ~4 chars = 1 token for display coloring
  const tokens = tokenizeApprox(text);
  const COLORS = ['#fff4ed', '#ffe4cc', '#ffd0a8'];
  let html = '';
  tokens.forEach((tok, i) => {
    const bg = COLORS[i % 3];
    const escaped = tok.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += `<span class="viz-token" style="background:${bg}" title="Token #${i+1}: ${tok.length} chars">${escaped}</span>`;
  });

  container.innerHTML = html || '<em style="color:var(--muted)">No text to visualize.</em>';
  section.style.display = 'block';
}

function tokenizeApprox(text) {
  // Split by whitespace and punctuation to create token-like chunks
  const chunks = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[\s\n\r]/.test(ch)) {
      if (current) { chunks.push(current); current = ''; }
      if (ch !== '\n') chunks.push(ch); else chunks.push('↵');
    } else if (/[.,!?;:()[\]{}"'`]/.test(ch)) {
      if (current) { chunks.push(current); current = ''; }
      chunks.push(ch);
    } else {
      current += ch;
      // Break into ~4-char chunks to simulate tokenization
      if (current.length >= 4) { chunks.push(current); current = ''; }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(t => t.length > 0).slice(0, 500); // cap at 500 visual tokens
}

/* ── Prompt Optimizer ────────────────────────────────────────────────────── */
const FILLER_PATTERNS = [
  { pattern: /\b(please|kindly)\b/gi,               save: 1,  tip: 'Remove "please/kindly" — LLMs respond without polite filler.' },
  { pattern: /\b(as an ai|as a language model)\b/gi, save: 4,  tip: 'Remove "as an AI" — irrelevant to output quality.' },
  { pattern: /\b(i would like you to|i want you to|could you please)\b/gi, save: 4, tip: 'Replace long openers with direct commands.' },
  { pattern: /\b(very|really|quite|extremely|absolutely)\b/gi, save: 1, tip: 'Cut intensifier adverbs — they add tokens but not meaning.' },
  { pattern: /\b(in order to)\b/gi,                 save: 1,  tip: 'Replace "in order to" with "to".' },
  { pattern: /\b(the fact that)\b/gi,                save: 2,  tip: 'Replace "the fact that" with "that".' },
  { pattern: /\b(it is important to note that|it should be noted that|please note that)\b/gi, save: 5, tip: 'Cut meta-commentary like "It is important to note that".' },
  { pattern: /[ \t]{2,}/g,                           save: 1,  tip: 'Remove extra spaces/whitespace.' },
  { pattern: /\n{3,}/g,                              save: 1,  tip: 'Collapse multiple blank lines into one.' },
];

function analyzePromptOptimizations(text) {
  const suggestions = [];
  let totalSavings = 0;

  FILLER_PATTERNS.forEach(({ pattern, save, tip }) => {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const tokens = matches.length * save;
      totalSavings += tokens;
      suggestions.push({ tip, count: matches.length, tokens });
    }
  });

  // Repetition detection
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};
  words.forEach(w => { if (w.length > 5) wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const repeated = Object.entries(wordFreq).filter(([,c]) => c > 3);
  if (repeated.length > 0) {
    suggestions.push({ tip: `"${repeated[0][0]}" repeats ${repeated[0][1]}x — consider condensing.`, count: repeated[0][1], tokens: repeated[0][1] - 1 });
    totalSavings += repeated[0][1] - 1;
  }

  return { suggestions, totalSavings };
}

function renderPromptOptimizer(text) {
  const section = $('optimizer-section');
  const container = $('optimizer-content');
  if (!section || !container) return;

  const { suggestions, totalSavings } = analyzePromptOptimizations(text);
  const costSaving = (totalSavings / 1_000_000) * 2.5; // avg $2.5/1M tokens

  if (suggestions.length === 0) {
    container.innerHTML = '<p style="color:var(--success);font-weight:600;">✓ Your prompt looks optimized already!</p>';
  } else {
    let html = `<div class="optimizer-header-row">
      <span class="optimizer-savings">~${totalSavings} tokens saved · ${fmtMoney(costSaving * 1000)} per 1K requests</span>
    </div><ul class="optimizer-list">`;
    suggestions.forEach(s => {
      html += `<li class="optimizer-item">
        <span class="optimizer-check">⚡</span>
        <span class="optimizer-tip">${s.tip}</span>
        <span class="optimizer-token-save">−${s.tokens} tok</span>
      </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
  }
  section.style.display = 'block';
}

/* ── Post-analysis: wire up all post-results features ────────────────────── */
function showPostAnalysisFeatures(text, tokenCount) {
  // Build window._lastResults for export
  const results = [];
  for (const [provId, models] of Object.entries(MODELS)) {
    const provName = PROVIDER_META[provId]?.name || provId;
    for (const m of models) {
      results.push({
        model: m.name,
        provider: provName,
        modelId: m.id,
        inputTokens: tokenCount,
        outputTokens: Math.round(tokenCount * 0.3), // estimate
        inputCost:  parseFloat(((tokenCount / 1e6) * m.inputPrice).toFixed(6)),
        outputCost: parseFloat(((tokenCount / 1e6) * m.outputPrice * 0.3).toFixed(6)),
        totalCost:  parseFloat(((tokenCount / 1e6) * (m.inputPrice + m.outputPrice * 0.3)).toFixed(6)),
      });
    }
  }
  window._lastResults = results.sort((a, b) => a.totalCost - b.totalCost);

  // Show export + share rows
  const exportRow = $('export-row');
  if (exportRow) exportRow.style.display = 'flex';

  const projCard = $('projection-card');
  if (projCard) projCard.style.display = 'block';

  // Show viral share row
  let shareRow = $('viral-share-row');
  if (!shareRow) {
    shareRow = document.createElement('div');
    shareRow.id = 'viral-share-row';
    shareRow.className = 'viral-share-row';
    const rs = $('results-section');
    rs?.querySelector('.section-container')?.appendChild(shareRow);
  }
  const cheapest = window._lastResults[0];
  const tweetText = encodeURIComponent(`Just analyzed my prompt with Tokenia — it costs ${fmtMoney(cheapest.totalCost)} on ${cheapest.provider} ${cheapest.model}.\nFree LLM token calculator → tokenia.live`);
  shareRow.innerHTML = `
    <span class="share-label">Share your results:</span>
    <a href="https://twitter.com/intent/tweet?text=${tweetText}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm share-btn">
      𝕏 Post on X
    </a>
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://tokenia.live" target="_blank" rel="noopener" class="btn btn-ghost btn-sm share-btn">
      LinkedIn
    </a>
    <a href="https://reddit.com/submit?url=https://tokenia.live&title=Free+LLM+token+calculator+that+actually+respects+privacy" target="_blank" rel="noopener" class="btn btn-ghost btn-sm share-btn">
      Reddit
    </a>`;
  shareRow.style.display = 'flex';

  // Render Token Visualizer (truncate to first 500 chars for perf)
  renderTokenVisualizer(text.slice(0, 2000));

  // Render Prompt Optimizer
  renderPromptOptimizer(text);

  // Populate compare selects if not done yet
  populateCompareSelects();
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

/* ══════════════════════════════════════════════════════════════════════
   v8 — DARK MODE · KEYBOARD SHORTCUTS · TOASTS · ONBOARDING · TRACKING
   ══════════════════════════════════════════════════════════════════════ */

/* ── Toast notification system ───────────────────────────────────────── */
(function setupToasts() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.body.appendChild(container);
})();

window.toast = function(msg, type = 'success', duration = 3000) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast-msg toast-' + type;
  el.style.cssText = `background:${type==='success'?'#1C2F1C':'#2F1C1C'};color:${type==='success'?'#86efac':'#fca5a5'};border:1px solid ${type==='success'?'#166534':'#991b1b'};border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3);pointer-events:auto;opacity:0;transform:translateY(8px);transition:all .2s;`;
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 250);
  }, duration);
};

/* ── Dark mode ────────────────────────────────────────────────────────── */
(function initDarkMode() {
  const saved = localStorage.getItem('tokenia_theme');
  const pref  = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = saved || pref;
  document.documentElement.setAttribute('data-theme', theme);
  updateDarkToggle(theme);
})();

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tokenia_theme', next);
  updateDarkToggle(next);
  window.toast(next === 'dark' ? '🌙 Dark mode on' : '☀️ Light mode on', 'success', 1500);
  tokeniaTrack('dark_mode_toggle', { to: next });
}

function updateDarkToggle(theme) {
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ── Keyboard shortcuts ───────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  switch (e.key) {
    case 'Enter':
      e.preventDefault();
      const btn = document.getElementById('btn-analyze');
      if (btn && !btn.disabled) btn.click();
      break;
    case 'k':
      e.preventDefault();
      const ta = document.getElementById('text-input');
      if (ta) { ta.focus(); ta.select(); }
      break;
    case 'd':
      e.preventDefault();
      toggleDarkMode();
      break;
    case 'l':
      e.preventDefault();
      cycleLanguage();
      break;
    case '/':
      e.preventDefault();
      toggleShortcutsModal();
      break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('shortcuts-modal');
    const tour  = document.getElementById('onboarding-overlay');
    if (modal && modal.style.display !== 'none') modal.style.display = 'none';
    if (tour)  tour.remove();
  }
});

function cycleLanguage() {
  // Stub — i18n-client.js handles this
  const langs = ['en','es','pt','zh','de'];
  const cur   = localStorage.getItem('tokenia_lang') || 'en';
  const next  = langs[(langs.indexOf(cur) + 1) % langs.length];
  if (typeof setLanguage === 'function') setLanguage(next);
}

/* ── Shortcuts modal ──────────────────────────────────────────────────── */
function toggleShortcutsModal() {
  let modal = document.getElementById('shortcuts-modal');
  if (modal) { modal.style.display = modal.style.display === 'none' ? '' : 'none'; return; }
  modal = document.createElement('div');
  modal.id = 'shortcuts-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:440px;width:90%;box-shadow:var(--shadow-xl);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <strong style="font-size:18px;font-weight:800;color:var(--text)">⌨️ Keyboard Shortcuts</strong>
        <button onclick="document.getElementById('shortcuts-modal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">×</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${[
          ['⌘ + Enter', 'Analyze tokens'],
          ['⌘ + K', 'Focus text input'],
          ['⌘ + D', 'Toggle dark mode'],
          ['⌘ + L', 'Cycle language'],
          ['⌘ + /', 'Show this panel'],
          ['Esc', 'Close modals / tour'],
        ].map(([k,v]) => `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 0"><kbd style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:3px 8px;font-family:monospace;font-size:12px;font-weight:700;color:var(--text)">${k}</kbd></td>
          <td style="padding:10px 0 10px 16px;color:var(--text-dim)">${v}</td>
        </tr>`).join('')}
      </table>
      <p style="font-size:12px;color:var(--muted);margin-top:16px;text-align:center">Use Ctrl on Windows/Linux, ⌘ on Mac</p>
    </div>`;
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  document.body.appendChild(modal);
}

/* ── Onboarding tour (first visit only) ──────────────────────────────── */
const TOUR_STEPS = [
  { selector: '#text-input',      title: '1/4 — Paste your prompt',    body: 'Paste any text — prompts, documents, code. Sent over HTTPS, never stored.' },
  { selector: '#btn-analyze',     title: '2/4 — Analyze it',           body: 'Click Analyze (or press ⌘+Enter) to see token counts across 30+ models instantly.' },
  { selector: '#provider-filter', title: '3/4 — Filter by provider',   body: 'Focus on OpenAI, Anthropic, Google, or all providers at once.' },
  { selector: '#lang-selector',   title: '4/4 — Switch language',      body: 'Tokenia works in 5 languages: EN, ES, PT, ZH, DE. Try ⌘+L to cycle.' },
];

function startOnboarding() {
  if (localStorage.getItem('tokenia_tour_done')) return;
  let step = 0;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;pointer-events:none;';
  document.body.appendChild(overlay);

  function renderStep() {
    overlay.innerHTML = '';
    if (step >= TOUR_STEPS.length) { overlay.remove(); localStorage.setItem('tokenia_tour_done','1'); return; }
    const s   = TOUR_STEPS[step];
    const el  = document.querySelector(s.selector);
    if (!el)  { step++; renderStep(); return; }
    const r   = el.getBoundingClientRect();

    // Backdrop with hole
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `position:absolute;inset:0;background:rgba(0,0,0,.55);`;
    // Highlight ring
    const highlight = document.createElement('div');
    highlight.style.cssText = `position:absolute;left:${r.left-6}px;top:${r.top+window.scrollY-6}px;width:${r.width+12}px;height:${r.height+12}px;border:2px solid #FF6B2C;border-radius:8px;box-shadow:0 0 0 4px rgba(255,107,44,.2);pointer-events:none;`;

    // Tooltip
    const tip = document.createElement('div');
    const tipTop = r.bottom + window.scrollY + 14;
    tip.style.cssText = `position:absolute;left:${Math.min(r.left, window.innerWidth-300)}px;top:${tipTop}px;background:var(--surface,#fff);border:1px solid var(--border,#E5E5E5);border-radius:12px;padding:16px;width:280px;box-shadow:0 8px 24px rgba(0,0,0,.15);pointer-events:auto;z-index:7001;`;
    tip.innerHTML = `
      <strong style="display:block;font-size:14px;font-weight:700;color:var(--text,#0A0A0A);margin-bottom:6px;">${s.title}</strong>
      <p style="font-size:13px;color:var(--text-dim,#525252);line-height:1.5;margin:0 0 12px;">${s.body}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('onboarding-overlay')?.remove();localStorage.setItem('tokenia_tour_done','1')" style="background:none;border:1px solid var(--border,#E5E5E5);border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;color:var(--muted,#888)">Skip</button>
        <button onclick="window._tourNext()" style="background:#FF6B2C;border:none;color:#fff;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;">${step < TOUR_STEPS.length-1 ? 'Next →' : 'Done ✓'}</button>
      </div>`;
    overlay.appendChild(backdrop); overlay.appendChild(highlight); overlay.appendChild(tip);
  }

  window._tourNext = () => { step++; renderStep(); };
  setTimeout(renderStep, 800);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(startOnboarding, 1500);

  // Inject dark mode toggle into nav
  const navRight = document.querySelector('.nav-right');
  if (navRight && !document.getElementById('dark-toggle')) {
    const btn = document.createElement('button');
    btn.id = 'dark-toggle';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.cssText = 'min-width:36px;font-size:16px;padding:6px 8px;';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.onclick = toggleDarkMode;
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    btn.textContent = current === 'dark' ? '☀️' : '🌙';
    navRight.prepend(btn);
  }

  // Add ⌘+Enter hint below analyze button
  const btnAnalyze = document.getElementById('btn-analyze');
  if (btnAnalyze && !document.getElementById('shortcut-hint')) {
    const hint = document.createElement('p');
    hint.id = 'shortcut-hint';
    hint.style.cssText = 'font-size:11px;color:var(--muted);text-align:center;margin-top:6px;';
    hint.innerHTML = '⌘+Enter to analyze · <a href="#" onclick="toggleShortcutsModal();return false" style="color:var(--orange)">⌘+/ for shortcuts</a>';
    btnAnalyze.parentNode.insertAdjacentElement('afterend', hint);
  }

  // Client-side error tracking
  window.onerror = (msg, src, line, col, err) => {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: String(msg).slice(0,200), stack: err?.stack?.slice(0,500), page: location.pathname }),
    }).catch(() => {});
  };
  window.addEventListener('unhandledrejection', (e) => {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: String(e.reason).slice(0,200), page: location.pathname }),
    }).catch(() => {});
  });
});

/* ── tokeniaTrack utility (used throughout app) ───────────────────────── */
window.tokeniaTrack = function(event, props = {}) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, props, page: location.pathname, lang: document.documentElement.lang }),
  }).catch(() => {});
};

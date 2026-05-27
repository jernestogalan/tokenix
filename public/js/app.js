/**
 * Tokenia — app.js (v2)
 * Full frontend: tabs, file upload, model selector, token results,
 * cleaning, retrieval, upgrade gate, lead capture.
 */

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const qsa = sel => document.querySelectorAll(sel);

function fmt(n) { return Number(n).toLocaleString(); }

function fmtMoney(n) {
  if (n == null) return '—';
  n = Number(n);
  if (n === 0) return '$0.0000';
  if (n < 0.0001) return '<$0.0001';
  if (n < 0.01)   return `$${n.toFixed(6)}`;
  if (n < 1)      return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n) {
  if (n == null) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function pctOfContext(tokens, contextWindow) {
  if (!contextWindow || contextWindow === 0) return '—';
  const p = (tokens / contextWindow) * 100;
  if (p < 0.01) return '<0.01%';
  if (p > 100)  return '>100%';
  return `${p.toFixed(2)}%`;
}

function precisionBadge(precision) {
  if (precision === 'exact') return '<span class="badge-exact">Exact</span>';
  if (precision === 'official_api') return '<span class="badge-local">Official API</span>';
  return '<span class="badge-estimated">~Estimated</span>';
}

function showEl(el, show = true) {
  if (!el) return;
  if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
}

function setHtml(el, html) { if (el) el.innerHTML = html; }

/* ── State ────────────────────────────────────────────────────────────────── */
let _features      = {};
let _models        = {};
let _selectedFile  = null;
let _cleanFile     = null;
let _retrieveFile  = null;
let _lastCleanText = '';
let _lastChunks    = [];
let _planOverride  = null; // from ?plan= query param
let _activeProvider = 'all';
let _allResults    = [];
let _modelChecked  = new Set(['gpt-4o', 'claude-sonnet-4']); // defaults

/* ── Plan from URL ────────────────────────────────────────────────────────── */
(function() {
  const p = new URLSearchParams(window.location.search).get('plan');
  if (p && ['free', 'pro', 'team'].includes(p)) _planOverride = p;
})();

function planHeaders() {
  return _planOverride ? { 'X-Plan': _planOverride } : {};
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
(async function init() {
  try {
    [_features, _models] = await Promise.all([
      fetch('/api/features').then(r => r.json()),
      fetch('/api/models').then(r => r.json()),
    ]);
  } catch (_) {
    _features = {};
    _models   = {};
  }
  buildModelSelector();
  setupUpgradeModal();
  setupNavPro();
})();

/* ── Model selector ───────────────────────────────────────────────────────── */
function buildModelSelector() {
  const wrap = $('model-checkboxes');
  if (!wrap) return;
  wrap.innerHTML = '';

  for (const [provId, prov] of Object.entries(_models)) {
    for (const [mId, m] of Object.entries(prov.models || {})) {
      if (m.active === false) continue;
      const checked = _modelChecked.has(mId) ? 'checked' : '';
      const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${prov.color || '#666'};margin-right:4px;"></span>`;
      const label = document.createElement('label');
      label.className = 'flex items-center gap-1 bg-[#21262d] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs cursor-pointer hover:border-[#6366f1] transition-colors';
      label.innerHTML = `<input type="checkbox" class="model-check" data-model="${mId}" data-provider="${provId}" ${checked} style="accent-color:#6366f1;"> ${dot}${m.name}`;
      wrap.appendChild(label);
    }
  }

  wrap.addEventListener('change', () => {
    _modelChecked = new Set(
      [...qsa('.model-check')].filter(c => c.checked).map(c => c.dataset.model)
    );
  });
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
qsa('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    qsa('.tab-btn').forEach(b => {
      b.classList.remove('active-tab', 'bg-[#161b22]', 'text-white');
      b.classList.add('text-[#8b949e]');
    });
    qsa('.tab-panel').forEach(p => p.classList.add('hidden'));

    btn.classList.add('active-tab', 'bg-[#161b22]', 'text-white');
    btn.classList.remove('text-[#8b949e]');

    const panel = $(`tab-${btn.dataset.tab}`);
    if (panel) panel.classList.remove('hidden');
  });
});

// Mark first tab active on load
const firstTab = document.querySelector('.tab-btn');
if (firstTab) {
  firstTab.classList.add('active-tab', 'bg-[#161b22]', 'text-white');
  firstTab.classList.remove('text-[#8b949e]');
}

/* ── Text input ───────────────────────────────────────────────────────────── */
const textInput      = $('text-input');
const charCountEl    = $('char-count');
const wordCountEl    = $('word-count');
const lineCountEl    = $('line-count');
const btnAnalyzeText = $('btn-analyze-text');
const btnClearText   = $('btn-clear-text');

if (textInput) {
  textInput.addEventListener('input', () => {
    const t     = textInput.value;
    const chars = t.length;
    const words = t.trim() ? t.trim().split(/\s+/).length : 0;
    const lines = t ? t.split('\n').length : 0;
    if (charCountEl) charCountEl.textContent = `${fmt(chars)} chars`;
    if (wordCountEl) wordCountEl.textContent = `${fmt(words)} words`;
    if (lineCountEl) lineCountEl.textContent = `${fmt(lines)} lines`;
    if (btnAnalyzeText) btnAnalyzeText.disabled = chars === 0;
    if (btnClearText)   btnClearText.disabled   = chars === 0;
  });
}

if (btnClearText) {
  btnClearText.addEventListener('click', () => {
    textInput.value = '';
    textInput.dispatchEvent(new Event('input'));
    hideResults();
    hideError();
  });
}

if (btnAnalyzeText) {
  btnAnalyzeText.addEventListener('click', () => analyzeText());
}

/* ── File drag-drop ───────────────────────────────────────────────────────── */
const dropzone      = $('dropzone');
const fileInput     = $('file-input');
const fileInfo      = $('file-info');
const fileNameEl    = $('file-name');
const fileSizeEl    = $('file-size');
const btnRemoveFile = $('btn-remove-file');
const btnBrowse     = $('btn-browse');
const btnAnalyzeFile = $('btn-analyze-file');

const ALLOWED_EXTS = new Set([
  '.txt','.md','.pdf','.docx','.doc',
  '.js','.ts','.jsx','.tsx','.py','.rb','.go','.rs','.java','.kt','.swift',
  '.c','.cpp','.cs','.php','.sh','.bash','.sql','.html','.htm','.css','.scss',
  '.json','.yaml','.yml','.xml','.toml','.r','.ipynb',
]);

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function validateFile(file) {
  const ext = getExt(file.name);
  if (!ALLOWED_EXTS.has(ext)) return `File type "${ext}" not supported.`;
  if (file.size > 10 * 1024 * 1024) return 'File too large — max 10 MB.';
  return null;
}

function selectFile(file) {
  const err = validateFile(file);
  if (err) { showError(err); return; }
  _selectedFile = file;
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
  showEl(fileInfo);
  if (btnAnalyzeFile) btnAnalyzeFile.disabled = false;
}

if (dropzone) {
  dropzone.addEventListener('click', e => {
    if (e.target.id === 'btn-browse' || e.target === dropzone || dropzone.contains(e.target)) {
      fileInput && fileInput.click();
    }
  });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  });
}
if (btnBrowse) btnBrowse.addEventListener('click', e => { e.stopPropagation(); fileInput && fileInput.click(); });
if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files[0]) selectFile(fileInput.files[0]); });
if (btnRemoveFile) btnRemoveFile.addEventListener('click', () => {
  _selectedFile = null;
  showEl(fileInfo, false);
  if (btnAnalyzeFile) btnAnalyzeFile.disabled = true;
  if (fileInput) fileInput.value = '';
});
if (btnAnalyzeFile) btnAnalyzeFile.addEventListener('click', () => analyzeFile());

/* ── Analyze text ─────────────────────────────────────────────────────────── */
async function analyzeText() {
  if (!textInput || !textInput.value.trim()) return;
  showLoading(true);
  hideError();
  hideResults();
  try {
    const body = { text: textInput.value };
    const res  = await fetch('/api/count', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...planHeaders() },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 402) { showUpgradeModal(data.error); return; }
      throw new Error(data.error || 'Server error');
    }
    renderResults(data, null);
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

/* ── Analyze file ─────────────────────────────────────────────────────────── */
async function analyzeFile() {
  if (!_selectedFile) return;
  showLoading(true);
  hideError();
  hideResults();
  try {
    const fd = new FormData();
    fd.append('file', _selectedFile);
    const res  = await fetch('/api/count', { method: 'POST', headers: planHeaders(), body: fd });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 402) { showUpgradeModal(data.error); return; }
      if (res.status === 413) { showError('File too large for your plan.'); return; }
      throw new Error(data.error || 'Server error');
    }
    renderResults(data, _selectedFile.name);
  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

/* ── Render token results ─────────────────────────────────────────────────── */
function renderResults(data, filename) {
  _allResults = data.results || [];

  // Stats bar
  setHtml($('s-chars'), fmt(data.charCount));
  setHtml($('s-words'), fmt(data.wordCount));
  setHtml($('s-lines'), fmt(data.lineCount));
  const sfb = $('s-file-block');
  if (filename && sfb) {
    sfb.classList.remove('hidden');
    setHtml($('s-file'), filename);
  } else if (sfb) {
    sfb.classList.add('hidden');
  }

  // Provider pills
  renderProviderPills();

  // Table
  renderResultsTable();

  // Show sections
  showEl($('results'));
  showEl($('token-results'));

  // Scroll to results
  $('results') && $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderProviderPills() {
  const pf = $('provider-pills');
  if (!pf) return;
  const providers = ['all', ...new Set(_allResults.map(r => r.provider))];
  pf.innerHTML = providers.map(p => `
    <button class="provider-pill text-xs px-3 py-1 rounded-full border transition-colors ${p === _activeProvider ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'border-[#30363d] text-[#8b949e] hover:text-white'}"
      data-p="${p}">${p === 'all' ? 'All' : (_models[p] ? _models[p].name : p)}</button>
  `).join('');
  pf.querySelectorAll('.provider-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeProvider = btn.dataset.p;
      renderProviderPills();
      renderResultsTable();
    });
  });
}

function renderResultsTable() {
  const tbody = $('results-body');
  if (!tbody) return;

  const filtered = _allResults.filter(r => {
    if (_activeProvider !== 'all' && r.provider !== _activeProvider) return false;
    if (_modelChecked.size > 0 && !_modelChecked.has(r.model)) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-[#8b949e] text-sm">No results. Try selecting more models above.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const prov = _models[r.provider] || {};
    const color = prov.color || '#8b949e';
    const ctxPct = pctOfContext(r.tokens, r.contextWindow);
    const ctxWarn = r.contextWindow && r.tokens > r.contextWindow
      ? '<span class="text-[#f85149] ml-1" title="Exceeds context window!">⚠</span>' : '';
    return `<tr class="border-b border-[#30363d]/50 hover:bg-[#21262d]/30 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
          <div>
            <p class="text-sm font-medium text-white">${r.modelName || r.model}</p>
            <p class="text-xs text-[#8b949e]">${prov.name || r.provider}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-right font-mono text-sm">${fmt(r.tokens)}</td>
      <td class="px-4 py-3 text-right text-sm font-mono">${ctxPct}${ctxWarn}</td>
      <td class="px-4 py-3 text-right text-sm font-mono">${fmtMoney(r.inputCost)}</td>
      <td class="px-4 py-3 text-right text-sm font-mono">${fmtMoney(r.outputCost)}</td>
      <td class="px-4 py-3 text-center">${precisionBadge(r.precision)}</td>
    </tr>`;
  }).join('');
}

/* ── Loading / error / results visibility ─────────────────────────────────── */
function showLoading(show) {
  const el = $('loading');
  if (el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
}
function showError(msg) {
  const banner = $('error-banner');
  const txt    = $('error-text');
  if (txt)    txt.textContent = msg;
  if (banner) banner.classList.remove('hidden');
}
function hideError() {
  const banner = $('error-banner');
  if (banner) banner.classList.add('hidden');
}
function hideResults() {
  showEl($('results'), false);
  showEl($('savings-card'), false);
  showEl($('clean-result'), false);
  showEl($('retrieve-result'), false);
}

const btnDismissError = $('btn-dismiss-error');
if (btnDismissError) btnDismissError.addEventListener('click', hideError);

/* ── Savings card ─────────────────────────────────────────────────────────── */
function renderSavingsCard(origResults, optimizedResults, msg) {
  const card = $('savings-card');
  if (!card || !origResults || !origResults.length) return;

  const first    = origResults[0];
  const opt      = optimizedResults ? optimizedResults[0] : null;
  const origCost = (first.tokens / 1e6) * (first.inputPer1M || 0);
  const optCost  = opt ? (opt.tokens / 1e6) * (first.inputPer1M || 0) : origCost;
  const pct      = origCost > 0 ? Math.round(((origCost - optCost) / origCost) * 1000) / 10 : 0;

  const msgEl  = $('savings-msg');
  const origEl = $('savings-orig');
  const optEl  = $('savings-opt');
  const pctEl  = $('savings-pct');
  const discEl = $('savings-disclaimer');

  if (msgEl)  msgEl.textContent  = msg || '';
  if (origEl) origEl.textContent = fmtMoney(origCost);
  if (optEl)  optEl.textContent  = fmtMoney(optCost);
  if (pctEl)  pctEl.textContent  = `${pct}% saved`;
  if (discEl) discEl.textContent = first.precision === 'estimated'
    ? '~Estimated (non-OpenAI tokenizer)' : '';

  showEl(card);
}

/* ── Upgrade modal ────────────────────────────────────────────────────────── */
function setupUpgradeModal() {
  const modal       = $('upgrade-modal');
  const modalClose  = $('modal-close');
  const modalSubmit = $('modal-submit');
  const modalEmail  = $('modal-email');
  const modalMsg    = $('modal-msg');

  if (!modal) return;

  function openModal() {
    modal.classList.add('open');
    if (modalEmail) modalEmail.focus();
  }
  function closeModal() { modal.classList.remove('open'); }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('upgrade-trigger')) {
      const feature = e.target.dataset.feature || 'pro';
      const plan    = e.target.dataset.plan    || 'pro';
      if (_features.billingEnabled) {
        fetch('/api/billing/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        }).then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
      } else {
        modal._feature = feature;
        modal._plan    = plan;
        openModal();
      }
    }
  });

  if (modalSubmit) {
    modalSubmit.addEventListener('click', async () => {
      const email = modalEmail ? modalEmail.value.trim() : '';
      if (!email || !email.includes('@')) {
        if (modalMsg) { modalMsg.textContent = 'Please enter a valid email.'; modalMsg.classList.remove('hidden'); }
        return;
      }
      modalSubmit.disabled = true;
      modalSubmit.textContent = 'Joining…';
      try {
        await fetch('/api/lead', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            email,
            desiredPlan:   modal._plan    || 'pro',
            featureClicked: modal._feature || 'upgrade_modal',
          }),
        });
        if (modalMsg) {
          modalMsg.textContent = "You're on the list! We'll reach out when Pro launches.";
          modalMsg.style.color = '#3fb950';
          modalMsg.classList.remove('hidden');
        }
        modalSubmit.textContent = 'Done!';
      } catch (_) {
        if (modalMsg) { modalMsg.textContent = 'Something went wrong.'; modalMsg.classList.remove('hidden'); }
        modalSubmit.disabled = false;
        modalSubmit.textContent = 'Join waitlist';
      }
    });
  }
}

function showUpgradeModal(msg) {
  const modal = $('upgrade-modal');
  if (modal) modal.classList.add('open');
}

function setupNavPro() {
  const btn = $('nav-get-pro');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (_features.billingEnabled) {
      window.location.href = '/pricing.html';
    } else {
      showUpgradeModal();
    }
  });
}

/* ── Clean section ────────────────────────────────────────────────────────── */
const btnCleanUpload  = $('btn-clean-upload');
const cleanFileInput  = $('clean-file-input');
const cleanResult     = $('clean-result');
const cleanLoading    = $('clean-loading');
const cleanError      = $('clean-error');

if (btnCleanUpload && cleanFileInput) {
  btnCleanUpload.addEventListener('click', () => cleanFileInput.click());
}
if (cleanFileInput) {
  cleanFileInput.addEventListener('change', () => {
    const f = cleanFileInput.files[0];
    if (!f) return;
    _cleanFile = f;
    btnCleanUpload.textContent = f.name.length > 25 ? f.name.slice(0, 25) + '…' : f.name;
    runClean();
  });
}

async function runClean() {
  if (!_cleanFile) return;
  showEl(cleanResult, false);
  showEl(cleanLoading);
  if (cleanError) cleanError.classList.add('hidden');

  try {
    const fd = new FormData();
    fd.append('file', _cleanFile);
    const res  = await fetch('/api/clean', { method: 'POST', headers: planHeaders(), body: fd });
    const data = await res.json();

    showEl(cleanLoading, false);

    if (!res.ok) {
      if (res.status === 402) { showUpgradeModal(data.error); return; }
      throw new Error(data.error || 'Clean failed');
    }

    _lastCleanText = data.cleanedText || '';
    renderCleanResult(data);
  } catch (e) {
    showEl(cleanLoading, false);
    if (cleanError) { cleanError.textContent = e.message; cleanError.classList.remove('hidden'); }
  }
}

function renderCleanResult(data) {
  // Demo banner
  const demoBanner = $('clean-demo-banner');
  const demoMsg    = $('clean-demo-msg');
  const cleanBadge = $('clean-badge');
  if (data.demo) {
    if (demoMsg)    demoMsg.textContent  = data.demoMessage || 'Demo mode — showing preview.';
    if (demoBanner) showEl(demoBanner);
    if (cleanBadge) cleanBadge.className = 'badge-demo';
    if (cleanBadge) cleanBadge.textContent = 'Demo';
  } else {
    if (demoBanner) showEl(demoBanner, false);
    if (cleanBadge) cleanBadge.className = 'badge-exact';
    if (cleanBadge) cleanBadge.textContent = 'Full';
  }

  // Stats
  const orig = data.originalStats || {};
  const cln  = data.cleanStats    || {};
  const savedChars = (orig.charCount || 0) - (cln.charCount || 0);
  const pct        = orig.charCount > 0 ? ((savedChars / orig.charCount) * 100).toFixed(1) : 0;

  setHtml($('clean-orig-chars'),  fmt(orig.charCount  || 0));
  setHtml($('clean-new-chars'),   fmt(cln.charCount   || 0));
  setHtml($('clean-saved-chars'), fmt(savedChars));
  setHtml($('clean-pct'),         `${pct}%`);

  // Token comparison table
  const cmpBody = $('clean-cmp-body');
  if (cmpBody && data.tokenComparison) {
    cmpBody.innerHTML = data.tokenComparison.map(r => `
      <tr>
        <td>${r.modelName || r.model}</td>
        <td class="text-right font-mono">${fmt(r.originalTokens)}</td>
        <td class="text-right font-mono">${fmt(r.cleanTokens)}</td>
        <td class="text-right font-mono text-[#3fb950]">${fmt(r.tokensSaved)}</td>
        <td class="text-right font-mono pct-saved">${r.pctSaved}%</td>
      </tr>
    `).join('');
  }

  // Cleaned text preview
  const textOut = $('clean-text-out');
  if (textOut) textOut.textContent = (data.cleanedText || '').slice(0, 2000) + ((data.cleanedText || '').length > 2000 ? '\n\n[truncated…]' : '');

  // Download button
  const dlBtn = $('btn-download-clean');
  if (dlBtn) showEl(dlBtn, !data.demo);

  // Savings card
  if (data.savingsMessage) {
    renderSavingsCard(
      _allResults.length ? _allResults : [],
      null,
      data.savingsMessage
    );
  }

  showEl(cleanResult);
  cleanResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Copy clean text
const btnCopyClean = $('btn-copy-clean');
if (btnCopyClean) {
  btnCopyClean.addEventListener('click', () => {
    navigator.clipboard.writeText(_lastCleanText).then(() => {
      btnCopyClean.textContent = 'Copied!';
      setTimeout(() => { btnCopyClean.textContent = 'Copy'; }, 1500);
    });
  });
}

// Download clean text
const btnDownloadClean = $('btn-download-clean');
if (btnDownloadClean) {
  btnDownloadClean.addEventListener('click', () => {
    if (!_lastCleanText) return;
    const blob = new Blob([_lastCleanText], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (_cleanFile ? _cleanFile.name.replace(/\.[^.]+$/, '') : 'cleaned') + '_tokenia.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
}

/* ── Retrieve section ─────────────────────────────────────────────────────── */
const btnRetrieveUpload = $('btn-retrieve-upload');
const retrieveFileInput = $('retrieve-file-input');
const retrieveFileNameEl = $('retrieve-file-name');
const retrieveQuery     = $('retrieve-query');
const retrieveTopK      = $('retrieve-topk');
const btnRetrieve       = $('btn-retrieve');
const retrieveResult    = $('retrieve-result');
const retrieveLoading   = $('retrieve-loading');
const retrieveError     = $('retrieve-error');

if (btnRetrieveUpload && retrieveFileInput) {
  btnRetrieveUpload.addEventListener('click', () => retrieveFileInput.click());
}
if (retrieveFileInput) {
  retrieveFileInput.addEventListener('change', () => {
    const f = retrieveFileInput.files[0];
    if (!f) return;
    _retrieveFile = f;
    if (retrieveFileNameEl) retrieveFileNameEl.textContent = f.name;
    if (btnRetrieve) btnRetrieve.disabled = !retrieveQuery?.value?.trim();
  });
}
if (retrieveQuery) {
  retrieveQuery.addEventListener('input', () => {
    if (btnRetrieve) btnRetrieve.disabled = !(_retrieveFile && retrieveQuery.value.trim());
  });
}
if (btnRetrieve) {
  btnRetrieve.addEventListener('click', runRetrieve);
}

async function runRetrieve() {
  if (!_retrieveFile || !retrieveQuery?.value?.trim()) return;
  showEl(retrieveResult, false);
  showEl(retrieveLoading);
  if (retrieveError) retrieveError.classList.add('hidden');

  try {
    const fd = new FormData();
    fd.append('file', _retrieveFile);
    fd.append('query', retrieveQuery.value.trim());
    fd.append('topK', retrieveTopK ? retrieveTopK.value : '5');

    const res  = await fetch('/api/retrieve', { method: 'POST', headers: planHeaders(), body: fd });
    const data = await res.json();

    showEl(retrieveLoading, false);

    if (!res.ok) {
      if (res.status === 402) { showUpgradeModal(data.error); return; }
      throw new Error(data.error || 'Retrieve failed');
    }

    _lastChunks = data.chunks || [];
    renderRetrieveResult(data);
  } catch (e) {
    showEl(retrieveLoading, false);
    if (retrieveError) { retrieveError.textContent = e.message; retrieveError.classList.remove('hidden'); }
  }
}

function renderRetrieveResult(data) {
  // Demo banner
  const demoBanner = $('retrieve-demo-banner');
  const demoMsg    = $('retrieve-demo-msg');
  const badge      = $('retrieve-badge');
  if (data.demo) {
    if (demoMsg)    demoMsg.textContent  = data.demoMessage || 'Demo — showing top 3 chunks.';
    if (demoBanner) showEl(demoBanner);
    if (badge)      badge.className = 'badge-demo'; badge && (badge.textContent = 'Demo');
  } else {
    if (demoBanner) showEl(demoBanner, false);
    if (badge)      badge.className = 'badge-exact'; badge && (badge.textContent = 'Full');
  }

  // Meta
  const metaEl = $('retrieve-meta');
  if (metaEl) metaEl.textContent = `Found ${data.returnedChunks} of ${data.totalChunks} chunks · Query: "${data.query}" · ${data.disclaimer || ''}`;

  // Token comparison
  const cmpBody = $('retrieve-cmp-body');
  if (cmpBody && data.tokenComparison) {
    cmpBody.innerHTML = data.tokenComparison.map(r => `
      <tr>
        <td>${r.modelName || r.model}</td>
        <td class="text-right font-mono">${fmt(r.fullTokens || r.originalTokens)}</td>
        <td class="text-right font-mono">${fmt(r.retrievedTokens)}</td>
        <td class="text-right font-mono text-[#3fb950]">${fmt(r.tokensSaved)}</td>
        <td class="text-right font-mono pct-saved">${r.pctSaved}%</td>
      </tr>
    `).join('');
  }

  // Chunks
  const chunksList = $('chunks-list');
  if (chunksList) {
    chunksList.innerHTML = (data.chunks || []).map((c, i) => `
      <div class="chunk-card">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold text-[#8b949e]">Chunk ${i + 1}</span>
          <span class="chunk-score">score: ${(c.score || 0).toFixed(4)}</span>
        </div>
        <div class="chunk-text">${escapeHtml(c.text)}</div>
      </div>
    `).join('');
  }

  // Savings card
  if (data.savingsMessage) {
    renderSavingsCard([], null, data.savingsMessage);
  }

  showEl(retrieveResult);
  retrieveResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Copy chunks
const btnCopyChunks = $('btn-copy-chunks');
if (btnCopyChunks) {
  btnCopyChunks.addEventListener('click', () => {
    const text = _lastChunks.map(c => c.text).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      btnCopyChunks.textContent = 'Copied!';
      setTimeout(() => { btnCopyChunks.textContent = 'Copy context'; }, 1500);
    });
  });
}

/* ── Utility ──────────────────────────────────────────────────────────────── */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Handle checkout success/cancel ────────────────────────────────────────── */
(function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === 'success') {
    showError('🎉 Subscription active! Refresh to use Pro features.');
  } else if (params.get('checkout') === 'cancel') {
    // silent
  }
})();

/* ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 — Auth module
 * Loads Supabase JS from CDN, handles login/signup/logout,
 * updates nav user state, attaches Bearer token to API requests.
 * ══════════════════════════════════════════════════════════════════════════════ */

let _supabaseClient = null;
let _currentUser    = null;
let _currentToken   = null;
let _authEnabled    = false;

/**
 * Load the Supabase client library from CDN if auth is enabled.
 */
function loadSupabaseScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-supabase]');
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url;
    s.setAttribute('data-supabase', '1');
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load Supabase SDK'));
    document.head.appendChild(s);
  });
}

/**
 * Initialize auth: fetch /api/config, load Supabase SDK if needed,
 * set up session listener, update UI.
 */
async function initAuth() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    _authEnabled = cfg.authEnabled && !!cfg.supabaseUrl && !!cfg.supabaseAnonKey;

    // Show "Sign in" button whenever auth is available
    if (_authEnabled || cfg.supabaseUrl) {
      const signinBtn = $('nav-signin-btn');
      if (signinBtn) signinBtn.classList.remove('hidden');
    }

    if (!_authEnabled) {
      updateNavAnon();
      return;
    }

    // Load Supabase SDK from CDN
    await loadSupabaseScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
    const { createClient } = window.supabase;
    _supabaseClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    // Listen for auth state changes
    _supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        _currentUser  = session.user;
        _currentToken = session.access_token;
        await fetchAndUpdateUserProfile();
      } else {
        _currentUser  = null;
        _currentToken = null;
        updateNavAnon();
      }
    });

    // Check existing session
    const { data: { session } } = await _supabaseClient.auth.getSession();
    if (session) {
      _currentUser  = session.user;
      _currentToken = session.access_token;
      await fetchAndUpdateUserProfile();
    } else {
      updateNavAnon();
    }
  } catch (err) {
    console.warn('[auth] initAuth failed:', err.message);
    updateNavAnon();
  }
}

/**
 * Fetch /api/auth/user (with Bearer token) and update the nav.
 */
async function fetchAndUpdateUserProfile() {
  try {
    const resp = await apiFetch('/api/auth/user');
    if (resp.authenticated && resp.user) {
      updateNavLoggedIn(resp.user.email, resp.plan, resp.profile);
    }
  } catch (err) {
    console.warn('[auth] fetchAndUpdateUserProfile:', err.message);
    updateNavLoggedIn(_currentUser?.email || '', { id: 'free', name: 'Free', badge: 'Free' }, null);
  }
}

/**
 * Wrapper around fetch that adds the Bearer token when available.
 */
async function apiFetch(url, opts = {}) {
  if (_currentToken) {
    opts.headers = opts.headers || {};
    opts.headers['Authorization'] = `Bearer ${_currentToken}`;
  }
  const resp = await fetch(url, opts);
  if (!resp.ok && resp.status !== 402 && resp.status !== 429) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

/* ── Nav updates ──────────────────────────────────────────────────────────── */

function updateNavAnon() {
  const navAnon = $('nav-anon');
  const navUser = $('nav-user');
  if (navAnon) navAnon.style.display = 'flex';
  if (navUser) navUser.classList.add('hidden');
}

function updateNavLoggedIn(email, plan, profile) {
  const navAnon = $('nav-anon');
  const navUser = $('nav-user');
  if (navAnon) navAnon.style.display = 'none';
  if (navUser) navUser.classList.remove('hidden');

  const emailEl = $('nav-user-email');
  const badgeEl = $('nav-plan-badge');
  if (emailEl) emailEl.textContent = email || '';
  if (badgeEl) {
    badgeEl.textContent = plan?.badge || plan?.name || 'Free';
    const colors = { pro: '#8b5cf6', team: '#0ea5e9', free: '#6b7280' };
    badgeEl.style.color = colors[plan?.id] || colors.free;
  }

  // Credits display
  const creditsEl = $('nav-credits');
  if (creditsEl && profile) {
    const credits = profile.creditsRemaining ?? 0;
    creditsEl.textContent = credits > 0 ? `${credits} créditos` : '';
    creditsEl.style.display = credits > 0 ? '' : 'none';
  }

  // Usage bar (only for free/pro plans with quotas)
  if (profile && profile.monthlyTokenLimit) {
    const used  = profile.monthlyTokensUsed  || 0;
    const limit = profile.monthlyTokenLimit  || 50000;
    const pct   = Math.min(100, Math.round((used / limit) * 100));
    const navUsage = $('nav-usage');
    const navBar   = $('nav-usage-bar');
    const navLabel = $('nav-usage-label');
    if (navUsage) navUsage.classList.remove('hidden');
    if (navBar) {
      navBar.style.width = pct + '%';
      // Colour: red ≥90%, orange ≥75%, indigo otherwise
      navBar.style.background = pct >= 90 ? '#f85149' : pct >= 75 ? '#f97316' : '#6366f1';
    }
    if (navLabel) {
      const usedK  = used  >= 1000 ? (used  / 1000).toFixed(0)  + 'K' : used;
      const limitK = limit >= 1000 ? (limit / 1000).toFixed(0) + 'K' : limit;
      navLabel.textContent = `${usedK} / ${limitK}`;
    }
    // Warn in the nav when ≥90%
    if (pct >= 90) {
      const warn = $('nav-usage-warn');
      if (!warn) {
        const w = document.createElement('span');
        w.id = 'nav-usage-warn';
        w.title = pct >= 100
          ? 'Has alcanzado el límite mensual de tu plan.'
          : 'Estás cerca de tu límite mensual.';
        w.style.cssText = 'font-size:0.75rem;cursor:default';
        w.textContent = pct >= 100 ? '🔴' : '🟠';
        navUsage?.appendChild(w);
      }
    }
  }
}

/* ── Auth modal logic ─────────────────────────────────────────────────────── */

function openAuthModal(tab = 'signin') {
  const modal = $('auth-modal');
  if (modal) modal.style.display = 'flex';
  switchAuthTab(tab);
  const firstInput = $(`${tab}-email`);
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeAuthModal() {
  const modal = $('auth-modal');
  if (modal) modal.style.display = 'none';
  clearAuthMsg();
}

function switchAuthTab(tab) {
  ['signin', 'signup'].forEach(t => {
    const btn   = $(`auth-tab-${t}`);
    const panel = $(`auth-panel-${t}`);
    if (btn) {
      btn.classList.toggle('active-tab', t === tab);
      btn.classList.toggle('text-[#8b949e]', t !== tab);
    }
    if (panel) panel.classList.toggle('hidden', t !== tab);
  });
  clearAuthMsg();
}

function setAuthMsg(msg, isError = false) {
  const el = $('auth-msg');
  if (!el) return;
  el.textContent = msg;
  el.className   = `text-xs mt-3 ${isError ? 'text-[#f85149]' : 'text-[#3fb950]'}`;
  el.classList.remove('hidden');
}

function clearAuthMsg() {
  const el = $('auth-msg');
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

async function handleSignIn() {
  if (!_supabaseClient) return;
  const email = ($('signin-email')?.value || '').trim();
  const pass  = ($('signin-password')?.value || '').trim();
  if (!email || !pass) { setAuthMsg('Email and password are required.', true); return; }

  const btn = $('btn-signin');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    const { error } = await _supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (error) { setAuthMsg(error.message, true); return; }
    setAuthMsg('Signed in!');
    setTimeout(closeAuthModal, 800);
  } catch (err) {
    setAuthMsg(err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
  }
}

async function handleSignUp() {
  if (!_supabaseClient) return;
  const email = ($('signup-email')?.value || '').trim();
  const pass  = ($('signup-password')?.value || '').trim();
  if (!email || !pass) { setAuthMsg('Email and password are required.', true); return; }
  if (pass.length < 8)  { setAuthMsg('Password must be at least 8 characters.', true); return; }

  const btn = $('btn-signup');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

  try {
    const { error } = await _supabaseClient.auth.signUp({ email, password: pass });
    if (error) { setAuthMsg(error.message, true); return; }
    setAuthMsg('Account created! Check your email to confirm.');
  } catch (err) {
    setAuthMsg(err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create free account'; }
  }
}

async function handleSignOut() {
  if (!_supabaseClient) return;
  await _supabaseClient.auth.signOut().catch(() => {});
  _currentUser  = null;
  _currentToken = null;
  updateNavAnon();
}

/* ── Wire up auth event listeners ─────────────────────────────────────────── */
(function wireAuthListeners() {
  // Modal open triggers
  const navSignin = $('nav-signin-btn');
  if (navSignin) navSignin.addEventListener('click', () => openAuthModal('signin'));

  const navGetPro = $('nav-get-pro');
  if (navGetPro) {
    navGetPro.addEventListener('click', () => {
      if (_authEnabled && !_currentUser) {
        openAuthModal('signup');
      } else {
        const upgradeModal = $('upgrade-modal');
        if (upgradeModal) upgradeModal.style.display = 'flex';
      }
    });
  }

  // Auth modal close
  const authClose = $('auth-modal-close');
  if (authClose) authClose.addEventListener('click', closeAuthModal);

  const authModal = $('auth-modal');
  if (authModal) authModal.addEventListener('click', e => {
    if (e.target === authModal) closeAuthModal();
  });

  // Tab switching
  ['signin', 'signup'].forEach(tab => {
    const btn = $(`auth-tab-${tab}`);
    if (btn) btn.addEventListener('click', () => switchAuthTab(tab));
  });

  // Form submissions
  const btnSignin = $('btn-signin');
  if (btnSignin) btnSignin.addEventListener('click', handleSignIn);

  const btnSignup = $('btn-signup');
  if (btnSignup) btnSignup.addEventListener('click', handleSignUp);

  // Enter key in auth fields
  ['signin-email', 'signin-password'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignIn(); });
  });
  ['signup-email', 'signup-password'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignUp(); });
  });

  // Sign out
  const signoutBtn = $('nav-signout-btn');
  if (signoutBtn) signoutBtn.addEventListener('click', handleSignOut);
})();

/* ── Boot auth ────────────────────────────────────────────────────────────── */
initAuth();

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH MODULE — Supabase email/password auth
   Appended to app.js — does NOT modify existing code above.

   Flow:
     1. initAuth() fetches /api/config to get supabaseUrl + anonKey
     2. Loads Supabase JS SDK from CDN (cdn.jsdelivr.net) dynamically
     3. Creates supabase client with anon key (safe for browser)
     4. Sets up onAuthStateChange listener
     5. All API calls use apiFetch() which adds Bearer token when logged in
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Auth state ──────────────────────────────────────────────────────────── */
let _supabaseClient = null;   // Supabase JS client (browser)
let _currentUser    = null;   // Supabase user object
let _currentToken   = null;   // JWT access token
let _authEnabled    = false;  // mirrors server ENABLE_AUTH flag
let _currentProfile = null;   // { plan, creditsRemaining, monthlyTokensUsed, monthlyTokenLimit }

/* ── apiFetch — wraps fetch, adds Bearer token when available ─────────────
   Replaces all direct fetch('/api/...') calls for authenticated actions.
   The existing planHeaders() function is left intact for ?plan= dev overrides.
   ──────────────────────────────────────────────────────────────────────── */
async function apiFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };

  // Add Bearer token if logged in
  if (_currentToken) {
    headers['Authorization'] = `Bearer ${_currentToken}`;
  }

  // Keep ?plan= override header for dev (planHeaders() from existing code)
  const ph = planHeaders();
  if (ph['X-Plan']) headers['X-Plan'] = ph['X-Plan'];

  return fetch(url, { ...opts, headers });
}

/* ── Load Supabase JS SDK from CDN (only when auth is enabled) ───────────── */
function loadSupabaseScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve(); // already loaded
    const s  = document.createElement('script');
    s.src    = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Supabase SDK'));
    document.head.appendChild(s);
  });
}

/* ── Update nav — anonymous state ───────────────────────────────────────── */
function updateNavAnon() {
  const navAnon = $('nav-anon');
  const navUser = $('nav-user');
  const signinBtn = $('nav-signin-btn');

  if (navUser)    navUser.classList.add('hidden');
  if (navAnon)    navAnon.classLis
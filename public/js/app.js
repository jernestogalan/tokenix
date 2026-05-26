/**
 * Tokenix — app.js
 * All client-side logic: tabs, drag-and-drop, API calls, results rendering.
 * Includes Pro tools: Format Cleaner + Smart Retrieval.
 */

/* ── DOM helpers ─────────────────────────────────────────────────────────────── */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ── Free-tier DOM refs ──────────────────────────────────────────────────────── */
const textInput       = $('#text-input');
const charCount       = $('#char-count');
const wordCount       = $('#word-count');
const lineCount       = $('#line-count');
const btnAnalyzeText  = $('#btn-analyze-text');
const btnClearText    = $('#btn-clear-text');

const fileInput       = $('#file-input');
const dropzone        = $('#dropzone');
const btnBrowse       = $('#btn-browse');
const fileInfo        = $('#file-info');
const fileName        = $('#file-name');
const fileSizeLabel   = $('#file-size');
const btnRemoveFile   = $('#btn-remove-file');
const btnAnalyzeFile  = $('#btn-analyze-file');

const loading         = $('#loading');
const errorBanner     = $('#error-banner');
const errorText       = $('#error-text');
const btnDismissError = $('#btn-dismiss-error');

const resultsSection  = $('#results-section');
const sChars          = $('#s-chars');
const sWords          = $('#s-words');
const sLines          = $('#s-lines');
const sFileBlock      = $('#s-file-block');
const sFile           = $('#s-file');
const providerFilter  = $('#provider-filter');
const resultsBody     = $('#results-body');

const btnNotify       = $('#btn-notify');
const notifyModal     = $('#notify-modal');
const btnModalClose   = $('#btn-modal-close');
const btnNotifySubmit = $('#btn-notify-submit');
const notifyEmail     = $('#notify-email');

/* ── Pro-tools DOM refs ──────────────────────────────────────────────────────── */
// Cleaner
const cleanDropzone    = $('#clean-dropzone');
const cleanFileInput   = $('#clean-file-input');
const cleanBrowse      = $('#clean-browse');
const cleanFileInfo    = $('#clean-file-info');
const cleanFileName    = $('#clean-file-name');
const cleanFileSize    = $('#clean-file-size');
const cleanRemoveFile  = $('#clean-remove-file');
const btnClean         = $('#btn-clean');
const cleanResult      = $('#clean-result');
const cleanSavings     = $('#clean-savings');
const cleanCmpToggle   = $('#clean-cmp-toggle');
const cleanCmpWrap     = $('#clean-cmp-table-wrap');
const cleanTextOutput  = $('#clean-text-output');
const btnCopyClean     = $('#btn-copy-clean');
const btnDownloadClean = $('#btn-download-clean');
const cleanError       = $('#clean-error');
const cleanErrorText   = $('#clean-error-text');

// Retriever
const retrieveDropzone   = $('#retrieve-dropzone');
const retrieveFileInput  = $('#retrieve-file-input');
const retrieveBrowse     = $('#retrieve-browse');
const retrieveFileInfo   = $('#retrieve-file-info');
const retrieveFileName   = $('#retrieve-file-name');
const retrieveFileSize   = $('#retrieve-file-size');
const retrieveRemoveFile = $('#retrieve-remove-file');
const retrieveQuery      = $('#retrieve-query');
const retrieveTopK       = $('#retrieve-topk');
const btnRetrieve        = $('#btn-retrieve');
const retrieveResult     = $('#retrieve-result');
const retrieveMeta       = $('#retrieve-meta');
const retrieveSavings    = $('#retrieve-savings');
const retrieveCmpToggle  = $('#retrieve-cmp-toggle');
const retrieveCmpWrap    = $('#retrieve-cmp-table-wrap');
const chunksList         = $('#chunks-list');
const btnCopyChunks      = $('#btn-copy-chunks');
const retrieveError      = $('#retrieve-error');
const retrieveErrorText  = $('#retrieve-error-text');

/* ── State ───────────────────────────────────────────────────────────────────── */
let allResults        = [];
let activeProvider    = 'all';
let selectedFile      = null;
let cleanSelectedFile = null;
let retrieveSelectedFile = null;
let lastCleanText     = '';
let lastChunksText    = '';

/* ══════════════════════════════════════════════════════════════════════════════
   FEATURE FLAG CHECK — decide whether to show Pro tools
   ══════════════════════════════════════════════════════════════════════════════ */
(async function initProTools() {
  try {
    const data = await fetch('/api/features').then(r => r.json());
    const label = $('#pro-status-label');

    if (data.paidFeaturesEnabled) {
      // Pro is ON — show the tools
      $('#pro-tools-grid').classList.remove('hidden');
      if (label) label.textContent = '— enabled';

    } else if (data.billingEnabled) {
      // Pro is OFF but Stripe billing is live — show upgrade CTA
      $('#pro-upgrade').classList.remove('hidden');
      if (label) {
        label.textContent = '— upgrade available';
        label.style.color = 'var(--accent)';
      }
      const btn   = $('#btn-upgrade');
      const errEl = $('#upgrade-error');
      if (btn) {
        btn.addEventListener('click', async () => {
          btn.disabled    = true;
          btn.textContent = 'Redirecting…';
          try {
            const res  = await fetch('/api/billing/checkout', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({}),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Checkout failed.');
            window.location.href = body.url;   // redirect to Stripe Checkout
          } catch (e) {
            if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
            btn.disabled    = false;
            btn.textContent = 'Upgrade to Pro →';
          }
        });
      }

    } else {
      // Pro OFF, billing OFF — show dev/self-host message
      $('#pro-locked').classList.remove('hidden');
      if (label) {
        label.textContent = '— disabled';
        label.style.color = 'var(--red)';
      }
    }
  } catch (_) {
    // Server may not be running yet — show locked state gracefully
    const locked = $('#pro-locked');
    if (locked) locked.classList.remove('hidden');
  }
})();

/* ══════════════════════════════════════════════════════════════════════════════
   FREE TIER — Tab switching
   ══════════════════════════════════════════════════════════════════════════════ */
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    $(`#tab-${tab.dataset.tab}`).classList.add('active');
  });
});

/* ── Text input live stats ───────────────────────────────────────────────────── */
textInput.addEventListener('input', () => {
  const text = textInput.value;
  const chars = text.length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const lines = text === '' ? 0 : text.split('\n').length;

  charCount.textContent = `${fmt(chars)} chars`;
  wordCount.textContent = `${fmt(words)} words`;
  lineCount.textContent = `${fmt(lines)} lines`;

  const hasContent = chars > 0;
  btnAnalyzeText.disabled = !hasContent;
  btnClearText.disabled   = !hasContent;
});

btnClearText.addEventListener('click', () => {
  textInput.value = '';
  textInput.dispatchEvent(new Event('input'));
  hideResults();
  hideError();
});

/* ── File drag-and-drop ──────────────────────────────────────────────────────── */
dropzone.addEventListener('click', (e) => {
  if (e.target !== btnBrowse) fileInput.click();
});
btnBrowse.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});
btnRemoveFile.addEventListener('click', () => { clearFile(); hideResults(); hideError(); });

function setFile(file) {
  selectedFile = file;
  fileName.textContent      = file.name;
  fileSizeLabel.textContent = formatBytes(file.size);
  fileInfo.classList.remove('hidden');
  btnAnalyzeFile.disabled = false;
}

function clearFile() {
  selectedFile = null;
  fileInfo.classList.add('hidden');
  btnAnalyzeFile.disabled = true;
  fileInput.value = '';
}

/* ── Analyze buttons ─────────────────────────────────────────────────────────── */
btnAnalyzeText.addEventListener('click', async () => {
  const text = textInput.value;
  if (!text.trim()) return;
  await runAnalysis('text', text);
});

btnAnalyzeFile.addEventListener('click', async () => {
  if (!selectedFile) return;
  await runAnalysis('file', selectedFile);
});

async function runAnalysis(type, payload) {
  hideError();
  hideResults();
  showLoading(true);
  try {
    let data;
    if (type === 'text') {
      data = await postJSON('/api/tokenize', { text: payload });
    } else {
      const form = new FormData();
      form.append('file', payload);
      data = await postFormData('/api/tokenize/file', form);
    }
    allResults = data.results;
    renderResults(data);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    showLoading(false);
  }
}

/* ── API helpers ─────────────────────────────────────────────────────────────── */
async function postJSON(url, body) {
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

async function postFormData(url, formData) {
  const res  = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

/* ── Render results ──────────────────────────────────────────────────────────── */
function renderResults(data) {
  sChars.textContent = fmt(data.charCount);
  sWords.textContent = fmt(data.wordCount);
  sLines.textContent = fmt(data.lineCount);

  if (data.filename) {
    sFile.textContent = `${data.filename} (${formatBytes(data.filesize)})`;
    sFileBlock.style.display = '';
  } else {
    sFileBlock.style.display = 'none';
  }

  buildProviderFilter(data.results);
  renderTable(data.results);

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildProviderFilter(results) {
  const seen = new Set();
  const providers = [];
  results.forEach(r => {
    if (!seen.has(r.provider)) {
      seen.add(r.provider);
      providers.push({ key: r.provider, name: r.providerName, color: r.providerColor });
    }
  });

  $$('.filter-pill:not([data-provider="all"])').forEach(p => p.remove());

  providers.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'filter-pill';
    btn.dataset.provider = p.key;
    btn.style.setProperty('--pill-color', p.color);
    btn.textContent = p.name;
    btn.addEventListener('click', () => setActiveProvider(p.key));
    providerFilter.appendChild(btn);
  });

  setActiveProvider('all');
}

function setActiveProvider(provider) {
  activeProvider = provider;
  $$('.filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.provider === provider);
  });
  renderTable(allResults);
}

$('.filter-pill[data-provider="all"]').addEventListener('click', () => setActiveProvider('all'));

function renderTable(results) {
  const filtered = activeProvider === 'all'
    ? results
    : results.filter(r => r.provider === activeProvider);

  resultsBody.innerHTML = '';

  const grouped = {};
  filtered.forEach(r => {
    if (!grouped[r.provider]) grouped[r.provider] = [];
    grouped[r.provider].push(r);
  });

  Object.entries(grouped).forEach(([, rows]) => {
    const color = rows[0].providerColor;
    if (activeProvider === 'all') {
      const sep = document.createElement('tr');
      sep.className = 'provider-row';
      sep.innerHTML = `<td colspan="6"><span style="color:${color}">●</span> &nbsp;${rows[0].providerName}</td>`;
      resultsBody.appendChild(sep);
    }
    rows.forEach(r => resultsBody.appendChild(buildRow(r)));
  });
}

function buildRow(r) {
  const tr = document.createElement('tr');
  tr.dataset.provider = r.provider;

  const pct      = Math.min(r.contextPct, 100);
  const barClass = pct > 90 ? 'over' : pct > 70 ? 'warn' : '';
  const pctLabel = pct >= 100 ? '> 100%' : `${pct.toFixed(1)}%`;

  const inCost  = formatCost(r.inputCost);
  const outCost = formatCost(r.outputCost);

  const accuracyBadge = r.exact
    ? `<span class="accuracy-badge badge-exact" title="${escHtml(r.tokenizerNote)}">✓ Exact</span>`
    : `<span class="accuracy-badge badge-estimated" title="${escHtml(r.tokenizerNote)}">~ Estimated</span>`;

  const contextTitle = r.fitsContext
    ? `${fmt(r.tokens)} of ${fmt(r.contextWindow)} tokens (${pctLabel})`
    : `⚠ Exceeds context window! ${fmt(r.tokens)} tokens > ${fmt(r.contextWindow)} max`;

  tr.innerHTML = `
    <td class="cell-model">
      <div style="display:flex;align-items:center">
        <span class="model-provider-dot" style="background:${r.providerColor}"></span>
        <span class="model-name">${escHtml(r.modelName)}</span>
      </div>
      ${r.note ? `<span class="model-note">${escHtml(r.note)}</span>` : ''}
    </td>
    <td class="cell-tokens">${fmt(r.tokens)}</td>
    <td class="cell-context">
      <div class="context-bar-wrap" title="${contextTitle}">
        <div class="context-bar-bg">
          <div class="context-bar-fill ${barClass}" style="width:${pct}%"></div>
        </div>
        <span class="context-pct">${pctLabel}</span>
      </div>
      ${!r.fitsContext ? '<span class="fits-no">⚠ Exceeds context</span>' : ''}
    </td>
    <td class="cell-cost ${costClass(r.inputCost)}">${inCost}</td>
    <td class="cell-cost ${costClass(r.outputCost)}">${outCost}</td>
    <td>${accuracyBadge}</td>
  `;
  return tr;
}

/* ── UI helpers ──────────────────────────────────────────────────────────────── */
function showLoading(show) { loading.classList.toggle('hidden', !show); }
function hideResults()     { resultsSection.classList.add('hidden'); }
function showError(msg)    { errorText.textContent = msg; errorBanner.classList.remove('hidden'); }
function hideError()       { errorBanner.classList.add('hidden'); }

btnDismissError.addEventListener('click', hideError);

/* ── Notify modal ────────────────────────────────────────────────────────────── */
if (btnNotify) {
  btnNotify.addEventListener('click', () => { notifyModal.classList.remove('hidden'); notifyEmail.focus(); });
}
if (btnModalClose) btnModalClose.addEventListener('click', () => notifyModal.classList.add('hidden'));
if (notifyModal) {
  notifyModal.addEventListener('click', (e) => { if (e.target === notifyModal) notifyModal.classList.add('hidden'); });
}
if (btnNotifySubmit) {
  btnNotifySubmit.addEventListener('click', () => {
    const email = notifyEmail.value.trim();
    if (!email || !email.includes('@')) { notifyEmail.focus(); return; }
    btnNotifySubmit.textContent = "✓ You're on the list!";
    btnNotifySubmit.disabled = true;
    setTimeout(() => notifyModal.classList.add('hidden'), 2000);
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   PRO TOOL 1 — FORMAT CLEANER
   ══════════════════════════════════════════════════════════════════════════════ */

/* Mini dropzone wiring */
wireDropzone(cleanDropzone, cleanFileInput, cleanBrowse, (file) => {
  cleanSelectedFile = file;
  cleanFileName.textContent = file.name;
  cleanFileSize.textContent = formatBytes(file.size);
  cleanFileInfo.classList.remove('hidden');
  btnClean.disabled = false;
  cleanResult.classList.add('hidden');
  proHideError(cleanError);
});

cleanRemoveFile.addEventListener('click', () => {
  cleanSelectedFile = null;
  cleanFileInfo.classList.add('hidden');
  btnClean.disabled = true;
  cleanFileInput.value = '';
  cleanResult.classList.add('hidden');
});

/* Run cleaning */
btnClean.addEventListener('click', async () => {
  if (!cleanSelectedFile) return;
  proHideError(cleanError);
  cleanResult.classList.add('hidden');
  setProLoading(btnClean, true, 'Cleaning…');

  try {
    const form = new FormData();
    form.append('file', cleanSelectedFile);
    const data = await postFormData('/api/clean', form);
    renderCleanResult(data);
  } catch (err) {
    proShowError(cleanError, cleanErrorText, err.message);
  } finally {
    setProLoading(btnClean, false, 'Clean Text');
  }
});

function renderCleanResult(data) {
  // Pick the first model's comparison for the summary (e.g. GPT-4o as reference)
  // We'll show the avg across all models that have savings
  const rows    = data.tokenComparison.filter(r => r.tokensSaved >= 0);
  const avgPct  = rows.length ? rows.reduce((s, r) => s + r.pctSaved, 0) / rows.length : 0;
  const maxSave = rows.reduce((max, r) => r.moneySaved > max ? r.moneySaved : max, 0);

  // Summary bar
  const origTotal = rows[0] ? rows[0].originalTokens : 0;
  const cleanTotal = rows[0] ? rows[0].cleanTokens : 0;
  cleanSavings.innerHTML = `
    <div class="savings-stat">
      <span class="savings-label">Before</span>
      <span class="savings-value neutral">${fmt(origTotal)} tokens</span>
    </div>
    <div class="savings-stat">
      <span class="savings-label">After</span>
      <span class="savings-value">${fmt(cleanTotal)} tokens</span>
    </div>
    <div class="savings-stat">
      <span class="savings-label">Saved</span>
      <span class="savings-value">${fmt(origTotal - cleanTotal)} tokens (${avgPct.toFixed(1)}%)</span>
    </div>
    <div class="savings-stat">
      <span class="savings-label">Max input cost saved</span>
      <span class="savings-value">${formatCost(maxSave)} / call</span>
    </div>
    <div class="savings-stat">
      <span class="savings-label">Layout lines removed</span>
      <span class="savings-value neutral">${data.cleanerStats.boilerplateLineTypes} pattern${data.cleanerStats.boilerplateLineTypes !== 1 ? 's' : ''}</span>
    </div>
  `;

  // Comparison table
  cleanCmpWrap.innerHTML = buildCmpTable(data.tokenComparison, 'clean');

  // Clean text output
  lastCleanText = data.cleanText;
  cleanTextOutput.textContent = data.cleanText;

  cleanResult.classList.remove('hidden');
  cleanResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* Toggle comparison table */
cleanCmpToggle.addEventListener('click', () => {
  const open = !cleanCmpWrap.classList.contains('hidden');
  cleanCmpWrap.classList.toggle('hidden', open);
  cleanCmpToggle.textContent = open ? 'Show per-model savings ▾' : 'Hide per-model savings ▴';
});

/* Copy clean text */
btnCopyClean.addEventListener('click', async () => {
  if (!lastCleanText) return;
  await copyToClipboard(lastCleanText);
  flashBtn(btnCopyClean, 'Copied!');
});

/* Download clean text */
btnDownloadClean.addEventListener('click', () => {
  if (!lastCleanText) return;
  downloadText(lastCleanText, 'cleaned.txt');
});

/* ══════════════════════════════════════════════════════════════════════════════
   PRO TOOL 2 — SMART RETRIEVAL
   ══════════════════════════════════════════════════════════════════════════════ */

/* Mini dropzone wiring */
wireDropzone(retrieveDropzone, retrieveFileInput, retrieveBrowse, (file) => {
  retrieveSelectedFile = file;
  retrieveFileName.textContent = file.name;
  retrieveFileSize.textContent = formatBytes(file.size);
  retrieveFileInfo.classList.remove('hidden');
  updateRetrieveBtn();
  retrieveResult.classList.add('hidden');
  proHideError(retrieveError);
});

retrieveRemoveFile.addEventListener('click', () => {
  retrieveSelectedFile = null;
  retrieveFileInfo.classList.add('hidden');
  retrieveFileInput.value = '';
  updateRetrieveBtn();
  retrieveResult.classList.add('hidden');
});

retrieveQuery.addEventListener('input', updateRetrieveBtn);

function updateRetrieveBtn() {
  btnRetrieve.disabled = !(retrieveSelectedFile && retrieveQuery.value.trim());
}

/* Run retrieval */
btnRetrieve.addEventListener('click', async () => {
  if (!retrieveSelectedFile || !retrieveQuery.value.trim()) return;
  proHideError(retrieveError);
  retrieveResult.classList.add('hidden');
  setProLoading(btnRetrieve, true, 'Searching…');

  try {
    const form = new FormData();
    form.append('file', retrieveSelectedFile);
    form.append('query', retrieveQuery.value.trim());
    form.append('topK', retrieveTopK.value);
    const data = await postFormData('/api/retrieve', form);
    renderRetrieveResult(data);
  } catch (err) {
    proShowError(retrieveError, retrieveErrorText, err.message);
  } finally {
    setProLoading(btnRetrieve, false, 'Find Relevant Chunks');
  }
});

function renderRetrieveResult(data) {
  // Meta line
  retrieveMeta.textContent =
    `Found ${data.returnedChunks} relevant chunks from a ${fmt(data.totalChunks)}-chunk document ` +
    `(~${data.chunkSize} chars/chunk, ${data.overlap} char overlap).`;

  // Summary bar
  const rows     = data.tokenComparison.filter(r => r.tokensSaved >= 0);
  const avgPct   = rows.length ? rows.reduce((s, r) => s + r.pctSaved, 0) / rows.length : 0;
  const maxSave  = rows.reduce((max, r) => r.moneySaved > max ? r.moneySaved : max, 0);
  const fullTok  = rows[0] ? rows[0].fullTokens : 0;
  const retTok   = rows[0] ? rows[0].retrievedTokens : 0;

  retrieveSavings.innerHTML = `
    <div class="savings-stat">
      <span class="savings-label">Full doc</span>
      <span class="savings-value neutral">${fmt(fullTok)} tokens</span>
    </div>
    <div class="savings-stat">
      <span class="savings-label">Retrieved chunks</span>
      <span class="savings-value">${fmt(retTok)} tokens</span>
    </div>
    <div class="savings-stat">
      <span class="savings-label">Saved</span>
      <span class="savings-value">${fmt(fullTok - retTok)} tokens (${avgPct.toFixed(1)}%)</span>
    </div>
    <div class="savings-stat">
      <span class="savings-label">Max input cost saved</span>
      <span class="savings-value">${formatCost(maxSave)} / query</span>
    </div>
  `;

  // Comparison table
  retrieveCmpWrap.innerHTML = buildCmpTable(data.tokenComparison, 'retrieve');

  // Render chunks
  chunksList.innerHTML = '';
  data.chunks.forEach((chunk, i) => {
    const div = document.createElement('div');
    div.className = 'chunk-item';
    div.innerHTML = `
      <div class="chunk-meta">
        <span class="chunk-rank">#${i + 1} — chunk ${chunk.index + 1}</span>
        <span class="chunk-score">score: ${chunk.score.toFixed(4)}</span>
      </div>
      <div class="chunk-text">${escHtml(chunk.text)}</div>
    `;
    chunksList.appendChild(div);
  });

  lastChunksText = data.chunks.map((c, i) =>
    `### Chunk ${i + 1} (score: ${c.score.toFixed(4)})\n\n${c.text}`
  ).join('\n\n---\n\n');

  retrieveResult.classList.remove('hidden');
  retrieveResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* Toggle comparison table */
retrieveCmpToggle.addEventListener('click', () => {
  const open = !retrieveCmpWrap.classList.contains('hidden');
  retrieveCmpWrap.classList.toggle('hidden', open);
  retrieveCmpToggle.textContent = open ? 'Show per-model savings ▾' : 'Hide per-model savings ▴';
});

/* Copy all chunks */
btnCopyChunks.addEventListener('click', async () => {
  if (!lastChunksText) return;
  await copyToClipboard(lastChunksText);
  flashBtn(btnCopyChunks, 'Copied!');
});

/* ══════════════════════════════════════════════════════════════════════════════
   SHARED PRO UTILITIES
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Wire up a mini-dropzone (click, drag-over, drop) to an <input type="file">.
 * Calls `onFile(file)` when a valid file is selected.
 */
function wireDropzone(zone, input, browseBtn, onFile) {
  zone.addEventListener('click', (e) => {
    if (e.target !== browseBtn) input.click();
  });
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });
  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0]);
  });
}

/** Show inline loading state on a Pro button */
function setProLoading(btn, isLoading, labelText) {
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="pro-spinner"></span>${escHtml(labelText)}`;
  } else {
    btn.disabled = false;
    btn.textContent = labelText;
  }
}

/** Show inline error for a pro tool */
function proShowError(banner, textEl, msg) {
  textEl.textContent = msg;
  banner.classList.remove('hidden');
}

function proHideError(banner) {
  banner.classList.add('hidden');
}

/**
 * Build a comparison mini-table from tokenComparison rows.
 * `mode` = 'clean' (originalTokens/cleanTokens) | 'retrieve' (fullTokens/retrievedTokens)
 */
function buildCmpTable(rows, mode) {
  const isCleaner  = mode === 'clean';
  const colBefore  = isCleaner ? 'originalTokens' : 'fullTokens';
  const colAfter   = isCleaner ? 'cleanTokens'    : 'retrievedTokens';
  const labelAfter = isCleaner ? 'Clean'           : 'Retrieved';

  // Show only a subset of representative models to keep the table compact
  const SHOW_PROVIDERS = ['anthropic', 'openai', 'google', 'meta', 'mistral'];
  // One model per provider (cheapest, for a cost-focused table)
  const seen = new Set();
  const filtered = rows.filter(r => {
    if (seen.has(r.provider)) return false;
    seen.add(r.provider);
    return SHOW_PROVIDERS.includes(r.provider);
  });

  const thead = `
    <thead>
      <tr>
        <th>Provider</th>
        <th>Before</th>
        <th>${labelAfter}</th>
        <th>Saved</th>
        <th>% saved</th>
        <th>Input cost saved</th>
        <th>Accuracy</th>
      </tr>
    </thead>`;

  const tbody = filtered.map(r => `
    <tr>
      <td class="td-model">${escHtml(r.providerName)}</td>
      <td class="td-neutral">${fmt(r[colBefore])}</td>
      <td class="td-neutral">${fmt(r[colAfter])}</td>
      <td class="td-saved">${fmt(r.tokensSaved)}</td>
      <td class="td-saved">${r.pctSaved.toFixed(1)}%</td>
      <td class="td-money">${formatCost(r.moneySaved)}</td>
      <td>${r.exact
        ? '<span class="accuracy-badge badge-exact" style="font-size:.68rem">✓ Exact</span>'
        : '<span class="accuracy-badge badge-estimated" style="font-size:.68rem">~ Est.</span>'
      }</td>
    </tr>`).join('');

  return `<table class="cmp-table">${thead}<tbody>${tbody}</tbody></table>`;
}

/** Copy text to clipboard, with fallback */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/** Briefly change a button's label to confirm an action */
function flashBtn(btn, label) {
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = orig; }, 1800);
}

/** Download a string as a .txt file */
function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════════════════
   FORMATTING UTILITIES
   ══════════════════════════════════════════════════════════════════════════════ */

/** Format integer with thousands separator */
function fmt(n) { return Number(n).toLocaleString('en-US'); }

/** Format file size */
function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format USD cost with enough precision to be meaningful */
function formatCost(usd) {
  if (usd === 0)      return '$0.000000';
  if (usd < 0.000001) return '< $0.000001';
  if (usd < 0.001)    return `$${usd.toFixed(7).replace(/0+$/, '').replace(/\.$/, '')}`;
  if (usd < 1)        return `$${usd.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}`;
  if (usd < 100)      return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/** CSS class for cost coloring */
function costClass(usd) {
  if (usd < 0.001) return 'cost-tiny';
  if (usd < 0.10)  return 'cost-small';
  if (usd < 1.00)  return 'cost-medium';
  return 'cost-large';
}

/** Escape HTML to prevent XSS */
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

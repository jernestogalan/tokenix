/**
 * Tokenix — src/parsers/index.js
 *
 * Extracts plain text from uploaded files.
 * Supported types:
 *   • .pdf         → pdf-parse (text layer only; scanned/image PDFs return empty)
 *   • .docx/.doc   → mammoth (extracts raw text; discards formatting)
 *   • everything else → read as UTF-8 text (covers .txt, .md, all code files, etc.)
 */

const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const path     = require('path');

// Extensions treated as plain text (no special parser needed)
const PLAIN_TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.mdx', '.rst',
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.php',
  '.sh', '.bash', '.zsh', '.fish',
  '.sql',
  '.html', '.htm', '.xml', '.svg',
  '.css', '.scss', '.sass', '.less',
  '.json', '.jsonc', '.yaml', '.yml', '.toml',
  '.env', '.ini', '.cfg', '.conf',
  '.r', '.R',
  '.ipynb', // Jupyter notebooks are JSON — useful to count the source cells
]);

/**
 * Extract text from a file buffer.
 *
 * @param {Buffer} buffer   — file contents
 * @param {string} filename — original filename (used to detect type)
 * @returns {Promise<string>} extracted plain text
 */
async function extractText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case '.pdf':
      return extractPDF(buffer, filename);

    case '.docx':
    case '.doc':
      return extractDocx(buffer, filename);

    default:
      if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
        return extractPlainText(buffer, filename);
      }
      // Unknown extension — attempt UTF-8 decode and hope for the best
      return extractPlainText(buffer, filename);
  }
}

// ── PDF ───────────────────────────────────────────────────────────────────────
async function extractPDF(buffer, filename) {
  try {
    const data = await pdfParse(buffer);
    if (!data.text || data.text.trim().length === 0) {
      throw new Error(
        `No text layer found in "${filename}". ` +
        'This PDF may be image-only or scanned. ' +
        'Run it through an OCR tool first, then try again.'
      );
    }
    return data.text;
  } catch (err) {
    // pdf-parse throws on some malformed PDFs
    if (err.message.includes('No text layer')) throw err;
    throw new Error(`Could not parse PDF "${filename}": ${err.message}`);
  }
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
async function extractDocx(buffer, filename) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    if (result.messages && result.messages.length > 0) {
      // Log warnings but don't fail — mammoth still returns text
      result.messages.forEach(m => console.warn(`[mammoth] ${m.type}: ${m.message}`));
    }
    return result.value;
  } catch (err) {
    throw new Error(`Could not parse DOCX "${filename}": ${err.message}`);
  }
}

// ── Plain text / code ─────────────────────────────────────────────────────────
function extractPlainText(buffer, filename) {
  try {
    return buffer.toString('utf-8');
  } catch {
    throw new Error(`Could not decode "${filename}" as UTF-8 text.`);
  }
}

module.exports = { extractText };

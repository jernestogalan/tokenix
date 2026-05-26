'use strict';
/**
 * Tokenix — src/retriever/index.js
 *
 * Smart Retrieval (Pro feature) — Chunking + TF-IDF similarity search
 *
 * WHY TF-IDF (not neural embeddings) for MVP:
 *  • Zero extra dependencies — no API keys, no model downloads, works offline
 *  • Fast enough for documents up to a few thousand chunks
 *  • Transparent and deterministic — easy to audit
 *  • Good recall on keyword-heavy queries (code docs, legal, technical manuals)
 *  • Upgrade path: drop-in replace `scoreChunks()` with an embedding model later
 *
 * WHAT THIS DOES:
 *  1. Split the document into overlapping paragraph-aware chunks
 *  2. Build a TF-IDF matrix over those chunks
 *  3. Score each chunk against the user's query with cosine similarity
 *  4. Return the top-k chunks (default k=5) with their scores
 *
 * WHAT THIS DOES NOT DO:
 *  - Understand meaning / semantics (it finds keyword overlap, not paraphrase)
 *  - Replace the full document for broad questions — only good for focused queries
 *
 * For production you would swap in: sentence-transformers (via @xenova/transformers
 * or a cloud API), plus a vector store (Chroma, pgvector, Pinecone).
 */

// ── Configuration ─────────────────────────────────────────────────────────────
const DEFAULT_CHUNK_SIZE    = 800;  // target chars per chunk
const DEFAULT_CHUNK_OVERLAP = 150;  // overlap chars between adjacent chunks
const DEFAULT_TOP_K         = 5;    // number of chunks to return
const MIN_CHUNK_LENGTH      = 80;   // discard chunks shorter than this (noise)

// Stop-words to skip when building TF-IDF vectors (English)
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'as','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall',
  'this','that','these','those','it','its','their','they','we','our',
  'you','your','he','his','she','her','i','my','me','us','not','no',
  'by','from','up','out','if','then','than','so','also','just','into',
  'about','over','after','before','between','through','during','while',
  'which','who','what','where','when','how','all','each','any','some',
  'there','here','more','other','such','only','both','own','same','new',
]);

// ── Tokenisation (for TF-IDF, not LLM tokenization) ──────────────────────────
function tfidfTokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

// ── Chunking ──────────────────────────────────────────────────────────────────
/**
 * Split text into overlapping chunks, preferring paragraph boundaries.
 * Strategy:
 *  1. Split on double-newline (paragraph) boundaries
 *  2. Merge small paragraphs, split oversized ones at sentence boundaries
 *  3. Apply overlap by prepending the tail of the previous chunk
 */
function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  // Step 1: paragraph split
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(p => p.length >= MIN_CHUNK_LENGTH);

  if (paragraphs.length === 0) {
    // Fallback: fixed-size with overlap
    return fixedChunks(text, chunkSize, overlap);
  }

  // Step 2: merge/split paragraphs into ~chunkSize blobs
  const blobs = [];
  let current = '';

  for (const para of paragraphs) {
    if (para.length > chunkSize * 2) {
      // Oversized paragraph → split at sentence boundaries
      if (current) { blobs.push(current.trim()); current = ''; }
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sub = '';
      for (const sent of sentences) {
        if (sub.length + sent.length + 1 > chunkSize && sub) {
          blobs.push(sub.trim());
          sub = sent;
        } else {
          sub += (sub ? ' ' : '') + sent;
        }
      }
      if (sub) current = sub;
    } else if (current.length + para.length + 2 > chunkSize && current) {
      blobs.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) blobs.push(current.trim());

  // Step 3: apply overlap (prepend tail of previous blob)
  const chunks = [];
  for (let i = 0; i < blobs.length; i++) {
    if (i === 0 || overlap === 0) {
      chunks.push(blobs[i]);
    } else {
      const tail = blobs[i - 1].slice(-overlap);
      chunks.push(tail + ' ' + blobs[i]);
    }
  }

  return chunks.filter(c => c.length >= MIN_CHUNK_LENGTH);
}

function fixedChunks(text, size, overlap) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.filter(c => c.length >= MIN_CHUNK_LENGTH);
}

// ── TF-IDF ────────────────────────────────────────────────────────────────────
/**
 * Build a TF-IDF model over an array of text chunks.
 * Returns: { tfVectors, idf, terms }
 */
function buildTFIDF(chunks) {
  const N = chunks.length;

  // Term frequencies per chunk (normalised by max freq in that chunk)
  const tfVectors = chunks.map(chunk => {
    const terms = tfidfTokenize(chunk);
    const freq  = {};
    for (const t of terms) freq[t] = (freq[t] || 0) + 1;
    const max = Math.max(1, ...Object.values(freq));
    const tf  = {};
    for (const [t, f] of Object.entries(freq)) tf[t] = f / max;
    return tf;
  });

  // Document frequency
  const df = {};
  for (const tf of tfVectors) {
    for (const t of Object.keys(tf)) {
      df[t] = (df[t] || 0) + 1;
    }
  }

  // IDF with smoothing: log((N+1)/(df+1)) + 1
  const idf = {};
  for (const [t, d] of Object.entries(df)) {
    idf[t] = Math.log((N + 1) / (d + 1)) + 1;
  }

  return { tfVectors, idf };
}

/**
 * Cosine similarity between a TF vector and a query TF vector,
 * weighted by the IDF of each term.
 */
function cosineSimilarity(chunkTF, queryTF, idf) {
  let dot = 0, magChunk = 0, magQuery = 0;

  // All unique terms across both vectors
  const allTerms = new Set([...Object.keys(chunkTF), ...Object.keys(queryTF)]);

  for (const t of allTerms) {
    const w      = idf[t] || 1;
    const chunkW = (chunkTF[t]  || 0) * w;
    const queryW = (queryTF[t]  || 0) * w;
    dot      += chunkW * queryW;
    magChunk += chunkW * chunkW;
    magQuery += queryW * queryW;
  }

  if (magChunk === 0 || magQuery === 0) return 0;
  return dot / (Math.sqrt(magChunk) * Math.sqrt(magQuery));
}

// ── Main ──────────────────────────────────────────────────────────────────────
/**
 * Given full document text and a user query, return the top-k most relevant chunks.
 *
 * @param {string} documentText  - full extracted text
 * @param {string} query         - user's question or search string
 * @param {number} topK          - how many chunks to return (default 5)
 * @param {number} chunkSize     - target chunk size in chars
 * @param {number} overlap       - overlap between adjacent chunks in chars
 * @returns {{
 *   chunks: Array<{ text: string, score: number, index: number }>,
 *   totalChunks: number,
 *   chunkSize: number,
 *   overlap: number
 * }}
 */
function retrieve(documentText, query, topK = DEFAULT_TOP_K, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  if (!documentText || !query) throw new Error('documentText and query are required.');

  // 1. Chunk the document
  const chunks = chunkText(documentText, chunkSize, overlap);
  if (chunks.length === 0) throw new Error('Document too short to chunk.');

  // 2. Build TF-IDF over chunks
  const { tfVectors, idf } = buildTFIDF(chunks);

  // 3. Build TF vector for the query
  const queryTerms = tfidfTokenize(query);
  const queryFreq  = {};
  for (const t of queryTerms) queryFreq[t] = (queryFreq[t] || 0) + 1;
  const queryMax = Math.max(1, ...Object.values(queryFreq));
  const queryTF  = {};
  for (const [t, f] of Object.entries(queryFreq)) queryTF[t] = f / queryMax;

  // 4. Score each chunk
  const scored = chunks.map((text, i) => ({
    text,
    index: i,
    score: cosineSimilarity(tfVectors[i], queryTF, idf),
  }));

  // 5. Sort by score descending, return top-k with score > 0
  const topChunks = scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // If nothing matched (very generic query), return first k chunks
  const results = topChunks.length > 0
    ? topChunks
    : chunks.slice(0, topK).map((text, i) => ({ text, index: i, score: 0 }));

  return {
    chunks:      results,
    totalChunks: chunks.length,
    chunkSize,
    overlap,
  };
}

module.exports = { retrieve, chunkText };

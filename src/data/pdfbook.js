// PDF guided-study support: extract page text + render real pages (pdf.js).
// Lazy-loaded so pdfjs-dist only enters the bundle when a PDF is studied.
import { mediaKind } from './study.js';

let pdfjsPromise = null;
const docCache = new Map();
const renderTasks = new WeakMap();

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import('pdfjs-dist');
      if (typeof window !== 'undefined') {
        try {
          const Worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
          lib.GlobalWorkerOptions.workerPort = new Worker();
        } catch (e) {
          try {
            lib.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
          } catch { console.warn('pdf worker unavailable:', e && e.message); }
        }
      }
      return lib;
    })();
  }
  return pdfjsPromise;
}

function dataToBytes(fileData) {
  const i = String(fileData).indexOf(',');
  const bin = atob(String(fileData).slice(i + 1));
  const bytes = new Uint8Array(bin.length);
  for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
  return bytes;
}

export async function openPdf(fileData) {
  const key = String(fileData).length;
  if (docCache.has(key)) return docCache.get(key);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: dataToBytes(fileData), isEvalSupported: false }).promise;
  docCache.clear();
  docCache.set(key, doc);
  return doc;
}

export async function extractPdfPages(doc) {
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let text = '';
    for (const it of tc.items) {
      if (!it.str) { if (it.hasEOL) text += '\n'; continue; }
      text += (text && !text.endsWith('\n') && !text.endsWith(' ') ? ' ' : '') + it.str;
      if (it.hasEOL) text += '\n';
    }
    out.push(text.replace(/[ \t]+/gm, ' ').trim());
  }
  return out;
}

function pageParas(text) {
  const paras = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
  return paras.length ? paras : [''];
}

function chapterLine(pageText) {
  const lines = String(pageText || '').split('\n').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(chapter\s+\d+)(.*)$/i);
    if (!m) continue;
    if (line.includes('...') || line.includes('…')) continue;
    const rest = m[2].replace(/^[\s:.\-–—]+/, '').trim();
    let title = '';
    if (rest.length >= 3 && /[A-Za-z]/.test(rest) && !rest.includes('...') && !rest.includes('…')) {
      title = rest;
    } else {
      const nextLine = lines[i + 1] || '';
      if (nextLine && nextLine.length <= 80 && /[A-Za-z]/.test(nextLine)
        && !/^[.\s\d]+$/.test(nextLine) && !nextLine.includes('...') && !nextLine.includes('…')) {
        title = nextLine;
      }
    }
    if (!title) continue;
    title = title.replace(/^\d+(?:\.\d+)*[.)]?\s+/, '').trim();
    if (!title) continue;
    const full = m[1].replace(/\s+/g, ' ').trim() + ': ' + title;
    return full.length > 78 ? full.slice(0, 75) + '…' : full;
  }
  return null;
}

export function buildBookFromPages(pageTexts, item) {
  const n = pageTexts.length;
  const starts = [];
  pageTexts.forEach((pt, i) => {
    const c = chapterLine(pt);
    if (c != null) starts.push({ i, title: c });
  });
  const useChapters = starts.length >= 2;
  const groups = [];
  if (useChapters) {
    if (starts[0].i > 0) groups.push({ from: 0, to: starts[0].i - 1, title: null });
    starts.forEach((s, k) => {
      const to = k + 1 < starts.length ? starts[k + 1].i - 1 : n - 1;
      groups.push({ from: s.i, to, title: s.title });
    });
  } else {
    const CHUNK = 10;
    for (let i = 0; i < n; i += CHUNK) {
      const to = Math.min(i + CHUNK - 1, n - 1);
      const firstLine = (pageTexts[i] || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || null;
      const okTitle = firstLine && firstLine.length <= 60 && /[A-Za-z]/.test(firstLine) && !/^[.\s\d]+$/.test(firstLine);
      groups.push({ from: i, to, title: okTitle ? firstLine : null });
    }
  }
  let words = 0;
  const sections = groups.map((g, idx) => {
    const pages = [];
    for (let p = g.from; p <= g.to; p++) {
      const paras = pageParas(pageTexts[p]);
      words += paras.join(' ').split(/\s+/).length;
      pages.push(paras);
    }
    const blocks = [];
    for (const paras of pages) for (const t of paras) if (t) blocks.push({ type: 'para', text: t });
    return {
      id: idx, num: idx + 1, title: g.title, level: 1,
      blocks, pages, pdfStart: g.from + 1,
      pageCount: pages.length,
      words: blocks.reduce((a, b) => a + b.text.split(/\s+/).length, 0)
    };
  });
  if (!sections.length) sections.push({ id: 0, num: 1, title: null, level: 1, blocks: [], pages: [['']], pdfStart: 1, pageCount: 1, words: 0 });
  return {
    sections,
    pages: n,
    words,
    estMin: Math.max(1, Math.round(words / 180) + sections.length),
    pdf: { numPages: n }
  };
}

export async function buildPdfBook(item) {
  if (mediaKind(item && item.fileData) !== 'pdf') return null;
  const doc = await openPdf(item.fileData);
  const texts = await extractPdfPages(doc);
  return buildBookFromPages(texts, item);
}

export async function renderPdfPageTo(canvas, fileData, absNum, maxWidth) {
  if (!canvas) return;
  const prev = renderTasks.get(canvas);
  if (prev) { try { prev.cancel(); } catch { /* noop */ } }
  const doc = await openPdf(fileData);
  const page = await doc.getPage(Math.min(Math.max(1, absNum), doc.numPages));
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(240, Math.min(maxWidth || 720, 860));
  const scale = (cssW / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.maxWidth = '100%';
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  const task = page.render({ canvasContext: ctx, viewport });
  renderTasks.set(canvas, task);
  try { await task.promise; } catch (e) { if (!e || e.name !== 'RenderingCancelledException') throw e; }
  if (renderTasks.get(canvas) === task) renderTasks.delete(canvas);
}

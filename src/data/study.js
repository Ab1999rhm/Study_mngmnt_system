// Guided-study content parser + generators (pure, no React).
// Splits book/notes text into chapters → sections → pages, and builds
// questionnaire questions + key points for the "capture in mind" step.

const STOP = new Set(('the and for are but not you all can had has was one our out this that with have from they will when your how why who them than its into any may also been were each which their there more most some only over very after before between through during under above below about because while where being does did doing should could would must').split(' '));

export function splitSentences(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = [];
  let cur = '';
  const terminators = '.!?।።';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    cur += ch;
    if (terminators.includes(ch)) {
      while (i + 1 < t.length && '"”’\')'.includes(t[i + 1])) cur += t[++i];
      if (cur.trim().length > 8) { out.push(cur.trim()); cur = ''; }
    }
  }
  if (cur.trim().length > 8) out.push(cur.trim());
  return out;
}

function headingOf(line) {
  if (line.length > 90) return null;
  let m;
  if ((m = line.match(/^#{1,4}\s+(.+)$/))) return { text: m[1].trim(), level: m[1].startsWith('#') ? 2 : 1 };
  if ((m = line.match(/^\*\*(.+?)\*\*$/))) return { text: m[1].trim(), level: 1 };
  if ((m = line.match(/^(chapter|part|section|unit|lesson|chapter|ምዕራፍ|ክፍል|บท)\s+[\d.ivxlc]+[:.\-–—]?\s*(.*)$/i))) {
    return { text: line, level: 1 };
  }
  if ((m = line.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.{2,70})$/))) {
    if (/\.$/.test(m[2]) && m[2].split(' ').length > 8) return null;
    return { text: (m[1] + ' ' + m[2]).trim(), level: Math.min(m[1].split('.').length, 3) };
  }
  const words = line.split(' ');
  if (line.length <= 70 && words.length <= 10 && /^[A-Z0-9][A-Z0-9\s.,:;'’\-–—()&]+$/.test(line) && /[A-Z]{3}/.test(line)) {
    return { text: line, level: 1 };
  }
  if (line.length <= 70 && (line.endsWith(':') || line.endsWith('·')) && words.length <= 12) {
    return { text: line.replace(/[:·]+$/, '').trim(), level: 1 };
  }
  return null;
}

export function parseBook(body) {
  const lines = String(body || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let buf = [];
  const flush = () => { if (buf.join(' ').trim()) blocks.push({ type: 'para', text: buf.join(' ').trim() }); buf = []; };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^(-{3,}|={3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push({ type: 'break' }); continue; }
    const h = headingOf(line);
    if (h) { flush(); blocks.push({ type: 'h', text: h.text, level: h.level }); }
    else buf.push(line);
  }
  flush();

  const sections = [];
  let cur = null;
  const pushSection = (title, level) => { cur = { title, level: level || 1, blocks: [] }; sections.push(cur); };
  for (const b of blocks) {
    if (b.type === 'h') { pushSection(b.text, b.level); continue; }
    if (!cur) pushSection(null, 1);
    cur.blocks.push(b);
  }

  // No headings at all → chunk paragraphs into parts of 4 so a long note still gets a plan.
  if (sections.length === 1 && sections[0] && !sections[0].title) {
    const paras = sections[0].blocks.filter(b => b.type === 'para');
    if (paras.length > 6) {
      sections.length = 0;
      for (let i = 0; i < paras.length; i += 4) sections.push({ title: null, level: 1, blocks: paras.slice(i, i + 4) });
    }
  }
  if (!sections.length) pushSection(null, 1);

  let totalPages = 0;
  let totalWords = 0;
  sections.forEach((s, idx) => {
    const pages = [];
    let page = [];
    let size = 0;
    const pushPage = () => { if (page.length) { pages.push(page); page = []; size = 0; } };
    const addPiece = text => {
      if (size > 0 && size + text.length > 1000) pushPage();
      page.push(text);
      size += text.length;
    };
    for (const b of s.blocks) {
      if (b.type === 'break') { pushPage(); continue; }
      const text = b.text;
      totalWords += text.split(/\s+/).length;
      if (text.length > 1200) {
        let chunk = '';
        for (const sn of splitSentences(text)) {
          if (chunk && chunk.length + sn.length > 900) { addPiece(chunk); chunk = ''; }
          chunk += (chunk ? ' ' : '') + sn;
        }
        if (chunk) addPiece(chunk);
      } else addPiece(text);
    }
    pushPage();
    if (!pages.length) pages.push(['']);
    s.index = idx;
    s.pages = pages;
    s.pageCount = pages.length;
    s.words = s.blocks.reduce((a, b) => a + b.text.split(/\s+/).length, 0);
    totalPages += pages.length;
  });

  return {
    sections: sections.map((s, i) => ({ ...s, id: i, num: i + 1 })),
    pages: totalPages,
    words: totalWords,
    estMin: Math.max(1, Math.round(totalWords / 180) + sections.length)
  };
}

export function mediaKind(fileData) {
  if (!fileData || typeof fileData !== 'string' || !fileData.startsWith('data:')) return null;
  const semi = fileData.indexOf(';');
  if (semi < 5) return null;
  const mime = fileData.slice(5, semi).toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime.includes('markdown') || mime.includes('csv')) return 'text';
  return 'file';
}

export function decodeDataText(fileData) {
  try {
    const i = String(fileData).indexOf(',');
    if (i < 0) return '';
    const bin = atob(fileData.slice(i + 1));
    const bytes = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) { return ''; }
}

export function buildBook(item) {
  const kind = mediaKind(item && item.fileData);
  let text = String((item && item.body) || '');
  if (!text.trim() && kind === 'text') text = decodeDataText(item.fileData);
  const book = text.trim() ? parseBook(text) : parseBook('');
  if (!kind || kind === 'text') return book;
  const rest = text.trim() ? book.sections : [];
  const mediaSec = {
    title: String((item.fileName || item.title || 'Upload')).trim(),
    level: 1, blocks: [], pages: [['']], pageCount: 1, words: 0,
    media: { kind, src: item.fileData, name: String(item.fileName || item.title || '') }
  };
  const sections = [mediaSec, ...rest];
  const totalPages = sections.reduce((a, s) => a + (s.pageCount || 1), 0);
  const totalWords = sections.reduce((a, s) => a + (s.words || 0), 0);
  return {
    sections: sections.map((s, i) => ({ ...s, id: i, num: i + 1 })),
    pages: totalPages,
    words: totalWords,
    estMin: Math.max(1, Math.round(totalWords / 180) + sections.length)
  };
}

export function keyPoints(section) {
  const sentences = [];
  (section.blocks || []).forEach(b => splitSentences(b.text).forEach(s => sentences.push(s)));
  const scored = sentences.map((s, i) => {
    const w = s.split(/\s+/).length;
    let score = 0;
    if (w >= 6 && w <= 30) score += 3;
    if (/\d/.test(s)) score += 1;
    if (i < 3) score += 1;
    if (s.length > 400) score -= 2;
    return { s, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const picked = [];
  for (const x of scored) {
    if (picked.length >= 4) break;
    if (picked.some(p => p.slice(0, 24) === x.s.slice(0, 24))) continue;
    picked.push(x.s);
  }
  if (!picked.length) {
    const raw = (section.blocks || []).map(b => b.text).join(' ').trim();
    if (raw) picked.push(raw.length > 180 ? raw.slice(0, 177) + '…' : raw);
  }
  return picked;
}

function shuffleSeeded(arr, seed) {
  const a = [...arr];
  let s = (seed + 1) * 1103515245 + 12345;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483647;
    const j = Math.abs(s) % (i + 1);
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

const clean = w => w.replace(/[^\p{L}\p{N}'’-]/gu, '');

export function makeQuestions(section, max = 3) {
  const text = (section.blocks || []).map(b => b.text).join(' ');
  const sentences = splitSentences(text).filter(s => {
    const w = s.split(/\s+/).length;
    return w >= 6 && w <= 32;
  });
  const goodWords = [...new Set(text.split(/\s+/).map(clean))]
    .filter(w => w.length >= 4 && !STOP.has(w.toLowerCase()));
  if (goodWords.length < 6 || !sentences.length) return [];

  const out = [];
  const usedWords = new Set();
  const step = Math.max(1, Math.floor(sentences.length / max));
  for (let i = 0; i < sentences.length && out.length < max; i += step) {
    const s = sentences[i];
    const cands = s.split(/\s+/).map(clean)
      .filter(w => w.length >= 4 && !STOP.has(w.toLowerCase()) && !usedWords.has(w.toLowerCase()))
      .sort((a, b) => b.length - a.length);
    if (!cands.length) continue;
    const answer = cands[0];
    const distractors = shuffleSeeded(goodWords.filter(w => w.toLowerCase() !== answer.toLowerCase()), out.length * 17 + i * 7).slice(0, 3);
    if (distractors.length < 2) continue;
    usedWords.add(answer.toLowerCase());
    const options = shuffleSeeded([answer, ...distractors], out.length * 13 + i * 5);
    let q = s;
    try { q = s.replace(new RegExp(escapeReg(answer), 'i'), ' ______ '); } catch { continue; }
    if (!q.includes('______')) continue;
    out.push({ q, answer, options });
  }
  return out;
}

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

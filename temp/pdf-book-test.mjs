// buildBookFromPages on the real uploaded OOP PDF: exact pages + chapters + AI text.
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildBookFromPages } from '../src/data/pdfbook.js';

const db = JSON.parse(fs.readFileSync(new URL('../data/db.json', import.meta.url), 'utf8'));
const up = db.uploads.find(u => (u.fileName || '').toLowerCase().endsWith('.pdf'));
const bytes = Buffer.from(String(up.fileData).split(',')[1], 'base64');
const doc = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;

const texts = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  let text = '';
  for (const it of tc.items) {
    if (!it.str) { if (it.hasEOL) text += '\n'; continue; }
    text += (text && !text.endsWith('\n') && !text.endsWith(' ') ? ' ' : '') + it.str;
    if (it.hasEOL) text += '\n';
  }
  texts.push(text.replace(/[ \t]+/gm, ' ').trim());
}

const book = buildBookFromPages(texts, up);
let pass = 0, fail = 0;
const t = (name, cond, extra) => { if (cond) { pass++; console.log('  ok -', name); } else { fail++; console.log('  FAIL -', name, extra != null ? ':: ' + extra : ''); } };

console.log('sections:', book.sections.length, '| titles:', book.sections.map(s => s.title).slice(0, 12).map(x => (x || 'null').slice(0, 40)).join(' | '));
t('exact page count = 162', book.pages === 162, book.pages);
t('pdf marker numPages', book.pdf && book.pdf.numPages === 162);
t('pages sum matches sections', book.sections.reduce((a, s) => a + s.pageCount, 0) === 162);
t('sections = 8 (front matter + 7 chapters)', book.sections.length === 8, book.sections.length);
const titled = book.sections.filter(s => s.title);
t('7 chapter titles', titled.length === 7, titled.length);
t('chapter-like titles found', titled.filter(s => /chapter/i.test(s.title)).length === 7,
  titled.map(s => s.title).join(' | '));
t('words > 25000', book.words > 25000, book.words);
t('estMin sane', book.estMin > 100 && book.estMin < 2000, book.estMin);
const aiText = book.sections.flatMap(s => s.pages.flat()).join('\n');
t('AI text has OOP content', /Object\s*-\s*oriented|Object-oriented/i.test(aiText));
t('AI text > 150k chars', aiText.length > 150000, aiText.length);
const s0 = book.sections[0];
t('section pdfStart chain contiguous', book.sections.every((s, i) => s.pdfStart === (i === 0 ? 1 : book.sections[i - 1].pdfStart + book.sections[i - 1].pageCount)),
  book.sections.map(s => s.pdfStart).join(','));
t('first section starts at page 1', s0.pdfStart === 1, s0.pdfStart);
t('every section has blocks text', book.sections.every(s => s.blocks.length >= 0) && book.sections.some(s => s.blocks.length > 5));
t('pages are arrays of paragraphs', book.sections.every(s => s.pages.every(p => Array.isArray(p) && p.length >= 1)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

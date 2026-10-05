// Does the uploaded OOP PDF have a text layer? (decides: extract vs OCR)
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const db = JSON.parse(fs.readFileSync(new URL('../data/db.json', import.meta.url), 'utf8'));
const up = db.uploads.find(u => (u.fileName || '').toLowerCase().endsWith('.pdf'));
if (!up) { console.log('no pdf upload'); process.exit(1); }
const b64 = String(up.fileData).split(',')[1];
const bytes = Buffer.from(b64, 'base64');
console.log('file:', up.fileName, '| bytes:', bytes.length);

const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false }).promise;
console.log('pages:', doc.numPages);
let grand = 0;
const shown = Math.min(doc.numPages, 6);
for (let i = 1; i <= shown; i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  const text = tc.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
  grand += text.length;
  console.log(`page ${i}: ${text.length} chars :: ${text.slice(0, 100)}`);
}
if (doc.numPages > shown) {
  for (let i = shown + 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    grand += tc.items.map(it => it.str).join(' ').length;
  }
}
console.log('TOTAL extracted chars across', doc.numPages, 'pages:', grand);
console.log(grand > 500 ? 'VERDICT: text PDF -> extraction works, no OCR needed' : 'VERDICT: scanned/image PDF -> OCR needed for AI');
process.exit(0);

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = {
  get length() { return mem.size; },
  key: i => [...mem.keys()][i] ?? null,
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k)
};
globalThis.window = {
  dispatchEvent() {}, addEventListener() {},
  location: { pathname: '/x', search: '?user=t', origin: 'http://localhost' }
};

// legacy per-browser notes awaiting migration
mem.set('ssa_notes_stu_legacy', JSON.stringify([{ text: 'legacy follow note', by: 'Old Dir', at: '2026-01-01T00:00:00.000Z' }]));
mem.set('ssa_notes_stu_empty', JSON.stringify([]));
mem.set('ssa_db_v1', JSON.stringify({ users: [], reports: [], videos: [], uploads: [], codes: [], payRequests: [], resetRequests: [], notes: { stu_map: [{ text: 'map-era note', by: 'D', at: '2026-01-02T00:00:00.000Z' }] } }));

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label); };

const root = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(root, '..', 'src', 'data', 'store.js');
const { store } = await import(pathToFileURL(storePath).href);

// 1. legacy migration
const legacy = store.directorNotes('stu_legacy');
ok(legacy.length === 1 && legacy[0].text === 'legacy follow note', 'legacy ssa_notes_* migrated into db.notes');
ok(mem.get('ssa_notes_stu_legacy') === undefined, 'legacy key removed after migration');
ok(mem.get('ssa_notes_stu_empty') === undefined || JSON.parse(mem.get('ssa_notes_stu_empty')).length === 0, 'empty legacy key removed, not migrated');
const mapEra = store.directorNotes('stu_map');
ok(mapEra.length === 1 && mapEra[0].text === 'map-era note' && mapEra[0].studentId === 'stu_map', 'map-shaped db.notes converted to flat array');

// 2. write path
const rec = store.addDirectorNote('stu_1', '  called parent  ', 'Dir A');
ok(rec && rec.text === 'called parent' && rec.by === 'Dir A', 'addDirectorNote trims + stamps record');
const notes1 = store.directorNotes('stu_1');
ok(notes1.length === 1 && notes1[0].text === 'called parent', 'directorNotes returns the record');
const persisted = JSON.parse(mem.get('ssa_db_v1'));
ok(Array.isArray(persisted.notes), 'db.notes is a flat array (spec: db.notes[])');
ok((persisted.notes.find(n => n.studentId === 'stu_1') || {}).text === 'called parent', 'note persisted into ssa_db_v1 (shared store)');
ok(!Object.keys(persisted).some(k => k.startsWith('ssa_notes_')), 'no per-browser note keys written');

// 3. append + guards
store.addDirectorNote('stu_1', 'second note', 'Dir B');
ok(store.directorNotes('stu_1').length === 2, 'notes append per student');
ok(store.addDirectorNote('stu_1', '   ', 'X') === null, 'blank note rejected');
ok(store.directorNotes('stu_unknown').length === 0, 'unknown student -> empty array');

console.log(fail ? `NOT OK (${pass} pass, ${fail} fail)` : `ALL NOTES TESTS PASSED (${pass})`);
process.exit(fail ? 1 : 0);

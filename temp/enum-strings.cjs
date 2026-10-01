const fs = require('fs');
const src = fs.readFileSync('src/AdminDashboard.jsx', 'utf8');
const lines = src.split(/\r?\n/);
const logic = new Set(['paid', 'unpaid', 'expired', 'blocked', 'aioff', 'free', 'hidden', 'locked', 'plan', 'full', 'item', 'student', 'director', 'admin', 'pending', 'approved', 'rejected', 'graded', 'students', 'reports', 'uploads', 'payments', 'directors', 'settings', 'overview', 'name', 'grade', 'points', 'joined', 'asc', 'desc', 'newest', 'oldest', 'title', 'today', 'month', 'all', 'All', 'Sort', 'sort', 'open', 'closed']);
const out = new Map();
const add = (s, i) => {
  s = s.trim();
  if (!s || logic.has(s)) return;
  if (!out.has(s)) out.set(s, []);
  out.get(s).push(i + 1);
};
lines.forEach((l, i) => {
  for (const m of l.matchAll(/'([A-Z][A-Za-z0-9 ,'’&%:!?.\-\/+#]{3,60})'/g)) add(m[1], i);
  for (const m of l.matchAll(/"([A-Z][A-Za-z0-9 ,'’&%:!?.\-\/+#]{3,60})"/g)) add(m[1], i);
  for (const m of l.matchAll(/>([A-Z][A-Za-z0-9 ,'’&%:.+\-]{3,60})</g)) add(m[1], i);
});
console.log('unique:', out.size);
[...out.entries()].sort((a, b) => a[1][0] - b[1][0])
  .forEach(([s, ls]) => console.log(ls[0] + (ls.length > 1 ? '+' + (ls.length - 1) : '') + ' ' + JSON.stringify(s)));

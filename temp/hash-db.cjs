const fs = require('fs');
const bcrypt = require('bcryptjs');
const P = 'data/db.json';
const db = JSON.parse(fs.readFileSync(P, 'utf8'));
let n = 0;
(db.users || []).forEach(u => {
  if (u.password != null && !String(u.password).startsWith('$2')) {
    u.password = bcrypt.hashSync(String(u.password), 10);
    n++;
  }
});
fs.writeFileSync(P, JSON.stringify(db, null, 2));
const ok = (db.users || []).every(u => String(u.password).startsWith('$2'));
console.log('hashed ' + n + '/' + (db.users || []).length + ' users; all hashed now: ' + ok);

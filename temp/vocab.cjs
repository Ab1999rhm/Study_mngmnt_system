const fs = require('fs');
const t = fs.readFileSync('src/i18n.js', 'utf8');
const langs = { en: [t.indexOf('const en'), t.indexOf('const om')], om: [t.indexOf('const om'), t.indexOf('const am')], am: [t.indexOf('const am'), t.indexOf('const so')], so: [t.indexOf('const so'), t.indexOf('export default')] };
const keys = ['directors', 'status', 'pending', 'approved', 'rejected', 'points', 'email', 'name', 'search', 'all', 'details', 'actions', 'days', 'fee', 'paid', 'unpaid', 'expired', 'openPackage', 'deleteStudent', 'resetPassword', 'active', 'inactive', 'remedial', 'grade', 'school', 'students' /* may not exist */, 'free', 'locked', 'hide', 'unhide', 'clone', 'preview', 'upload', 'chapter', 'score', 'subjects', 'question', 'correctAnswer', 'addQuestion', 'storageUsed', 'exportCsv', 'noRequests', 'noNotes', 'addDirector', 'assignStudents', 'viewNotes', 'announcement', 'saveSettings', 'postAnnouncement', 'noAnnouncements', 'revenue', 'totalStudents', 'packageActive', 'averageScore', 'payments', 'myRequests', 'noQuestions', 'questions', 'paymentReceived', 'manageStudents', 'overview', 'reports', 'settings', 'admin', 'logout'];
const out = {};
for (const [lang, [a, b]] of Object.entries(langs)) {
  const block = t.slice(a, b);
  out[lang] = {};
  for (const k of keys) {
    const m = block.match(new RegExp(`(?:^|[\\s{,])${k}\\s*:\\s*(['"])(.*?)\\1\\s*[,;]`));
    if (m) out[lang][k] = m[2];
  }
}
for (const k of keys) {
  console.log(k + ' | en=' + (out.en[k] ?? '—') + ' | om=' + (out.om[k] ?? '—') + ' | am=' + (out.am[k] ?? '—') + ' | so=' + (out.so[k] ?? '—'));
}

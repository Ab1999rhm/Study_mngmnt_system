const fs = require('fs');
const t = fs.readFileSync('src/i18n.js', 'utf8');
const need = ['days', 'remedial', 'active', 'inactive', 'email', 'name', 'points', 'grade', 'actions', 'details', 'search', 'all', 'pending', 'approved', 'rejected', 'free', 'locked', 'hidden', 'hide', 'unhide', 'clone', 'preview', 'upload', 'questions', 'noQuestions', 'question', 'correctAnswer', 'addQuestion', 'storageUsed', 'exportCsv', 'openPackage', 'deleteStudent', 'resetPassword', 'myRequests', 'noRequests', 'noNotes', 'addDirector', 'assignStudents', 'viewNotes', 'announcement', 'saveSettings', 'postAnnouncement', 'noAnnouncements', 'revenue', 'totalStudents', 'packageActive', 'averageScore', 'students', 'status', 'school', 'payments', 'fee', 'chapter', 'score', 'subjects', 'subject', 'admin', 'logout', 'manageStudents', 'manageUploads', 'managePackages', 'directors', 'overview', 'reports', 'settings', 'unpaid', 'paid', 'expired', 'paymentReceived'];
const missing = need.filter(k => !new RegExp('(?:^|[\\s{,])' + k + '\\s*:').test(t));
console.log('MISSING keys: ' + (missing.join(', ') || 'none'));
for (const dead of ['enterCode', 'redeem', 'codeInvalid', 'codeSuccess', 'revoke', 'revoked', 'expiresIn', 'addStudent', 'editStudent', 'statusFilter', 'manageCodes']) {
  const c = (t.match(new RegExp('(?:^|[\\s{,])' + dead + '\\s*:', 'g')) || []).length;
  console.log('key ' + dead + ': ' + c + ' definitions');
}
// show a sample of existing en entries to learn style
const en = t.slice(t.indexOf('const en'), t.indexOf('const om'));
console.log('--- en block size:', en.length, 'lines:', en.split('\n').length);
console.log(en.split('\n').slice(0, 8).join('\n'));

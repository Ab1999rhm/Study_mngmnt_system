// Headless smoke test: loads each route and reports missing markers + console errors.
const { execFileSync } = require('child_process');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/seed-test.html';

const ROUTES = [
  { hash: '#/', user: 'none', name: 'landing-desktop', must: ['l-header', 'l-hero', 'l-footer', 'Small steps every day', 'How it works', 'Inspiration', 'l-hero-slide', 'l-hero-dots', 'fikaduabraham093@gmail.com', 'Telegram: @maalgodhu', 'auth?mode=login'], mustNot: ['🇬🇧 EN', 'l-foot-langs', 'support@ssa.local', 'Company'] },
  { hash: '#/landing-mobile', user: 'none', name: 'landing-mobile-375px', viewport: '375,812', must: ['l-header', 'l-hero', 'l-footer', 'Small steps every day'] },
  { hash: '#/landing-tablet', user: 'none', name: 'landing-tablet-768px', viewport: '768,1024', must: ['l-grades', 'l-feat-grid'] },
  { hash: '#/auth', user: 'none', name: 'auth-page', must: ['auth-wrap', 'auth-card', 'auth-logo', 'Register'], mustNot: ['Demo accounts', 'auth-hero', 'Offline PWA', 'role-tabs', 'Admin'] },
  { hash: '#/auth?mode=login', user: 'none', name: 'auth-login-mode', must: ['auth-wrap', 'auth-card', 'Access your dashboard', 'Login'], mustNot: ['Ayaan Ali', 'School Director', 'Create your personal learning dashboard'] },
{ hash: '#/auth?mode=forgot', user: 'none', name: 'auth-forgot-mode', must: ['auth-wrap', 'auth-card', 'Forgot password', 'Enter your email to request a password reset', 'Send reset request'], mustNot: ['Create your personal learning dashboard', 'Access your dashboard'] },
  { hash: '#/landing-am', user: 'none', lang: 'am', name: 'landing-amharic', must: ['የእለት ትንንሽ ጥራት', 'l-footer', 'l-hero'] },
  { hash: '#/landing-om', user: 'none', lang: 'om', name: 'landing-afaan-oromoo', must: ['Gantaleen guyyuu', 'l-footer', 'l-hero'] },
  { hash: '#/landing-so', user: 'none', lang: 'so', name: 'landing-somali', must: ['Tallaabooyinka yaryar', 'l-footer', 'l-hero'] },
  { hash: '#/student', user: 'stu_test', must: ['stat', 'Recent', 'mastery', 'Mid-term exams'], name: 'student-overview' },
  { hash: '#/student/learn', user: 'stu_test', must: ['AI Tutor', 'subject-card', 'real AI, offline backup', 'welcome'], name: 'student-learn' },
  { hash: '#/student/learn', user: 'stu_2', must: ['AI study is not activated yet'], mustNot: ['Pick a subject', 'Google Gemma 2 2B'], name: 'student-ai-locked' },
  { hash: '#/student/library', user: 'stu_test', must: ['library', 'Test Book'], name: 'student-library' },
  { hash: '#/student/materials', user: 'stu_test', must: ['Learning materials', 'Test Notes'], name: 'student-materials' },
  { hash: '#/student/exams', user: 'stu_test', must: ['Full Mock Exam', 'Test Model Exam', 'Playable Quiz'], name: 'student-exams' },
  { hash: '#/student/videos', user: 'stu_test', must: ['Video Hub', 'Test Video'], name: 'student-videos' },
  { hash: '#/student/store', user: 'stu_2', must: ['How to pay', 'Pay fee', 'Pay to unlock', 'Test Video', 'My payment requests', '+251 91 111 2233', 'Full access — 30 days'], mustNot: ['Enter your access code', 'Redeem'], name: 'student-store' },
  { hash: '#/student/plan', user: 'stu_test', must: ['Study Schedule'], name: 'student-plan' },
  { hash: '#/student/learn/Mathematics/1', user: 'stu_test', must: ['Welcome to Mathematics', 'Study Timetable'], name: 'student-lesson-ai' },
  { hash: '#/admin', user: 'adm_t', must: ['Directors', 'per grade', 'nav-burger'], name: 'admin-overview' },
  { hash: '#/admin/students', user: 'adm_t', must: ['Test School', 'Joined', '🤖 On', '🤖 Off', 'Export CSV'], mustNot: ['Add student'], name: 'admin-students' },
  { hash: '#/admin/uploads', user: 'adm_t', must: ['Upload new content', 'Test Book', 'Make free', 'Model Exam', '✏️ Edit', 'All types', 'Storage used', 'Preview', 'Duplicate'], name: 'admin-uploads' },
  { hash: '#/admin/packages', user: 'adm_t', must: ['Close package', 'Open Package', 'Add plan'], name: 'admin-packages' },
  { hash: '#/admin/payments', user: 'adm_t', must: ['Payment requests', 'Password reset requests', 'Revenue', 'Reject', 'Approve &'], mustNot: ['Generate access code', 'XYZ789', 'Approve and create code', 'Revoke', 'Expires in', 'Enter your access code'], name: 'admin-codes' },
  { hash: '#/admin/reports', user: 'adm_t', must: ['Mathematics', 'Chapter 1', 'Export CSV'], name: 'admin-reports' },
  { hash: '#/admin/directors', user: 'adm_t', must: ['director@ssa.local', 'Add director', 'Assign students', 'View notes'], name: 'admin-directors' },
  { hash: '#/admin/settings', user: 'adm_t', must: ['Payment phone', '91 111 2233', 'Announcement', 'Save settings', 'My account', 'Current password', 'Save account'], name: 'admin-settings' },
  { hash: '#/director', user: 'dir_t', must: ['engagement', 'per grade'], name: 'director-overview' },
  { hash: '#/director/students', user: 'dir_t', must: ['Test School', 'Active'], name: 'director-students' },
  { hash: '#/director/follow', user: 'dir_t', must: ['Select student', 'choose'], name: 'director-follow' },
  { hash: '#/director/analytics', user: 'dir_t', must: ['Score trend', 'Mathematics'], name: 'director-analytics' },
  { hash: '#/student', user: 'stu_test', lang: 'am', must: ['ዳሽቦርድ', 'የጥናት ዕቅድ'], name: 'lang-amharic' },
  { hash: '#/student', user: 'stu_test', lang: 'om', must: ['Gabatee', 'Kutaa 8'], name: 'lang-afaan-oromoo' },
  { hash: '#/student', user: 'stu_test', lang: 'so', must: ['Xarunta', 'Fasal 8'], name: 'lang-somali' }
];

let pass = 0, fail = 0;
const failures = [];

for (const r of ROUTES) {
  const params = new URLSearchParams({ user: r.user });
  if (r.lang) params.set('lang', r.lang);
  const full = `${BASE}?${params}${r.hash}`;
  const out = `test_${r.name}.html`;
  const err = `test_${r.name}.err`;
  const args = [
    '--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=9000',
    '--enable-logging=stderr', '--v=0'
  ];
  if (r.viewport) args.push(`--window-size=${r.viewport}`);
  args.push('--dump-dom', full);
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    try {
      execFileSync(CHROME, args, { stdio: ['ignore', fs.openSync(out, 'w'), fs.openSync(err, 'w')], timeout: 60000 });
      ok = true;
    } catch (e) {
      if (attempt === 2) { failures.push(`${r.name}: chrome failed ${e.message}`); fail++; }
      else console.log(`RETRY ${r.name}`);
    }
  }
  if (!ok) continue;
  const dom = fs.readFileSync(out, 'utf8');
  const log = fs.readFileSync(err, 'utf8');
  const missing = r.must.filter(m => !dom.toLowerCase().includes(m.toLowerCase()));
  const forbidden = (r.mustNot || []).filter(m => dom.includes(m));
  const errors = (log.match(/CONSOLE.*ERROR|Uncaught|TypeError|ReferenceError/g) || []);
  if (missing.length === 0 && forbidden.length === 0 && errors.length === 0) { pass++; console.log(`PASS  ${r.name}`); }
  else {
    fail++;
    failures.push(`${r.name}: missing=[${missing.join(', ')}] forbidden=[${forbidden.join(', ')}] jsErrors=[${errors.join(', ')}]`);
    console.log(`FAIL  ${r.name} missing=[${missing}] forbidden=[${forbidden}] errors=[${errors}]`);
  }
  fs.unlinkSync(out); fs.unlinkSync(err);
}

console.log(`\n${pass} passed, ${fail} failed`);
failures.forEach(f => console.log(' - ' + f));
process.exit(fail ? 1 : 0);
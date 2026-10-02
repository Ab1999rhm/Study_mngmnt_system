const fs = require('fs');
const bcrypt = require('bcryptjs');
fs.copyFileSync('src/data/store.js', 'src/data/store-t.mjs');

const mem = {};
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => {
    const s = String(v);
    if (s.length > 5 * 1024 * 1024) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    mem[k] = s;
  },
  removeItem: k => { delete mem[k]; }
};

(async () => {
  const { store } = await import('./src/data/store-t.mjs');
  const assert = (name, cond) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name); if (!cond) process.exitCode = 1; };

  store.seedIfEmpty();
  assert('seed no longer creates built-in accounts', store.db.users.length === 0);

  const setup = store.createFirstAdmin({ fullName: 'Flow Admin', email: 'flowadmin@ssa.local', password: 'flowpw1' });
  assert('setup wizard creates first admin', setup.ok === true && setup.user.role === 'admin');
  assert('passwords stored as bcrypt hash, never plain', String(setup.user.password).startsWith('$2') && setup.user.password !== 'flowpw1');
  const admin = store.login('flowadmin@ssa.local', 'flowpw1');
  assert('admin login', admin && admin.role === 'admin');
  assert('setup idempotent: second call rejected', store.createFirstAdmin({ fullName: 'X', email: 'x@x.x', password: 'xxxxxx' }).ok === false);

  const dirRec = store.addDirector({ fullName: 'Flow Director', email: 'director@ssa.local', password: 'flowdirpw1' });
  assert('director created by admin', dirRec.ok === true && dirRec.user.role === 'director');
  const dir = store.login('director@ssa.local', 'flowdirpw1');
  assert('director login', dir && dir.role === 'director');

  const fix = store.addUpload({ type: 'material', title: 'Fixture Note', subject: 'Mathematics', grade: '8', price: 100, body: 'Fixture body' });
  assert('fixture upload created', fix.ok === true && store.uploads().length >= 1);

  const fc = store.generateCode({ plan: 'full', planLabel: 'Full access â€” all content', price: 1000 });
  assert('fixture full-access code unused', !!fc && !fc.usedBy);

  const stu = store.addStudent({ fullName: 'Flow Student', email: 'flow1@ssa.local', schoolName: 'Flow School', grade: '8', password: 'flowpw1' }).user;
  store.login('flow1@ssa.local', 'flowpw1');
  assert('fresh student starts locked', !!stu && store.hasAccess(stu) === false);

  const item = store.uploads()[0];
  assert('locked item denied', store.hasAccess(stu, item) === false);

  const req = store.createPayRequest(stu.id, { plan: 'item', itemId: item.id, planLabel: item.title, price: item.price });
  assert('pay request pending', store.payRequests().find(r => r.id === req.id).status === 'pending');

  store.approveRequest(req.id);
  assert('request approved', store.payRequests().find(r => r.id === req.id).status === 'approved');

  const rec = store.generateCode({ plan: 'item', itemId: item.id, planLabel: item.title, price: item.price });
  assert('code format valid', /^[A-Z]{3}[0-9]{3}$/.test(rec.code));

  assert('wrong code rejected', store.redeemCode(stu.id, 'ZZZ999').ok === false);
  const r1 = store.redeemCode(stu.id, rec.code);
  assert('code redeems', r1.ok === true);
  assert('item unlocked after redeem', store.hasAccess(stu, item) === true);
  const r2 = store.redeemCode(stu.id, rec.code);
  assert('single use: second redeem fails', r2.ok === false && r2.error === 'used');

  const other = store.addStudent({ fullName: 'Flow Two', email: 'flow2@ssa.local', grade: '9', password: 'flowpw2' }).user;
  const r3 = store.redeemCode(other.id, rec.code);
  assert('single user: other student fails', r3.ok === false);

  const full = store.codes().find(c => c.code === fc.code);
  const r4 = store.redeemCode(other.id, fc.code);
  assert('full-access code opens package', r4.ok === true && other.packageOpen === true);
  assert('full access grants every item', store.hasAccess(other, item) === true);
  assert('code now used', full.usedBy === other.id);

  const up = store.addUpload({ type: 'video', title: 'New Clip', subject: 'Science', grade: '8', link: 'https://example.com/v', price: 60 });
  assert('admin upload', up.ok === true && store.uploads()[0].title === 'New Clip');
  const upd = store.updateUpload(up.item.id, { title: 'Updated Clip', price: 75 });
  assert('admin update upload', upd && upd.title === 'Updated Clip' && upd.price === 75);
  store.updateUser(stu.id, { aiEnabled: false });
  assert('admin can toggle AI off', stu.aiEnabled === false);
  store.updateUser(stu.id, { aiEnabled: true });
  assert('new upload locked for student', store.hasAccess(stu, up.item) === false);

  store.toggleFree(up.item.id);
  assert('free toggle grants access', store.hasAccess(stu, up.item) === true);
  store.toggleFree(up.item.id);
  store.deleteUpload(up.item.id);
  assert('upload deleted', !store.uploads().some(u => u.id === up.item.id));

  const big = store.addUpload({ type: 'book', title: 'Big', price: 10, body: 'x'.repeat(6 * 1024 * 1024) });
  assert('oversized upload rejected', big.ok === false);

  // ---- gap-fix: request reject / code revoke / expiry ----
  const req2 = store.createPayRequest(stu.id, { plan: 'full', itemId: null, planLabel: 'Full', price: 500 });
  store.rejectRequest(req2.id);
  assert('request rejected', store.payRequests().find(x => x.id === req2.id).status === 'rejected');

  const rc = store.generateCode({ plan: 'full', planLabel: 'Full', price: 100, expiresInDays: 1 });
  assert('code expiry set', !!rc.expiresAt && Date.parse(rc.expiresAt) > Date.now());
  const rc0 = store.generateCode({ plan: 'full', planLabel: 'NoExpiry', price: 100 });
  assert('no expiry default', rc0.expiresAt === null);

  const rc2 = store.generateCode({ plan: 'full', planLabel: 'Revoked', price: 100 });
  store.revokeCode(rc2.code);
  const rr = store.redeemCode(stu.id, rc2.code);
  assert('revoked code rejected', rr.ok === false && rr.error === 'revoked');

  const rc3 = store.generateCode({ plan: 'full', planLabel: 'Expired', price: 100, expiresInDays: 5 });
  rc3.expiresAt = new Date(Date.now() - 1000).toISOString();
  const re = store.redeemCode(stu.id, rc3.code);
  assert('expired code rejected', re.ok === false && re.error === 'expired');

  // ---- gap-fix: hidden / clone / quiz questions ----
  const up2 = store.addUpload({ type: 'material', title: 'Hidden Note', price: 10 });
  store.toggleHidden(up2.item.id);
  assert('upload hidden', store.uploads().find(u => u.id === up2.item.id).hidden === true);
  const cl = store.cloneUpload(up2.item.id);
  assert('upload cloned', cl.ok && cl.item.title.includes('(copy)') && cl.item.hidden === false);

  const qz = [{ type: 'mcq', q: '2+2?', options: ['3', '4'], answer: '4' }];
  const upq = store.addUpload({ type: 'test', title: 'Quiz Roundtrip', questions: qz, price: 10 });
  assert('quiz questions saved', store.uploads().find(u => u.id === upq.item.id).questions.length === 1);
  const quizItem = store.uploads().find(u => u.id === upq.item.id);

  // ---- gap-fix: package plans + expiry ----
  assert('default packages seeded', store.packages().length >= 1);
  const p = store.addPackage({ name: 'Trial 7 days', price: 200, days: 7 });
  assert('package added', !!p && store.packages().some(x => x.id === p.id));
  store.updatePackage(p.id, { price: 250 });
  assert('package updated', store.packages().find(x => x.id === p.id).price === 250);

  const stuA = store.students()[0];
  store.updateUser(stuA.id, { packageOpen: true, packageExpires: new Date(Date.now() + 86400000).toISOString() });
  assert('package active within days', store.hasAccess(stuA, quizItem) === true);
  store.updateUser(stuA.id, { packageExpires: new Date(Date.now() - 1000).toISOString() });
  assert('package expired blocks access', store.hasAccess(stuA, quizItem) === false);

  // ---- gap-fix: director + student CRUD ----
  const nd = store.addDirector({ fullName: 'New Dir', email: 'ndir@x.y', schoolName: 'S2', password: 'pw123456' });
  assert('director added', nd.ok && nd.user.role === 'director');
  const dupDir = store.addDirector({ fullName: 'Dup', email: 'ndir@x.y' });
  assert('duplicate email rejected', dupDir.ok === false);
  store.assignStudents(nd.user.id, [stuA.id]);
  assert('student assigned', store.db.users.find(u => u.id === stuA.id).directorId === nd.user.id);
  store.updateUser(nd.user.id, { active: false });
  assert('deactivated cannot login', store.login('ndir@x.y', 'pw123456') === null);
  store.updateUser(nd.user.id, { active: true });
  assert('reactivated can login', store.login('ndir@x.y', 'pw123456') !== null);
  store.removeUser(nd.user.id);
  assert('dangling directorId cleared', store.db.users.find(u => u.id === stuA.id).directorId == null);

  const ns = store.addStudent({ fullName: 'New Kid', email: 'newkid@x.y', grade: '7', password: 'kidpw1' });
  assert('student added', ns.ok && ns.user.role === 'student');
  const ns2 = store.addStudent({ fullName: 'Dup Kid', email: 'newkid@x.y' });
  assert('duplicate student email rejected', ns2.ok === false);
  store.updateUser(ns.user.id, { active: false });
  assert('inactive student blocked from login', store.login('newkid@x.y', 'kidpw1') === null);

  // ---- gap-fix: settings + announcements + stats ----
  store.updateSettings({ payPhone: '+251 900 000 000' });
  assert('settings phone updated', store.settings().payPhone === '+251 900 000 000');
  const an = store.addAnnouncement('Hello students');
  assert('announcement posted', an && store.announcements()[0].id === an.id);
  store.deleteAnnouncement(an.id);
  assert('announcement deleted', store.announcements().length === 0);

  assert('revenue total positive', typeof store.revenueTotal() === 'number' && store.revenueTotal() > 0);
  assert('item stats shape', typeof store.itemStats(quizItem.id).unlocked === 'number');
  assert('storage used reports bytes', store.storageUsed() > 1000);

  // ---- forgot password: student asks, admin approves, student sets own password ----
  const fr = store.requestPasswordReset('flow1@ssa.local');
  assert('forgot: student request pending', fr.ok === true && fr.status === 'pending');
  const fr2 = store.requestPasswordReset('nobody@x.y');
  assert('forgot: unknown email rejected', fr2.ok === false);
  assert('forgot: reset blocked while pending', store.setResetPassword('flow1@ssa.local', 'NewPass456') === null);
  const ap = store.approveResetRequest(fr.request.id);
  assert('forgot: admin approves request', !!ap && ap.status === 'approved');
  const setu = store.setResetPassword('flow1@ssa.local', 'NewPass456');
  assert('forgot: student sets new password (stored hashed)', !!setu && bcrypt.compareSync('NewPass456', setu.password));
  assert('forgot: old password rejected', store.login('flow1@ssa.local', 'flowpw1') === null);
  const relog = store.login('flow1@ssa.local', 'NewPass456');
  assert('forgot: new password works', !!relog && relog.id === stu.id);
  const doneReq = store.resetRequests().find(x => x.studentId === stu.id);
  assert('forgot: request marked done', !!doneReq && doneReq.status === 'done');
  const ar = store.adminAllowReset('flow2@ssa.local');
  assert('forgot: admin allow creates approved request', !!ar && ar.status === 'approved');
  const set2 = store.setResetPassword('flow2@ssa.local', 'Chosen99');
  assert('forgot: immediate set after admin allow (stored hashed)', !!set2 && bcrypt.compareSync('Chosen99', set2.password));

  // ---- workflow mismatch fixes ----
  const gItem = store.addUpload({ type: 'material', title: 'Grant Item', subject: 'Mathematics', grade: '8', price: 50, body: 'Grant body' });
  const codesBefore = store.codes().length;
  const gReq = store.createPayRequest(stu.id, { plan: 'item', itemId: gItem.item.id, planLabel: 'Grant Item', price: 50 });
  const gRes = store.approveAndGrant(gReq.id);
  assert('#1 approve grants item access', !!gRes && gRes.granted && gRes.request.status === 'approved' && store.hasAccess(stu, gItem.item) === true);
  assert('#1 approve needs no code', !!gRes && gRes.code == null && store.codes().length === codesBefore);
  const gReq2 = store.createPayRequest(stu.id, { plan: 'full', planLabel: 'Full access', price: 1000 });
  const gRes2 = store.approveAndGrant(gReq2.id);
  const stuNow = store.db.users.find(u => u.id === stu.id);
  assert('#1 full payment opens package', !!gRes2 && gRes2.granted && stuNow.packageOpen === true);

  store.closePackage(stuA.id);
  const opn = store.openPackage(stuA.id);
  assert('#2 openPackage sets expiry', opn.packageOpen === true && !!opn.packageExpires && Date.parse(opn.packageExpires) > Date.now());
  assert('#2 full redeem sets expiry', !!other.packageExpires);

  const bkid = store.addStudent({ fullName: 'Blocked Kid', email: 'blocked@x.y', password: 'kidpw1' }).user;
  store.updateUser(bkid.id, { active: false });
  const la = store.loginWithReason('blocked@x.y', 'kidpw1');
  assert('#5 blocked login reports blocked', la.user === null && la.reason === 'blocked');
  const la2 = store.loginWithReason('blocked@x.y', 'wrongpw');
  assert('#5 wrong password reports invalid', la2.user === null && la2.reason === 'invalid');
  store.updateUser(bkid.id, { active: true });
  const la3 = store.loginWithReason('blocked@x.y', 'kidpw1');
  assert('#5 unblocked login works', !!la3.user && la3.reason === 'ok');

  assert('#3/#4 grade all visible', store.gradeVisible({ grade: '8' }, { grade: 'all' }) === true);
  assert('#3/#4 matching grade visible', store.gradeVisible({ grade: '8' }, { grade: '8' }) === true);
  assert('#3/#4 other grade hidden', store.gradeVisible({ grade: '8' }, { grade: '12' }) === false);

  const dNew = store.addDirector({ fullName: 'Grace Director', email: 'grace@x.y', password: 'gracepw1' }).user;
  store.assignStudents(dNew.id, [stu.id]);
  assert('#7 directorName synced on assign', store.db.users.find(u => u.id === stu.id).directorName === 'Grace Director');
  store.assignStudents(dNew.id, []);
  assert('#7 directorName cleared on unassign', store.db.users.find(u => u.id === stu.id).directorName == null);

  store.addAnnouncement('Second notice');
  store.addAnnouncement('Third notice');
  assert('#8 multiple announcements kept', store.announcements().length === 2 && store.announcements()[0].text === 'Third notice');

  const studyMod = await import('./src/data/study.js');
  const sample = [
    '1. Introduction',
    'Mathematics is the study of numbers and shapes. Students learn patterns carefully every day.',
    'Chapter 2: Algebra',
    'Algebra uses letters to stand for unknown values. Solving equations takes practice and patience.',
    'The quick brown fox jumps over the lazy dog near the river bank while children watch happily.'
  ].join('\n');
  const bk = studyMod.parseBook(sample);
  assert('study: chapters split into sections', bk.sections.length >= 2 && /Introduction/.test(bk.sections[0].title || ''));
  assert('study: pages + time estimate built', bk.pages >= 2 && bk.estMin >= 1);
  const sQ = studyMod.makeQuestions(bk.sections[1]);
  assert('study: auto questionnaire built', sQ.length >= 1 && sQ[0].options.length >= 3 && sQ[0].options.includes(sQ[0].answer) && sQ[0].q.includes('______'));
  const sK = studyMod.keyPoints(bk.sections[1]);
  assert('study: capture key points extracted', sK.length >= 1);
  const flat = studyMod.parseBook('One paragraph note about verbs and tenses. Second sentence explains usage clearly in class.');
  assert('study: plain note gets fallback sections', flat.sections.length >= 1 && flat.pages >= 1);
  store.setProgress(stu.id, 'study:up_probe', { sec: 1, done: [0], phase: 'read' });
  const sBack = store.db.users.find(u => u.id === stu.id).progress['study:up_probe'];
  assert('study: progress persists on student', !!sBack && sBack.sec === 1 && sBack.done.length === 1 && sBack.phase === 'read');

  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const bImg = studyMod.buildBook({ title: 'Shots', fileName: 'notes.png', body: 'A short description of the screenshot.', fileData: png });
  assert('study: uploaded image becomes first section', bImg.sections[0].media && bImg.sections[0].media.kind === 'image' && bImg.sections.length === 2);
  const bImgOnly = studyMod.buildBook({ title: 'Shot', fileName: 'shot.png', body: '', fileData: png });
  assert('study: image-only upload gets single section', bImgOnly.sections.length === 1 && bImgOnly.sections[0].media.kind === 'image' && bImgOnly.pages === 1);
  const txtData = 'data:text/plain;base64,' + Buffer.from('Photosynthesis converts light energy into chemical energy stored in glucose molecules for plant growth.').toString('base64');
  const bTxt = studyMod.buildBook({ title: 'Notes', fileName: 'bio.txt', body: '', fileData: txtData });
  assert('study: text file decoded into study content', bTxt.words > 10 && bTxt.sections.length >= 1 && !bTxt.sections[0].media);
  assert('study: media kinds detected', studyMod.mediaKind(png) === 'image' && studyMod.mediaKind('data:application/pdf;base64,JVB') === 'pdf' && studyMod.mediaKind('data:video/mp4;base64,x') === 'video' && studyMod.mediaKind(null) === null);

  // ---- payment flow rework: selected package only + auto-approve + close ----
  const pk7 = store.addPackage({ name: 'Select 7 days', price: 500, days: 7 });
  assert('selected package added', !!pk7 && store.packages().some(x => x.id === pk7.id));
  const selReq = store.createPayRequest(other.id, { plan: 'full', planLabel: 'Select 7 days', price: 500, packageId: pk7.id, days: 7 });
  assert('request stores selected packageId', !!store.payRequests().find(r => r.id === selReq.id).packageId);
  const oth = store.db.users.find(u => u.id === other.id);
  store.openPackage(other.id);
  const selRow = store.payRequests().find(r => r.id === selReq.id);
  assert('open: only the selected package opens with its days', oth.packageOpen === true && oth.packagePlan && oth.packagePlan.id === pk7.id && Date.parse(oth.packageExpires) <= Date.now() + 7 * 86400000 + 60000 && Date.parse(oth.packageExpires) > Date.now() + 6 * 86400000);
  assert('open: pending request auto-approved', selRow.status === 'approved');
  assert('open: student never left pending', store.payRequests().every(r => !(r.studentId === other.id && r.plan === 'full' && r.status === 'pending')));
  const payCntBefore = store.payRequests().length;
  store.approveAndGrant(selReq.id);
  assert('approve is idempotent, creates nothing', store.payRequests().length === payCntBefore && store.codes().length === codesBefore);
  store.closePackage(other.id);
  assert('close: package closed immediately', oth.packageOpen === false && oth.packageExpires == null && !oth.packagePlan && store.hasAccess(oth, item) === false);

  // ---- account management ----
  const pw1 = store.setUserPassword(stu.id, 'newpass123');
  assert('setUserPassword stores bcrypt hash', pw1.ok === true && bcrypt.compareSync('newpass123', store.db.users.find(u => u.id === stu.id).password));
  const pw2 = store.setUserPassword(stu.id, 'abc');
  assert('setUserPassword rejects short password', pw2.ok === false && bcrypt.compareSync('newpass123', store.db.users.find(u => u.id === stu.id).password));
  const admId = store.db.users.find(u => u.role === 'admin').id;
  const apBad = store.updateAdminProfile({ userId: admId, fullName: 'Renamed Admin', currentPw: 'wrong-pw', newPw: 'brandnew99' });
  assert('updateAdminProfile rejects wrong current password', apBad.ok === false && bcrypt.compareSync('flowpw1', store.db.users.find(u => u.id === admId).password));
  const apOk = store.updateAdminProfile({ userId: admId, fullName: 'Renamed Admin', email: 'admin.renamed@ssa.local' });
  assert('updateAdminProfile updates name/email', apOk.ok === true && store.db.users.find(u => u.id === admId).fullName === 'Renamed Admin');
  const apDup = store.updateAdminProfile({ userId: admId, email: 'director@ssa.local' });
  assert('updateAdminProfile rejects duplicate email', apDup.ok === false);

  const dTmp = store.addDirector({ fullName: 'Temp Dir', email: 'tmpdir@x.y', schoolName: 'S3', password: 'pw123456' }).user;
  store.assignStudents(dTmp.id, [stuA.id]);
  const delOk = store.deleteDirector(dTmp.id);
  assert('deleteDirector removes director and unassigns students', delOk === true && !store.db.users.some(u => u.id === dTmp.id) && store.db.users.find(u => u.id === stuA.id).directorId == null);

  fs.unlinkSync('src/data/store-t.mjs');
  console.log(process.exitCode ? '\nFLOW TEST FAILED' : '\nALL FLOW TESTS PASSED');
})().catch(e => { console.error('ERROR', e); process.exit(1); });


const fs = require('fs');
const F = 'src/AdminDashboard.jsx';
let src = fs.readFileSync(F, 'utf8');
let pass = 0, fail = [];

function rep(find, replace, count) {
  const parts = src.split(find);
  const got = parts.length - 1;
  if (got !== count) { fail.push(`count ${got}!=${count} :: ${find.slice(0, 90)}`); return; }
  src = parts.join(replace);
  pass++;
}

// ---- A. sidebar / chrome ----
rep(`{ label: 'Management', keys: ['overview', 'students'] }`, `{ label: 'navGrpManagement', keys: ['overview', 'students'] }`, 1);
rep(`{ label: 'Store & Sales', keys: ['uploads', 'packages', 'payments'] }`, `{ label: 'navGrpStore', keys: ['uploads', 'packages', 'payments'] }`, 1);
rep(`{ label: 'Data & People', keys: ['reports', 'directors', 'settings'] }`, `{ label: 'navGrpData', keys: ['reports', 'directors', 'settings'] }`, 1);
rep(`<div className="grp">{g.label}</div>`, `<div className="grp">{t(g.label)}</div>`, 1);
rep(`aria-label="Menu"`, `aria-label={t('ariaMenu')}`, 1);
rep(`aria-label="Close"`, `aria-label={t('closeLabel')}`, 1);
rep(`<div className="user"><b>{me.fullName}</b>Administrator</div>`, `<div className="user"><b>{me.fullName}</b>{t('roleAdmin')}</div>`, 1);

// ---- B. upload messages ----
rep(`setUpMsg('❌ File too large — max 4 MB. For big files, paste a Link instead.');`, `setUpMsg(t('upFileTooLarge'));`, 1);
rep(`setUpMsg('❌ Storage almost full — ' + (free / 1048576).toFixed(1) + ' MB left of 5 MB. Use a Link for this file, or delete old uploads.');`, `setUpMsg(t('upStorageFull', { free: (free / 1048576).toFixed(1) }));`, 1);
rep(`setUpMsg('❌ Could not read that file');`, `setUpMsg(t('upReadFail'));`, 1);
rep(`setUpMsg('❌ Update failed');`, `setUpMsg(t('upUpdateFail'));`, 1);
rep(`setUpMsg('✅ Updated "' + res.title + '"');`, `setUpMsg(t('upUpdated', { title: res.title }));`, 1);
rep(`setUpMsg('✅ Uploaded "' + res.item.title + '" — students must pay to open it.');`, `setUpMsg(t('upUploaded', { title: res.item.title }));`, 1);
rep(`setUpMsg('❌ Question needs text, at least 2 options, and a non-empty correct answer');`, `setUpMsg(t('upQuestionNeed'));`, 1);

// ---- C. bulk / flashes ----
rep(`const FIELD_LABELS = { aiEnabled: 'AI', packageOpen: 'package', active: 'login', points: 'points', grade: 'grade', directorId: 'director' };`,
    `const FIELD_LABELS = { aiEnabled: t('aiWord'), packageOpen: t('packageWord'), active: t('loginWord'), points: t('points'), grade: t('grade'), directorId: t('directorWord') };`, 1);
rep(`flash('Updated ' + Object.keys(patch).map(k => FIELD_LABELS[k] || k).join(', ') + ' for ' + sel.length + ' student(s)');`,
    `flash(t('bulkUpdated', { fields: Object.keys(patch).map(k => FIELD_LABELS[k] || k).join(', '), n: sel.length }));`, 1);
rep(`flash('Director added — ' + res.user.email + ' / ' + res.user.password);`, `flash(t('directorAdded') + ' — ' + res.user.email + ' / ' + res.user.password);`, 1);
rep(`flash('Director updated');`, `flash(t('directorUpdated'));`, 1);
rep(`flash('Students assigned');`, `flash(t('studentsAssigned'));`, 1);
rep(`flash('Settings saved — Store page now shows ' + payPhone.trim());`, `flash(t('settingsSaved', { phone: payPhone.trim() }));`, 1);
rep(`flash('Announcement text required', false)`, `flash(t('annRequired'), false)`, 1);
rep(`flash('Announcement posted to all students');`, `flash(t('annPosted'));`, 1);
rep(`flash('Name and email are required', false)`, `flash(t('nameEmailRequired'), false)`, 1);
rep(`flash('New password must be at least 6 characters', false)`, `flash(t('newPwTooShort'), false)`, 1);
rep(`flash('Account updated — ' + res.user.email);`, `flash(t('accountUpdated') + ' — ' + res.user.email);`, 1);
rep(`flash('Plan name required', false)`, `flash(t('planNameRequired'), false)`, 1);
rep(`flash(pkgEditId ? 'Plan updated' : 'Plan added');`, `flash(pkgEditId ? t('planUpdated') : t('planAdded'));`, 1);
rep(`flash(s.active === false ? 'Student activated — can log in again' : 'Student blocked from login');`,
    `flash(s.active === false ? t('studentActivated') : t('studentBlocked'));`, 1);
rep(`const pw = window.prompt('Set a new password for ' + d.email + '\\nMinimum 6 characters:');`,
    `const pw = window.prompt(t('promptSetPw', { email: d.email }));`, 1);
rep(`if (res.ok) flash('Password set — ' + d.email + ' can now log in');`, `if (res.ok) flash(t('pwSetLogin', { email: d.email }));`, 1);
rep(`if (!window.confirm('Delete director "' + d.fullName + '"?' + (n ? ' Their ' + n + ' student(s) will be unassigned.' : ''))) return;`,
    `if (!window.confirm(t('confirmDeleteDir', { name: d.fullName }) + (n ? ' ' + t('confirmDeleteDirUnassign', { n }) : ''))) return;`, 1);
rep(`flash('Director deleted' + (n ? ' — ' + n + ' student(s) unassigned' : ''));`,
    `flash(t('directorDeleted') + (n ? ' — ' + t('dirUnassignedTail', { n }) : ''));`, 1);
rep(`      flash(req.plan === 'full'\n        ? '✅ Payment confirmed — package opened for ' + (st ? st.fullName : 'the student') + ' (no code needed)'\n        : '✅ Payment confirmed — item unlocked for ' + (st ? st.fullName : 'the student'));`,
    `      const who = st ? st.fullName : t('theStudent');\n      flash(req.plan === 'full' ? t('approveFullMsg', { name: who }) : t('approveItemMsg', { name: who }));`, 1);
rep(`flash('Request approved');`, `flash(t('requestApproved'));`, 1);
rep(`.map(([g, n]) => ({ name: g === 'remedial' ? 'Remedial' : 'G' + g, students: n }))`,
    `.map(([g, n]) => ({ name: g === 'remedial' ? t('remedial') : 'G' + g, students: n }))`, 1);

// ---- D. overview ----
rep("title={`👥 ${t('totalStudents')} per grade`} sub=\"Distribution across the platform\"",
    "title={`👥 ${t('totalStudents')} ${t('perGrade')}`} sub={t('distributionSub')}", 1);
rep(`>🆕 Latest registrations</h3>`, `>🆕 {t('latestRegistrations')}</h3>`, 1);
rep(`<th>Joined</th>`, `<th>{t('joinedLabel')}</th>`, 2);
rep(`Joined{sortArrow('joined')}`, `{t('joinedLabel')}{sortArrow('joined')}`, 1);
rep(`>No students registered yet</td>`, `>{t('noStudentsRegistered')}</td>`, 1);

// ---- E. students tab ----
rep(`placeholder="Name, school, email…"`, `placeholder={t('phNameSchoolEmail')}`, 1);
rep(`<option key={g} value={String(g)}>Grade {g}</option>`, `<option key={g} value={String(g)}>{t('grade')} {g}</option>`, 4);
rep(`<option value="blocked">⛔ Blocked</option>`, `<option value="blocked">⛔ {t('blockedLabel')}</option>`, 1);
rep(`<b>{sel.length} selected:</b>`, `<b>{sel.length} {t('selectedColon')}</b>`, 1);
rep(`}>🔒 Close package</button>`, `}>🔒 {t('closePackage')}</button>`, 1);
rep(`window.confirm('Block login for ' + sel.length + ' selected student(s)?')`, `window.confirm(t('confirmBlockN', { n: sel.length }))`, 1);
rep(`}>⛔ Block</button>`, `}>⛔ {t('blockBtn')}</button>`, 1);
rep(`}>✅ Unblock</button>`, `}>✅ {t('unblockBtn')}</button>`, 1);
rep(`}>⬇️ Export selected</button>`, `}>⬇️ {t('exportSelected')}</button>`, 1);
rep(`>⛔ Blocked</span>`, `>⛔ {t('blockedLabel')}</span>`, 1);
rep(`>No students match</td>`, `>{t('noStudentsMatch')}</td>`, 1);

// ---- F. packages tab ----
rep(`placeholder="Full access — 30 days"`, `placeholder={t('phPlanName')}`, 1);
rep(`<label>{t('days') || 'Days'}</label>`, `<label>{t('days')}</label>`, 1);
rep(`<th>{t('days') || 'Days'}</th>`, `<th>{t('days')}</th>`, 1);
rep(`{pkgEditId ? '💾 Save' : '➕ Add plan'}`, `{pkgEditId ? '💾 ' + t('saveBtn') : '➕ ' + t('addPlan')}`, 1);
rep(`>✕ Cancel</button>`, `>✕ {t('cancelBtn')}</button>`, 4);
rep(`>✏️ Edit</button>`, `>✏️ {t('editBtn')}</button>`, 3);
rep(`window.confirm('Delete plan "' + p.name + '"? Students with this plan are not affected.')`, `window.confirm(t('confirmDeletePlan', { name: p.name }))`, 1);
rep(`>No plans yet — add one above</td>`, `>{t('noPlansYet')}</td>`, 1);
rep(`<th>Expires</th>`, `<th>{t('expiresTh')}</th>`, 1);
rep(`{pkgActive(s) ? 'Close package' : '🔓 ' + t('openPackage')}`, `{pkgActive(s) ? t('closePackage') : '🔓 ' + t('openPackage')}`, 1);
rep(`>No students yet</td>`, `>{t('noStudentsYet')}</td>`, 1);

// ---- G. uploads tab ----
rep(`{editId ? '✏️ Edit content' : '📤 Upload new content for students'}`, `{editId ? t('editContent') : t('uploadNew')}`, 1);
rep(`                  Textbooks, notes, videos, library items, tests and model exams — everything stays <b>locked</b> until the student pays the fee and the admin opens their access.`,
    `                  {t('uploadsIntro')}`, 1);
rep(`<label>Type</label>`, `<label>{t('typeLabel')}</label>`, 2);
rep(`<option value="book">📕 Textbook</option>`, `<option value="book">{t('typeBook')}</option>`, 2);
rep(`<option value="material">📝 Notes / material</option>`, `<option value="material">{t('typeMaterialFull')}</option>`, 1);
rep(`<option value="material">📝 Notes</option>`, `<option value="material">{t('typeMaterialShort')}</option>`, 1);
rep(`<option value="video">🎬 Video</option>`, `<option value="video">{t('typeVideo')}</option>`, 2);
rep(`<option value="library">📚 Library item</option>`, `<option value="library">{t('typeLibraryFull')}</option>`, 1);
rep(`<option value="library">📚 Library</option>`, `<option value="library">{t('typeLibraryShort')}</option>`, 1);
rep(`<option value="test">🧪 Test / Quiz</option>`, `<option value="test">{t('typeTestFull')}</option>`, 1);
rep(`<option value="test">🧪 Test</option>`, `<option value="test">{t('typeTestShort')}</option>`, 1);
rep(`<option value="exam">📋 Model Exam</option>`, `<option value="exam">{t('typeExam')}</option>`, 2);
rep(`<label>Title *</label>`, `<label>{t('labelTitle')}</label>`, 1);
rep(`<label>Subject</label>`, `<label>{t('labelSubject')}</label>`, 1);
rep(`<label>Grade</label>`, `<label>{t('grade')}</label>`, 1);
rep(`<option value="all">All grades</option>`, `<option value="all">{t('allGrades')}</option>`, 1);
rep(`<option value="remedial">Remedial</option>`, `<option value="remedial">{t('remedial')}</option>`, 1);
rep(`<label>Price (ETB)</label>`, `<label>{t('priceLabel')} (ETB)</label>`, 1);
rep(`<label>Access</label>`, `<label>{t('accessLabel')}</label>`, 1);
rep(`🆓 Free for everyone (skip payment)`, `{t('freeForEveryone')}`, 1);
rep(`<label>File (≤ 4 MB — PDF, Word, slides, image, audio, video)</label>`, `<label>{t('labelFile')}</label>`, 1);
rep(`<label>Link URL (video / online book / website)</label>`, `<label>{t('labelLinkUrl')}</label>`, 1);
rep(`<label>Attachment</label>`, `<label>{t('labelAttachment')}</label>`, 1);
rep(`: 'No file selected'}`, `: t('noFileSelected')}`, 1);
rep(`<label>Content text (for notes/books without a link — students read it inside the app)</label>`, `<label>{t('labelContentText')}</label>`, 1);
rep(`? '🎬 Video — paste a YouTube/Drive link in the Link field (best for big videos), or attach a video file (≤ 4 MB) that plays inside the app.'`, `? t('hintVideo')`, 1);
rep(`? '🧪 Test / Model Exam — build the questions below; you can also attach a PDF/image with instructions.'`, `? t('hintTest')`, 1);
rep(`? '📚 Library — attach a book file (PDF/EPUB/Word), paste a link, or paste the text below. Attached files and text open inside the guided study view.'`, `? t('hintLibrary')`, 1);
rep(`: '📖 Textbook / Notes — attach a file (PDF, Word, slides, image — ≤ 4 MB), paste a link, or write the content below. Attached images, screenshots, PDFs and text files open inside the guided study view. Tip: in written content, start headings with numbers (1., 1.1), #, ALL CAPS or a colon — students then get a guided study plan (chapters, page-by-page reading, capture-in-mind, questions, self-explanation).'}`,
    `: t('hintTextbook')}`, 1);
rep(`Option {String.fromCharCode(65 + i)}{qDraft.a === i ? ' ✓ ' + t('correctAnswer') : ''}`,
    `{t('optionWord')} {String.fromCharCode(65 + i)}{qDraft.a === i ? ' ✓ ' + t('correctAnswer') : ''}`, 1);
rep(`placeholder={'Option ' + String.fromCharCode(65 + i)}`, `placeholder={t('optionWord') + ' ' + String.fromCharCode(65 + i)}`, 1);
rep(`{editId ? '💾 Save changes' : '📤 ' + t('upload')}`, `{editId ? t('saveChanges') : '📤 ' + t('upload')}`, 1);
rep(`placeholder="Title or subject…"`, `placeholder={t('phTitleOrSubject')}`, 1);
rep(`<option value="all">All types</option>`, `<option value="all">{t('allTypes')}</option>`, 1);
rep(`<label>Sort</label>`, `<label>{t('sortLabel')}</label>`, 1);
rep(`<option value="newest">Newest first</option>`, `<option value="newest">{t('newestFirst')}</option>`, 1);
rep(`<option value="oldest">Oldest first</option>`, `<option value="oldest">{t('oldestFirst')}</option>`, 1);
rep(`<option value="title">Title A–Z</option>`, `<option value="title">{t('titleAZ')}</option>`, 1);
rep(`<th>Unlocked</th>`, `<th>{t('unlockedTh')}</th>`, 1);
rep(`{ book: '📕 Textbook', material: '📝 Notes', video: '🎬 Video', library: '📚 Library', test: '🧪 Test', exam: '📋 Model Exam' }[u.type] || u.type`,
    `{ book: t('typeBook'), material: t('typeMaterialShort'), video: t('typeVideo'), library: t('typeLibraryShort'), test: t('typeTestShort'), exam: t('typeExam') }[u.type] || u.type`, 1);
rep(`{u.free ? '🔒 Lock' : '🔓 Make free'}`, `{u.free ? t('lockBtn') : t('makeFreeBtn')}`, 1);
rep(`if (r.ok) flash('Duplicated "' + r.item.title + '"'); else`, `if (r.ok) flash(t('duplicatedN', { title: r.item.title })); else`, 1);
rep(`if (window.confirm('Delete "' + u.title + '"? This cannot be undone.'))`, `if (window.confirm(t('confirmDeleteUpload', { title: u.title })))`, 1);
rep(`>🗑 Delete</button>`, `>🗑 {t('deleteBtn')}</button>`, 1);
rep(`>No uploads match — add your first item above</td>`, `>{t('noUploadsMatch')}</td>`, 1);

// ---- H. payments tab ----
rep(`>🔑 Password reset requests</h3>`, `>🔑 {t('resetReqTitle')}</h3>`, 1);
rep(`<th>Date</th>`, `<th>{t('dateTh')}</th>`, 5);
rep(`{r.status === 'done' ? '✓ Completed' : r.status === 'approved' ? '✅ Allowed' : '⏳ Waiting'}`,
    `{r.status === 'done' ? t('resetCompleted') : r.status === 'approved' ? t('resetAllowed') : t('resetWaiting')}`, 1);
rep(`flash('Reset allowed — student can now set a new password'); }}>✔ Allow reset</button>`,
    `flash(t('resetAllowedFlash')); }}>{t('allowResetBtn')}</button>`, 1);
rep(`{r.status === 'done' ? 'password changed' : 'waiting for student'}`,
    `{r.status === 'done' ? t('pwChangedSmall') : t('waitingStudentSmall')}`, 1);
rep(`>No password reset requests yet</td>`, `>{t('noResetReqs')}</td>`, 1);
rep(`>💳 Payment requests</h3>`, `>💳 {t('payReqTitle')}</h3>`, 1);
rep(`<th>Plan / item</th>`, `<th>{t('planItemTh')}</th>`, 1);
rep(`>FULL</span>`, `>{t('fullBadge')}</span>`, 1);
rep(`{r.plan === 'full' ? '✅ Approve & open package' : '✅ Approve & unlock item'}`,
    `{r.plan === 'full' ? t('approveOpen') : t('approveUnlock')}`, 1);
rep(`flash('Request rejected');`, `flash(t('requestRejected'));`, 1);
rep(`? t('rejected') : 'access opened'}`, `? t('rejected') : t('accessOpened')}`, 1);
rep(`>No payment requests yet</td>`, `>{t('noPayReqs')}</td>`, 1);

// ---- I. reports tab ----
rep(`placeholder="Student name…"`, `placeholder={t('phStudentName')}`, 1);
rep(`<label>From</label>`, `<label>{t('fromLabel')}</label>`, 1);
rep(`<label>To</label>`, `<label>{t('toLabel')}</label>`, 1);
rep(`<> · Class average <b`, `<> · {t('classAverage')} <b`, 1);
rep(`>No reports match your filters</td>`, `>{t('noReportsMatch')}</td>`, 1);
rep(`>No reports yet</td>`, `>{t('noReportsYet')}</td>`, 2);

// ---- J. directors tab ----
rep(`placeholder="Name, email, school…"`, `placeholder={t('phNameEmailSchool')}`, 1);
rep(`{dirForm.mode === 'add' ? '➕ ' + t('addDirector') : '✏️ Edit director'}`,
    `{dirForm.mode === 'add' ? '➕ ' + t('addDirector') : '✏️ ' + t('editDirector')}`, 1);
rep(`<label>Email *</label>`, `<label>{t('email')} *</label>`, 1);
rep(`<label>Password</label>`, `<label>{t('passwordLabel')}</label>`, 1);
rep(`>💾 Save</button>`, `>💾 {t('saveBtn')}</button>`, 2);
rep(`<th>Email</th>`, `<th>{t('email')}</th>`, 1);
rep(`<th>Students</th>`, `<th>{t('studentsTh')}</th>`, 1);
rep(`>🔑 Set password</button>`, `>🔑 {t('setPasswordBtn')}</button>`, 1);
rep(`flash(d.active === false ? 'Director activated' : 'Director deactivated');`,
    `flash(d.active === false ? t('directorActivated') : t('directorDeactivated'));`, 1);
rep(`>No directors match your search</td>`, `>{t('noDirsMatch')}</td>`, 1);
rep(`>No directors yet — add one above</td>`, `>{t('noDirsYet')}</td>`, 1);

// ---- K. settings tab ----
rep(`                  Students see this number on the Store page — one setting, every language.`,
    `                  {t('settingsPhoneSub')}`, 1);
rep(`                  Posted announcements appear on every student's dashboard.`,
    `                  {t('settingsAnnSub')}`, 1);
rep(`placeholder="Exam week starts Monday…"`, `placeholder={t('phAnnouncement')}`, 1);
rep(`window.confirm('Delete this announcement?')`, `window.confirm(t('confirmDeleteAnn'))`, 1);
rep(`>👤 My account</h3>`, `>👤 {t('myAccount')}</h3>`, 1);
rep(`                  Change your display name, login email or password. Password changes need your current password.`,
    `                  {t('myAccountSub')}`, 1);
rep(`<label>Current password</label>`, `<label>{t('currentPw')}</label>`, 1);
rep(`<label>New password (min 6)</label>`, `<label>{t('newPwLabel')}</label>`, 1);
rep(`placeholder="Leave empty to keep"`, `placeholder={t('phKeepPw')}`, 1);
rep(`>💾 Save account</button>`, `>{t('saveAccountBtn')}</button>`, 1);

// ---- L. preview modal ----
rep(`— can't preview here, click to download &amp; open`, `{t('cantPreview')}`, 1);
rep(`</div>No content attached</div>`, `</div>{t('noContentAttached')}</div>`, 1);

// ---- M. detail modal ----
rep(`Joined {new Date(detailStu.joinedAt).toLocaleDateString()}`, `{t('joinedLabel')} {new Date(detailStu.joinedAt).toLocaleDateString()}`, 1);
rep(`>🤖 AI On</span> : <span className="chip bad">🤖 AI Off</span>}`, `>{t('aiOnChip')}</span> : <span className="chip bad">{t('aiOffChip')}</span>}`, 1);
rep(`: 'Grade ' + detailStu.grade]`, `: t('grade') + ' ' + detailStu.grade]`, 1);
rep(`              📖 Read-only profile — students edit their own details at registration. The actions below take effect immediately on the student's account.`,
    `              {t('detailReadOnlySub')}`, 1);
rep(`if (r) flash('Password reset allowed — ' + detailStu.email + ' can now set a new password via “Forgot password”');`,
    `if (r) flash(t('resetAllowedFlash2', { email: detailStu.email }));`, 1);
rep(`else flash('Student email not found');`, `else flash(t('emailNotFound'));`, 1);
rep(`const pw = window.prompt('Set a new password for ' + detailStu.email + '\\nMinimum 6 characters:');`,
    `const pw = window.prompt(t('promptSetPw', { email: detailStu.email }));`, 1);
rep(`if (res.ok) flash('Password set — ' + detailStu.email + ' can now log in with the new password');`,
    `if (res.ok) flash(t('pwSetLogin2', { email: detailStu.email }));`, 1);
rep(`}}>🔑 Set new password</button>`, `}}>🔑 {t('setNewPwBtn')}</button>`, 1);
rep(`}}>Close package</button>`, `}}>{t('closePackage')}</button>`, 1);
rep(`                  No payment request yet — 🔓 Open Package will appear here once this student requests payment.`,
    `                  {t('noPayReqYet')}`, 1);
rep(`{detailStu.active === false ? '✅ Unblock' : '⛔ Block login'}`,
    `{detailStu.active === false ? '✅ ' + t('unblockBtn') : '⛔ ' + t('blockLoginBtn')}`, 1);
rep(`if (window.confirm('Delete ' + detailStu.fullName + '? This cannot be undone.')) {`,
    `if (window.confirm(t('confirmDeleteStudent', { name: detailStu.fullName }))) {`, 1);
rep(`flash('Student deleted');`, `flash(t('studentDeleted'));`, 1);
rep(`>🔓 Unlocked items</h4>`, `>🔓 {t('unlockedItems')}</h4>`, 1);
rep(`>📦 Full package{detailStu.packageExpires ? ' · exp ' + new Date(detailStu.packageExpires).toLocaleDateString() : ''}</span>`,
    `>📦 {t('fullPackageChip')}{detailStu.packageExpires ? ' · ' + t('expShort') + ' ' + new Date(detailStu.packageExpires).toLocaleDateString() : ''}</span>`, 1);
rep(`>Nothing unlocked yet</span>`, `>{t('nothingUnlocked')}</span>`, 1);
rep(`: 'warn')}>{r.status}</span>`, `: 'warn')}>{t(r.status)}</span>`, 1);

// ---- N. assign modal ----
rep(`· {assignIds.length} selected`, `· {assignIds.length} {t('selectedWord')}`, 1);
rep(`placeholder="🔍 Search students by name, school, grade…"`, `placeholder={t('phAssignSearch')}`, 1);

fs.writeFileSync(F, src);
console.log('applied rules:', pass, 'FAILED:', fail.length);
for (const f of fail) console.log('  FAIL ' + f);
process.exit(fail.length ? 1 : 0);

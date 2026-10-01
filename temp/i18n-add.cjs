const fs = require('fs');
const FILE = 'src/i18n.js';
let src = fs.readFileSync(FILE, 'utf8');

// 1) remove dead (access-code era) keys from every language block
const dead = ['enterCode', 'redeem', 'codeInvalid', 'codeSuccess', 'revoke', 'revoked', 'expiresIn', 'addStudent', 'editStudent', 'statusFilter', 'manageCodes'];
let removed = 0;
for (const k of dead) {
  const re = new RegExp(`^[ \\t]*${k}[ \\t]*:[^\\n]*,?[ \\t]*\\r?\\n`, 'gm');
  src = src.replace(re, () => { removed++; return ''; });
}
console.log('dead keys removed:', removed, '(expect 44)');

const K = {
  navGrpManagement: ['Management', 'Maamulaa', 'አስተዳደር', 'Maamulidda'],
  navGrpStore: ['Store & Sales', 'Marketaa fi Gurgurtaa', 'መጋዘንና ሽያጭ', 'Kaydka iyo Suuqa'],
  navGrpData: ['Data & People', 'Deetaa fi Namoota', 'መረጃና ሰዎች', 'Xogta iyo Dadka'],
  ariaMenu: ['Menu', 'Tarreewwii', 'ዝርዝር', 'Liiska'],
  closeLabel: ['Close', 'Cufii', 'ዝጋ', 'Xir'],
  roleAdmin: ['Administrator', 'Bulbulsaa', 'አስተዳዳሪ', 'Maamule'],
  latestRegistrations: ['Latest registrations', 'Gorsaalee dhihootti', 'በቅርብ ጊዜ የተመዘገቡት', 'Isdiiwaangeladii ugu dambeeyay'],
  joinedLabel: ['Joined', 'Hiramaa', 'የተቀላቀለበት', 'Kusoo biiray'],
  noStudentsRegistered: ['No students registered yet', 'Waliigalii barataa hin jiru', 'እስካሁን ተማሪ አልተመዘገበም', 'Weli arday lama diiwaangalin'],
  distributionSub: ['Distribution across the platform', 'Qoodaan pajjinicha alaatti', 'በመድረኩ ላይ የተሰራጠፈው', 'Kala-qaybsiga dhulka martida'],
  perGrade: ['per grade', 'sadarkaan', 'በደረጃ', 'darajo kasta'],
  phNameSchoolEmail: ['Name, school, email…', 'Maqaa, garaa, iimeelii…', 'ስም፣ ትምህርት ቤት፣ ኢሜይል…', 'Magac, dugsi, iimayl…'],
  allGrades: ['All grades', 'Sadarkooti hundi', 'ሁሉም ክፍሎች', 'Dhammaan fasallada'],
  blockedLabel: ['Blocked', 'Kutiima', 'ተዘግቷል', 'La xannibay'],
  selectedColon: ['selected:', 'filatamee:', 'የተመረጡ፡', 'la doortay:'],
  selectedWord: ['selected', 'filatamee', 'የተመረጡ', 'la doortay'],
  confirmBlockN: ['Block login for {{n}} selected student(s)?', 'Barataa {{n}} filatamee seenuu kutitaa?', 'የተመረጡ ተማሪዎች {{n}} መግባት ይዘጋ?', 'Xaashiyadda soo galitaanka {{n}} arday la doortay la xannibaa?'],
  exportSelected: ['Export selected', 'Filatamee dorkaa', 'የተመረጡትን አስመጣ', 'Soo saar kuwa la doortay'],
  noStudentsMatch: ['No students match', 'Barataan mijaru filaman', 'ተማሪ አልተገናኙም', 'Arday ma ay isku dhacaan'],
  closePackage: ['Close package', 'Pakii jjira', 'ጥቅሉን ዝጋ', 'Xir baakijka'],
  blockBtn: ['Block', 'Kuti', 'አግደው', 'Xannib'],
  unblockBtn: ['Unblock', 'Kutii aafigaa', 'አግደው ፈትት', 'Ka xannib'],
  blockLoginBtn: ['Block login', 'Seeni kuti', 'መግባት አግደው', 'Xannib galitaanka'],
  bulkUpdated: ['Updated {{fields}} for {{n}} student(s)', '{{n}} barataaf {{fields}} haaraa', 'የ {{fields}} በ {{n}} ተማሪ ተስተካክሏል', '{{fields}} wax ka beddelay {{n}} arday'],
  aiWord: ['AI', 'AI', 'AI', 'AI'],
  packageWord: ['package', 'pakii', 'ጥቅል', 'baakij'],
  loginWord: ['login', 'seenuu', 'መግባት', 'galitaan'],
  directorWord: ['director', 'direktooraa', 'ዳይሬክተር', 'agaasime'],
  phStudentName: ['Student name…', 'Maqaa barataa…', 'የተማሪ ስም…', 'Magaca ardayga…'],
  phTitleOrSubject: ['Title or subject…', 'Maticaaffi maddaan…', 'ርዕስ ወይም ዜና…', 'Cinwaan ama mawduuc…'],
  phNameEmailSchool: ['Name, email, school…', 'Maqaa, iimeelii, garaa…', 'ስም፣ ኢሜይል፣ ትምህርት ቤት…', 'Magac, iimayl, dugsi…'],
  phAssignSearch: ['🔍 Search students by name, school, grade…', '🔍 Barataa maqaa, garaa, sadarkaan barbaadi…', '🔍 ተማሪዎችን በስም፣ ትምህርት ቤት፣ ክፍል ፈልግ…', '🔍 Raadi arday magac, dugsi, fasal ku saleysan…'],
  phPlanName: ['Full access — 30 days', 'Gaheessuu bu’aa — 30 guyyaa', 'ሙሉ መዳረሻ — 30 ቀን', 'Helitaan buuxa — 30 maalmood'],
  saveBtn: ['Save', 'Erigii', 'አስቀምጥ', 'Kaydi'],
  addPlan: ['Add plan', 'Siyaasa gaafi', 'ዕቅብ ጨምር', 'Ku dar qorshaha'],
  cancelBtn: ['Cancel', 'Dhaabi', 'ሰርዝ', 'Jooji'],
  editBtn: ['Edit', 'Jijjiiri', 'አስተካክል', 'Wax ka beddel'],
  confirmDeletePlan: ['Delete plan "{{name}}"? Students with this plan are not affected.', 'Siyaasa "{{name}}" haqi? Barataan siyaasa kana qabaniif miidhin.', 'ዕቅብን "{{name}}" ይሰርዝ? በዚህ ዕቅብ ያሉ ተማሪዎች አይጎዳቸውም።', 'Qorshaha "{{name}}" ma tirtiraa? Ardayga qorshahan qaba ma la dhibayo.'],
  noPlansYet: ['No plans yet — add one above', 'Siyaasa hin jiru — haa gaadi bittaa', 'እስካሁን ዕቅብ የለም — ከላይ አንዱን ጨምር', 'Weli qorsha ma jiro — mid sare ku dar'],
  expiresTh: ['Expires', 'Badhaa', 'ጊዜው ይቆያል', 'Waqtigiisu dhammaanayo'],
  noStudentsYet: ['No students yet', 'Waliigalii barataa hin jiru', 'እስካሁን ተማሪ የለም', 'Weli arday ma jiro'],
  editContent: ['✏️ Edit content', '✏️ Qabiyyee jijjiiri', '✏️ ይዘት አስተካክል', '✏️ Wax ka beddel waxyaabaha'],
  uploadNew: ['📤 Upload new content for students', '📤 Barataaf qabiyyee haaraa ol kaa’i', '📤 ለተማሪዎች አዲስ ይዘት ስቀል', '📤 Soo rar waxyaabo cusub ardayga'],
  uploadsIntro: ['Textbooks, notes, videos, library items, tests and model exams — everything stays locked until the student pays the fee and the admin opens their access.', 'Barreewwan, yaadannoo, viidiyoowwan, meeshaalee maxxansaa, colaaffii fi karaa imitii — hundi cinamaa ta’u barataan kaffaltii kaffalanii adminiin gaheessuu isaanii banuu harkaan.', 'መሠሪ መጻሕፍት፣ ማስታወሻ፣ ቪዲዮ፣ የቤተ መጻሕፍት እቃዎች፣ ምርመራና ናሙና ምርመራ — ተማሪው ክፍያ ከከፈለ እና አስተዳዳሪው መዳረሻውን ከከፈተ ስጋቸው ይቆያሉ።', 'Buugagga, xusuusyada, muuqaallada, waxyaabaha maktabadda, imtixaannada iyo imtixaannada tijaabada — wax kastu waa xiran yahay ilaa ardaygu lacagta bixiyo oo maamuhu helitaankiisa furo.'],
  labelTitle: ['Title *', 'Maticaaffi *', 'ርዕስ *', 'Cinwaanka *'],
  labelSubject: ['Subject', 'Maddaan', 'ዜና', 'Mawduuca'],
  typeLabel: ['Type', 'Bakka', 'ዓይነት', 'Nooca'],
  priceLabel: ['Price', 'Gatiin', 'ዋጋ', 'Qiimaha'],
  accessLabel: ['Access', 'Gaheessuu', 'መዳረሻ', 'Helitaanka'],
  freeForEveryone: ['🆓 Free for everyone (skip payment)', '🆓 Namootiif hunda bilan (kaffaltii dhaabi)', '🆓 ለሁሉም ነጻ (ክፍያ ዝለል)', '🆓 Bilaash qof walba (lacag-bixinta ka bood)'],
  labelFile: ['File (≤ 4 MB — PDF, Word, slides, image, audio, video)', 'Fayilii (≤ 4 MB — PDF, Word, ibsi, suuraa, aannoo, viidiyo)', 'ፋይል (≤ 4 MB — PDF, Word, ማሳያ፣ ምስል፣ ድምፀ በሬዎች፣ ቪዲዮ)', 'Faylka (≤ 4 MB — PDF, Word, muuqaallo, sawir, cod, muuqaal)'],
  labelLinkUrl: ['Link URL (video / online book / website)', 'Jijjiirraa URL (viidiyo / buuqqaa online / maharuu)', 'አገናኝ URL (ቪዲዮ / የመስመር ላይ መጽሐፍ / ድረ-ገጽ)', 'Khadka URL (muuqaal / buug online / boggan)'],
  labelAttachment: ['Attachment', 'Walqabataa', 'ተያዥ', 'Ku-darista'],
  noFileSelected: ['No file selected', 'Fayilii filatamee hin jiru', 'ፋይል አልተመረጠም', 'Fayl la ma dooran'],
  labelContentText: ['Content text (for notes/books without a link — students read it inside the app)', 'Barreessi qabiyyee (yaadannoo/buuqii ilkaan hin qabniif — barataan sooftuu keessaa dubbisu)', 'የይዘት ጽሑፍ (ያለአገናኝ ማስታወሻ/መጽሐፍት — ተማሪዎች በመተግበሪያው ውስጥ ያነባሉ)', 'Qoraalka waxyaabaha (xusuusyo/buugag khad la’aan — ardayga akhrinayaan gudaha barnaamijka)'],
  hintVideo: ['🎬 Video — paste a YouTube/Drive link in the Link field (best for big videos), or attach a video file (≤ 4 MB) that plays inside the app.', '🎬 Viidiyo — meeshaa Jijjiirraatiif xiriirra YouTube/Drive maxxansi (viidiyoowwan guutuu fiixxoo), fi yookaan viidiyo fayilii (≤ 4 MB) sooftuu keessatti taphatu ol kaa’i.', '🎬 ቪዲዮ — በአገናኝ መስክው ውስጥ YouTube/Drive አገናኝ ያስገቡ (ለትልቅ ቪዲዮ ምርጫ) ወይም በመተግበሪያው ውስጥ የሚጫወት ቪዲዮ ፋይል (≤ 4 MB) ያያዩ።', '🎬 Muuqaal — ku dheji goobta Khadka xiriirka YouTube/Drive (ugu fiican muuqaallada waaweyn), ama ku dar fayl muuqaal (≤ 4 MB) oo gudaha barnaamijka ka dhaca.'],
  hintTest: ['🧪 Test / Model Exam — build the questions below; you can also attach a PDF/image with instructions.', '🧪 Colaaffii / Karaa Imitii — gaaffilee gadii fududaa; Waliinatti PDF/suuraa daawwataa walqabsisi.', '🧪 ምርመራ / ናሙና ምርመራ — ጥያቄዎችን ከታች ይገንቡ፤ መመሪያ ያሉትን PDF/ምስል መያዝም ይችላሉ።', '🧪 Imtixaan / Imtixaan tijaabo — su’aalaha hoos u dhiso; waxaad sidoo kale ku dari kartaa PDF/sawir talooyin leh.'],
  hintLibrary: ['📚 Library — attach a book file (PDF/EPUB/Word), paste a link, or paste the text below. Attached files and text open inside the guided study view.', '📚 Maxxansaa — fayilii buuqii (PDF/EPUB/Word) walqabsisi, xiriirra maxxansi, yookaan barreessi gadii maxxansi. Fayilootiin qabatamaa fi barreessi horduun dubbisaa keessatti banama.', '📚 ቤተ መጻሕፍት — የመጽሐፍ ፋይል (PDF/EPUB/Word) ያያዩ፣ አገናኝ ያስገቡ ወይም ከታች ጽሑፉን ያስገቡ። የተያዙ ፋይሎችና ጽሑፍ በመመሪያ የጥናት አይታ ውስጥ ይከፈታሉ።', '📚 Maktabadda — ku dar fayl buug (PDF/EPUB/Word), ku dheji xiriir, ama ku dheji qoraalka hoos. Faylada iyo qoraalka waxay ku furmayaan aragga waxbarashada hagaya.'],
  hintTextbook: ['📖 Textbook / Notes — attach a file (PDF, Word, slides, image — ≤ 4 MB), paste a link, or write the content below. Attached images, screenshots, PDFs and text files open inside the guided study view. Tip: in written content, start headings with numbers (1., 1.1), #, ALL CAPS or a colon — students then get a guided study plan (chapters, page-by-page reading, capture-in-mind, questions, self-explanation).', '📖 Barreessi Barnootaa / Yaadannoo — fayilii (PDF, Word, ibsi, suuraa — ≤ 4 MB) walqabsisi, xiriirra maxxansi, yookaan qabiyyee gadii barreessi. Suuratootiin qabatamaa, gabaanee fi PDF/fayilootiin barreessi horduun dubbisaa keessatti banama. Tilmaama: barreessi keessatti, mataduree lakkoofatti (1., 1.1), #, HURUUF HUNDAA yookaan xiqqaa eessatti eessani — barataan sinnaan siyaasa horduun barachuu argitu (boqonnaa, gargar dubbisi, qabuuf, gaaffilee, deebiin of anna).', '📖 መሠሪ መጽሐፍ / ማስታወሻ — ፋይል (PDF, Word, ማሳያ፣ ምስል — ≤ 4 MB) ያያዩ፣ አገናኝ ያስገቡ ወይም ከታች ይዘቱን ይጻፉ። የተያዙ ምስሎች፣ ስክሪንሾቶች፣ PDFዎችና የጽሑፍ ፋይሎች በመመሪያ የጥናት አይታ ውስጥ ይከፈታሉ። ምክር: በጽሑፍ ውስጥ ራስጌዎችን በክፍል ቁጥር (1., 1.1)፣ #፣ ሁሉም በአደረጃጀት ወይም በሁለት ነጥብ ማስረከቢያ ይጀምሩ — ተማሪዎች ከዚያ የመመሪያ የጥናት ዕቅብ ያገኛሉ (ምዕራፎች፣ ገጽ በገጽ ንባብ፣ በአእምሮ መዝግብ፣ ጥያቄዎች፣ የራስ ማብራራያ).', '📖 Buug Waxbarasho / Xusuus — ku dar fayl (PDF, Word, muuqaallo, sawir — ≤ 4 MB), ku dheji xiriir, ama qoraalka hoos qor. Sawirada, sawirro shaashadeysan, PDF-yada iyo faylada qoraalka waxay ku furmayaan aragga waxbarashada hagaya. Talo: qoraalka, madaxyada ka bilow lambarrada (1., 1.1), #, SARRE HORE ama laba-xariir — ardayga waxay helaysaan qorso waxbarasho hagaysa (qaybaha, akhris bog-bog, qabashada maskaxda, su’aalaho, sharaxaadda nafta).'],
  optionWord: ['Option', 'Filannoo', 'አማራጭ', 'Xulasho'],
  saveChanges: ['💾 Save changes', '💾 Jijjiirraa Erigii', '💾 ለውጦችን አስቀምጥ', '💾 Kaydi isbeddellada'],
  allTypes: ['All types', 'Bakka hundi', 'ሁሉም ዓይነቶች', 'Dhammaan noocyada'],
  typeBook: ['📕 Textbook', '📕 Barreessi Barnootaa', '📕 መሠሪ መጽሐፍ', '📕 Buug waxbarasho'],
  typeMaterialFull: ['📝 Notes / material', '📝 Yaadannoo / qabiyyee', '📝 ማስታወሻ / እቃ', '📝 Xusuus / wax'],
  typeMaterialShort: ['📝 Notes', '📝 Yaadannoo', '📝 ማስታወሻ', '📝 Xusuus'],
  typeVideo: ['🎬 Video', '🎬 Viidiyo', '🎬 ቪዲዮ', '🎬 Muuqaal'],
  typeLibraryFull: ['📚 Library item', '📚 Meeshaa maxxansaa', '📚 የቤተ መጻሕፍት እቃ', '📚 Wax ku jira maktabadda'],
  typeLibraryShort: ['📚 Library', '📚 Maxxansaa', '📚 ቤተ መጻሕፍት', '📚 Maktabad'],
  typeTestFull: ['🧪 Test / Quiz', '🧪 Colaaffii / Gaaffii', '🧪 ምርመራ / ጥያቄ', '🧪 Imtixaan / Su’aal'],
  typeTestShort: ['🧪 Test', '🧪 Colaaffii', '🧪 ምርመራ', '🧪 Imtixaan'],
  typeExam: ['📋 Model Exam', '📋 Karaa Imitii', '📋 ናሙና ምርመራ', '📋 Imtixaan tusaale'],
  sortLabel: ['Sort', 'Filannoo', 'ደርድር', 'Qaabeynta'],
  newestFirst: ['Newest first', 'Haaraa dura', 'አዲስ የመጀመሪያ', 'Ugu cusub marka hore'],
  oldestFirst: ['Oldest first', 'Duree dura', 'የታዘዘ የመጀመሪያ', 'Ugu qadi marka hore'],
  titleAZ: ['Title A–Z', 'Maticaaffi A–Z', 'ርዕስ A–Z', 'Cinwaanka A–Z'],
  unlockedTh: ['Unlocked', 'Banatame', 'ተከፍቷል', 'La furay'],
  lockBtn: ['🔒 Lock', '🔒 Cinii', '🔒 ዝጋ', '🔒 Xir'],
  makeFreeBtn: ['🔓 Make free', '🔓 Bilan taasi', '🔓 ነጻ አድርግ', '🔓 Ka dhig bilaash'],
  upFileTooLarge: ['❌ File too large — max 4 MB. For big files, paste a Link instead.', '❌ Fayilii guutuu guddaan — 4 MB ol. Fayiloota guutuuf, xiriirra maxxansi.', '❌ ፋይል በጣም ትልቅነው — ከፍተኛው 4 MB. ለትልቅ ፋይሎች በምትኩ አገናኝ ያስገቡ።', '❌ Faylka aad buu u weyn yahay — ugu badhan 4 MB. Faylada waaweyn, beddel xiriir.'],
  upStorageFull: ['❌ Storage almost full — {{free}} MB left of 5 MB. Use a Link for this file, or delete old uploads.', '❌ Qabiyyee xiqqaa guutuu — 5 MB keessaa {{free}} MB hafe. Fayila kanaaf xiriirra hundaa, yookaan ol kaa’imaan mooffaa haqi.', '❌ መከማቻ መጥፎበጣም ቀርቷል — ከ 5 MB ውስጥ {{free}} MB ቀርቷል። ለዚህ ፋይል አገናኝ ይጠቀሙ ወይም አሮጌ ስቀሎችን ይሰርዱ።', '❌ Kaydinta aad buu u buuxday — 5 MB ka haray {{free}} MB. Isticmaal xiriir faylkan, ama tirtir raritaadii hore.'],
  upReadFail: ['❌ Could not read that file', '❌ Fayila kan dubbisa hin dandeenye', '❌ ፋይሉን ማንበብ አልቻልኩም', '❌ Faylkaas ma akhrin'],
  upUpdateFail: ['❌ Update failed', '❌ Haarsuu kuffe', '❌ ማዘመን አልተሳካም', '❌ Cusbooneysi waa khaldanayd'],
  upUpdated: ['✅ Updated "{{title}}"', '✅ "{{title}}" haaromsiifame', '✅ "{{title}}" ተስተካክሏል', '✅ "{{title}}" waa la cusbooneysiiyay'],
  upUploaded: ['✅ Uploaded "{{title}}" — students must pay to open it.', '✅ "{{title}}" ol kaa’amee — barataan banuudhaaf kaffaluu qabu.', '✅ "{{title}}" ተስቀልሏል — መክፈት ለማድረግ ተማሪዎች መክፈል አለባቸው።', '✅ "{{title}}" waa la raray — ardayga waa inay bixiyaan si ay u furaan.'],
  upQuestionNeed: ['❌ Question needs text, at least 2 options, and a non-empty correct answer', '❌ Gaaffiin barreessi, filannoo 2 olaanaa, deebiin sirrii hin duuqqanisini barbaada', '❌ ጥያቄ ጽሑፍ፣ ከሁለት አማራጭ በላይ እና ባዶ የሆነ ትክክለኛ መልስ ያስፈልጋል', '❌ Su’aalku wuxuu u baahan yahay qoraal, ugu yaraan 2 dooro, iyo jawaab sax ah oo aan banneyn'],
  duplicatedN: ['Duplicated "{{title}}"', '"{{title}}" garagalchame', '"{{title}}" ተባዛ', '"{{title}}" waa la koomeeyay'],
  confirmDeleteUpload: ['Delete "{{title}}"? This cannot be undone.', '"{{title}}" haqi? Kun hin deebi’u.', '"{{title}}" ይሰርዝ? ይህ ሊመለስ አይችልም።', '"{{title}}" ma tirtiraa? Kani dib looma noqon karo.'],
  deleteBtn: ['Delete', 'Haqi', 'ሰርዝ', 'Tirtir'],
  noUploadsMatch: ['No uploads match — add your first item above', 'Ol kaa’imaan mijaru filaman — jalqaba meeshaa bittaa gaadi', 'ስቀሎች አልተገናኙም — የመጀመሪያውን እቃ ከላይ ጨምር', 'Raritaada ma isku dhacdo — midkaaga ugu horreeya sare ku dar'],
  resetReqTitle: ['Password reset requests', 'Begiiwan passwordii haaromsi', 'የይለፍ ቃል ዳግም አስቻል ጥያቄዎች', 'Codsigyada cusbooneysiga erayga sirta ah'],
  dateTh: ['Date', 'Guyyaa', 'ቀን', 'Taariikhda'],
  resetCompleted: ['✓ Completed', '☑ Xumamee', '✓ ተጠናቋል', '✓ Dhammaaday'],
  resetAllowed: ['✅ Allowed', '✅ Mirkaneeffame', '✅ የተፈቀደ', '✅ La ansixiyay'],
  resetWaiting: ['⏳ Waiting', '⏳ Eegaa', '⏳ በመጠባበቅ', '⏳ Sugaya'],
  allowResetBtn: ['✔ Allow reset', '✔ Haaromsiif mirkaneeffadi', '✔ ዳግም አስቻል ፍቀድ', '✔ U ogolaadow cusbooneysi'],
  resetAllowedFlash: ['Reset allowed — student can now set a new password', 'Haaromsiif mirkaneeffamee — barataan amma passwordii haaraa kaa’a', 'ዳግም አስቻል ተፈቅዷል — ተማሪ አሁን አዲስ የይለፍ ቃል ማዘጋጀት ይችላል', 'Cusbooneysi waa la ogolaaday — ardayga hadda wuxuu samayn karaa eray cusub'],
  pwChangedSmall: ['password changed', 'passwordii jijjiirame', 'የይለፍ ቃል ተቀይሯል', 'erayga waa la beddelay'],
  waitingStudentSmall: ['waiting for student', 'barataa eegaa', 'ተማሪ በመጠባበቅ ላይ', 'ardayga la sugayo'],
  noResetReqs: ['No password reset requests yet', 'Begiiwan passwordii haaromsi hin jiru', 'የይለፍ ቃል ዳግም አስቻል ጥያቄዎች የለም', 'Weli codsiyo cusbooneysi eray ma jiro'],
  payReqTitle: ['Payment requests', 'Begiiwan kaffaltii', 'የክፍያ ጥያቄዎች', 'Codsigyada lacag-bixinta'],
  planItemTh: ['Plan / item', 'Siyaasa / meeshaa', 'ዕቅብ / እቃ', 'Qorshaha / wax'],
  fullBadge: ['FULL', 'GUUTUU', 'ሙሉ', 'BUUXA'],
  approveOpen: ['✅ Approve & open package', '✅ Mirkaniisii & herrega banii', '✅ ውሉን አጽድቅና ኩብ ክፈት', '✅ Ansixi oo fur baakijka'],
  approveUnlock: ['✅ Approve & unlock item', '✅ Mirkaniisii & meeshaa banii', '✅ ያጽድቅና እቃ ክፈት', '✅ Ansixi oo fur wax'],
  requestRejected: ['Request rejected', 'Begii dhaabame', 'ጥያቄው ተደውሏል', 'Codsiga waa la diiday'],
  accessOpened: ['access opened', 'gaheessuu baname', 'መዳረሻ ተከፍቷል', 'helitaanka waa la furay'],
  noPayReqs: ['No payment requests yet', 'Begiiwan kaffaltii hin jiru', 'የክፍያ ጥያቄዎች የለም', 'Weli codsi lacag-bixin ma jiro'],
  approveFullMsg: ['✅ Payment confirmed — package opened for {{name}} (no code needed)', '✅ Kaffaltii mijramee — herrega {{name}} banamee (koodii hin barbaachisu)', '✅ ክፍያው ᓠረጉጋል — ጥቅሉ ለ{{name}} ተከፍቷል (ኮድ አያስፈልግም)', '✅ Lacagta waa la xaqiijiyay — baakijka {{name}} waa la furay (lama u baahna khood)'],
  approveItemMsg: ['✅ Payment confirmed — item unlocked for {{name}}', '✅ Kaffaltii mijramee — meeshaa {{name}} banatamee', '✅ ክፍያው ᓠረጉጋል — እቃው ለ{{name}} ተከፍቷል', '✅ Lacagta waa la xaqiijiyay — waxka {{name}} waa la furay'],
  theStudent: ['the student', 'barataa', 'ተማሪው', 'ardayga'],
  requestApproved: ['Request approved', 'Begii mirkaneeffame', 'ጥያቄው የተፈቀደ', 'Codsigu waa la ansixiyay'],
  fromLabel: ['From', 'Iiboo', 'ከ', 'Ka'],
  toLabel: ['To', 'Harkaa', 'እስከ', 'Ilaa'],
  classAverage: ['Class average', 'Gatiitoo ganda', 'አማካኛው ውጤት', 'Celceliska fasalka'],
  noReportsMatch: ['No reports match your filters', 'Gabaasiin galchaa mijaru filaman', 'ሪፖርቶች ከማጣሪያዎችዎ ጋር አልተገናኙም', 'Warbixinnada ma ay isku dhacaan shaashadahaaga'],
  noReportsYet: ['No reports yet', 'Gabaasiin hin jiru', 'እስካሁን ሪፖርት የለም', 'Weli warbixin ma jiro'],
  editDirector: ['Edit director', 'Direktooraa jijjiiri', 'ዳይሬክተር አስተካክል', 'Wax ka beddel agaasimaha'],
  passwordLabel: ['Password', 'Passwordii', 'የይለፍ ቃል', 'Erayga sirta ah'],
  studentsTh: ['Students', 'Barataa', 'ተማሪዎች', 'Ardayga'],
  setPasswordBtn: ['Set password', 'Passwordii kaa’i', 'የይለፍ ቃል ያዘጋጁ', 'Deji erayga sirta ah'],
  directorUpdated: ['Director updated', 'Direktooraa haaromsiifame', 'ዳይሬክተሩ ተስተካክሏል', 'Agaasimaha waa la cusbooneysiiyay'],
  directorActivated: ['Director activated', 'Direktooraa sochii galaa', 'ዳይሬክተሩ ንቁ ሆኗል', 'Agaasimaha waa la shaqaaleeyay'],
  directorDeactivated: ['Director deactivated', 'Direktooraa dhaabame', 'ዳይሬክተሩ ተገልቋል', 'Agaasimaha waa la joojiyay'],
  noDirsMatch: ['No directors match your search', 'Direktoorootan barbaadani mijaru filaman', 'ዳይሬክተሮች ከፍለጋዎ ጋር አልተገናኙም', 'Maamulayaasha ma ay isku dhacaan raadintaada'],
  noDirsYet: ['No directors yet — add one above', 'Direktoorootan hin jiru — haa gaadi bittaa', 'እስካሁን ዳይሬክተር የለም — ከላይ አንዱን ጨምር', 'Weli agaasime ma jiro — mid sare ku dar'],
  directorAdded: ['Director added', 'Direktooraa ga’ame', 'ዳይሬክተር ተጨምሯል', 'Agaasime waa la kordhiyay'],
  studentsAssigned: ['Students assigned', 'Barataa biheeffame', 'ተማሪዎች ተመድበዋል', 'Arday waa la kala qeybiyay'],
  promptSetPw: ['Set a new password for {{email}}\nMinimum 6 characters:', '{{email}} passwordii haaraa kaa’i\nGatiituu 6 olaanaa:', 'ለ {{email}} አዲስ የይለፍ ቃል ያዘጋጁ\nአንድነት 6 ቁምፊዎች፦', 'U deji eray cusub {{email}}\nUgu yaraan 6 xaraf:'],
  pwSetLogin: ['Password set — {{email}} can now log in', 'Passwordii kaa’amee — {{email}} amma seenuu danda’a', 'የይለፍ ቃል ተደውሏል — {{email}} አሁን መግባት ይችላል', 'Erayga waa la dejiyay — {{email}} hadda wuu geli karaa'],
  pwSetLogin2: ['Password set — {{email}} can now log in with the new password', 'Passwordii kaa’amee — {{email}} amma passwordii haaraatiin seenuu danda’a', 'የይለፍ ቃል ተደውሏል — {{email}} አሁን በአዲስ የይለፍ ቃል መግባት ይችላል', 'Erayga waa la dejiyay — {{email}} hadda wuxuu geli karaa erayga cusub'],
  confirmDeleteDir: ['Delete director "{{name}}"?', 'Direktooraa "{{name}}" haqi?', 'ዳይሬክተር "{{name}}" ይሰርዝ?', 'Maamulaha "{{name}}" ma tirtiraa?'],
  confirmDeleteDirUnassign: ['Their {{n}} student(s) will be unassigned.', 'Barooti isaanii {{n}} dhiifama.', 'የእነሱ {{n}} ተማሪዎች እንደማይመዱ ይሆናሉ።', '{{n}} arday oo ay leeyihiin lama sii qaban doono.'],
  directorDeleted: ['Director deleted', 'Direktooraa haqame', 'ዳይሬክተሩ ተሰርዟል', 'Agaasimaha waa la tirtiray'],
  dirUnassignedTail: ['{{n}} student(s) unassigned', 'barataa {{n}} dhiifame', 'ተማሪዎች {{n}} ተነጥፈዋል', '{{n}} arday lama sii qeybin'],
  settingsPhoneSub: ['Students see this number on the Store page — one setting, every language.', 'Barataan lakkoofa kana Marketaa irratti hiramaa — tartiiba tokko, afaan hundi.', 'ተማሪዎች ይህን ቁጥር በመጋዘን ገጽ ላይ ያያሉ — አንድ ቅንብር፣ በማንኛውም ቋንቋ።', 'Ardayga waxay arkayaan lambarkan bogga kaydka — dejin hal, af kasta.'],
  settingsAnnSub: ["Posted announcements appear on every student's dashboard.", 'Beeksiileen dhihiphame dachiisa barataa hundiitti agarsiisu.', 'የተለጡ ማስታወቂያዎች በየተማሪው ዳሽቦርድ ላይ ይታያሉ።', 'Ogeysiyada la diray waxay ka muuqdaan dhammaan dashboordyada ardayga.'],
  phAnnouncement: ['Exam week starts Monday…', 'Torbee imtiyaasiin eebalama', 'የምርመራ ሳምንት ሰኞ ይጀምራል…', 'Todobaadka imtixaanka waxaa bilaabmaya Isniinta…'],
  confirmDeleteAnn: ['Delete this announcement?', 'Beeksisaa kani haqi?', 'ይህን ማስታወቂያ ይሰርዝ?', 'Ogeysiskan ma tirtiraa?'],
  myAccount: ['My account', 'Herrega koo', 'የእኔ መለያ', 'Akoonkayga'],
  myAccountSub: ['Change your display name, login email or password. Password changes need your current password.', 'Maqaa agarsiisaa, iimeelii seenuu yookaan passwordii jijjiiri. Passwordii jijjiirni passwordii ammee barbaada.', 'የማሳያ ስምዎን፣ የመግቢያ ኢሜይል ወይም የይለፍ ቃል ይቀይሩ። የይለፍ ቃል ለውጥ የአሁኑን የይለፍ ቃል ይፈልጋል።', 'Beddel magaca muuqaalka, iimaylka soo galitaanka ama erayga. Beddelidda erayga waxay u baahan tahay eraygaaga hadda.'],
  currentPw: ['Current password', 'Passwordii ammee', 'የአሁኑ የይለፍ ቃል', 'Erayga hadda'],
  newPwLabel: ['New password (min 6)', 'Passwordii haaraa (gatiituu 6)', 'አዲስ የይለፍ ቃል (አነስተኛ 6)', 'Eray cusub (ugu yaraan 6)'],
  phKeepPw: ['Leave empty to keep', 'Kaa’uuf duqqaa tarkachiisi', 'ለመቆየት ባዶ ይተዉት', 'Ka tag si aad u haysato'],
  saveAccountBtn: ['💾 Save account', '💾 Herrega Erigii', '💾 መለያውን አስቀምጥ', '💾 Kaydi akoonka'],
  settingsSaved: ['Settings saved — Store page now shows {{phone}}', 'Tartiibaa olkaa’amee — Marketaa amma {{phone}} agarsiisa', 'ቅንብሮች ተቀምጠዋል — የመጋዘን ገጽ አሁን {{phone}} ያሳያል', 'Dejinta waa la kaydiyay — bogga kaydka hadda wuxuu muujinayaa {{phone}}'],
  annRequired: ['Announcement text required', 'Barreessi beeksiyaa barbaachisa', 'የማስታወቂያ ጽሑፍ ያስፈልጋል', 'Qoraalka ogeysiiska waa loo baahan yahay'],
  annPosted: ['Announcement posted to all students', 'Beeksiiseen barataa hundiitti dhihiphame', 'ማስታወቂያው ለሁሉም ተማሪዎች ተለጥፏል', 'Ogeysiiska waa loo diray dhammaan ardayga'],
  nameEmailRequired: ['Name and email are required', 'Maqaa fi iimeelii barbaachisa', 'ስምና ኢሜይል ያስፈልጋሉ', 'Magac iyo iimayl waa loo baahan yahay'],
  newPwTooShort: ['New password must be at least 6 characters', 'Passwordii haaraan gatiituu 6 olaanaa ta’uu qaba', 'አዲስ የይለፍ ቃል ከስድስት ቁምፊዎች በላይ መሆን አለበት', 'Erayga cusub waa inuu ugu yaraan 6 xaraf noqdaa'],
  accountUpdated: ['Account updated', 'Herrega haaromsiifame', 'መለያው ተስተካክሏል', 'Akoonka waa la cusbooneysiiyay'],
  planNameRequired: ['Plan name required', 'Maqaa siyaasaa barbaachisa', 'የዕቅብ ስም ያስፈልጋል', 'Magaca qorshaha waa loo baahan yahay'],
  planUpdated: ['Plan updated', 'Siyaasa haaromsiifame', 'ዕቅቡ ተስተካክሏል', 'Qorshaha waa la cusbooneysiiyay'],
  planAdded: ['Plan added', 'Siyaasa ga’ame', 'ዕቅብ ተጨምሯል', 'Qorshaha waa la kordhiyay'],
  studentActivated: ['Student activated — can log in again', 'Barataa sochii galaa — deebisee seenuu danda’a', 'ተማሪው ንቁ ሆኗል — እንደገና መግባት ይችላል', 'Ardayga waa la shaqaaleeyay — mar kale wuu geli karaa'],
  studentBlocked: ['Student blocked from login', 'Barataa seenni kutitame', 'ተማሪው ከመግባት ተዘግቷል', 'Ardayga waa laga xannibay soo galitaanka'],
  aiOnChip: ['🤖 AI On', '🤖 AI Sochii', '🤖 AI ንቁ', '🤖 AI Shaqaale'],
  aiOffChip: ['🤖 AI Off', '🤖 AI Dhaabame', '🤖 AI ገልቋል', '🤖 AI Jooji'],
  detailReadOnlySub: ["Read-only profile — students edit their own details at registration. The actions below take effect immediately on the student's account.", 'Ageensa dubbisaa qofee — barataan detaa isaanii galchaa keessatti mijatu. Tarkaanfiilee gadiin harka amma akka barataa applies.', 'የንባብ መለያ — ተማሪዎች የራሳቸውን ዝርዝሮች በምዝገባ ላይ ያስተካክላሉ። ከዚህ በታች ያሉ ተግባራት በተማሪው መለያ ላይ ወዲያውኑ ተፎካካሟል።', 'Profil akhris-keliya — ardayga waxay beddelaan faahfaahinadooda marka ay diiwaangashadaan. Ficillada hoos waxay si degdeg ah u saamaynayaan akoonka ardayga.'],
  resetAllowedFlash2: ['Password reset allowed — {{email}} can now set a new password via “Forgot password”', 'Haaromsiin passwordii mirkaneeffamee — {{email}} amma “Passwordii dagattee” barreessiin passwordii haaraa kaa’a danda’a', 'የይለፍ ቃል ዳግም አስቻል ተፈቅዷል — {{email}} አሁን በ“የይለፍ ቃል ረሳሁ” አዲስ የይለፍ ቃል ማዘጋጀት ይችላል', 'Cusbooneysi eray waa la ogolaaday — {{email}} hadda wuxuu samayn karaa eray cusub adigoo isticmaalaya “Waan ilmo erayga”'],
  emailNotFound: ['Student email not found', 'Iimeelii barataa hin argamne', 'የተማሪው ኢሜይል አልተገኘም', 'Iimaylka ardayga lama helin'],
  setNewPwBtn: ['Set new password', 'Passwordii haaraa kaa’i', 'አዲስ የይለፍ ቃል ያዘጋጁ', 'Deji eray cusub'],
  noPayReqYet: ['No payment request yet — 🔓 Open Package will appear here once this student requests payment.', 'Begii kaffaltii hin jiru — 🔓 Herrega Banuu akka barataan kanaan kaffaltii gaafatu bittaa agarsiima.', 'እስካሁን የክፍያ ጥያቄ የለም — 🔓 ኩብ መክፈት ይህ ተማሪ ክፍያ ሲጠይቅ እዚህ ይታያል።', 'Weli codsi lacag-bixin ma jiro — 🔓 Furista Baakijka waxay halkan ka soo bixi doontaa marka ardaygu lacag-bixin coddo.'],
  confirmDeleteStudent: ['Delete {{name}}? This cannot be undone.', '{{name}} haqi? Kun hin deebi’u.', '{{name}} ይሰርዝ? ይህ ሊመለስ አይችልም።', '{{name}} ma tirtiraa? Kani dib looma noqon karo.'],
  studentDeleted: ['Student deleted', 'Barataa haqame', 'ተማሪው ተሰርዟል', 'Ardayga waa la tirtiray'],
  unlockedItems: ['Unlocked items', 'Meeshaalee banataman', 'የተከፈቱ እቃዎች', 'Waxyaabaha la furay'],
  fullPackageChip: ['Full package', 'Pakii guutuu', 'ሙሉ ጥቅል', 'Baakijka buuxa'],
  expShort: ['exp', 'bitaa', 'ጊዜው', 'dhammaadka'],
  nothingUnlocked: ['Nothing unlocked yet', 'Watii banatame hin jiru', 'እስካሁን ምንም አልተከፈተም', 'Weli waxba lama furin'],
  cantPreview: ["can't preview here, click to download & open", 'harkatti fuuliinii hin dandeenye, dorkaa & banuu cuqaasi', 'እዚህ ቅድመ ዕይታ አይቻልም፣ ለማውረድና ለመክፈት ይጫኑ', 'horudhac halkan ma samayn karto, riix si aad u soo dejiso oo furto'],
  noContentAttached: ['No content attached', 'Qabiyyee walqabatamee hin jiru', 'የተያዘ ይዘት የለም', 'Waxyaabo lagu daray ma jiro']
};
// tiny sanity checks on a few exact-anchored values
if (K.noPayReqs[0] !== 'No payment requests yet') throw new Error('noPayReqs en mismatch');
if (!K.approveOpen[0].includes('Approve &')) throw new Error('approveOpen must contain "Approve &"');
if (K.noPayReqYet[0].indexOf('No payment request yet') !== 0) throw new Error('noPayReqYet must start with singular anchor');

const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
const starts = {};
for (const l of ['en', 'om', 'am', 'so']) starts[l] = src.indexOf(`const ${l} = {`);
starts['end'] = src.indexOf('export default');

// insert from LAST block to FIRST so pre-computed offsets stay valid
let insertions = 0;
for (const idx of [3, 2, 1, 0]) {
  const l = ['en', 'om', 'am', 'so'][idx];
  const from = starts[l];
  const to = idx < 3 ? starts[['en', 'om', 'am', 'so'][idx + 1]] : starts['end'];
  const block = src.slice(from, to);
  const closeIdx = block.lastIndexOf('\n};');
  if (closeIdx < 0) throw new Error('close not found for ' + l);
  let chunk = '';
  for (const [k, vals] of Object.entries(K)) chunk += `  ${k}: '${esc(vals[idx])}',\n`;
  const abs = from + closeIdx;
  const tail = src.slice(0, abs).replace(/\s+$/, '');
  const needComma = !tail.endsWith(',');
  src = tail + (needComma ? ',' : '') + '\n' + chunk.trimEnd() + src.slice(abs);
  insertions++;
}
fs.writeFileSync(FILE, src);
console.log('inserted blocks:', insertions, 'keys:', Object.keys(K).length);

// verify all four blocks parse: quick count per key
const check = fs.readFileSync(FILE, 'utf8');
for (const k of Object.keys(K)) {
  const c = (check.match(new RegExp(`(?:^|[\\s{,])${k}\\s*:`, 'g')) || []).length;
  if (c !== 4) throw new Error(`key ${k} defined ${c} times (want 4)`);
}
for (const k of dead) {
  const c = (check.match(new RegExp(`(?:^|[\\s{,])${k}\\s*:`, 'g')) || []).length;
  if (c !== 0) throw new Error(`dead key ${k} still present ${c}`);
}
console.log('i18n.js OK: all keys x4, dead keys gone');

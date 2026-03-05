/**
 * اختبارات التقويم الهجري — Node.js
 * التحقق من المستوى 1 (حسابي) والمستوى 2 (فلكي) والتصحيحات
 */

const fs = require('fs');
const vm = require('vm');

// Mock localStorage for Node.js
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
    removeItem(k) { delete this._data[k]; }
};

vm.runInThisContext(fs.readFileSync('./hijri.js', 'utf8'));
const H = HijriCalendar;

let passed = 0, failed = 0;

function assert(cond, desc) {
    if (cond) { console.log(`  \x1b[32m✓ ${desc}\x1b[0m`); passed++; }
    else { console.log(`  \x1b[31m✗ ${desc}\x1b[0m`); failed++; }
}

function header(t) { console.log(`\n\x1b[33m═══ ${t} ═══\x1b[0m`); }

// ═══════════════════════════════════════════════════════════
// 1. المستوى 1 — الحسابي (التوفيقات الإلهامية)
// ═══════════════════════════════════════════════════════════
header('1. Tabular Mode — Leap Years');
H.setMode('tabular');
const expectedLeap = [2, 5, 7, 10, 13, 15, 18, 21, 24, 26, 29];
for (let i = 1; i <= 30; i++) {
    assert(H.Tabular.isLeapYear(i) === expectedLeap.includes(i), `Year ${i}`);
}

header('1b. Tabular — 30-year cycle');
let total30 = 0;
for (let i = 1; i <= 30; i++) total30 += H.Tabular.daysInYear(i);
assert(total30 === 10631, `30-year cycle = ${total30} (expected 10631)`);

header('1c. Tabular — Known dates');
H.setMode('tabular');
const tab_ram1446 = H.hijriToGregorian(1446, 9, 1);
assert(tab_ram1446.year === 2025 && tab_ram1446.month === 3 && tab_ram1446.day === 1,
    `1 Ramadan 1446 → ${tab_ram1446.year}-${tab_ram1446.month}-${tab_ram1446.day}`);

const tab_ram1447 = H.hijriToGregorian(1447, 9, 1);
assert(tab_ram1447.year === 2026 && tab_ram1447.month === 2 && tab_ram1447.day === 18,
    `1 Ramadan 1447 → ${tab_ram1447.year}-${tab_ram1447.month}-${tab_ram1447.day}`);

const tab_shaw1447 = H.hijriToGregorian(1447, 10, 1);
assert(tab_shaw1447.year === 2026 && tab_shaw1447.month === 3 && tab_shaw1447.day === 20,
    `1 Shawwal 1447 → ${tab_shaw1447.year}-${tab_shaw1447.month}-${tab_shaw1447.day}`);

header('1d. Tabular — Roundtrip');
const tabDates = [[1,1,1],[2,12,30],[1446,9,1],[1447,10,1],[1500,12,29]];
tabDates.forEach(([y,m,d]) => {
    const jdn = H.hijriToJDN(y,m,d);
    const back = H.jdnToHijri(jdn);
    assert(back.year===y && back.month===m && back.day===d,
        `Roundtrip ${y}-${m}-${d}`);
});

// ═══════════════════════════════════════════════════════════
// 2. المستوى 2 — الفلكي
// ═══════════════════════════════════════════════════════════
header('2. Astronomical Mode — New Moon calculation');
H.setMode('astronomical');

// Check month lengths are reasonable (29 or 30 days)
for (let m = 1; m <= 12; m++) {
    const days = H.daysInMonth(1447, m);
    assert(days === 29 || days === 30,
        `1447 month ${m}: ${days} days`);
}

header('2b. Astronomical — Year 1447 total days');
const y1447days = H.daysInYear(1447);
assert(y1447days === 354 || y1447days === 355,
    `Year 1447 = ${y1447days} days`);

header('2c. Astronomical — Known dates (approximate ±1 day)');
// الفلكي قد يختلف عن الحسابي بيوم أو يومين
const ast_ram1447 = H.hijriToGregorian(1447, 9, 1);
const diff_ram = Math.abs(
    H.gregorianToJDN(ast_ram1447.year, ast_ram1447.month, ast_ram1447.day) -
    H.gregorianToJDN(2026, 2, 18)
);
assert(diff_ram <= 2,
    `1 Ramadan 1447 astro → ${ast_ram1447.year}-${ast_ram1447.month}-${ast_ram1447.day} (diff=${diff_ram} from tabular)`);
console.log(`    Astronomical: ${ast_ram1447.year}-${ast_ram1447.month}-${ast_ram1447.day}`);
console.log(`    Tabular:      2026-2-18`);

const ast_shaw1447 = H.hijriToGregorian(1447, 10, 1);
const diff_shaw = Math.abs(
    H.gregorianToJDN(ast_shaw1447.year, ast_shaw1447.month, ast_shaw1447.day) -
    H.gregorianToJDN(2026, 3, 20)
);
assert(diff_shaw <= 2,
    `1 Shawwal 1447 astro → ${ast_shaw1447.year}-${ast_shaw1447.month}-${ast_shaw1447.day} (diff=${diff_shaw} from tabular)`);

header('2d. Astronomical — Roundtrip');
const astroDates = [[1447,1,1],[1447,6,15],[1447,9,1],[1447,12,1]];
astroDates.forEach(([y,m,d]) => {
    const jdn = H.hijriToJDN(y,m,d);
    const back = H.jdnToHijri(jdn);
    assert(back.year===y && back.month===m && back.day===d,
        `Roundtrip ${y}-${m}-${d}`);
});

// ═══════════════════════════════════════════════════════════
// 3. التصحيحات اليدوية
// ═══════════════════════════════════════════════════════════
header('3. User Corrections');
H.setMode('tabular');
H.clearCorrections();

// بدون تصحيح
const base = H.hijriToGregorian(1447, 9, 1);
console.log(`    Base: 1 Ramadan 1447 = ${base.year}-${base.month}-${base.day}`);

// تصحيح +1 يوم
H.setCorrection(1447, 9, 1);
const corrected = H.hijriToGregorian(1447, 9, 1);
console.log(`    +1 correction: 1 Ramadan 1447 = ${corrected.year}-${corrected.month}-${corrected.day}`);
assert(
    H.gregorianToJDN(corrected.year, corrected.month, corrected.day) -
    H.gregorianToJDN(base.year, base.month, base.day) === 1,
    `+1 correction shifts date by 1 day`);

// التصحيح يسري على الشهور التالية
const correctedShaw = H.hijriToGregorian(1447, 10, 1);
const baseShaw = H.Tabular.hijriToJDN(1447, 10, 1);
const corrShawJDN = H.hijriToJDN(1447, 10, 1);
assert(corrShawJDN - baseShaw === 1,
    `Correction propagates: Shawwal shifted by 1`);

// تصحيح -1 يوم
H.setCorrection(1447, 9, -1);
const correctedMinus = H.hijriToGregorian(1447, 9, 1);
assert(
    H.gregorianToJDN(correctedMinus.year, correctedMinus.month, correctedMinus.day) -
    H.gregorianToJDN(base.year, base.month, base.day) === -1,
    `-1 correction shifts date back by 1 day`);

// مسح التصحيحات
H.clearCorrections();
const afterClear = H.hijriToGregorian(1447, 9, 1);
assert(afterClear.year === base.year && afterClear.month === base.month && afterClear.day === base.day,
    `Clear restores original date`);

// ═══════════════════════════════════════════════════════════
// 4. تبديل الأنماط
// ═══════════════════════════════════════════════════════════
header('4. Mode Switching');
H.setMode('tabular');
assert(H.getMode() === 'tabular', 'Mode = tabular');
H.setMode('astronomical');
assert(H.getMode() === 'astronomical', 'Mode = astronomical');

// ═══════════════════════════════════════════════════════════
// 5. Today
// ═══════════════════════════════════════════════════════════
header('5. Today');
H.setMode('astronomical');
H.clearCorrections();
const today = H.todayHijri();
console.log(`    Today (astronomical): ${today.year}-${today.month}-${today.day} (${H.MONTH_NAMES[today.month-1]})`);
H.setMode('tabular');
const todayTab = H.todayHijri();
console.log(`    Today (tabular):      ${todayTab.year}-${todayTab.month}-${todayTab.day} (${H.MONTH_NAMES[todayTab.month-1]})`);

// ═══════════════════════════════════════════════════════════
// 6. معادلة زايد — حساب سهيل بخط العرض
// ═══════════════════════════════════════════════════════════
header('6. Zayed Equation — Suhail by Latitude');

// المرجع: ليوا 23°ش → 15 أغسطس
const z23 = H.calcSuhailByZayed(23);
assert(z23 && z23[0] === 8 && z23[1] === 15, 'Liwa 23°N → Aug 15 (reference)');

// دبي 25.2° → ~18 أغسطس
const zDubai = H.calcSuhailByZayed(25.2);
assert(zDubai && zDubai[0] === 8 && zDubai[1] === 18, 'Dubai 25.2°N → Aug 18');

// الكويت 29.4° → ~23 أغسطس
const zKuwait = H.calcSuhailByZayed(29.4);
assert(zKuwait && zKuwait[0] === 8 && zKuwait[1] === 23, 'Kuwait 29.4°N → Aug 23');

// بغداد 33.3° → ~2 سبتمبر (2.67 × 3.3 = 8.8 ≈ 9 أيام → 24 أغسطس + 9 = 2 سبتمبر)
const zBaghdad = H.calcSuhailByZayed(33.3);
assert(zBaghdad && zBaghdad[0] === 9 && zBaghdad[1] === 2, 'Baghdad 33.3°N → Sep 2');

// عدن 12.8° → ~27 يوليو
const zAden = H.calcSuhailByZayed(12.8);
assert(zAden && zAden[0] === 7 && zAden[1] === 27, 'Aden 12.8°N → Jul 27');

// أبوظبي 24.5° → ~17 أغسطس
const zAbuDhabi = H.calcSuhailByZayed(24.5);
assert(zAbuDhabi && zAbuDhabi[0] === 8 && zAbuDhabi[1] === 17, 'Abu Dhabi 24.5°N → Aug 17');

// خارج النطاق
const zOut = H.calcSuhailByZayed(10);
assert(zOut === null, 'Lat 10°N → null (outside range)');

// الحد الأقصى 36° → 9 سبتمبر
const z36 = H.calcSuhailByZayed(36);
assert(z36 && z36[0] === 9 && z36[1] === 9, 'Lat 36°N → Sep 9 (max)');

header('6b. Schwab Emirates Criterion');
// 15 أغسطس + 90 = 13 نوفمبر → acceptable (13 خارج نافذة 14-23 لكن في نوفمبر)
assert(H.verifyEmiratesElderly(8, 15) === 'acceptable', 'Aug 15 + 90d = Nov 13 → acceptable');

// 24 أغسطس + 90 = 22 نوفمبر → exact
assert(H.verifyEmiratesElderly(8, 24) === 'exact', 'Aug 24 + 90d = Nov 22 → exact');

// 9 سبتمبر + 90 = 8 ديسمبر → outside
assert(H.verifyEmiratesElderly(9, 9) === 'outside', 'Sep 9 + 90d = Dec 8 → outside');

// 26 يوليو + 90 = 23 أكتوبر → outside
assert(H.verifyEmiratesElderly(7, 26) === 'outside', 'Jul 26 + 90d = Oct 23 → outside');

// 3 أغسطس + 90 = 1 نوفمبر → acceptable
assert(H.verifyEmiratesElderly(8, 3) === 'acceptable', 'Aug 3 + 90d = Nov 1 → acceptable');

header('6c. getSuhailRegion with Zayed');
const rUAE = H.getSuhailRegion(24.5, 54.7);
assert(rUAE && rUAE.source === 'zayed', 'Abu Dhabi region source = zayed');
assert(rUAE && rUAE.month === 8 && rUAE.day === 17, 'Abu Dhabi region date = Aug 17');
assert(rUAE && rUAE.emiratesElderly, 'Abu Dhabi has Schwab Emirates verification');
assert(rUAE && rUAE.ar === 'أبوظبي', 'Abu Dhabi keeps city name');

// ═══════════════════════════════════════════════════════════
header('SUMMARY');
console.log(`  Total: ${passed + failed} tests — \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m`);
if (failed === 0) console.log('  \x1b[32m✓ ALL TESTS PASSED\x1b[0m');
else { console.log(`  \x1b[31m✗ ${failed} TESTS FAILED\x1b[0m`); process.exit(1); }

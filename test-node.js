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
header('SUMMARY');
console.log(`  Total: ${passed + failed} tests — \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m`);
if (failed === 0) console.log('  \x1b[32m✓ ALL TESTS PASSED\x1b[0m');
else { console.log(`  \x1b[31m✗ ${failed} TESTS FAILED\x1b[0m`); process.exit(1); }

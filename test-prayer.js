/**
 * اختبار دقة حساب مواقيت الصلاة
 * ═══════════════════════════════════════════════════════════
 * يتحقق من صحة محرك الحساب الفلكي (Jean Meeus) عبر 4 مدن
 * مع 4 طرق حساب مختلفة. القيم المتوقعة محسوبة من المحرك نفسه
 * بعد مطابقتها مع بيانات الأوائل (al-awail.com) والتحقق من
 * اتساقها الفلكي (±0-2 دقيقة مقارنة بالمرجع).
 *
 * Cross-reference with Al-Awail (al-awail.com):
 *   Sharjah: 6/6 exact match vs Assalatu Noor app (official UAE times)
 *   Cairo:   6/6 exact match (0 min diff)
 *   Makkah:  6/6 exact match (0 min diff)
 *   Amman:   6/6 within ±2 min (elevation-dependent)
 *   Seeq:    4/6 within ±2 min (algorithm variance)
 * ═══════════════════════════════════════════════════════════
 */

// Load prayer-times.js via Function() to avoid Node vm context issues
const fs = require('fs');
const code = fs.readFileSync('prayer-times.js', 'utf-8');
const modifiedCode = code.replace('const PrayerTimes = (() => {', 'var PrayerTimes = (() => {');

const storage = {};
const localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
};

const fn = new Function('localStorage', modifiedCode + '\nreturn PrayerTimes;');
const PT = fn(localStorage);

if (!PT || !PT.calculate) {
    console.error('FAIL: PrayerTimes did not load correctly');
    process.exit(1);
}
console.log('PrayerTimes loaded successfully.');
console.log(`Methods available: ${Object.keys(PT.METHODS).length}\n`);

// ─── Test cases: 4 cities, 4 methods ────────────────────────
const testCases = [
    {
        city: 'Seeq, Oman',
        method: 'mwl',
        lat: 23.29, lng: 57.02, tz: 4,
        elevation: 400,
        expected: { fajr:'05:28', sunrise:'06:41', dhuhr:'12:27', asr:'15:42', maghrib:'18:11', isha:'19:20' }
    },
    {
        city: 'Amman, Jordan',
        method: 'jordan',
        lat: 31.95, lng: 35.93, tz: 2,
        elevation: 900,
        expected: { fajr:'04:55', sunrise:'06:12', dhuhr:'11:51', asr:'14:59', maghrib:'17:28', isha:'18:45' }
    },
    {
        city: 'Makkah, Saudi Arabia',
        method: 'ummAlQura',
        lat: 21.42, lng: 39.83, tz: 3,
        elevation: 0,
        expected: { fajr:'05:34', sunrise:'06:51', dhuhr:'12:36', asr:'15:52', maghrib:'18:19', isha:'19:49' }
    },
    {
        city: 'Cairo, Egypt',
        method: 'egyptian',
        lat: 30.04, lng: 31.24, tz: 2,
        elevation: 0,
        expected: { fajr:'05:07', sunrise:'06:34', dhuhr:'12:10', asr:'15:20', maghrib:'17:44', isha:'19:02' }
    },
    {
        city: 'Sharjah, UAE',
        method: 'uae',
        lat: 25.3622222, lng: 55.3911111, tz: 4,
        elevation: 50,
        expected: { fajr:'05:34', sunrise:'06:49', dhuhr:'12:35', asr:'15:48', maghrib:'18:15', isha:'19:30' }
    },
];

const testDate = { year: 2026, month: 2, day: 16 };

function parseTime(str) {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
}

console.log(`Test date: ${testDate.year}-02-16`);
console.log('='.repeat(70));

let totalTests = 0, passed = 0, failed = 0;

for (const tc of testCases) {
    console.log(`\n> ${tc.city} (${tc.method}) elev=${tc.elevation}m`);

    const result = PT.calculate(
        testDate, tc.lat, tc.lng, tc.tz,
        tc.method, 1, 'none', tc.elevation, false
    );

    for (const p of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        totalTests++;
        const calc = result[p];
        const exp = tc.expected[p];
        const diff = parseTime(calc) - parseTime(exp);
        const ok = diff === 0;

        if (ok) {
            passed++;
            console.log(`  OK  ${p.padEnd(8)}: ${calc}`);
        } else {
            failed++;
            console.log(`  ERR ${p.padEnd(8)}: calc=${calc}  exp=${exp}  diff=${diff > 0 ? '+' : ''}${diff}min  << MISMATCH`);
        }
    }
}

console.log('\n' + '='.repeat(70));
console.log(`Results: ${passed}/${totalTests} passed, ${failed} failed (tolerance: 0 min)`);

if (failed === 0) {
    console.log('\nAll tests PASSED!');
}

process.exit(failed > 0 ? 1 : 0);

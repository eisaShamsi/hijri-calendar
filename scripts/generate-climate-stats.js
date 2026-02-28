#!/usr/bin/env node
/**
 * generate-climate-stats.js
 * جلب 80 سنة من بيانات الطقس التاريخية من Open-Meteo وتحليلها
 * لتأكيد التكرار السنوي للأنواء والدرور والرياح والمواسم
 *
 * الاستخدام: node scripts/generate-climate-stats.js
 * المخرجات: climate-stats.json
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

// ══════════════════════════════════════════════
// الإعدادات
// ══════════════════════════════════════════════
const LAT = 24.45;
const LNG = 54.65;
const TIMEZONE = 'Asia/Dubai';
const START_YEAR = 1946;
const END_YEAR = 2025;
const DAILY_VARS = [
    'temperature_2m_max', 'temperature_2m_min', 'temperature_2m_mean',
    'precipitation_sum', 'windspeed_10m_max', 'winddirection_10m_dominant',
    'relative_humidity_2m_max', 'weather_code', 'sunshine_duration'
].join(',');

const RAW_CACHE = path.join(__dirname, 'raw-weather-cache.json');
const OUTPUT = path.join(__dirname, '..', 'climate-stats.json');

// ══════════════════════════════════════════════
// المرحلة 0 — تحميل بيانات hijri.js
// ══════════════════════════════════════════════
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'hijri.js'), 'utf8'));
const H = HijriCalendar;

// استخراج البيانات الخام
const TAWALIE = H.TAWALIE;
const DURR_DETAILS = H.DURR_DETAILS;
const ENRICHMENT = H.ANWA_ENRICHMENT;
const SEASONS = H.SEASONS;
const SPECIAL_SEASONS = H.SPECIAL_SEASONS;

console.log(`\x1b[33m═══ مولّد الإحصائيات المناخية (${START_YEAR}–${END_YEAR}) ═══\x1b[0m`);
console.log(`  الأنواء: ${TAWALIE.length} | الدرور: ${Object.keys(DURR_DETAILS).length} | الرياح: ${ENRICHMENT.seasonalWinds.length}`);
console.log(`  المواسم: ${SEASONS.length}+${SPECIAL_SEASONS.length} | الضربات: ${ENRICHMENT.seaStrikes.length}`);

// ══════════════════════════════════════════════
// أدوات مساعدة
// ══════════════════════════════════════════════
function matchRange(gMonth, gDay, from, to) {
    const d = gMonth * 100 + gDay;
    const f = from[0] * 100 + from[1];
    const t = to[0] * 100 + to[1];
    if (f <= t) return d >= f && d <= t;
    return d >= f || d <= t;
}

function suhailDay(gMonth, gDay, gYear) {
    const start = new Date(gYear, 7, 15);
    let target = new Date(gYear, gMonth - 1, gDay);
    if (target < start) start.setFullYear(gYear - 1);
    return Math.floor((target - start) / 86400000) + 1;
}

function getDurrKey(gMonth, gDay, gYear) {
    const sDay = suhailDay(gMonth, gDay, gYear);
    let mia, idx;
    if (sDay <= 100) { mia = 0; idx = Math.ceil(sDay / 10) - 1; }
    else if (sDay <= 200) { mia = 1; idx = Math.ceil((sDay - 100) / 10) - 1; }
    else if (sDay <= 300) { mia = 2; idx = Math.ceil((sDay - 200) / 10) - 1; }
    else { mia = 3; idx = Math.min(Math.ceil((sDay - 300) / 10) - 1, 5); }
    if (idx < 0) idx = 0;
    if (idx > 9) idx = 9;
    return `${mia}-${idx}`;
}

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function percentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const i = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** الاتجاه السائد — إحصائيات دائرية */
function dominantDirection(dirs) {
    if (!dirs.length) return 0;
    let sinSum = 0, cosSum = 0;
    for (const d of dirs) {
        const rad = d * Math.PI / 180;
        sinSum += Math.sin(rad);
        cosSum += Math.cos(rad);
    }
    let avg = Math.atan2(sinSum / dirs.length, cosSum / dirs.length) * 180 / Math.PI;
    if (avg < 0) avg += 360;
    return Math.round(avg);
}

/** تحويل اتجاه الدرجات إلى اسم عربي من بوصلة الرياح */
function dirToArabic(deg) {
    const compass = ENRICHMENT.windCompass;
    let best = compass[0], minDiff = 999;
    for (const c of compass) {
        let diff = Math.abs(deg - c.degree);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) { minDiff = diff; best = c; }
    }
    return best.ar;
}

/** توزيع اتجاهات الرياح على 8 قطاعات */
function windDirDistribution(dirs) {
    const sectors = { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0, NW: 0 };
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (const d of dirs) {
        const idx = Math.round(d / 45) % 8;
        sectors[labels[idx]]++;
    }
    const total = dirs.length || 1;
    for (const k of labels) sectors[k] = Math.round(sectors[k] / total * 100) / 100;
    return sectors;
}

// ══════════════════════════════════════════════
// المرحلة 1 — جلب البيانات من Open-Meteo
// ══════════════════════════════════════════════
function fetchChunk(startDate, endDate, retries = 3) {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LNG}&start_date=${startDate}&end_date=${endDate}&daily=${DAILY_VARS}&timezone=${TIMEZONE}`;
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (data.error || data.reason) {
                        if (retries > 0 && (data.reason || '').includes('limit')) {
                            console.log(`  \x1b[33m⏳ تجاوز الحد — إعادة بعد 65 ثانية (${retries} محاولات متبقية)...\x1b[0m`);
                            await new Promise(r => setTimeout(r, 65000));
                            resolve(fetchChunk(startDate, endDate, retries - 1));
                        } else {
                            reject(new Error(data.reason || data.error));
                        }
                    } else resolve(data);
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function fetchAllData() {
    // تحقق من الكاش
    if (fs.existsSync(RAW_CACHE)) {
        console.log('  \x1b[36m⟳ تحميل البيانات من الكاش المحلي...\x1b[0m');
        return JSON.parse(fs.readFileSync(RAW_CACHE, 'utf8'));
    }

    const chunks = [];
    const step = 20;
    for (let y = START_YEAR; y <= END_YEAR; y += step) {
        const s = `${y}-01-01`;
        const e = `${Math.min(y + step - 1, END_YEAR)}-12-31`;
        console.log(`  \x1b[36m⟳ جلب ${s} → ${e} ...\x1b[0m`);
        const data = await fetchChunk(s, e);
        chunks.push(data);
        if (y + step <= END_YEAR) await new Promise(r => setTimeout(r, 5000));
    }

    // دمج البيانات
    const merged = { daily: {} };
    const keys = Object.keys(chunks[0].daily);
    for (const k of keys) merged.daily[k] = [];
    for (const chunk of chunks) {
        for (const k of keys) {
            merged.daily[k].push(...chunk.daily[k]);
        }
    }

    // حفظ الكاش
    fs.writeFileSync(RAW_CACHE, JSON.stringify(merged), 'utf8');
    console.log(`  \x1b[32m✓ تم حفظ ${merged.daily.time.length} يوم في الكاش\x1b[0m`);
    return merged;
}

// ══════════════════════════════════════════════
// المرحلة 2 — ربط الأيام بالفترات
// ══════════════════════════════════════════════
function buildDayRows(raw) {
    const n = raw.daily.time.length;
    const rows = [];
    for (let i = 0; i < n; i++) {
        const date = raw.daily.time[i];
        const parts = date.split('-');
        const gYear = +parts[0], gMonth = +parts[1], gDay = +parts[2];

        rows.push({
            gYear, gMonth, gDay,
            tMax: raw.daily.temperature_2m_max[i],
            tMin: raw.daily.temperature_2m_min[i],
            tMean: raw.daily.temperature_2m_mean[i],
            precip: raw.daily.precipitation_sum[i],
            windMax: raw.daily.windspeed_10m_max[i],
            windDir: raw.daily.winddirection_10m_dominant[i],
            humidity: raw.daily.relative_humidity_2m_max[i],
            wxCode: raw.daily.weather_code[i],
            sunshine: raw.daily.sunshine_duration[i]
        });
    }
    return rows;
}

function mapRowToPeriods(row) {
    const { gMonth, gDay, gYear } = row;

    // النوء (الطالع)
    let anwaIdx = -1;
    for (let i = 0; i < TAWALIE.length; i++) {
        if (matchRange(gMonth, gDay, TAWALIE[i].from, TAWALIE[i].to)) { anwaIdx = i; break; }
    }

    // الدر
    const durrKey = getDurrKey(gMonth, gDay, gYear);

    // الرياح (يمكن عدة رياح في نفس اليوم)
    const windIdxs = [];
    for (let i = 0; i < ENRICHMENT.seasonalWinds.length; i++) {
        const w = ENRICHMENT.seasonalWinds[i];
        if (matchRange(gMonth, gDay, w.from, w.to)) windIdxs.push(i);
    }

    // الموسم الأساسي
    let seasonIdx = -1;
    for (let i = 0; i < SEASONS.length; i++) {
        if (matchRange(gMonth, gDay, SEASONS[i].from, SEASONS[i].to)) { seasonIdx = i; break; }
    }

    // المواسم الخاصة
    const specialIdxs = [];
    for (let i = 0; i < SPECIAL_SEASONS.length; i++) {
        if (matchRange(gMonth, gDay, SPECIAL_SEASONS[i].from, SPECIAL_SEASONS[i].to)) specialIdxs.push(i);
    }

    // الضربات البحرية
    const strikeIdxs = [];
    for (let i = 0; i < ENRICHMENT.seaStrikes.length; i++) {
        if (matchRange(gMonth, gDay, ENRICHMENT.seaStrikes[i].from, ENRICHMENT.seaStrikes[i].to)) strikeIdxs.push(i);
    }

    return { anwaIdx, durrKey, windIdxs, seasonIdx, specialIdxs, strikeIdxs };
}

// ══════════════════════════════════════════════
// المرحلة 3 — حساب الإحصائيات
// ══════════════════════════════════════════════
function computeStats(rows) {
    const valid = rows.filter(r => r.tMax != null && r.tMin != null);
    if (!valid.length) return null;

    const tMaxArr = valid.map(r => r.tMax);
    const tMinArr = valid.map(r => r.tMin);
    const tMeanArr = valid.filter(r => r.tMean != null).map(r => r.tMean);
    const precipArr = valid.filter(r => r.precip != null).map(r => r.precip);
    const rainyDays = precipArr.filter(p => p > 0.1);
    const windMaxArr = valid.filter(r => r.windMax != null).map(r => r.windMax);
    const windDirArr = valid.filter(r => r.windDir != null).map(r => r.windDir);
    const humArr = valid.filter(r => r.humidity != null).map(r => r.humidity);
    const sunArr = valid.filter(r => r.sunshine != null).map(r => r.sunshine);
    const wxArr = valid.filter(r => r.wxCode != null).map(r => r.wxCode);

    const n = valid.length;

    // توزيع رموز الطقس
    const clearDays = wxArr.filter(c => c >= 0 && c <= 3).length;
    const fogDays = wxArr.filter(c => c >= 45 && c <= 48).length;
    const rainDays = wxArr.filter(c => (c >= 51 && c <= 67) || (c >= 80 && c <= 82)).length;
    const stormDays = wxArr.filter(c => c >= 95 && c <= 99).length;

    const r1 = (v) => Math.round(v * 10) / 10;

    return {
        n,
        temp: {
            aMax: r1(mean(tMaxArr)),
            aMin: r1(mean(tMinArr)),
            aMean: r1(tMeanArr.length ? mean(tMeanArr) : (mean(tMaxArr) + mean(tMinArr)) / 2),
            xMax: r1(Math.max(...tMaxArr)),
            xMin: r1(Math.min(...tMinArr)),
            p10: r1(percentile(tMaxArr, 10)),
            p90: r1(percentile(tMaxArr, 90))
        },
        rain: {
            prob: r1(precipArr.length ? rainyDays.length / precipArr.length : 0),
            aRain: r1(rainyDays.length ? mean(rainyDays.map(r => r)) : 0),
            xRain: r1(precipArr.length ? Math.max(...precipArr) : 0)
        },
        wind: {
            aMax: r1(windMaxArr.length ? mean(windMaxArr) : 0),
            xMax: r1(windMaxArr.length ? Math.max(...windMaxArr) : 0),
            dir: dominantDirection(windDirArr),
            dirAr: dirToArabic(dominantDirection(windDirArr))
        },
        hum: r1(humArr.length ? mean(humArr) : 0),
        sun: r1(sunArr.length ? mean(sunArr) / 3600 : 0),
        wx: {
            clear: r1(wxArr.length ? clearDays / wxArr.length : 0),
            fog: r1(wxArr.length ? fogDays / wxArr.length : 0),
            rain: r1(wxArr.length ? rainDays / wxArr.length : 0),
            storm: r1(wxArr.length ? stormDays / wxArr.length : 0)
        }
    };
}

// ══════════════════════════════════════════════
// المرحلة 4 — حساب نسبة التطابق
// ══════════════════════════════════════════════
const CLAIM_PATTERNS = [
    { type: 'temp_extreme_hot', re: /أشد.*حر|ذروة.*القيظ|جمرة|تتجاوز ٥٠|50°|peak.*heat|extreme.*heat|most extreme heat/i },
    { type: 'temp_hot', re: /حر|حار|ارتفاع الحرارة|الحر|heat|hot/i },
    { type: 'temp_moderate', re: /معتدل|اعتدال|moderate/i },
    { type: 'temp_cold', re: /برد|بارد|cold/i },
    { type: 'temp_extreme_cold', re: /صقيع|قارس|أشد.*برد|أبرد|peak cold|extreme cold|coldest|intense cold/i },
    { type: 'temp_cooling', re: /انكسار.*حر|يبرد|تبرد|cool|heat.*break|decline/i },
    { type: 'rain_likely', re: /أمطار|مطر|rain|precipitation/i },
    { type: 'rain_heavy', re: /غزير|كثرة الأمطار|abundant rain|heavy rain/i },
    { type: 'rain_none', re: /لا أمطار|لا سحب|جاف|no rain|no cloud|dry/i },
    { type: 'humid_high', re: /رطوبة عالية|ارتفاع الرطوبة|high humidity/i },
    { type: 'humid_low', re: /جاف|جفاف|dry|dryness/i },
    { type: 'wind_strong', re: /رياح قوية|عواصف|شديدة|strong wind|storm/i },
    { type: 'wind_north', re: /رياح.*شمال|شمالية|north.*wind/i },
    { type: 'wind_south', re: /رياح.*جنوب|جنوبية|south.*wind|كوس|monsoon/i },
    { type: 'wind_nw', re: /شمالية غربية|بوارح|NW wind|dry NW/i },
    { type: 'wind_dust', re: /غبار|ترابية|dust/i },
    { type: 'fog', re: /ضباب|fog/i },
    { type: 'thunder', re: /رعدية|thunder/i },
];

function extractClaims(text) {
    if (!text) return [];
    const claims = [];
    for (const p of CLAIM_PATTERNS) {
        if (p.re.test(text)) claims.push(p.type);
    }
    return [...new Set(claims)]; // إزالة التكرار
}

function verifyClaim(type, stats, prevStats) {
    if (!stats) return null;
    const t = stats.temp;
    switch (type) {
        case 'temp_extreme_hot': return t.aMax >= 42 && t.p90 >= 44;
        case 'temp_hot': return t.aMax >= 35;
        case 'temp_moderate': return t.aMean >= 18 && t.aMean <= 30;
        case 'temp_cold': return t.aMin <= 18;
        case 'temp_extreme_cold': return t.xMin <= 8 || t.aMin <= 14;
        case 'temp_cooling': return prevStats ? t.aMean < prevStats.temp.aMean : t.aMax < 40;
        case 'rain_likely': return stats.rain.prob >= 0.03;
        case 'rain_heavy': return stats.rain.prob >= 0.1;
        case 'rain_none': return stats.rain.prob < 0.02;
        case 'humid_high': return stats.hum >= 55;
        case 'humid_low': return stats.hum <= 45;
        case 'wind_strong': return stats.wind.aMax >= 22 || stats.wind.xMax >= 50;
        case 'wind_north': { const d = stats.wind.dir; return (d >= 315 || d <= 45); }
        case 'wind_south': { const d = stats.wind.dir; return d >= 135 && d <= 225; }
        case 'wind_nw': { const d = stats.wind.dir; return d >= 270 && d <= 360; }
        case 'wind_dust': return stats.wind.aMax >= 20 && stats.hum <= 45;
        case 'fog': return stats.hum >= 65 && stats.wx.fog >= 0.02;
        case 'thunder': return stats.wx.storm >= 0.01 || stats.wx.rain >= 0.05;
        default: return null;
    }
}

function computeMatchScore(textAr, textEn, stats, prevStats) {
    const claims = [...new Set([...extractClaims(textAr), ...extractClaims(textEn)])];
    if (!claims.length) return null;

    let matched = 0, total = 0;
    for (const c of claims) {
        const result = verifyClaim(c, stats, prevStats);
        if (result === null) continue;
        total++;
        if (result) matched++;
    }
    return total > 0 ? Math.round((matched / total) * 100) : null;
}

// ══════════════════════════════════════════════
// المرحلة 5 — تجميع النتائج
// ══════════════════════════════════════════════
async function main() {
    // 1. جلب البيانات
    console.log('\n\x1b[33m─── المرحلة 1: جلب البيانات ───\x1b[0m');
    const raw = await fetchAllData();
    const rows = buildDayRows(raw);
    console.log(`  \x1b[32m✓ ${rows.length} يوم من البيانات\x1b[0m`);

    // 2. ربط وتصنيف
    console.log('\n\x1b[33m─── المرحلة 2: ربط الأيام بالفترات ───\x1b[0m');
    const buckets = {
        anwa: {},    // مفتاح: فهرس 0-27
        duror: {},   // مفتاح: 'mia-durr'
        winds: {},   // مفتاح: فهرس 0-20
        seasons: {}, // مفتاح: فهرس 0-13
        special: {}, // مفتاح: فهرس 0-17
        strikes: {}, // مفتاح: فهرس 0-4
        daily: {}    // مفتاح: 'MM-DD' (يوم من السنة)
    };

    for (const row of rows) {
        const map = mapRowToPeriods(row);

        // النوء
        if (map.anwaIdx >= 0) {
            if (!buckets.anwa[map.anwaIdx]) buckets.anwa[map.anwaIdx] = [];
            buckets.anwa[map.anwaIdx].push(row);
        }

        // الدر
        if (!buckets.duror[map.durrKey]) buckets.duror[map.durrKey] = [];
        buckets.duror[map.durrKey].push(row);

        // الرياح
        for (const wi of map.windIdxs) {
            if (!buckets.winds[wi]) buckets.winds[wi] = [];
            buckets.winds[wi].push(row);
        }

        // الموسم
        if (map.seasonIdx >= 0) {
            if (!buckets.seasons[map.seasonIdx]) buckets.seasons[map.seasonIdx] = [];
            buckets.seasons[map.seasonIdx].push(row);
        }

        // مواسم خاصة
        for (const si of map.specialIdxs) {
            if (!buckets.special[si]) buckets.special[si] = [];
            buckets.special[si].push(row);
        }

        // ضربات بحرية
        for (const st of map.strikeIdxs) {
            if (!buckets.strikes[st]) buckets.strikes[st] = [];
            buckets.strikes[st].push(row);
        }

        // يومي
        const dayKey = `${String(row.gMonth).padStart(2, '0')}-${String(row.gDay).padStart(2, '0')}`;
        if (!buckets.daily[dayKey]) buckets.daily[dayKey] = [];
        buckets.daily[dayKey].push(row);
    }

    console.log(`  \x1b[32m✓ تصنيف مكتمل\x1b[0m`);

    // 3. حساب الإحصائيات
    console.log('\n\x1b[33m─── المرحلة 3: حساب الإحصائيات ───\x1b[0m');

    const result = {
        meta: {
            location: 'Abu Dhabi, UAE',
            lat: LAT, lng: LNG,
            years: [START_YEAR, END_YEAR],
            totalDays: rows.length,
            generated: new Date().toISOString().split('T')[0],
            v: 1
        },
        anwa: {},
        duror: {},
        winds: {},
        seasons: {},
        special: {},
        strikes: {},
        daily: []
    };

    // الأنواء (28)
    let prevAnwaStats = null;
    for (let i = 0; i < TAWALIE.length; i++) {
        const t = TAWALIE[i];
        const stats = computeStats(buckets.anwa[i] || []);
        if (!stats) continue;
        const match = computeMatchScore(t.weatherAr, t.weatherEn, stats, prevAnwaStats);
        result.anwa[i] = { key: t.ar, ...stats, match };
        prevAnwaStats = stats;
    }
    console.log(`  \x1b[32m✓ الأنواء: ${Object.keys(result.anwa).length} نوء\x1b[0m`);

    // الدرور (37)
    const durrKeys = Object.keys(DURR_DETAILS).sort((a, b) => {
        const [am, ad] = a.split('-').map(Number);
        const [bm, bd] = b.split('-').map(Number);
        return am * 10 + ad - (bm * 10 + bd);
    });
    let prevDurrStats = null;
    for (const key of durrKeys) {
        const d = DURR_DETAILS[key];
        const stats = computeStats(buckets.duror[key] || []);
        if (!stats) continue;
        const match = computeMatchScore(d.ar, d.en, stats, prevDurrStats);
        result.duror[key] = { key: d.ar ? d.ar.substring(0, 30) : key, ...stats, match };
        prevDurrStats = stats;
    }
    console.log(`  \x1b[32m✓ الدرور: ${Object.keys(result.duror).length} دُرّ\x1b[0m`);

    // الرياح (21)
    for (let i = 0; i < ENRICHMENT.seasonalWinds.length; i++) {
        const w = ENRICHMENT.seasonalWinds[i];
        const stats = computeStats(buckets.winds[i] || []);
        if (!stats) continue;
        const match = computeMatchScore(w.desc_ar, w.desc_en, stats, null);
        // إضافة توزيع الاتجاهات
        const dirRows = (buckets.winds[i] || []).filter(r => r.windDir != null).map(r => r.windDir);
        const dirDist = windDirDistribution(dirRows);
        result.winds[i] = { key: w.ar, ...stats, dirDist, match };
    }
    console.log(`  \x1b[32m✓ الرياح: ${Object.keys(result.winds).length} ريح\x1b[0m`);

    // المواسم (14)
    for (let i = 0; i < SEASONS.length; i++) {
        const s = SEASONS[i];
        const stats = computeStats(buckets.seasons[i] || []);
        if (!stats) continue;
        result.seasons[i] = { key: s.ar, ...stats };
    }
    console.log(`  \x1b[32m✓ المواسم: ${Object.keys(result.seasons).length} موسم\x1b[0m`);

    // مواسم خاصة (18)
    for (let i = 0; i < SPECIAL_SEASONS.length; i++) {
        const s = SPECIAL_SEASONS[i];
        const stats = computeStats(buckets.special[i] || []);
        if (!stats) continue;
        const match = computeMatchScore(s.desc_ar, s.desc_en, stats, null);
        result.special[i] = { key: s.ar, ...stats, match };
    }
    console.log(`  \x1b[32m✓ مواسم خاصة: ${Object.keys(result.special).length}\x1b[0m`);

    // الضربات البحرية (5)
    for (let i = 0; i < ENRICHMENT.seaStrikes.length; i++) {
        const s = ENRICHMENT.seaStrikes[i];
        const stats = computeStats(buckets.strikes[i] || []);
        if (!stats) continue;
        result.strikes[i] = { key: s.ar, ...stats };
    }
    console.log(`  \x1b[32m✓ الضربات: ${Object.keys(result.strikes).length}\x1b[0m`);

    // المعدلات اليومية (366 يوم)
    const dailyArr = [];
    for (let m = 1; m <= 12; m++) {
        const daysInMonth = new Date(2024, m, 0).getDate(); // 2024 كبيسة
        for (let d = 1; d <= daysInMonth; d++) {
            const dayKey = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayRows = buckets.daily[dayKey] || [];
            if (dayRows.length) {
                const tMaxArr = dayRows.filter(r => r.tMax != null).map(r => r.tMax);
                const tMinArr = dayRows.filter(r => r.tMin != null).map(r => r.tMin);
                const precipArr = dayRows.filter(r => r.precip != null).map(r => r.precip);
                const humArr = dayRows.filter(r => r.humidity != null).map(r => r.humidity);
                dailyArr.push({
                    d: dayKey,
                    tMax: Math.round(mean(tMaxArr) * 10) / 10,
                    tMin: Math.round(mean(tMinArr) * 10) / 10,
                    rain: Math.round((precipArr.filter(p => p > 0.1).length / (precipArr.length || 1)) * 100) / 100,
                    hum: Math.round(mean(humArr))
                });
            }
        }
    }
    result.daily = dailyArr;
    console.log(`  \x1b[32m✓ معدلات يومية: ${dailyArr.length} يوم\x1b[0m`);

    // 4. نسب التطابق
    console.log('\n\x1b[33m─── المرحلة 4: نسب التطابق ───\x1b[0m');
    const anwaScores = Object.values(result.anwa).filter(a => a.match != null).map(a => a.match);
    const durrScores = Object.values(result.duror).filter(d => d.match != null).map(d => d.match);
    if (anwaScores.length) console.log(`  الأنواء — متوسط التطابق: ${Math.round(mean(anwaScores))}% (${Math.min(...anwaScores)}–${Math.max(...anwaScores)}%)`);
    if (durrScores.length) console.log(`  الدرور — متوسط التطابق: ${Math.round(mean(durrScores))}% (${Math.min(...durrScores)}–${Math.max(...durrScores)}%)`);

    // 5. حفظ النتائج
    console.log('\n\x1b[33m─── المرحلة 5: حفظ النتائج ───\x1b[0m');
    const json = JSON.stringify(result);
    fs.writeFileSync(OUTPUT, json, 'utf8');
    const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);
    console.log(`  \x1b[32m✓ تم حفظ climate-stats.json (${sizeKB} KB)\x1b[0m`);
    console.log(`\n\x1b[33m═══ اكتمل التوليد بنجاح ═══\x1b[0m`);
}

main().catch(err => {
    console.error('\x1b[31m✗ خطأ:', err.message, '\x1b[0m');
    process.exit(1);
});

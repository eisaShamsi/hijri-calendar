/**
 * محرك حساب مواقيت الصلاة
 * ═══════════════════════════════════════════════════════════
 * حساب فلكي ذاتي — 21 طريقة حساب معتمدة عالمياً
 * يشمل: موضع الشمس (Jean Meeus)، زوايا الفجر والعشاء،
 *        طريقتي الشافعي والحنفي للعصر، تعديلات خطوط العرض العالية
 * ═══════════════════════════════════════════════════════════
 */

const PrayerTimes = (() => {
    const DEG = Math.PI / 180;
    const RAD = 180 / Math.PI;

    // ─── طرق الحساب المعتمدة ──────────────────────────────
    const METHODS = {
        mwl:        { id: 'mwl',        fajr: 18.0, isha: 17.0, ishaType: 'angle', maghribAngle: null, nameAr: 'رابطة العالم الإسلامي', nameEn: 'Muslim World League (MWL)' },
        egyptian:   { id: 'egyptian',   fajr: 19.5, isha: 17.5, ishaType: 'angle', maghribAngle: null, nameAr: 'الهيئة المصرية العامة للمساحة', nameEn: 'Egyptian General Authority' },
        karachi:    { id: 'karachi',    fajr: 18.0, isha: 18.0, ishaType: 'angle', maghribAngle: null, nameAr: 'جامعة العلوم الإسلامية – كراتشي', nameEn: 'University of Islamic Sciences, Karachi' },
        ummAlQura:  { id: 'ummAlQura',  fajr: 18.5, isha: 90,   ishaType: 'offset', maghribAngle: null, ishaRamadan: 120, nameAr: 'جامعة أم القرى – مكة', nameEn: 'Umm al-Qura, Makkah' },
        isna:       { id: 'isna',       fajr: 15.0, isha: 15.0, ishaType: 'angle', maghribAngle: null, nameAr: 'الجمعية الإسلامية لأمريكا الشمالية', nameEn: 'Islamic Society of North America (ISNA)' },
        tehran:     { id: 'tehran',     fajr: 17.7, isha: 14.0, ishaType: 'angle', maghribAngle: 4.5,  midnightMode: 'shia', nameAr: 'جامعة طهران – معهد الجيوفيزياء', nameEn: 'Inst. of Geophysics, Univ. of Tehran' },
        qom:        { id: 'qom',        fajr: 16.0, isha: 14.0, ishaType: 'angle', maghribAngle: 4.0,  midnightMode: 'shia', nameAr: 'شيعة اثنا عشرية – مؤسسة لواء، قم', nameEn: 'Shia Ithna-Ashari, Leva Inst., Qom' },
        uae:        { id: 'uae',        fajr: 18.2, isha: 18.2, ishaType: 'angle', maghribAngle: null, nameAr: 'الهيئة العامة للشؤون الإسلامية – الإمارات', nameEn: 'UAE - GAIAE' },
        kuwait:     { id: 'kuwait',     fajr: 18.0, isha: 17.5, ishaType: 'angle', maghribAngle: null, nameAr: 'وزارة الأوقاف – الكويت', nameEn: 'Kuwait' },
        qatar:      { id: 'qatar',      fajr: 18.0, isha: 17.5, ishaType: 'angle', maghribAngle: null, nameAr: 'وزارة الأوقاف – قطر', nameEn: 'Qatar' },
        turkey:     { id: 'turkey',     fajr: 18.0, isha: 17.0, ishaType: 'angle', maghribAngle: null, nameAr: 'رئاسة الشؤون الدينية – تركيا', nameEn: 'Turkey - Diyanet' },
        algeria:    { id: 'algeria',    fajr: 18.0, isha: 17.0, ishaType: 'angle', maghribAngle: null, nameAr: 'وزارة الشؤون الدينية – الجزائر', nameEn: 'Algeria' },
        tunisia:    { id: 'tunisia',    fajr: 18.0, isha: 18.0, ishaType: 'angle', maghribAngle: null, nameAr: 'وزارة الشؤون الدينية – تونس', nameEn: 'Tunisia' },
        morocco:    { id: 'morocco',    fajr: 19.0, isha: 17.0, ishaType: 'angle', maghribAngle: null, maghribOffset: 5, nameAr: 'وزارة الأوقاف – المغرب', nameEn: 'Morocco' },
        jordan:     { id: 'jordan',     fajr: 18.0, isha: 18.0, ishaType: 'angle', maghribAngle: null, nameAr: 'وزارة الأوقاف – الأردن', nameEn: 'Jordan' },
        france:     { id: 'france',     fajr: 12.0, isha: 12.0, ishaType: 'angle', maghribAngle: null, nameAr: 'اتحاد المنظمات الإسلامية – فرنسا', nameEn: 'France - UOIF' },
        singapore:  { id: 'singapore',  fajr: 20.0, isha: 18.0, ishaType: 'angle', maghribAngle: null, nameAr: 'مجلس الشؤون الدينية – سنغافورة', nameEn: 'Singapore - MUIS' },
        malaysia:   { id: 'malaysia',   fajr: 20.0, isha: 18.0, ishaType: 'angle', maghribAngle: null, nameAr: 'إدارة التنمية الإسلامية – ماليزيا', nameEn: 'Malaysia - JAKIM' },
        indonesia:  { id: 'indonesia',  fajr: 20.0, isha: 18.0, ishaType: 'angle', maghribAngle: null, nameAr: 'وزارة الشؤون الدينية – إندونيسيا', nameEn: 'Indonesia - KEMENAG' },
        palestine:  { id: 'palestine',  fajr: 19.5, isha: 17.5, ishaType: 'angle', maghribAngle: null, nameAr: 'وزارة الأوقاف – فلسطين', nameEn: 'Palestine' },
        libya:      { id: 'libya',      fajr: 19.5, isha: 17.5, ishaType: 'angle', maghribAngle: null, nameAr: 'الهيئة العامة للأوقاف – ليبيا', nameEn: 'Libya' },
    };

    // ─── تعديلات خطوط العرض العالية ─────────────────────────
    const HIGH_LAT = {
        none:           { id: 'none',           nameAr: 'بدون',                      nameEn: 'None' },
        middleOfNight:  { id: 'middleOfNight',  nameAr: 'منتصف الليل',               nameEn: 'Middle of Night' },
        oneSeventhNight:{ id: 'oneSeventhNight', nameAr: 'سُبع الليل',              nameEn: '1/7th of Night' },
        angleBased:     { id: 'angleBased',     nameAr: 'نسبة الزاوية',              nameEn: 'Angle-Based' },
    };

    // ─── موضع الشمس (Jean Meeus) ──────────────────────────
    function solarPosition(jdn) {
        const d = jdn - 2451545.0; // Days from J2000.0
        const T = d / 36525.0;

        // Mean longitude
        const L0 = _mod(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360);
        // Mean anomaly
        const M = _mod(357.52911 + 35999.05029 * T - 0.0001537 * T * T, 360);
        const Mr = M * DEG;
        // Eccentricity
        const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
        // Equation of center
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
                + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
                + 0.000289 * Math.sin(3 * Mr);
        // Sun true longitude
        const sunLng = L0 + C;
        // Omega for nutation
        const Omega = 125.04 - 1934.136 * T;
        // Apparent longitude
        const lambda = sunLng - 0.00569 - 0.00478 * Math.sin(Omega * DEG);
        // Obliquity
        const eps0 = 23.439291 - 0.013004167 * T;
        const eps = eps0 + 0.00256 * Math.cos(Omega * DEG);

        // Declination
        const decl = Math.asin(Math.sin(eps * DEG) * Math.sin(lambda * DEG)) * RAD;

        // Equation of time (minutes)
        const y = Math.tan(eps * DEG / 2);
        const y2 = y * y;
        const EqT = 4 * RAD * (
            y2 * Math.sin(2 * L0 * DEG)
            - 2 * e * Math.sin(Mr)
            + 4 * e * y2 * Math.sin(Mr) * Math.cos(2 * L0 * DEG)
            - 0.5 * y2 * y2 * Math.sin(4 * L0 * DEG)
            - 1.25 * e * e * Math.sin(2 * Mr)
        );

        return { declination: decl, equationOfTime: EqT };
    }

    // ─── حساب زاوية الساعة ───────────────────────────────
    function hourAngle(lat, decl, angle) {
        const cosH = (Math.sin(angle * DEG) - Math.sin(lat * DEG) * Math.sin(decl * DEG))
                   / (Math.cos(lat * DEG) * Math.cos(decl * DEG));
        if (cosH > 1) return null;  // الشمس لا تصل لهذه الزاوية (ليل دائم)
        if (cosH < -1) return null; // الشمس لا تغيب (نهار دائم)
        return Math.acos(cosH) * RAD / 15; // بالساعات
    }

    // ─── زاوية العصر ──────────────────────────────────────
    function asrAngle(lat, decl, factor) {
        const d = Math.abs(lat - decl);
        const alt = Math.atan(1.0 / (factor + Math.tan(d * DEG))) * RAD;
        return alt;
    }

    // ─── الحساب الرئيسي ──────────────────────────────────
    function calculate(date, lat, lng, tz, methodId, asrFactor, highLatId, elevation, isRamadan) {
        const method = METHODS[methodId] || METHODS.mwl;
        asrFactor = asrFactor || 1;
        highLatId = highLatId || 'none';
        elevation = elevation || 0;

        // JDN
        const y = date.year || date.getFullYear();
        const m = date.month || (date.getMonth() + 1);
        const d = date.day || date.getDate();
        const a = Math.floor((14 - m) / 12);
        const yy = y + 4800 - a;
        const mm = m + 12 * a - 3;
        const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy
                   + Math.floor(yy / 4) - Math.floor(yy / 100)
                   + Math.floor(yy / 400) - 32045;

        const sun = solarPosition(jdn);
        const decl = sun.declination;
        const eqt = sun.equationOfTime;

        // Solar noon
        const dhuhr = 12 + tz - lng / 15 - eqt / 60;

        // Elevation correction
        const elevCorr = 0.0347 * Math.sqrt(elevation);
        const sunriseAngle = -(0.8333 + elevCorr);

        // Hour angles
        const haSunrise = hourAngle(lat, decl, sunriseAngle);
        const haFajr = hourAngle(lat, decl, -method.fajr);
        const haIsha = method.ishaType === 'angle' ? hourAngle(lat, decl, -method.isha) : null;

        // Maghrib angle (Shia methods have sun below horizon further)
        const maghribDeg = method.maghribAngle ? -method.maghribAngle : sunriseAngle;
        const haMaghrib = hourAngle(lat, decl, maghribDeg);

        // Asr
        const asrAlt = asrAngle(lat, decl, asrFactor);
        const haAsr = hourAngle(lat, decl, asrAlt);

        // Base times
        let sunrise = haSunrise !== null ? dhuhr - haSunrise : null;
        let sunset  = haSunrise !== null ? dhuhr + haSunrise : null;
        let fajr    = haFajr !== null ? dhuhr - haFajr : null;
        let maghrib = haMaghrib !== null ? dhuhr + haMaghrib : null;
        let asr     = haAsr !== null ? dhuhr + haAsr : null;

        // Isha
        let isha;
        if (method.ishaType === 'offset') {
            const offset = (isRamadan && method.ishaRamadan) ? method.ishaRamadan : method.isha;
            isha = maghrib !== null ? maghrib + offset / 60 : null;
        } else {
            isha = haIsha !== null ? dhuhr + haIsha : null;
        }

        // Dhuhr safety margin (+1 min)
        const dhuhrFinal = dhuhr + 1 / 60;

        // Maghrib offset (Morocco +5min)
        if (method.maghribOffset && maghrib !== null) {
            maghrib += method.maghribOffset / 60;
        }

        // Imsak (10 min before Fajr)
        let imsak = fajr !== null ? fajr - 10 / 60 : null;

        // ─── تعديلات خطوط العرض العالية ────────────────────
        if (highLatId !== 'none' && sunrise !== null && sunset !== null) {
            const nightDuration = 24 - (sunset - sunrise);

            if (fajr === null || isha === null) {
                if (highLatId === 'middleOfNight') {
                    const mid = nightDuration / 2;
                    if (fajr === null) fajr = sunrise - mid;
                    if (isha === null) isha = sunset + mid;
                } else if (highLatId === 'oneSeventhNight') {
                    const seventh = nightDuration / 7;
                    if (fajr === null) fajr = sunrise - seventh;
                    if (isha === null) isha = sunset + seventh;
                } else if (highLatId === 'angleBased') {
                    const fajrPortion = method.fajr / 60 * nightDuration;
                    const ishaPortion = (method.ishaType === 'angle' ? method.isha : 17) / 60 * nightDuration;
                    if (fajr === null) fajr = sunrise - fajrPortion;
                    if (isha === null) isha = sunset + ishaPortion;
                }
                if (fajr !== null) imsak = fajr - 10 / 60;
            }
        }

        // Midnight
        let midnight;
        if (method.midnightMode === 'shia' && fajr !== null) {
            // Shia: midpoint sunset to fajr next day
            midnight = sunset !== null ? sunset + ((fajr + 24 - sunset) % 24) / 2 : null;
        } else {
            midnight = (sunrise !== null && sunset !== null) ? sunset + (24 - sunset + sunrise) / 2 : null;
        }
        if (midnight !== null && midnight > 24) midnight -= 24;

        return {
            fajr:     _fmt(fajr),
            sunrise:  _fmt(sunrise),
            dhuhr:    _fmt(dhuhrFinal),
            asr:      _fmt(asr),
            maghrib:  _fmt(maghrib),
            isha:     _fmt(isha),
            imsak:    _fmt(imsak),
            midnight: _fmt(midnight),
            // Raw hours for countdown calculations
            _raw: { fajr, sunrise, dhuhr: dhuhrFinal, asr, maghrib, isha, imsak, midnight }
        };
    }

    // ─── تنسيق الوقت ──────────────────────────────────────
    function _fmt(hours) {
        if (hours === null || hours === undefined || isNaN(hours)) return '--:--';
        // Normalize to 0-24
        hours = ((hours % 24) + 24) % 24;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        if (m === 60) return String(h + 1).padStart(2, '0') + ':00';
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function _mod(a, b) {
        return a - b * Math.floor(a / b);
    }

    // ─── الإعدادات ─────────────────────────────────────────
    let _method = 'mwl';
    let _asrFactor = 1;
    let _highLat = 'none';
    let _lat = 0;
    let _lng = 0;
    let _tz = 0;
    let _elevation = 0;

    function _load() {
        try {
            _method    = localStorage.getItem('prayer-method') || 'mwl';
            _asrFactor = parseInt(localStorage.getItem('prayer-asr')) || 1;
            _highLat   = localStorage.getItem('prayer-highlat') || 'none';
            _lat       = parseFloat(localStorage.getItem('prayer-lat')) || 0;
            _lng       = parseFloat(localStorage.getItem('prayer-lng')) || 0;
            _tz        = parseFloat(localStorage.getItem('prayer-tz')) || 0;
            _elevation = parseFloat(localStorage.getItem('prayer-elevation')) || 0;
            if (!METHODS[_method]) _method = 'mwl';
            if (_asrFactor !== 1 && _asrFactor !== 2) _asrFactor = 1;
            if (!HIGH_LAT[_highLat]) _highLat = 'none';
        } catch (e) { /* ignore */ }
    }

    function _save() {
        try {
            localStorage.setItem('prayer-method', _method);
            localStorage.setItem('prayer-asr', _asrFactor);
            localStorage.setItem('prayer-highlat', _highLat);
            localStorage.setItem('prayer-lat', _lat);
            localStorage.setItem('prayer-lng', _lng);
            localStorage.setItem('prayer-tz', _tz);
            localStorage.setItem('prayer-elevation', _elevation);
        } catch (e) { /* ignore */ }
    }

    function setSettings(settings) {
        if (settings.method && METHODS[settings.method]) _method = settings.method;
        if (settings.asrFactor === 1 || settings.asrFactor === 2) _asrFactor = settings.asrFactor;
        if (settings.highLat && HIGH_LAT[settings.highLat]) _highLat = settings.highLat;
        if (typeof settings.lat === 'number') _lat = settings.lat;
        if (typeof settings.lng === 'number') _lng = settings.lng;
        if (typeof settings.tz === 'number') _tz = settings.tz;
        if (typeof settings.elevation === 'number') _elevation = settings.elevation;
        _save();
    }

    function getSettings() {
        return { method: _method, asrFactor: _asrFactor, highLat: _highLat, lat: _lat, lng: _lng, tz: _tz, elevation: _elevation };
    }

    function getForToday(isRamadan) {
        const now = new Date();
        return calculate(
            { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
            _lat, _lng, _tz, _method, _asrFactor, _highLat, _elevation, isRamadan
        );
    }

    function getForDate(gregDate, isRamadan) {
        return calculate(gregDate, _lat, _lng, _tz, _method, _asrFactor, _highLat, _elevation, isRamadan);
    }

    // ─── تهيئة ────────────────────────────────────────────
    _load();

    // ─── الواجهة العامة ───────────────────────────────────
    return {
        METHODS,
        HIGH_LAT,
        calculate,
        setSettings,
        getSettings,
        getForToday,
        getForDate,
        _save, _load
    };
})();

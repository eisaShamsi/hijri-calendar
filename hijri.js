/**
 * التقويم الهجري — محرك متعدد المستويات
 * ═══════════════════════════════════════════════════════════
 * المستوى 1: التقويم الحسابي الجدولي (التوفيقات الإلهامية)
 * المستوى 2: الحساب الفلكي — اقتران القمر (Jean Meeus) [الافتراضي]
 * المستوى 3: تصحيح يدوي من المستخدم (±1 يوم)
 * ═══════════════════════════════════════════════════════════
 */

const HijriCalendar = (() => {
    // ─── الثوابت المشتركة ───────────────────────────────────
    const EPOCH_JDN = 1948440;
    const DAYS_IN_30_YEAR_CYCLE = 10631;

    const MONTH_NAMES = [
        'المحرَّم', 'صفر', 'ربيع الأوَّل', 'ربيع الآخِر',
        'جمادى الأولى', 'جمادى الآخِرة', 'رجب', 'شعبان',
        'رمضان', 'شوَّال', 'ذو القَعدة', 'ذو الحِجَّة'
    ];

    const MONTH_NAMES_EN = [
        'Muharram', 'Safar', "Rabi' I", "Rabi' II",
        'Jumada I', 'Jumada II', 'Rajab', "Sha'ban",
        'Ramadan', 'Shawwal', "Dhul-Qi'dah", 'Dhul-Hijjah'
    ];

    const DAY_NAMES = [
        'السبت', 'الأحد', 'الإثنين', 'الثلاثاء',
        'الأربعاء', 'الخميس', 'الجمعة'
    ];

    const DAY_NAMES_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    const GREGORIAN_MONTH_NAMES = [
        'يناير', 'فبراير', 'مارس', 'أبريل',
        'مايو', 'يونيو', 'يوليو', 'أغسطس',
        'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const GREGORIAN_MONTH_NAMES_EN = [
        'January', 'February', 'March', 'April',
        'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'
    ];

    const MODE_NAMES = {
        tabular: 'حسابي (التوفيقات الإلهامية)',
        astronomical: 'فلكي (اقتران القمر)',
    };

    function toArabicNumerals(num) {
        return String(num);
    }

    // ─── الحالة ─────────────────────────────────────────────
    let currentMode = 'astronomical'; // الافتراضي: فلكي
    let weekStart = 0; // 0=السبت، 1=الأحد، 2=الإثنين
    let currentLang = 'ar'; // 'ar' أو 'en'

    // ─── الترجمة ─────────────────────────────────────────────
    const _UI = {
        ar: {
            title: 'التقويم الهجري',
            modeLabel: 'نمط الحساب', modeAstro: 'فلكي (اقتران القمر)', modeTab: 'حسابي (التوفيقات الإلهامية)',
            weekStartLabel: 'بداية الأسبوع', saturday: 'السبت', sunday: 'الأحد', monday: 'الإثنين',
            langLabel: 'Language', langAr: 'العربية', langEn: 'English',
            corrLabel: 'تصحيح الشهر الحالي', corrReset: 'إعادة', corrClearAll: 'مسح الكل',
            corrections: 'التصحيحات:', noCorrections: 'لا توجد تصحيحات',
            todayBtn: 'اليوم', leapYear: 'سنة كبيسة', weekCol: 'أسبوع',
            clickDay: 'انقر على يوم لعرض تفاصيله',
            goToDate: 'الانتقال إلى تاريخ', hijri: 'هجري', gregorian: 'ميلادي',
            day: 'اليوم', month: 'الشهر', year: 'السنة', go: 'انتقل',
            hSuffix: 'هـ', gSuffix: 'م',
            badgeAstro: 'فلكي', badgeTab: 'حسابي',
            prevMonth: 'الشهر السابق', nextMonth: 'الشهر التالي',
            plusDay: 'إضافة يوم', minusDay: 'إنقاص يوم', resetMonth: 'إعادة تعيين هذا الشهر',
            invalidDate: 'أدخل تاريخاً صحيحاً',
            aboutTitle: 'المنهج الحسابي',
            aboutP1: 'يعتمد هذا التقويم على منهجين: <strong>الفلكي</strong> (الافتراضي) يحسب لحظة الاقتران الفلكي للقمر بدقة عالية باستخدام خوارزمية Jean Meeus، ثم يحدد بداية الشهر بناءً على أول يوم بعد الاقتران. <strong>الحسابي</strong> يستخدم نظام الدورة الثلاثينية من كتاب «التوفيقات الإلهامية».',
            aboutP2: 'السنوات الكبيسة في الدورة: <strong>٢، ٥، ٧، ١٠، ١٣، ١٥، ١٨، ٢١، ٢٤، ٢٦، ٢٩</strong>',
            aboutP3: 'يمكن للمستخدم تصحيح أي شهر بإضافة أو إنقاص يوم. التصحيح يسري تلقائياً على كل الشهور اللاحقة من نقطة التطبيق فصاعداً. التصحيحات تُحفظ في المتصفح.',
            footer: 'إعداد عيسى بن راشد الشامسي — دولة الإمارات العربية المتحدة',
            version: 'الإصدار ١٫٠',
            credit: 'صُمم بواسطة Claude Code (Opus 4.6)',
            exportTitle: 'تصدير إلى أجندة (iCal)',
            exportFrom: 'من', exportTo: 'إلى',
            exportBtn: 'تصدير .ics',
            exportMonth: 'الشهر', exportYear: 'السنة',
        },
        en: {
            title: 'Hijri Calendar',
            modeLabel: 'Calculation Mode', modeAstro: 'Astronomical (Lunar Conjunction)', modeTab: 'Tabular (al-Tawfiqat al-Ilhamiyyah)',
            weekStartLabel: 'Week Start', saturday: 'Saturday', sunday: 'Sunday', monday: 'Monday',
            langLabel: 'Language', langAr: 'العربية', langEn: 'English',
            corrLabel: 'Month Correction', corrReset: 'Reset', corrClearAll: 'Clear All',
            corrections: 'Corrections:', noCorrections: 'No corrections',
            todayBtn: 'Today', leapYear: 'Leap Year', weekCol: 'Wk',
            clickDay: 'Click a day for details',
            goToDate: 'Go to Date', hijri: 'Hijri', gregorian: 'Gregorian',
            day: 'Day', month: 'Month', year: 'Year', go: 'Go',
            hSuffix: 'AH', gSuffix: 'CE',
            badgeAstro: 'Astro', badgeTab: 'Tabular',
            prevMonth: 'Previous Month', nextMonth: 'Next Month',
            plusDay: 'Add a day', minusDay: 'Subtract a day', resetMonth: 'Reset this month',
            invalidDate: 'Enter a valid date',
            aboutTitle: 'Methodology',
            aboutP1: 'This calendar uses two methods: <strong>Astronomical</strong> (default) computes lunar conjunction precisely using Jean Meeus algorithms, then determines the month start. <strong>Tabular</strong> uses the 30-year cycle from the book "al-Tawfiqat al-Ilhamiyyah".',
            aboutP2: 'Leap years in the cycle: <strong>2, 5, 7, 10, 13, 15, 18, 21, 24, 26, 29</strong>',
            aboutP3: 'Users can correct any month by adding or subtracting a day. Corrections propagate forward automatically. Corrections are saved in the browser.',
            footer: 'By Eisa bin Rashid Al Shamsi — United Arab Emirates',
            version: 'Version 1.0',
            credit: 'Designed with Claude Code (Opus 4.6)',
            exportTitle: 'Export to Calendar (iCal)',
            exportFrom: 'From', exportTo: 'To',
            exportBtn: 'Export .ics',
            exportMonth: 'Month', exportYear: 'Year',
        }
    };

    function t(key) { return (_UI[currentLang] && _UI[currentLang][key]) || _UI.ar[key] || key; }

    function setLang(lang) { if (lang === 'ar' || lang === 'en') currentLang = lang; }
    function getLang() { return currentLang; }
    function _loadLang() {
        try { const l = localStorage.getItem('hijri-lang'); if (l === 'ar' || l === 'en') currentLang = l; } catch (e) { /* ignore */ }
    }
    function _saveLang() {
        try { localStorage.setItem('hijri-lang', currentLang); } catch (e) { /* ignore */ }
    }

    // ─── مساعدات أسماء حسب اللغة ─────────────────────────────
    function monthName(i) { return currentLang === 'en' ? MONTH_NAMES_EN[i] : MONTH_NAMES[i]; }
    function dayName(i) { return currentLang === 'en' ? DAY_NAMES_EN[i] : DAY_NAMES[i]; }
    function gregMonthName(i) { return currentLang === 'en' ? GREGORIAN_MONTH_NAMES_EN[i] : GREGORIAN_MONTH_NAMES[i]; }

    // تصحيحات المستخدم: { "1447-9": +1, "1447-10": -1 }
    // المفتاح = "سنة-شهر"، القيمة = عدد أيام الإزاحة
    let userCorrections = {};

    function setMode(mode) {
        if (mode === 'tabular' || mode === 'astronomical') {
            currentMode = mode;
        }
    }

    function getMode() { return currentMode; }

    // ─── بداية الأسبوع ─────────────────────────────────────
    function setWeekStart(ws) {
        if (ws >= 0 && ws <= 2) weekStart = ws;
    }

    function getWeekStart() { return weekStart; }

    function _loadWeekStart() {
        try {
            const v = parseInt(localStorage.getItem('hijri-weekstart'));
            if (v >= 0 && v <= 2) weekStart = v;
        } catch (e) { /* ignore */ }
    }

    function _saveWeekStart() {
        try { localStorage.setItem('hijri-weekstart', weekStart); }
        catch (e) { /* ignore */ }
    }

    // ─── رقم الأسبوع في السنة الهجرية ──────────────────────
    // الأسبوع الأول هو الذي يحتوي على 1 محرم
    function weekOfYear(jdn, hijriYear) {
        const muharram1JDN = hijriToJDN(hijriYear, 1, 1);
        // أول يوم بداية أسبوع يسبق أو يساوي 1 محرم
        const muharram1DOW = dayOfWeek(muharram1JDN);
        const offset = (muharram1DOW - weekStart + 7) % 7;
        const firstWeekStart = muharram1JDN - offset;
        return Math.floor((jdn - firstWeekStart) / 7) + 1;
    }

    // ─── تصحيحات المستخدم ───────────────────────────────────
    function setCorrection(year, month, offsetDays) {
        const key = `${year}-${month}`;
        if (offsetDays === 0) {
            delete userCorrections[key];
        } else {
            userCorrections[key] = offsetDays;
        }
        _saveCorrections();
    }

    function getCorrection(year, month) {
        const key = `${year}-${month}`;
        return userCorrections[key] || 0;
    }

    function clearCorrections() {
        userCorrections = {};
        _saveCorrections();
    }

    function getAllCorrections() {
        return { ...userCorrections };
    }

    function _saveCorrections() {
        try {
            localStorage.setItem('hijri-corrections', JSON.stringify(userCorrections));
        } catch (e) { /* ignore */ }
    }

    function _loadCorrections() {
        try {
            const data = localStorage.getItem('hijri-corrections');
            if (data) userCorrections = JSON.parse(data);
        } catch (e) { /* ignore */ }
    }

    function _loadMode() {
        try {
            const m = localStorage.getItem('hijri-mode');
            if (m === 'tabular' || m === 'astronomical') currentMode = m;
        } catch (e) { /* ignore */ }
    }

    function _saveMode() {
        try {
            localStorage.setItem('hijri-mode', currentMode);
        } catch (e) { /* ignore */ }
    }

    // ═══════════════════════════════════════════════════════════
    //  المستوى 1 — التقويم الحسابي الجدولي (التوفيقات الإلهامية)
    // ═══════════════════════════════════════════════════════════

    const Tabular = (() => {
        function isLeapYear(year) {
            return ((11 * year + 15) % 30) < 11;
        }

        function daysInMonth(year, month) {
            if (month % 2 === 1) return 30;
            if (month === 12 && isLeapYear(year)) return 30;
            return 29;
        }

        function daysInYear(year) {
            return isLeapYear(year) ? 355 : 354;
        }

        function hijriToJDN(year, month, day) {
            return day
                + Math.ceil(29.5 * (month - 1))
                + (year - 1) * 354
                + Math.floor((11 * (year - 1) + 15) / 30)
                + EPOCH_JDN - 1;
        }

        function jdnToHijri(jdn) {
            const k = jdn - EPOCH_JDN;
            let cycles = Math.floor(k / DAYS_IN_30_YEAR_CYCLE);
            let remainder = k - cycles * DAYS_IN_30_YEAR_CYCLE;
            if (remainder < 0) { cycles--; remainder += DAYS_IN_30_YEAR_CYCLE; }

            let yc = Math.floor(30 * remainder / DAYS_IN_30_YEAR_CYCLE);
            let ds = yc * 354 + Math.floor((11 * yc + 15) / 30);
            if (ds > remainder) { yc--; ds = yc * 354 + Math.floor((11 * yc + 15) / 30); }
            let dn = (yc + 1) * 354 + Math.floor((11 * (yc + 1) + 15) / 30);
            if (dn <= remainder) { yc++; ds = dn; }

            const year = cycles * 30 + yc + 1;
            let dayOfYear = remainder - ds;

            let month = Math.min(Math.ceil((dayOfYear + 1) / 29.5), 12);
            if (month < 1) month = 1;
            let dbm = Math.ceil(29.5 * (month - 1));
            while (dbm > dayOfYear && month > 1) { month--; dbm = Math.ceil(29.5 * (month - 1)); }

            return { year, month, day: dayOfYear - dbm + 1 };
        }

        return { isLeapYear, daysInMonth, daysInYear, hijriToJDN, jdnToHijri };
    })();

    // ═══════════════════════════════════════════════════════════
    //  المستوى 2 — الحساب الفلكي (Jean Meeus, Astronomical Algorithms)
    // ═══════════════════════════════════════════════════════════

    const Astronomical = (() => {
        /**
         * حساب لحظة الاقتران الفلكي (المحاق / New Moon)
         * بناءً على Jean Meeus, Astronomical Algorithms, Ch. 49
         *
         * المُدخل: k — رقم الاقتران (k=0 عند J2000.0 تقريباً، 2000 يناير 6)
         *   k عدد صحيح = محاق، k+0.5 = بدر
         *
         * المُخرج: JDE (Julian Ephemeris Day) للحظة الاقتران
         */
        function newMoonJDE(k) {
            const T = k / 1236.85;
            const T2 = T * T;
            const T3 = T2 * T;
            const T4 = T3 * T;

            // التقريب الأولي (Meeus eq. 49.1)
            let JDE = 2451550.09766 + 29.530588861 * k
                + 0.00015437 * T2
                - 0.000000150 * T3
                + 0.00000000073 * T4;

            // زوايا أساسية (بالدرجات)
            const toRad = Math.PI / 180;

            // الشذوذ المتوسط للشمس (M)
            const M = 2.5534 + 29.10535670 * k
                - 0.0000014 * T2
                - 0.00000011 * T3;

            // الشذوذ المتوسط للقمر (M')
            const Mp = 201.5643 + 385.81693528 * k
                + 0.0107582 * T2
                + 0.00001238 * T3
                - 0.000000058 * T4;

            // حجة خط عرض القمر (F)
            const F = 160.7108 + 390.67050284 * k
                - 0.0016118 * T2
                - 0.00000227 * T3
                + 0.000000011 * T4;

            // طول العقدة الصاعدة (Omega)
            const Omega = 124.7746 - 1.56375588 * k
                + 0.0020672 * T2
                + 0.00000215 * T3;

            // المُعامِل E (الانحراف المركزي لمدار الأرض)
            const E = 1 - 0.002516 * T - 0.0000074 * T2;
            const E2 = E * E;

            const Mr = M * toRad;
            const Mpr = Mp * toRad;
            const Fr = F * toRad;
            const Or = Omega * toRad;

            // تصحيحات المحاق (Table 49.A في Meeus)
            let correction = 0;
            correction += -0.40720 * Math.sin(Mpr);
            correction +=  0.17241 * E * Math.sin(Mr);
            correction +=  0.01608 * Math.sin(2 * Mpr);
            correction +=  0.01039 * Math.sin(2 * Fr);
            correction +=  0.00739 * E * Math.sin(Mpr - Mr);
            correction += -0.00514 * E * Math.sin(Mpr + Mr);
            correction +=  0.00208 * E2 * Math.sin(2 * Mr);
            correction += -0.00111 * Math.sin(Mpr - 2 * Fr);
            correction += -0.00057 * Math.sin(Mpr + 2 * Fr);
            correction +=  0.00056 * E * Math.sin(2 * Mpr + Mr);
            correction += -0.00042 * Math.sin(3 * Mpr);
            correction +=  0.00042 * E * Math.sin(Mr + 2 * Fr);
            correction +=  0.00038 * E * Math.sin(Mr - 2 * Fr);
            correction += -0.00024 * E * Math.sin(2 * Mpr - Mr);
            correction += -0.00017 * Math.sin(Or);
            correction += -0.00007 * Math.sin(Mpr + 2 * Mr);
            correction +=  0.00004 * Math.sin(2 * Mpr - 2 * Fr);
            correction +=  0.00004 * Math.sin(3 * Mr);
            correction +=  0.00003 * Math.sin(Mpr + Mr - 2 * Fr);
            correction +=  0.00003 * Math.sin(2 * Mpr + 2 * Fr);
            correction += -0.00003 * Math.sin(Mpr + Mr + 2 * Fr);
            correction +=  0.00003 * Math.sin(Mpr - Mr + 2 * Fr);
            correction += -0.00002 * Math.sin(Mpr - Mr - 2 * Fr);
            correction += -0.00002 * Math.sin(3 * Mpr + Mr);
            correction +=  0.00002 * Math.sin(4 * Mpr);

            JDE += correction;

            // تصحيحات إضافية (A terms — planetary arguments)
            const A = [];
            A[1]  = 299.77 +  0.107408 * k - 0.009173 * T2;
            A[2]  = 251.88 +  0.016321 * k;
            A[3]  = 251.83 + 26.651886 * k;
            A[4]  = 349.42 + 36.412478 * k;
            A[5]  =  84.66 + 18.206239 * k;
            A[6]  = 141.74 + 53.303771 * k;
            A[7]  = 207.14 +  2.453732 * k;
            A[8]  = 154.84 +  7.306860 * k;
            A[9]  =  34.52 + 27.261239 * k;
            A[10] = 207.19 +  0.121824 * k;
            A[11] = 291.34 +  1.844379 * k;
            A[12] = 161.72 + 24.198154 * k;
            A[13] = 239.56 + 25.513099 * k;
            A[14] = 331.55 +  3.592518 * k;

            const addCorr = [
                0, 0.000325, 0.000165, 0.000164, 0.000126, 0.000110,
                0.000062, 0.000060, 0.000056, 0.000047, 0.000042,
                0.000040, 0.000037, 0.000035, 0.000023
            ];

            for (let i = 1; i <= 14; i++) {
                JDE += addCorr[i] * Math.sin(A[i] * toRad);
            }

            return JDE;
        }

        /**
         * تحويل JDE → JDN (تقريب اليوم)
         * الشهر الهجري يبدأ عند غروب الشمس بعد المحاق
         * نضيف ~1 يوم تقريباً لأن الهلال لا يُرى إلا بعد الاقتران بـ 15-24 ساعة
         * ثم نأخذ JDN
         */
        function newMoonToMonthStart(jde) {
            // الشهر يبدأ في المساء التالي للاقتران + وقت كافٍ لظهور الهلال
            // تقريب: نضيف يوماً واحداً ثم نأخذ الجزء الصحيح
            return Math.round(jde + 0.5);
        }

        // ─── ذاكرة مؤقتة لبدايات الشهور ─────────────────────
        const _monthStartCache = {};

        /**
         * إيجاد قيمة k التقريبية لبداية شهر هجري معين
         * k=0 عند اقتران يناير 2000 تقريباً
         * 1 محرم 1421 ≈ 6 أبريل 2000
         */
        function _approxK(year, month) {
            // عدد الأشهر الهجرية منذ 1 محرم 1 هـ
            const hijriMonths = (year - 1) * 12 + (month - 1);
            // 1 محرم 1 هـ ≈ يوليو 622م
            // k=0 ≈ يناير 2000
            // الفرق بالأشهر القمرية بين الحقبة و J2000:
            // (2000 - 622.5) * 12.3685 ≈ 17038.8 شهر ميلادي
            // لكن بالأشهر القمرية: (2451550.09766 - 1948440) / 29.530588861 ≈ 17038.37
            const epochK = -17038.37;
            return epochK + hijriMonths;
        }

        /**
         * حساب JDN لبداية شهر هجري معين
         * (أول يوم من الشهر)
         */
        function monthStartJDN(year, month) {
            const key = `${year}-${month}`;
            if (_monthStartCache[key] !== undefined) return _monthStartCache[key];

            const approxK = _approxK(year, month);
            const k = Math.round(approxK);

            // نحسب اقتران هذا الشهر والشهر السابق والتالي
            const jde = newMoonJDE(k);
            const jdePrev = newMoonJDE(k - 1);
            const jdeNext = newMoonJDE(k + 1);

            const jdn = newMoonToMonthStart(jde);
            const jdnPrev = newMoonToMonthStart(jdePrev);
            const jdnNext = newMoonToMonthStart(jdeNext);

            // نستخدم التقويم الجدولي كمرجع تقريبي للتحقق
            const tabJDN = Tabular.hijriToJDN(year, month, 1);

            // نختار الأقرب لتقدير التقويم الجدولي (±2 يوم)
            let bestJDN = jdn;
            if (Math.abs(jdnPrev - tabJDN) < Math.abs(bestJDN - tabJDN)) bestJDN = jdnPrev;
            if (Math.abs(jdnNext - tabJDN) < Math.abs(bestJDN - tabJDN)) bestJDN = jdnNext;

            _monthStartCache[key] = bestJDN;
            return bestJDN;
        }

        function daysInMonth(year, month) {
            const start = monthStartJDN(year, month);
            const nm = month === 12 ? monthStartJDN(year + 1, 1) : monthStartJDN(year, month + 1);
            return nm - start;
        }

        function daysInYear(year) {
            return monthStartJDN(year + 1, 1) - monthStartJDN(year, 1);
        }

        function isLeapYear(year) {
            return daysInYear(year) === 355;
        }

        function hijriToJDN(year, month, day) {
            return monthStartJDN(year, month) + day - 1;
        }

        function jdnToHijri(jdn) {
            // تقدير أولي باستخدام الجدولي
            const approx = Tabular.jdnToHijri(jdn);
            let y = approx.year;
            let m = approx.month;

            // ضبط السنة
            while (monthStartJDN(y + 1, 1) <= jdn) y++;
            while (monthStartJDN(y, 1) > jdn) y--;

            // ضبط الشهر
            m = 1;
            while (m < 12) {
                const nextStart = (m === 12) ? monthStartJDN(y + 1, 1) : monthStartJDN(y, m + 1);
                if (nextStart <= jdn) m++;
                else break;
            }

            const d = jdn - monthStartJDN(y, m) + 1;
            return { year: y, month: m, day: d };
        }

        return { isLeapYear, daysInMonth, daysInYear, hijriToJDN, jdnToHijri, monthStartJDN, newMoonJDE };
    })();

    // ═══════════════════════════════════════════════════════════
    //  الواجهة الموحدة — تدير المستويات والتصحيحات
    // ═══════════════════════════════════════════════════════════

    function _engine() {
        return currentMode === 'tabular' ? Tabular : Astronomical;
    }

    /**
     * حساب إزاحة التصحيح لشهر معين
     * التصحيح يسري من نقطة التطبيق فصاعداً:
     * إذا صحّح المستخدم شهراً، فكل الشهور من هذه النقطة تتأثر
     */
    function _getCumulativeCorrection(year, month) {
        let total = 0;
        const keys = Object.keys(userCorrections).sort();
        for (const key of keys) {
            const [cy, cm] = key.split('-').map(Number);
            // التصحيح يسري على هذا الشهر وكل ما بعده
            if (cy < year || (cy === year && cm <= month)) {
                total += userCorrections[key];
            }
        }
        return total;
    }

    // ─── الدوال العامة الموحدة ───────────────────────────────

    function isLeapYear(year) { return _engine().isLeapYear(year); }

    function daysInMonth(year, month) { return _engine().daysInMonth(year, month); }

    function daysInYear(year) { return _engine().daysInYear(year); }

    function hijriToJDN(year, month, day) {
        const baseJDN = _engine().hijriToJDN(year, month, day);
        return baseJDN + _getCumulativeCorrection(year, month);
    }

    function jdnToHijri(jdn) {
        // البحث العكسي: نحتاج لإيجاد التاريخ الهجري الذي يعطي هذا الـ JDN
        // نبدأ بتقدير بدون تصحيح
        const approx = _engine().jdnToHijri(jdn);

        // نتحقق مع التصحيح
        let y = approx.year, m = approx.month, d = approx.day;

        // نعدّل: JDN الفعلي = JDN الأساسي + correction
        // إذن JDN الأساسي = JDN - correction
        const corr = _getCumulativeCorrection(y, m);
        const adjustedJDN = jdn - corr;
        const result = _engine().jdnToHijri(adjustedJDN);

        // تحقق نهائي: قد يتغير التصحيح بتغير الشهر
        const corr2 = _getCumulativeCorrection(result.year, result.month);
        if (corr2 !== corr) {
            const result2 = _engine().jdnToHijri(jdn - corr2);
            return result2;
        }

        return result;
    }

    // ─── تحويل ميلادي ↔ JDN ──────────────────────────────────

    function gregorianToJDN(year, month, day) {
        const a = Math.floor((14 - month) / 12);
        const y = year + 4800 - a;
        const m = month + 12 * a - 3;
        return day
            + Math.floor((153 * m + 2) / 5)
            + 365 * y
            + Math.floor(y / 4)
            - Math.floor(y / 100)
            + Math.floor(y / 400)
            - 32045;
    }

    function jdnToGregorian(jdn) {
        const a = jdn + 32044;
        const b = Math.floor((4 * a + 3) / 146097);
        const c = a - Math.floor(146097 * b / 4);
        const d = Math.floor((4 * c + 3) / 1461);
        const e = c - Math.floor(1461 * d / 4);
        const m = Math.floor((5 * e + 2) / 153);
        return {
            day: e - Math.floor((153 * m + 2) / 5) + 1,
            month: m + 3 - 12 * Math.floor(m / 10),
            year: 100 * b + d - 4800 + Math.floor(m / 10)
        };
    }

    function hijriToGregorian(y, m, d) { return jdnToGregorian(hijriToJDN(y, m, d)); }
    function gregorianToHijri(y, m, d) { return jdnToHijri(gregorianToJDN(y, m, d)); }

    function dayOfWeek(jdn) { return ((jdn % 7) + 2) % 7; }

    function todayHijri() {
        const now = new Date();
        return gregorianToHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    function todayJDN() {
        const now = new Date();
        return gregorianToJDN(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    // ─── بيانات الشهر للعرض ─────────────────────────────────

    function getMonthData(year, month) {
        const totalDays = daysInMonth(year, month);
        const firstDayJDN = hijriToJDN(year, month, 1);
        const firstDayOfWeek = dayOfWeek(firstDayJDN);
        const todayJDNValue = todayJDN();
        const correction = getCorrection(year, month);
        const cumCorr = _getCumulativeCorrection(year, month);

        const days = [];
        for (let d = 1; d <= totalDays; d++) {
            const jdn = firstDayJDN + d - 1;
            const greg = jdnToGregorian(jdn);
            days.push({
                hijriDay: d, gregorian: greg,
                dayOfWeek: dayOfWeek(jdn), jdn, isToday: jdn === todayJDNValue
            });
        }

        // عدد أيام البادئة حسب بداية الأسبوع المختارة
        const leadingCount = (firstDayOfWeek - weekStart + 7) % 7;

        // أيام الشهر السابق
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonthDays = daysInMonth(prevYear, prevMonth);
        const leadingDays = [];
        for (let i = leadingCount - 1; i >= 0; i--) {
            const d = prevMonthDays - i;
            const actualJDN = hijriToJDN(prevYear, prevMonth, d);
            const greg = jdnToGregorian(actualJDN);
            leadingDays.push({
                hijriDay: d, gregorian: greg,
                dayOfWeek: dayOfWeek(actualJDN), jdn: actualJDN,
                isToday: actualJDN === todayJDNValue, isOtherMonth: true
            });
        }

        // أيام الشهر التالي
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const totalCells = leadingDays.length + totalDays;
        const trailingCount = (7 - (totalCells % 7)) % 7;
        const trailingDays = [];
        for (let d = 1; d <= trailingCount; d++) {
            const actualJDN = hijriToJDN(nextYear, nextMonth, d);
            const greg = jdnToGregorian(actualJDN);
            trailingDays.push({
                hijriDay: d, gregorian: greg,
                dayOfWeek: dayOfWeek(actualJDN), jdn: actualJDN,
                isToday: actualJDN === todayJDNValue, isOtherMonth: true
            });
        }

        // النطاق الميلادي
        const firstGreg = jdnToGregorian(firstDayJDN);
        const lastGreg = jdnToGregorian(firstDayJDN + totalDays - 1);
        let gregorianRange;
        if (firstGreg.month === lastGreg.month && firstGreg.year === lastGreg.year) {
            gregorianRange = `${gregMonthName(firstGreg.month - 1)} ${toArabicNumerals(firstGreg.year)}`;
        } else if (firstGreg.year === lastGreg.year) {
            gregorianRange = `${gregMonthName(firstGreg.month - 1)} – ${gregMonthName(lastGreg.month - 1)} ${toArabicNumerals(firstGreg.year)}`;
        } else {
            gregorianRange = `${gregMonthName(firstGreg.month - 1)} ${toArabicNumerals(firstGreg.year)} – ${gregMonthName(lastGreg.month - 1)} ${toArabicNumerals(lastGreg.year)}`;
        }

        // إضافة رقم الأسبوع لكل يوم
        const allDays = [...leadingDays, ...days, ...trailingDays];
        allDays.forEach(day => {
            const hDate = jdnToHijri(day.jdn);
            day.weekNumber = weekOfYear(day.jdn, hDate.year);
        });

        // ترتيب رؤوس الأيام حسب بداية الأسبوع
        const orderedDayNames = [];
        for (let i = 0; i < 7; i++) {
            orderedDayNames.push(dayName((weekStart + i) % 7));
        }

        return {
            year, month,
            monthName: monthName(month - 1),
            totalDays,
            isLeapYear: isLeapYear(year),
            firstDayOfWeek,
            gregorianRange,
            correction,
            cumulativeCorrection: cumCorr,
            mode: currentMode,
            weekStart,
            orderedDayNames,
            days: allDays
        };
    }

    // ─── تهيئة ──────────────────────────────────────────────
    _loadCorrections();
    _loadMode();
    _loadWeekStart();
    _loadLang();

    // ─── الواجهة العامة ─────────────────────────────────────
    return {
        // المحركات
        setMode, getMode, _saveMode,
        MODE_NAMES,
        Tabular, Astronomical,

        // بداية الأسبوع
        setWeekStart, getWeekStart, _saveWeekStart, weekOfYear,

        // اللغة
        t, setLang, getLang, _saveLang,
        monthName, dayName, gregMonthName,

        // التصحيحات
        setCorrection, getCorrection, clearCorrections, getAllCorrections,

        // الحسابات
        isLeapYear, daysInMonth, daysInYear,
        hijriToJDN, jdnToHijri,
        gregorianToJDN, jdnToGregorian,
        hijriToGregorian, gregorianToHijri,
        dayOfWeek, todayHijri, todayJDN,
        getMonthData,

        // مساعدات
        toArabicNumerals,
        MONTH_NAMES, MONTH_NAMES_EN, DAY_NAMES, GREGORIAN_MONTH_NAMES,
        EPOCH_JDN
    };
})();

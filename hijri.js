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
            aboutTitle: 'المنهج الحسابي ومواقيت الصلاة',
            aboutP1: 'يعتمد هذا التقويم على منهجين: <strong>الفلكي</strong> (الافتراضي) يحسب لحظة الاقتران الفلكي للقمر بدقة عالية باستخدام خوارزمية Jean Meeus، ثم يحدد بداية الشهر بناءً على أول يوم بعد الاقتران. <strong>الحسابي</strong> يستخدم نظام الدورة الثلاثينية من كتاب «التوفيقات الإلهامية».',
            aboutP2: 'السنوات الكبيسة في الدورة: <strong>2، 5، 7، 10، 13، 15، 18، 21، 24، 26، 29</strong>',
            aboutP3: 'يمكن للمستخدم تصحيح أي شهر بإضافة أو إنقاص يوم. التصحيح يسري تلقائياً على كل الشهور اللاحقة من نقطة التطبيق فصاعداً. التصحيحات تُحفظ في المتصفح.',
            aboutP4: 'تُحسب مواقيت الصلاة بناءً على موقع المستخدم باستخدام معادلات فلكية دقيقة لتحديد زوايا الشمس. يدعم التطبيق <strong>21</strong> طريقة حساب معتمدة من هيئات إسلامية حول العالم، مع إمكانية اختيار مذهب العصر (شافعي أو حنفي) وطريقة حساب العروض العليا.',
            footer: 'إعداد عيسى بن راشد الشامسي — دولة الإمارات العربية المتحدة',
            version: 'الإصدار 1.6',
            credit: 'صُمم بواسطة Claude Code (Opus 4.6)',
            anwaTitle: 'الأنواء والمواسم',
            tale3Label: 'الطالع',
            zodiacLabel: 'البرج',
            seasonLabel: 'الموسم',
            durrLabel: 'الدّر',
            suhailLabel: 'سهيل',
            exportTitle: 'تصدير إلى أجندة (iCal)',
            exportFrom: 'من', exportTo: 'إلى',
            exportBtn: 'تصدير .ics',
            exportMonth: 'الشهر', exportYear: 'السنة',
            // مواقيت الصلاة
            prayerTitle: 'مواقيت الصلاة',
            prayerFajr: 'الفجر', prayerSunrise: 'الشروق', prayerDhuhr: 'الظهر',
            prayerAsr: 'العصر', prayerMaghrib: 'المغرب', prayerIsha: 'العشاء',
            prayerNext: 'التالي',
            prayerIn: 'بعد',
            prayerMethod: 'طريقة الحساب', prayerAsr_: 'العصر',
            prayerShafii: 'شافعي / مالكي / حنبلي', prayerHanafi: 'حنفي',
            prayerLat: 'خط العرض', prayerLng: 'خط الطول', prayerTz: 'المنطقة الزمنية',
            prayerHighLat: 'خطوط العرض العالية',
            prayerDetect: 'تحديد الموقع',
            prayerSettings: 'إعدادات مواقيت الصلاة',
            prayerElevation: 'الارتفاع (م)',
            prayerNoLocation: 'حدد موقعك لعرض مواقيت الصلاة',
            // الوضع الداكن
            themeLabel: 'المظهر', themeDark: '🌙', themeLight: '☀️',
            // المناسبات الإسلامية
            eventsLabel: 'المناسبات',
            // جدول الصلاة الشهري
            monthlyTimetable: 'الجدول الشهري', downloadCSV: 'تحميل CSV', timetableDay: 'اليوم', timetableHijriDate: 'التاريخ الهجري', timetableDate: 'التاريخ',
            // PWA
            installApp: 'تثبيت التطبيق',
            // الإشعارات
            notifyEnable: 'تفعيل الإشعارات', notifyBefore: 'قبل الصلاة بـ', notifyMinutes: 'دقائق',
            notifyGranted: 'الإشعارات مفعلة', notifyDenied: 'الإشعارات مرفوضة', notifyDefault: 'اضغط لتفعيل الإشعارات',
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
            aboutTitle: 'Methodology & Prayer Times',
            aboutP1: 'This calendar uses two methods: <strong>Astronomical</strong> (default) computes lunar conjunction precisely using Jean Meeus algorithms, then determines the month start. <strong>Tabular</strong> uses the 30-year cycle from the book "al-Tawfiqat al-Ilhamiyyah".',
            aboutP2: 'Leap years in the cycle: <strong>2, 5, 7, 10, 13, 15, 18, 21, 24, 26, 29</strong>',
            aboutP3: 'Users can correct any month by adding or subtracting a day. Corrections propagate forward automatically. Corrections are saved in the browser.',
            aboutP4: 'Prayer times are calculated based on the user\'s location using precise astronomical equations for solar angles. The app supports <strong>21</strong> calculation methods approved by Islamic authorities worldwide, with options for Asr jurisprudence (Shafi\'i or Hanafi) and high latitude adjustments.',
            footer: 'By Eisa bin Rashid Al Shamsi — United Arab Emirates',
            version: 'Version 1.6',
            credit: 'Designed with Claude Code (Opus 4.6)',
            anwaTitle: 'Seasons & Stars',
            tale3Label: 'Star',
            zodiacLabel: 'Zodiac',
            seasonLabel: 'Season',
            durrLabel: 'Darr',
            suhailLabel: 'Suhail',
            exportTitle: 'Export to Calendar (iCal)',
            exportFrom: 'From', exportTo: 'To',
            exportBtn: 'Export .ics',
            exportMonth: 'Month', exportYear: 'Year',
            // Prayer Times
            prayerTitle: 'Prayer Times',
            prayerFajr: 'Fajr', prayerSunrise: 'Sunrise', prayerDhuhr: 'Dhuhr',
            prayerAsr: 'Asr', prayerMaghrib: 'Maghrib', prayerIsha: 'Isha',
            prayerNext: 'Next',
            prayerIn: 'in',
            prayerMethod: 'Calculation Method', prayerAsr_: 'Asr',
            prayerShafii: "Shafi'i / Maliki / Hanbali", prayerHanafi: 'Hanafi',
            prayerLat: 'Latitude', prayerLng: 'Longitude', prayerTz: 'Timezone',
            prayerHighLat: 'High Latitude',
            prayerDetect: 'Detect Location',
            prayerSettings: 'Prayer Times Settings',
            prayerElevation: 'Elevation (m)',
            prayerNoLocation: 'Set your location to display prayer times',
            // Dark mode
            themeLabel: 'Theme', themeDark: '🌙', themeLight: '☀️',
            // Islamic events
            eventsLabel: 'Events',
            // Monthly timetable
            monthlyTimetable: 'Monthly Timetable', downloadCSV: 'Download CSV', timetableDay: 'Day', timetableHijriDate: 'Hijri Date', timetableDate: 'Date',
            // PWA
            installApp: 'Install App',
            // Notifications
            notifyEnable: 'Enable Notifications', notifyBefore: 'Before prayer by', notifyMinutes: 'minutes',
            notifyGranted: 'Notifications enabled', notifyDenied: 'Notifications denied', notifyDefault: 'Click to enable notifications',
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

    // ─── المناسبات الإسلامية ─────────────────────────────────
    const ISLAMIC_EVENTS = {
        '1-1':   { nameAr: 'رأس السنة الهجرية', nameEn: 'Islamic New Year', type: 'holiday' },
        '1-10':  { nameAr: 'يوم عاشوراء', nameEn: 'Day of Ashura', type: 'observance' },
        '3-12':  { nameAr: 'المولد النبوي', nameEn: 'Mawlid al-Nabi', type: 'holiday' },
        '7-27':  { nameAr: 'الإسراء والمعراج', nameEn: "Isra' & Mi'raj", type: 'special' },
        '8-15':  { nameAr: 'ليلة النصف من شعبان', nameEn: "Laylat al-Bara'ah", type: 'special' },
        '9-1':   { nameAr: 'أول رمضان', nameEn: 'First of Ramadan', type: 'holiday' },
        '9-17':  { nameAr: 'غزوة بدر', nameEn: 'Battle of Badr', type: 'observance' },
        '9-27':  { nameAr: 'ليلة القدر (تقديرية)', nameEn: 'Laylat al-Qadr (est.)', type: 'special' },
        '10-1':  { nameAr: 'عيد الفطر', nameEn: 'Eid al-Fitr', type: 'holiday' },
        '10-2':  { nameAr: 'ثاني أيام عيد الفطر', nameEn: 'Eid al-Fitr (Day 2)', type: 'holiday' },
        '10-3':  { nameAr: 'ثالث أيام عيد الفطر', nameEn: 'Eid al-Fitr (Day 3)', type: 'holiday' },
        '12-8':  { nameAr: 'يوم التروية', nameEn: 'Day of Tarwiyah', type: 'observance' },
        '12-9':  { nameAr: 'يوم عرفة', nameEn: 'Day of Arafah', type: 'special' },
        '12-10': { nameAr: 'عيد الأضحى', nameEn: 'Eid al-Adha', type: 'holiday' },
        '12-11': { nameAr: 'ثاني أيام عيد الأضحى', nameEn: 'Eid al-Adha (Day 2)', type: 'holiday' },
        '12-12': { nameAr: 'ثالث أيام عيد الأضحى', nameEn: 'Eid al-Adha (Day 3)', type: 'holiday' },
        '12-13': { nameAr: 'رابع أيام عيد الأضحى', nameEn: 'Eid al-Adha (Day 4)', type: 'holiday' },
    };

    function getEvent(month, day) {
        const key = `${month}-${day}`;
        const ev = ISLAMIC_EVENTS[key];
        if (!ev) return null;
        return { ...ev, name: currentLang === 'en' ? ev.nameEn : ev.nameAr };
    }

    // ─── الطوالع (منازل القمر) — 28 منزلة ─────────────────────
    // كل منزلة 13 يوماً، تبدأ الدورة من 11 أغسطس
    // التواريخ: [شهر_بداية, يوم_بداية, شهر_نهاية, يوم_نهاية]
    const TAWALIE = [
        { ar: 'النثرة (الكليبين)', en: 'Al-Nathra (Kulaibin)', from: [8,11], to: [8,23],
          weatherAr: 'ذروة جمرة القيظ مع رطوبة عالية، وتنشط رياح الكوس الرطبة وتتشكل السحب الركامية المحلية (الروايح)، ويظهر نجم سهيل إيذاناً ببدء انكسار شدة الحر.',
          weatherEn: 'Peak of summer heat with high humidity. Moist Kaus winds blow and local cumulus clouds form. Canopus (Suhail) appears, signaling the start of heat decline.' },
        { ar: 'الطرف', en: 'Al-Tarf', from: [8,24], to: [9,5],
          weatherAr: 'آخر أنواء الصيف، تستمر هبايب سهيل وهي رياح رطبة لطيفة تحد من شدة الحر، مع وعكات سهيل (موجات حر مع رطوبة عالية وسكون الرياح).',
          weatherEn: 'Last summer rains. Pleasant Suhail breezes reduce heat intensity. Heat waves with high humidity and calm winds (Suhail oppression) continue.' },
        { ar: 'الجبهة', en: 'Al-Jabha', from: [9,6], to: [9,19],
          weatherAr: 'أول طوالع الخريف، يُلتمس تحسّن الأجواء عند الفجر، وتستمر الرطوبة مع انكسار تدريجي لشدة الحر، ونوؤه محمود عند العرب لنفع أمطاره.',
          weatherEn: 'First autumn star. Weather improves noticeably at dawn. Humidity persists with gradual heat decline. Its rains are valued in Arabian tradition.' },
        { ar: 'الزبرة', en: 'Al-Zubra', from: [9,20], to: [10,2],
          weatherAr: 'يبرد الليل مع بقايا رياح السموم نهاراً، وتهب رياح الشمال، ويتساوى الليل بالنهار (الاعتدال الخريفي) ثم يأخذ الليل بالزيادة.',
          weatherEn: 'Nights cool down while hot Simoom winds linger during daytime. North winds blow. Autumnal equinox — day and night equalize, then nights grow longer.' },
        { ar: 'الصرفة', en: 'Al-Sarfa', from: [10,3], to: [10,15],
          weatherAr: 'انصراف الحر وبداية اعتدال الجو، يبرد الفجر وترتفع الرطوبة ويتشكل الضباب صباحاً، وتهب رياح الأكيذب الشمالية القوية.',
          weatherEn: 'Departure of heat and weather moderation begins. Dawn cools, humidity rises, morning fog forms. Strong northerly Akidhib winds blow.' },
        { ar: 'العوى', en: "Al-Awa", from: [10,16], to: [10,28],
          weatherAr: 'أول نجوم الوسم الماطر، يعتدل الجو نهاراً ويبرد ليلاً، وتتوافد السحب من الشمال والشمال الغربي، وأمطاره محمودة تسِم الأرض بالخضرة وينبت منها الفقع.',
          weatherEn: 'First star of the Wasm rainy season. Weather moderates by day and cools at night. Clouds come from the north/northwest. Its praised rains green the earth and truffles begin growing.' },
        { ar: 'السماك', en: 'Al-Simak', from: [10,29], to: [11,10],
          weatherAr: 'تزداد برودة الجو ليلاً مع اعتدال النهار، وتهب الرياح الجنوبية المثيرة للغبار، والرياح متقلبة الاتجاه، وتشيع الأمراض الموسمية بسبب التقلبات الجوية.',
          weatherEn: 'Nighttime cold increases noticeably while daytime stays moderate. Dusty southerly winds blow with variable directions. Seasonal illnesses spread due to weather fluctuations.' },
        { ar: 'الغفر', en: 'Al-Ghafr', from: [11,11], to: [11,23],
          weatherAr: 'آخر نجوم الوسم، يسكن بحر العرب ويهيج الخليج العربي، وتزداد برودة الليل أكثر من ذي قبل مع اعتدال النهار.',
          weatherEn: 'Last Wasm star. The Arabian Sea calms while the Gulf becomes agitated. Night cold increases further while daytime stays moderate.' },
        { ar: 'الزبانا', en: 'Al-Zubana', from: [11,24], to: [12,6],
          weatherAr: 'بداية مظاهر الشتاء، تزداد برودة الليل بشكل ملحوظ وتشتد الرياح الباردة، ويكثر هبوب العواصف وسقوط الأمطار، مع زيادة طول الليل.',
          weatherEn: 'Winter signs appear. Night cold increases notably with strong cold winds. Storms and rainfall become more frequent as nights grow longer.' },
        { ar: 'الإكليل', en: 'Al-Iklil', from: [12,7], to: [12,19],
          weatherAr: 'أول نجوم مربعانية الشتاء، تكثر الأمطار والغيوم ويشتد البرد، وتستمر فرصة ضربة الأحيمر وهي رياح قوية غير منتظمة يهيج معها البحر.',
          weatherEn: 'First star of winter Marbainiya (40-day cold). Rain and clouds increase, cold intensifies. Ahimar storm risk continues — strong irregular winds agitating the seas.' },
        { ar: 'القلب', en: 'Al-Qalb', from: [12,20], to: [1,1],
          weatherAr: 'ثاني نجوم المربعانية، دخول البرد الحقيقي وغاية طول الليل (الانقلاب الشتوي)، وتهب رياح الشمال الباردة ويتشكل الصقيع مع كثرة الضباب.',
          weatherEn: 'True winter cold arrives with the longest nights (winter solstice). Cold north winds blow, frost may form, and fog is frequent.' },
        { ar: 'الشولة', en: 'Al-Shawla', from: [1,2], to: [1,14],
          weatherAr: 'ثالث نجوم المربعانية، يبلغ البرد أشد مراحله مع تشكّل الصقيع، وتهب رياح الشمال الباردة الجافة، وتتوقف أغلب النباتات عن النمو لشدة البرودة.',
          weatherEn: 'Extreme cold reaches its peak. Frost forms regularly. Cold dry north winds blow. Most plants stop growing due to severe cold (winter dormancy).' },
        { ar: 'النعائم', en: "Al-Na'a'im", from: [1,15], to: [1,27],
          weatherAr: 'أول نجوم الشبط (برد البطين)، غاية شدة البرد والصقيع، تهب الرياح الباردة القارسة وتبيّض الأرض من الصقيع.',
          weatherEn: 'First star of Shabat (deep winter). Extreme biting cold and frost. Biting cold winds blow and the ground whitens from persistent frost.' },
        { ar: 'البلدة', en: 'Al-Balda', from: [1,28], to: [2,9],
          weatherAr: 'يستمر البرد القارس والصقيع، وتضرب رياح الشمال الباردة القوية (ضربة الستين)، وتزداد فرص الأمطار، وفي آخرها يبدأ الماء بالجريان في عروق الشجر.',
          weatherEn: 'Severe cold and frost continue. Strong cold north winds strike (Darba al-Sittin). Rain chances increase. Late in the period, sap begins flowing in trees.' },
        { ar: 'سعد الذابح', en: "Sa'd al-Dhabih", from: [2,10], to: [2,22],
          weatherAr: 'أول السعود وأول العقارب، بداية انكسار شدة البرد تدريجياً مع بقاء الصقيع، تكثر الرياح النشطة والاضطرابات الجوية الربيعية وتغزر الأمطار.',
          weatherEn: 'First of the auspicious Sa\'ud stars. Cold starts breaking gradually though frost remains. Active winds, spring weather disturbances, and abundant rain.' },
        { ar: 'سعد بلع', en: "Sa'd Bula'", from: [2,23], to: [3,7],
          weatherAr: 'ثاني السعود، تتخلله موجة دافئة (دفوة الطلع)، مع فترة برد العجوز في أواخره وهي ثمانية أيام باردة شديدة، وتنشط النعايات آخر الرياح الباردة.',
          weatherEn: 'Second Sa\'ud star. A warm spell (Dafwat al-Tal\'a) occurs mid-period. The Old Woman\'s Cold (8 harsh days) may strike late. Last cold winds (Na\'ayat) blow.' },
        { ar: 'سعد السعود', en: "Sa'd al-Su'ud", from: [3,8], to: [3,20],
          weatherAr: 'أول أنواء الربيع وآخر العقارب، يعتدل الجو خاصة نهاراً وتكثر الأمطار، وتهب النعايات نعياً للشتاء، وفيه أيام الحسوم ذات البرد والرياح المتقلبة.',
          weatherEn: 'First spring rains and last of al-Aqarib. Weather moderates especially daytime. Abundant rain. Farewell winter winds (Na\'ayat) blow. Husum days bring variable cold winds.' },
        { ar: 'سعد الأخبية', en: "Sa'd al-Akhbiya", from: [3,21], to: [4,2],
          weatherAr: 'آخر السعود وأول الحميمين، ترتفع الحرارة خاصة نهاراً وتبدأ فترة الدفء، وتنشط السرايات وهي سحب ركامية بعد الظهر مع أمطار رعدية غزيرة.',
          weatherEn: 'Last Sa\'ud and start of Humaimain warm period. Temperatures rise notably. Sarayat (convective thunderstorms) become active — rapid afternoon cloud buildup with heavy rain.' },
        { ar: 'المقدم', en: 'Al-Muqaddam', from: [4,3], to: [4,15],
          weatherAr: 'ثاني الحميمين، ترتفع الحرارة وتهب الرياح الشمالية، تنشط السرايات بذروتها مع رياح قوية تؤدي إلى اضطراب البحر وارتفاع الأمواج.',
          weatherEn: 'Second Humaimain. Temperature rises with north winds. Spring storms (Sarayat) peak — strong winds cause sea turbulence and high waves.' },
        { ar: 'المؤخر', en: "Al-Mu'akkhar", from: [4,16], to: [4,28],
          weatherAr: 'موسم انتقالي بين نهاية الربيع وبداية الحر، يعتدل الجو ليلاً ويميل للحرارة نهاراً، وتضطرب الأجواء قبل سقوط الثريا (يوالت الثريا).',
          weatherEn: 'Transitional season from spring to heat. Mild nights and warm days. Weather becomes unsettled before the Pleiades disappear (Yawalat al-Thuraya).' },
        { ar: 'الرشاء', en: 'Al-Risha', from: [4,29], to: [5,11],
          weatherAr: 'بداية كنة الثريا (غيوب الثريا)، تسود الأجواء الجافة وتقل الرطوبة، وتهب رياح الطوز الشمالية الغربية الجافة المحملة بالغبار مع ارتفاع الحرارة.',
          weatherEn: 'Start of the Pleiades hiding period. Dry weather dominates, humidity drops. Hot dusty northwest Toz winds blow as temperatures rise.' },
        { ar: 'الشرطين', en: 'Al-Sharatain', from: [5,12], to: [5,24],
          weatherAr: 'استمرار كنة الثريا وتمكّن الحر، تنشط رياح البوارح الشمالية الغربية الجافة التي تمنع تشكّل السحب والأمطار، وتجف المراعي والأعشاب.',
          weatherEn: 'Pleiades still hidden, heat intensifies. Dry northwesterly Bawarih winds dominate, preventing cloud formation and rain. Pastures and wild grasses dry out.' },
        { ar: 'البطين', en: 'Al-Butain', from: [5,25], to: [6,6],
          weatherAr: 'تزداد الحرارة والسموم، ويستمر موسم البوارح الجافة (البارح الصغير)، ويهيج بحر العرب، وتنتهي كنة الثريا في آخره.',
          weatherEn: 'Heat and hot Simoom winds increase. The dry Bawarih season continues (Lesser Baarih). The Arabian Sea becomes agitated. Pleiades hiding period ends.' },
        { ar: 'الثريا', en: 'Al-Thuraya', from: [6,7], to: [6,19],
          weatherAr: 'أول نجوم القيظ وشدة الحر، تشتد البوارح (بارح الثريا - البارح الكبير) وهي أشد رياح السنة الجافة، وتبدأ وغرات القيظ (موجات الحر).',
          weatherEn: 'Start of scorching summer. The Greater Baarih — the year\'s strongest dry northwesterly winds — blows fiercely. First major heat waves (Wagharat) strike.' },
        { ar: 'الدبران', en: 'Al-Dabaran', from: [6,20], to: [7,2],
          weatherAr: 'تهب رياح بارح الدبران المثيرة للعواصف الترابية، ويكون الانقلاب الصيفي (أطول نهار)، ويستمر الحر الشديد والجفاف مع غياب الأمطار.',
          weatherEn: 'Dabaran Baarih winds cause dust storms. Summer solstice occurs (longest day). Extreme heat and drought continue with no rain.' },
        { ar: 'الهقعة (الجوزاء الأولى)', en: 'Al-Haq\'a (Jawza I)', from: [7,3], to: [7,15],
          weatherAr: 'ذروة القيظ وجمرة الحر، أشد فترات السنة حرارة، تهب رياح السموم الحارة الجافة التي قد تتجاوز 50°م، وتلتهب الأرض ويكثر السراب.',
          weatherEn: 'Peak of summer — the hottest period of the entire year. Scorching dry Simoom winds may exceed 50°C. The earth burns, mirages shimmer.' },
        { ar: 'الهنعة (الجوزاء الثانية)', en: 'Al-Han\'a (Jawza II)', from: [7,16], to: [7,28],
          weatherAr: 'استمرار جمرة القيظ وذروة الحر مع رياح السموم، تنتهي البوارح ويبدأ هبوب رياح الكوس الرطبة من بحر العرب، مما يرفع الرطوبة تدريجياً.',
          weatherEn: 'Peak heat and Simoom winds continue. Bawarih winds end and moist Kaus monsoon winds from the Arabian Sea begin, gradually raising humidity.' },
        { ar: 'المرزم (الذراع)', en: 'Al-Mirzam', from: [7,29], to: [8,10],
          weatherAr: 'جمرة القيظ مع هبوب رياح الكوس الرطبة، أجواء مُجهدة من الرطوبة والحرارة، وتتشكل الروايح (سحب ركامية صيفية) على الجبال قد تصحبها أمطار رعدية.',
          weatherEn: 'Scorching heat with moist Kaus winds creates exhausting humidity. Summer cumulus clouds (Rawayih) form over mountains, sometimes bringing thunderstorms.' },
    ];

    // ─── الأبراج الشمسية — 12 برجاً ─────────────────────────
    const ZODIAC = [
        { ar: 'الأسد', en: 'Leo', symbol: '♌', from: [7,23], to: [8,22] },
        { ar: 'السنبلة', en: 'Virgo', symbol: '♍', from: [8,23], to: [9,22] },
        { ar: 'الميزان', en: 'Libra', symbol: '♎', from: [9,23], to: [10,22] },
        { ar: 'العقرب', en: 'Scorpio', symbol: '♏', from: [10,23], to: [11,21] },
        { ar: 'القوس', en: 'Sagittarius', symbol: '♐', from: [11,22], to: [12,21] },
        { ar: 'الجدي', en: 'Capricorn', symbol: '♑', from: [12,22], to: [1,19] },
        { ar: 'الدلو', en: 'Aquarius', symbol: '♒', from: [1,20], to: [2,18] },
        { ar: 'الحوت', en: 'Pisces', symbol: '♓', from: [2,19], to: [3,20] },
        { ar: 'الحمل', en: 'Aries', symbol: '♈', from: [3,21], to: [4,19] },
        { ar: 'الثور', en: 'Taurus', symbol: '♉', from: [4,20], to: [5,20] },
        { ar: 'الجوزاء', en: 'Gemini', symbol: '♊', from: [5,21], to: [6,20] },
        { ar: 'السرطان', en: 'Cancer', symbol: '♋', from: [6,21], to: [7,22] },
    ];

    // ─── المواسم العربية ──────────────────────────────────────
    const SEASONS = [
        { ar: 'الكليبين', en: 'Al-Kulaibin', from: [8,11], to: [8,23] },
        { ar: 'الصفري', en: 'Al-Safari', from: [8,24], to: [10,15] },
        { ar: 'الوسم', en: 'Al-Wasm', from: [10,16], to: [12,6] },
        { ar: 'مربعانية الشتاء', en: 'Winter Murabba\'aniya', from: [12,7], to: [1,14] },
        { ar: 'برد البطين (الشبط)', en: 'Bard al-Butain (Shabat)', from: [1,15], to: [2,9] },
        { ar: 'العقارب', en: "Al-Aqarib", from: [2,10], to: [3,20] },
        { ar: 'الحميمين', en: 'Al-Humaimain', from: [3,21], to: [4,15] },
        { ar: 'الذراعين', en: 'Al-Dhira\'ain', from: [4,16], to: [5,11] },
        { ar: 'كنة الثريا', en: 'Kannat al-Thuraya', from: [4,28], to: [6,6] },
        { ar: 'الثريا', en: 'Al-Thuraya', from: [6,7], to: [6,19] },
        { ar: 'التويبع', en: 'Al-Tuwaiba\'', from: [6,20], to: [7,2] },
        { ar: 'الجوزاء الأولى (الهقعة)', en: 'Jawza I (Al-Haq\'a)', from: [7,3], to: [7,15] },
        { ar: 'الجوزاء الثانية (الهنعة)', en: 'Jawza II (Al-Han\'a)', from: [7,16], to: [7,28] },
        { ar: 'المرزم', en: 'Al-Mirzam', from: [7,29], to: [8,10] },
    ];

    // ─── الدرور — 36 درّاً ───────────────────────────────────
    // يبدأ الحساب من 15 أغسطس (طلوع سهيل)
    // 4 مئات: الصفري (100 يوم)، الشتاء (100 يوم)، الصيف (100 يوم)، القيظ (65 يوم)
    const DUROR_LABELS = {
        ar: ['در العشر','در العشرين','در الثلاثين','در الأربعين','در الخمسين',
             'در الستين','در السبعين','در الثمانين','در التسعين','در المائة'],
        en: ['Darr 10','Darr 20','Darr 30','Darr 40','Darr 50',
             'Darr 60','Darr 70','Darr 80','Darr 90','Darr 100']
    };
    const DUROR_MIA = {
        ar: ['المائة الأولى (الصفري)','المائة الثانية (الشتاء)','المائة الثالثة (الصيف)','المائة الرابعة (القيظ)'],
        en: ['1st Hundred (Safari)','2nd Hundred (Winter)','3rd Hundred (Summer)','4th Hundred (Qaiz)']
    };

    /** حساب يوم سهيل من التاريخ الميلادي (15 أغسطس = يوم 1) */
    function _suhailDay(gMonth, gDay, gYear) {
        // 15 أغسطس = بداية الحساب
        const start = new Date(gYear, 7, 15); // Aug 15
        let target = new Date(gYear, gMonth - 1, gDay);
        // إذا كان التاريخ قبل 15 أغسطس، نحسب من السنة السابقة
        if (target < start) {
            start.setFullYear(gYear - 1);
        }
        const diff = Math.floor((target - start) / 86400000);
        return diff + 1; // يوم 1 = 15 أغسطس
    }

    /** الحصول على الدر الحالي ورقم سهيل */
    function getDurr(gMonth, gDay, gYear) {
        const sDay = _suhailDay(gMonth, gDay, gYear);
        // تحديد المائة والدر
        let mia, durrIdx;
        if (sDay <= 100) {
            mia = 0; durrIdx = Math.ceil(sDay / 10) - 1;
        } else if (sDay <= 200) {
            mia = 1; durrIdx = Math.ceil((sDay - 100) / 10) - 1;
        } else if (sDay <= 300) {
            mia = 2; durrIdx = Math.ceil((sDay - 200) / 10) - 1;
        } else {
            mia = 3; durrIdx = Math.min(Math.ceil((sDay - 300) / 10) - 1, 5);
        }
        if (durrIdx < 0) durrIdx = 0;
        if (durrIdx > 9) durrIdx = 9;
        const lang = currentLang;
        return {
            suhailDay: sDay,
            mia: DUROR_MIA[lang][mia],
            durr: DUROR_LABELS[lang][durrIdx],
            durrNum: (durrIdx + 1) * 10
        };
    }

    /** مطابقة تاريخ ميلادي مع نطاق (شهر، يوم) مع دعم العبور بين السنوات */
    function _matchRange(gMonth, gDay, from, to) {
        const d = gMonth * 100 + gDay;
        const f = from[0] * 100 + from[1];
        const t = to[0] * 100 + to[1];
        if (f <= t) return d >= f && d <= t;
        // نطاق يعبر نهاية السنة (مثل ديسمبر → يناير)
        return d >= f || d <= t;
    }

    function getTale3(gMonth, gDay) {
        for (const t of TAWALIE) {
            if (_matchRange(gMonth, gDay, t.from, t.to))
                return { name: currentLang === 'en' ? t.en : t.ar, nameAr: t.ar, nameEn: t.en,
                         weather: currentLang === 'en' ? t.weatherEn : t.weatherAr };
        }
        return null;
    }

    function getZodiac(gMonth, gDay) {
        for (const z of ZODIAC) {
            if (_matchRange(gMonth, gDay, z.from, z.to))
                return { name: currentLang === 'en' ? z.en : z.ar, nameAr: z.ar, nameEn: z.en, symbol: z.symbol };
        }
        return null;
    }

    function getSeason(gMonth, gDay) {
        for (const s of SEASONS) {
            if (_matchRange(gMonth, gDay, s.from, s.to))
                return { name: currentLang === 'en' ? s.en : s.ar, nameAr: s.ar, nameEn: s.en };
        }
        return null;
    }

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

        // المناسبات
        ISLAMIC_EVENTS, getEvent,

        // الأنواء والمواسم والأبراج والدرور
        getTale3, getZodiac, getSeason, getDurr,

        // مساعدات
        toArabicNumerals,
        MONTH_NAMES, MONTH_NAMES_EN, DAY_NAMES, GREGORIAN_MONTH_NAMES,
        EPOCH_JDN
    };
})();

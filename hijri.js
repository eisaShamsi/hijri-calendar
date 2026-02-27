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
            footer: 'عيسى بن راشد الشامسي - دولة الإمارات العربية المتحدة',
            version: 'الإصدار 3.2',
            credit: 'صُمم بواسطة Claude Code (Opus 4.6)',
            anwaTitle: 'الأنواء والمواسم',
            tale3Label: 'الطالع',
            zodiacLabel: 'البرج',
            seasonLabel: 'الموسم',
            durrLabel: 'الدر',
            suhailLabel: 'سهيل',
            moonPhaseLabel: 'طور القمر',
            moonAgeDays: 'يوم',
            moonIllumination: 'الإضاءة',
            moonNextPhase: 'القادم',
            moonDaysLeft: 'بعد',
            moonPhasesTitle: 'أطوار القمر',
            tideLabel: 'المد والجزر',
            hilalTitle: 'ولادة الهلال',
            hilalConjunction: 'الاقتران',
            hilalMoonAge: 'عمر الهلال',
            hilalAltitude: 'الارتفاع',
            hilalElongation: 'الاستطالة',
            hilalVisibility: 'إمكانية الرؤية',
            hilalHours: 'ساعة',
            hilalDegree: '°',
            hilalAtSunset: 'عند الغروب',
            hilalDirection: 'الاتجاه',
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
            // رمضان
            ramadanNight: 'ليلة رمضان', ramadanLastTen: 'العشر الأواخر', ramadanQadr: 'تُرجى فيها ليلة القدر',
            ramadanImsak: 'الإمساك', ramadanFasting: 'مدة الصيام',
            // التحويل
            converterResult: 'نتيجة التحويل', converterCopy: 'نسخ',
            converterCopied: 'تم النسخ!',
            // المشاركة
            shareTitle: 'مشاركة', shareCopied: 'تم نسخ النص!', shareError: 'تعذرت المشاركة',
            sharePrayerTitle: 'مشاركة المواقيت',
            shareBtn: 'مشاركة', shareContentDate: 'تاريخ فقط', shareContentPrayer: 'صلوات', shareContentFull: 'كامل',
            shareCopyBtn: 'نسخ', shareActionShare: 'مشاركة',
            shareThemeBasit: 'بسيط', shareThemeIslami: 'إسلامي', shareThemeArabi: 'عربي كلاسيكي',
            shareThemeMashr: 'المشربية', shareThemeQubba: 'القبة', shareThemeMakh: 'المخطوطة',
            creditsName: 'عيسى بن راشد الشامسي - دولة الإمارات العربية المتحدة',
            creditsVersion: 'الإصدار 3.2', creditsTech: 'صُمم بواسطة Claude Code (Opus 4.6)',
            // قوس الشمس
            sunArcDay: 'طول النهار', sunArcNight: 'طول الليل',
            arabicTime: 'الساعة العربية', arabicTimeNow: 'الساعة العربية الآن',
            timeFormat12h: 'تنسيق ١٢ ساعة (ص/م)', timeAM: 'ص', timePM: 'م',
            // الأذكار
            adhkarTitle: 'الأذكار', adhkarMorning: 'أذكار الصباح', adhkarEvening: 'أذكار المساء',
            adhkarCount: 'مرات', adhkarSource: 'المصدر', adhkarDone: 'تمت',
            // التصدير PDF
            exportPDF: 'طباعة PDF',
            // واجهة اليوم
            share: 'مشاركة',
            today: 'اليوم',
            backToCalendar: 'التقويم الشهري',
            backToDayView: 'الواجهة الرئيسة',
            palette: 'الألوان',
            palettePapyrus: 'البردي', paletteEmerald: 'الأخضر', paletteOcean: 'الأزرق',
            paletteAmethyst: 'البنفسجي', paletteGold: 'الذهبي', paletteRuby: 'الأحمر',
            paletteSnow: 'الأبيض', paletteNoir: 'الأسود',
            weatherTitle: 'حالة الطقس',
            anwaSeasons: 'الدرور والأنواء والمواسم',
            // عناصر الأنواء الإضافية
            windLabel: 'الرياح', fishLabel: 'الأسماك', cropsLabel: 'المحاصيل', wildlifeLabel: 'الحياة الفطرية',
            // صفحات التفاصيل
            anwaDetailBack: 'رجوع', anwaCurrent: 'الحالي', anwaDates: 'الفترة',
            anwaAllStars: 'الطوالع الثمانية والعشرون', anwaAllSeasons: 'المواسم', anwaAllDurr: 'نظام الدرور',
            anwaWindCompass: 'بوصلة الرياح', anwaSeasonalWinds: 'الرياح الموسمية',
            anwaSeaStrikes: 'الضربات البحرية',
            anwaAllFish: 'الأسماك الموسمية', anwaAllCrops: 'المحاصيل والفواكه', anwaAllWildlife: 'الحياة الفطرية',
            anwaSuhailDay: 'يوم سهيل', anwaInSeason: 'في الموسم', anwaOutSeason: 'خارج الموسم',
            anwaSource: 'المصدر: كتاب الدرور والطوالع — مركز جامع الشيخ زايد الكبير',
            dururCircleTitle: 'ديرة الدرور',
            dururCircleMore: 'ديرة الدرور',
            dururZodiac: 'البرج',
            tideMovements: 'حركات المد والجزر',
            tideHigh: 'مد', tideLow: 'جزر',
            tideSpring: 'مد عالٍ', tideNeap: 'مد منخفض', tideRising: 'مد متزايد', tideFalling: 'مد متناقص',
            weatherFeels: 'الإحساس', weatherHumidity: 'الرطوبة', weatherWind: 'الرياح', weatherKmh: 'كم/س',
            weatherPrecip: 'هطول', weatherMm: 'مم', weatherHigh: 'العظمى', weatherLow: 'الصغرى',
            weatherRainChance: 'احتمال أمطار', weatherUV: 'الأشعة فوق البنفسجية',
            locationBased: 'بحسب موقع المستخدم',
            welcomeTitle: 'مرحباً بك',
            welcomeMsg: 'حدد موقعك للحصول على مواقيت صلاة دقيقة وأحوال الطقس والمزيد',
            welcomeDetect: 'تحديد موقعي',
            welcomeSkip: 'تخطي',
            welcomeDetecting: 'جارٍ تحديد الموقع...',
            needleReset: 'انقر مرتين لإعادة الإبرة لليوم',
            // المحتوى الذكي (AI)
            aiSectionTitle: 'تأمل اليوم',
            aiVerse: 'آية',
            aiReflection: 'تأمل',
            aiHadith: 'حديث',
            aiWisdom: 'حكمة',
            aiHistory: 'في مثل هذا اليوم',
            aiLoading: 'جارٍ التحميل...',
            aiError: 'تعذر تحميل المحتوى',
            aiOffline: 'المحتوى غير متوفر بدون اتصال',
            aiSource: 'المصدر',
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
            footer: 'Eisa Rashid ALSHAMSI - UAE',
            version: 'Version 3.2',
            credit: 'Designed with Claude Code (Opus 4.6)',
            anwaTitle: 'Seasons & Stars',
            tale3Label: 'Star',
            zodiacLabel: 'Zodiac',
            seasonLabel: 'Season',
            durrLabel: 'Darr',
            suhailLabel: 'Suhail',
            moonPhaseLabel: 'Moon Phase',
            moonAgeDays: 'days',
            moonIllumination: 'Illumination',
            moonNextPhase: 'Next',
            moonDaysLeft: 'in',
            moonPhasesTitle: 'Moon Phases',
            tideLabel: 'Tides',
            hilalTitle: 'Crescent Birth',
            hilalConjunction: 'Conjunction',
            hilalMoonAge: 'Moon Age',
            hilalAltitude: 'Altitude',
            hilalElongation: 'Elongation',
            hilalVisibility: 'Visibility',
            hilalHours: 'hrs',
            hilalDegree: '°',
            hilalAtSunset: 'At Sunset',
            hilalDirection: 'Direction',
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
            // Ramadan
            ramadanNight: 'Ramadan Night', ramadanLastTen: 'Last 10 Nights', ramadanQadr: 'Laylat al-Qadr potential',
            ramadanImsak: 'Imsak', ramadanFasting: 'Fasting Duration',
            // Converter
            converterResult: 'Conversion Result', converterCopy: 'Copy',
            converterCopied: 'Copied!',
            // Share
            shareTitle: 'Share', shareCopied: 'Text copied!', shareError: 'Could not share',
            sharePrayerTitle: 'Share Prayer Times',
            shareBtn: 'Share', shareContentDate: 'Date Only', shareContentPrayer: 'Prayers', shareContentFull: 'Full',
            shareCopyBtn: 'Copy', shareActionShare: 'Share',
            shareThemeBasit: 'Simple', shareThemeIslami: 'Islamic', shareThemeArabi: 'Classic Arabic',
            shareThemeMashr: 'Mashrabiya', shareThemeQubba: 'Dome', shareThemeMakh: 'Manuscript',
            creditsName: 'Eisa Rashid ALSHAMSI - UAE',
            creditsVersion: 'Version 3.2', creditsTech: 'Designed with Claude Code (Opus 4.6)',
            // Sun arc
            sunArcDay: 'Day Length', sunArcNight: 'Night Length',
            arabicTime: 'Arabic Hour', arabicTimeNow: 'Arabic Hour Now',
            timeFormat12h: '12-hour format (AM/PM)', timeAM: 'AM', timePM: 'PM',
            // Adhkar
            adhkarTitle: 'Adhkar', adhkarMorning: 'Morning Adhkar', adhkarEvening: 'Evening Adhkar',
            adhkarCount: 'times', adhkarSource: 'Source', adhkarDone: 'Done',
            // PDF Export
            exportPDF: 'Print PDF',
            // Day View
            share: 'Share',
            today: 'Today',
            backToCalendar: 'Monthly Calendar',
            backToDayView: 'Main View',
            palette: 'Colors',
            palettePapyrus: 'Papyrus', paletteEmerald: 'Emerald', paletteOcean: 'Ocean',
            paletteAmethyst: 'Amethyst', paletteGold: 'Gold', paletteRuby: 'Ruby',
            paletteSnow: 'Snow', paletteNoir: 'Noir',
            weatherTitle: 'Weather',
            anwaSeasons: 'Duror, Anwa & Seasons',
            // Extra anwa elements
            windLabel: 'Winds', fishLabel: 'Fish', cropsLabel: 'Crops', wildlifeLabel: 'Wildlife',
            // Detail pages
            anwaDetailBack: 'Back', anwaCurrent: 'Current', anwaDates: 'Period',
            anwaAllStars: 'The 28 Lunar Mansions', anwaAllSeasons: 'Seasons', anwaAllDurr: 'Durr System',
            anwaWindCompass: 'Wind Compass', anwaSeasonalWinds: 'Seasonal Winds',
            anwaSeaStrikes: 'Sea Strikes',
            anwaAllFish: 'Seasonal Fish', anwaAllCrops: 'Crops & Fruits', anwaAllWildlife: 'Wildlife & Plants',
            anwaSuhailDay: 'Suhail Day', anwaInSeason: 'In season', anwaOutSeason: 'Off season',
            anwaSource: 'Source: Duroor & Tawalie Book — Sheikh Zayed Grand Mosque Center',
            dururCircleTitle: 'Duror Compass',
            dururCircleMore: 'Duror Compass',
            dururExplainTitle: 'What is the Duror Compass?',
            dururExplain: 'The Duror Compass (Arabic: ديرة الدرور) is a traditional Arabian seasonal calendar used by Gulf Arabs for centuries to track weather patterns, agriculture, fishing, and navigation.\n\n• <strong>Duror</strong> (singular: Darr) — Climatic periods of 10–13 days dividing the year, each with distinct weather traits.\n• <strong>Anwa</strong> — The 28 lunar mansions (star groups) whose rising and setting mark seasonal shifts.\n• <strong>Seasons</strong> — Traditional Arabian seasons like Suhail, Wasm, Marbaa\'niyya, and Sarayat.\n\nThe compass visualizes 10 concentric rings: zodiac signs, star mansions, duror, winds, sea conditions, agriculture, and Gregorian months — all aligned to show how they relate on any given day.\n\nSource: Duroor & Tawalie Book — Sheikh Zayed Grand Mosque Center.',
            anwaExplainTitle: 'What are Duror, Anwa & Seasons?',
            anwaExplain: '<strong>Duror</strong> — Climatic periods (10–13 days each) that divide the year. Each darr has unique weather, wind, and agricultural characteristics.\n\n<strong>Anwa</strong> — The 28 lunar mansions (star groups) used by Arabs to predict weather changes based on stellar positions.\n\n<strong>Seasons</strong> — Traditional markers like Suhail (the cooling star), Wasm (autumn rains), and Marbaa\'niyya (the 40-day cold).',
            dururZodiac: 'Zodiac',
            tideMovements: 'Tide Movements',
            tideHigh: 'high', tideLow: 'low',
            tideSpring: 'Spring tide', tideNeap: 'Neap tide', tideRising: 'Rising tide', tideFalling: 'Falling tide',
            weatherFeels: 'Feels', weatherHumidity: 'Humidity', weatherWind: 'Wind', weatherKmh: 'km/h',
            weatherPrecip: 'Precip', weatherMm: 'mm', weatherHigh: 'High', weatherLow: 'Low',
            weatherRainChance: 'Rain chance', weatherUV: 'UV',
            locationBased: 'Based on your location',
            welcomeTitle: 'Welcome',
            welcomeMsg: 'Set your location for accurate prayer times, weather, and more',
            welcomeDetect: 'Detect My Location',
            welcomeSkip: 'Skip',
            welcomeDetecting: 'Detecting location...',
            needleReset: 'Double-tap to reset to today',
            // AI Content
            aiSectionTitle: 'Daily Reflection',
            aiVerse: 'Verse',
            aiReflection: 'Reflection',
            aiHadith: 'Hadith',
            aiWisdom: 'Wisdom',
            aiHistory: 'On This Day',
            aiLoading: 'Loading...',
            aiError: 'Could not load content',
            aiOffline: 'Content unavailable offline',
            aiSource: 'Source',
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
    function isSacredMonth(m) { return m === 1 || m === 7 || m === 11 || m === 12; }

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

    // ══════════════════════════════════════════════════════════════
    // ⚠️  بيانات ديرة الدرور — مُقفلة (LOCKED v4.58)
    //     لا يجوز تعديل الأسماء أو التواريخ أو الترتيب
    //     المرجع: DIRAT_DUROR_SPEC.md
    //     المصدر: كتاب الدرور والطوالع — مركز جامع الشيخ زايد الكبير
    // ══════════════════════════════════════════════════════════════

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
          weatherAr: 'تزداد برودة الجو ليلاً مع اعتدال النهار، وتهب الرياح الجنوبية المثيرة للغبار، والرياح متقلبة الاتجاه، وتشيع الأمراض الموسمية بسبب التقلبات الجوية. وتقع فيه ضربة الأحيمر البحرية (1-10 نوفمبر) مع سقوط نجم قلب العقرب.',
          weatherEn: 'Nighttime cold increases noticeably while daytime stays moderate. Dusty southerly winds blow with variable directions. Seasonal illnesses spread due to weather fluctuations. Ahimar sea strike occurs (Nov 1-10) with the setting of Antares (Qalb al-Aqrab).' },
        { ar: 'الغفر', en: 'Al-Ghafr', from: [11,11], to: [11,23],
          weatherAr: 'آخر نجوم الوسم، يسكن بحر العرب ويهيج الخليج العربي، وتزداد برودة الليل أكثر من ذي قبل مع اعتدال النهار.',
          weatherEn: 'Last Wasm star. The Arabian Sea calms while the Gulf becomes agitated. Night cold increases further while daytime stays moderate.' },
        { ar: 'الزبانا', en: 'Al-Zubana', from: [11,24], to: [12,6],
          weatherAr: 'بداية مظاهر الشتاء، تزداد برودة الليل بشكل ملحوظ وتشتد الرياح الباردة، ويكثر هبوب العواصف وسقوط الأمطار، مع زيادة طول الليل.',
          weatherEn: 'Winter signs appear. Night cold increases notably with strong cold winds. Storms and rainfall become more frequent as nights grow longer.' },
        { ar: 'الإكليل', en: 'Al-Iklil', from: [12,7], to: [12,19],
          weatherAr: 'أول نجوم مربعانية الشتاء، تكثر الأمطار والغيوم ويشتد البرد، وتصادف فرصة ضربة الكوي وهي رياح قوية غير منتظمة يهيج معها البحر.',
          weatherEn: 'First star of winter Marbainiya (40-day cold). Rain and clouds increase, cold intensifies. Kawi storm risk coincides — strong irregular winds agitating the seas.' },
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

    // ─── الأبراج الشمسية — 12 برجاً ⚠️ مُقفل ──────────────
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

    // ─── المواسم العربية ⚠️ مُقفل ─────────────────────────────
    const SEASONS = [
        { ar: 'الكليبين', en: 'Late Summer Heat', from: [8,11], to: [8,23] },
        { ar: 'الصفري', en: 'Early Autumn', from: [8,24], to: [10,15] },
        { ar: 'الوسم', en: 'Rain Season', from: [10,16], to: [12,6] },
        { ar: 'مربعانية الشتاء', en: 'Deep Winter (40 days)', from: [12,7], to: [1,14] },
        { ar: 'برد البطين (الشبط)', en: 'Harsh Cold', from: [1,15], to: [2,9] },
        { ar: 'العقارب', en: 'Sting Cold', from: [2,10], to: [3,20] },
        { ar: 'الحميمين', en: 'Warming Days', from: [3,21], to: [4,15] },
        { ar: 'الذراعين', en: 'Spring Warmth', from: [4,16], to: [5,11] },
        { ar: 'كنة الثريا', en: 'Pleiades Heat', from: [4,28], to: [6,6] },
        { ar: 'الثريا', en: 'Pleiades Peak', from: [6,7], to: [6,19] },
        { ar: 'التويبع', en: 'Rising Heat', from: [6,20], to: [7,2] },
        { ar: 'الجوزاء الأولى (الهقعة)', en: 'Orion Heat I', from: [7,3], to: [7,15] },
        { ar: 'الجوزاء الثانية (الهنعة)', en: 'Orion Heat II', from: [7,16], to: [7,28] },
        { ar: 'المرزم', en: 'Peak Summer', from: [7,29], to: [8,10] },
    ];

    // ─── الدرور — 37 درّاً ⚠️ مُقفل ──────────────────────────
    // يبدأ الحساب من 15 أغسطس (طلوع سهيل)
    // 4 مئات: الصفري (100 يوم)، الشتاء (100 يوم)، الصيف (100 يوم)، القيظ (65 يوم)
    const DUROR_LABELS = {
        ar: ['العشر','العشرون','الثلاثون','الأربعون','الخمسون',
             'الستون','السبعون','الثمانون','التسعون','المائة'],
        en: ['10','20','30','40','50',
             '60','70','80','90','100']
    };
    // أسماء بديلة لدرور معينة حسب المئة — [mia][durrIndex]
    const DUROR_ALIASES = {
        ar: { '3-6': 'المساريق' },  // در المساريق — ليست السبعون، بل در مستقل (5 أيام)
        en: { '3-6': 'Masariq' }
    };
    const DUROR_MIA = {
        ar: ['المائة الأولى (الصفري)','المائة الثانية (الشتاء)','المائة الثالثة (الصيف)','المائة الرابعة (القيظ)'],
        en: ['1st Hundred (Safari)','2nd Hundred (Winter)','3rd Hundred (Summer)','4th Hundred (Qaiz)']
    };

    // ─── أسماء الأزمنة العربية (ساعات النهار والليل) ────
    // المصدر: كتاب فقه اللغة وسر العربية — أبو منصور الثعالبي
    // هذه أزمنة (فترات) وليست ساعات متساوية — تتغير مدتها حسب الفصل
    const ARAB_DAY_TIMES = [
        { ar: 'الشروق', en: 'Sunrise', descAr: 'بداية بزوغ الشمس من الأفق', descEn: 'The moment the sun begins to appear above the horizon' },
        { ar: 'البكور', en: 'Early Morning', descAr: 'أول النهار، وقت النشاط والبكور إلى العمل', descEn: 'The earliest active hours, when people head out to work' },
        { ar: 'الغدوة', en: 'Forenoon', descAr: 'ما بين الصبح وطلوع الشمس، وقت الغدو والانطلاق', descEn: 'The time of setting out, between early morning and mid-morning' },
        { ar: 'الضحى', en: 'Mid-Morning', descAr: 'ارتفاع الشمس واشتداد ضوئها', descEn: 'When the sun rises high and its light grows strong' },
        { ar: 'الهاجرة', en: 'Midday Heat', descAr: 'اشتداد الحر عند منتصف النهار، يهجر الناس بيوتهم', descEn: 'The intense midday heat when people seek shelter' },
        { ar: 'الظهيرة', en: 'High Noon', descAr: 'ذروة النهار حين تتوسط الشمس السماء', descEn: 'The peak of day when the sun is at its zenith' },
        { ar: 'الرواح', en: 'Afternoon', descAr: 'بعد الزوال، وقت الرواح والعودة من العمل', descEn: 'After noon, the time of returning from work' },
        { ar: 'العصر', en: 'Late Afternoon', descAr: 'آخر النهار، من العَصْر أي الضغط على بقية الوقت', descEn: 'Late day, squeezing the remaining daylight hours' },
        { ar: 'القصر', en: 'Declining Sun', descAr: 'قصر النهار وميل الشمس نحو الغروب', descEn: 'The day grows short as the sun tilts toward setting' },
        { ar: 'الأصيل', en: 'Pre-Sunset', descAr: 'اصفرار الشمس وتحوّل لونها قبيل الغروب', descEn: 'The sun turns golden shortly before setting' },
        { ar: 'العشي', en: 'Dusk', descAr: 'آخر النهار حين يبدأ ظلام العشاء', descEn: 'The final daylight as evening darkness begins' },
        { ar: 'الغروب', en: 'Sunset', descAr: 'اختفاء قرص الشمس تحت الأفق', descEn: 'The sun disappears below the horizon' }
    ];
    const ARAB_NIGHT_TIMES = [
        { ar: 'الشفق', en: 'Twilight', descAr: 'الحمرة الباقية في الأفق بعد غروب الشمس', descEn: 'The red glow lingering on the horizon after sunset' },
        { ar: 'الغسق', en: 'Nightfall', descAr: 'إقبال الظلام وامتزاجه ببقايا الضوء', descEn: 'Darkness creeping in as the last light fades' },
        { ar: 'العتمة', en: 'Deep Dark', descAr: 'ظلام الليل الأول حين يشتد السواد', descEn: 'The first deep darkness of the night' },
        { ar: 'السُّدفة', en: 'Mixed Light', descAr: 'اختلاط الضوء بالظلمة، لا ليل تام ولا نهار', descEn: 'A blend of faint light and darkness' },
        { ar: 'الفحمة', en: 'Darkest Hour', descAr: 'أشد الليل سواداً كلون الفحم', descEn: 'The blackest hour of the night, dark as coal' },
        { ar: 'الزُّلّة', en: 'Full Dark', descAr: 'منتصف الليل حين يزلّ النوم على الأعين', descEn: 'Deep midnight when sleep overtakes the eyes' },
        { ar: 'الزُّلفة', en: 'Late Night', descAr: 'ساعة التقرب والتهجد في جوف الليل', descEn: 'The still hours of devotion in the depths of night' },
        { ar: 'البُهرة', en: 'Midnight', descAr: 'وسط الليل، من البهر وهو الامتلاء', descEn: 'The very middle of the night, at its fullest depth' },
        { ar: 'السَّحَر', en: 'Pre-Dawn', descAr: 'آخر الليل قبيل الفجر، وقت السحور', descEn: 'The final stretch of night before dawn, time of the pre-dawn meal' },
        { ar: 'الفجر', en: 'Dawn', descAr: 'انفجار النور الأول في الأفق', descEn: 'The first light breaking through the horizon' },
        { ar: 'الصبح', en: 'Daybreak', descAr: 'انتشار الضوء واتضاح الأشياء', descEn: 'Light spreading and objects becoming visible' },
        { ar: 'الصباح', en: 'Morning Light', descAr: 'إشراق النور التام قبيل شروق الشمس', descEn: 'Full brightness just before the sun rises' }
    ];

    // ─── بيانات إثرائية من كتاب الدرور والطوالع ⚠️ مُقفل ────
    // (مركز جامع الشيخ زايد الكبير)
    const ANWA_ENRICHMENT = {
        // بوصلة الرياح — 16 اتجاه
        windCompass: [
            { ar: 'الشمال', en: 'Shamal (N)', degree: 0 },
            { ar: 'النعشي', en: 'Na\'shi (NNE)', degree: 22.5 },
            { ar: 'الناشي', en: 'Nashi (NE)', degree: 45 },
            { ar: 'الأزيب', en: 'Aziyab (ENE)', degree: 67.5 },
            { ar: 'الصبا', en: 'Saba (E)', degree: 90 },
            { ar: 'السهيلي الشرقي', en: 'Suhaili Sharqi (ESE)', degree: 112.5 },
            { ar: 'الكوس', en: 'Kaus (SE)', degree: 135 },
            { ar: 'السهيلي', en: 'Suhaili (SSE)', degree: 157.5 },
            { ar: 'الجنوب', en: 'Junub (S)', degree: 180 },
            { ar: 'المريسي', en: 'Murisi (SSW)', degree: 202.5 },
            { ar: 'الهبوب', en: 'Hubub (SW)', degree: 225 },
            { ar: 'اليافعي', en: 'Yafi\'i (WSW)', degree: 247.5 },
            { ar: 'الدبور', en: 'Dabur (W)', degree: 270 },
            { ar: 'الغربي', en: 'Gharbi (WNW)', degree: 292.5 },
            { ar: 'الشهيلي', en: 'Shihaili (NW)', degree: 315 },
            { ar: 'الحصبائي', en: 'Hasba\'i (NNW)', degree: 337.5 },
        ],
        // رياح موسمية — من جدول الرياح في كتاب الدرور والطوالع
        seasonalWinds: [
            { ar: 'هبايب سهيل', en: 'Cool Breezes', from: [8,15], to: [9,22], desc_ar: 'رياح لطيفة رطبة تلطف الأجواء مع طلوع سهيل', desc_en: 'Pleasant moist breezes that cool the air with Canopus rise' },
            { ar: 'رياح الكوس', en: 'Monsoon Winds', from: [7,16], to: [9,20], desc_ar: 'رياح موسمية رطبة من بحر العرب، عالية الرطوبة', desc_en: 'Monsoon winds from Arabian Sea, high humidity' },
            { ar: 'الروايح', en: 'Summer Clouds', from: [7,29], to: [8,15], desc_ar: 'سحب ركامية صيفية قد تصاحبها أمطار رعدية', desc_en: 'Summer cumulus clouds with possible thunderstorms' },
            { ar: 'رياح الأكيذب', en: 'Cooling Northerlies', from: [10,4], to: [10,31], desc_ar: 'رياح شمالية قوية يسبقها هدوء ولا تلبث طويلاً، تهب على شكل عواصف صغيرة تسرّع انصراف الحر واعتدال الجو', desc_en: 'Strong northerly winds preceded by calm, blowing in short storm bursts that hasten cool weather' },
            { ar: 'الأزيب', en: 'Moist Southerlies', from: [10,1], to: [11,30], desc_ar: 'رياح جنوبية محملة بالرطوبة وبخار الماء تبشر بالمطر', desc_en: 'Southern winds carrying moisture, heralding rain' },
            { ar: 'السهيلي', en: 'Southern Breeze', from: [10,1], to: [2,28], desc_ar: 'رياح جنوبية من جهة سهيل، ليست باردة، تبشر بالمطر', desc_en: 'Southern winds from Canopus direction, herald rain' },
            { ar: 'ضربة الأحيمر', en: 'Red Storm', from: [11,11], to: [12,20], desc_ar: 'رياح قوية غير منتظمة الاتجاه تتزامن مع غيوب الأحيمر (اختفاء نجم قلب العقرب ~40 يوماً)، يهيج معها بحر عُمان والخليج العربي', desc_en: 'Strong irregular winds coinciding with Ahimar disappearance (Antares hidden ~40 days). Oman Sea and Arabian Gulf become agitated.' },
            { ar: 'العقربي', en: 'Eastern Rains', from: [11,1], to: [12,31], desc_ar: 'رياح شرقية رطبة، إذا هبت شتاءً تتكون السحب الماطرة', desc_en: 'Eastern moist winds that bring rain clouds in winter' },
            { ar: 'رياح الشمال', en: 'North Winds', from: [11,15], to: [2,28], desc_ar: 'رياح شمالية إلى شمالية غربية باردة شديدة وجافة', desc_en: 'Cold, dry north to NW winds — peak winter' },
            { ar: 'الياهي', en: 'Bitter Cold Wind', from: [1,1], to: [2,28], desc_ar: 'رياح شمالية من أكثر الرياح برودة وجفافاً', desc_en: 'Northerly winds, among the coldest and driest' },
            { ar: 'النعشي', en: 'Gulf Churner', from: [2,1], to: [2,28], desc_ar: 'رياح شمالية شرقية يثور معها الخليج ويهيج', desc_en: 'NE winds that churn the Arabian Gulf' },
            { ar: 'النعايات', en: 'Winter Farewell', from: [2,23], to: [3,12], desc_ar: 'آخر الرياح الباردة — تنعى الشتاء', desc_en: 'Last cold winds — bidding winter farewell' },
            { ar: 'الصبا (المطلعي)', en: 'Spring Breeze', from: [3,1], to: [4,30], desc_ar: 'نسائم معتدلة ربيعية من الشرق تصاحبها روائح الأزهار', desc_en: 'Pleasant spring easterly breeze with flower scents' },
            { ar: 'السرايات (المراويح)', en: 'Spring Storms', from: [3,20], to: [4,28], desc_ar: 'اضطرابات جوية ربيعية تشكل سحب ركامية ماطرة بغزارة', desc_en: 'Spring thunderstorms with heavy cumulus rainfall' },
            { ar: 'الطوز', en: 'Dust Storms', from: [3,1], to: [5,31], desc_ar: 'رياح شمالية غربية جافة وحارة محملة بالغبار والأتربة، مصدرها جنوب العراق وشمال الجزيرة العربية، تقابلها رياح الخماسين في شمال أفريقيا', desc_en: 'Hot dry NW winds laden with dust from southern Iraq and northern Arabia, equivalent to North Africa\'s Khamsin winds' },
            { ar: 'البوارح', en: 'Dry NW Winds', from: [5,12], to: [7,28], desc_ar: 'رياح شمالية غربية جافة — لا أمطار ولا سحب', desc_en: 'Dry NW winds — no rain, no clouds' },
            { ar: 'بارح البطين', en: 'Early Dry Wind', from: [5,25], to: [6,6], desc_ar: 'أول البوارح، البارح الصغير', desc_en: 'First phase of dry NW winds' },
            { ar: 'بارح الثريا', en: 'Peak Dry Wind', from: [6,7], to: [7,2], desc_ar: 'البارح الكبير — أنشط البوارح', desc_en: 'Major dry wind phase — peak activity' },
            { ar: 'بارح الجوزاء', en: 'Scorching Wind', from: [7,3], to: [7,28], desc_ar: 'بوارح مع السموم — أشد الرياح حراً', desc_en: 'Dry winds with hot gusts — hottest winds' },
            { ar: 'رياح السموم', en: 'Poison Wind', from: [7,3], to: [8,10], desc_ar: 'رياح صيفية حارة جافة تتجاوز ٥٠ درجة مئوية', desc_en: 'Hot dry summer winds exceeding 50°C' },
            { ar: 'الغربي', en: 'Western Dust', from: [6,1], to: [6,30], desc_ar: 'رياح غربية دافئة وجافة تثير التراب والغبار', desc_en: 'Warm dry western winds raising dust' },
            { ar: 'بارح المرزم', en: 'Late Dry Wind', from: [7,29], to: [8,10], desc_ar: 'آخر البوارح، تضعف فيه البوارح وتنشط رياح الكوس', desc_en: 'Last phase of dry winds, Kaws winds begin to dominate' },
        ],
        // ضربات بحرية — اضطرابات جوية يتجنبها البحارة
        seaStrikes: [
            { ar: 'ضربة الأكيذب', en: 'Akidhib strike', from: [10,10], to: [10,20] },
            // ضربة الأحيمر (11/1-11/10) نُقلت إلى حلقة الرياح بجانب ضربة الأحيمر الريح
            { ar: 'ضربة الكوي', en: 'Kawi strike', from: [12,10], to: [12,20] },
            { ar: 'ضربة الإكليل', en: 'Iklil strike', from: [5,10], to: [5,20] },
            { ar: 'ضربة الثريا', en: 'Thuraya strike', from: [6,1], to: [6,10] },
            { ar: 'ضربة الشلي', en: 'Shali strike', from: [6,11], to: [6,20] },
        ],
        // أسماك موسمية — من ملخص الدرور في كتاب الدرور والطوالع
        fish: [
            { ar: 'الهامور', en: 'Hamour (Grouper)', from: [4,22], to: [8,31] },
            { ar: 'الكنعد', en: 'Kana\'ad (Kingfish)', from: [3,13], to: [8,31] },
            { ar: 'الشعري', en: 'Sha\'ri (Emperor)', from: [2,1], to: [5,31] },
            { ar: 'الصافي', en: 'Safi (Rabbitfish)', from: [11,23], to: [5,31] },
            { ar: 'الزبيدي', en: 'Zubaidi (Pomfret)', from: [2,1], to: [3,31] },
            { ar: 'البياح', en: 'Bayah (Mullet)', from: [8,15], to: [5,31] },
            { ar: 'الجش', en: 'Jesh (Grunt)', from: [4,22], to: [8,31] },
            { ar: 'القابط', en: 'Qabit (Lizardfish)', from: [11,23], to: [5,31] },
            { ar: 'الشعم', en: 'Sha\'am (Yellowfin bream)', from: [12,23], to: [4,30] },
            { ar: 'الكوفر', en: 'Kufar (Yellowtail)', from: [12,23], to: [4,30] },
            { ar: 'القباقيب', en: 'Gabagib (Crab)', from: [12,23], to: [7,31] },
            { ar: 'الخبّاط', en: 'Khabbat (Queenfish)', from: [10,14], to: [1,31] },
            { ar: 'المرجان', en: 'Murjan (Coral fish)', from: [11,23], to: [12,31] },
            { ar: 'الحلوايوه', en: 'Halwayoh (Sweetlip)', from: [11,23], to: [12,31] },
            { ar: 'السولي', en: 'Suli (Needlefish)', from: [9,24], to: [11,22] },
            { ar: 'الشنينوه', en: 'Shninoh (Barracuda)', from: [9,24], to: [11,22] },
            { ar: 'النيسر', en: 'Naysar (Trevally)', from: [3,3], to: [5,31] },
            { ar: 'القباب', en: 'Gubab (Barracuda)', from: [6,21], to: [7,31] },
            { ar: 'الدردمان', en: 'Dardaman (Sardine)', from: [10,14], to: [12,31] },
            { ar: 'اليريور (القرش)', en: 'Yariur (Shark)', from: [3,13], to: [6,30] },
        ],
        // محاصيل وفواكه — من ملخص الدرور في كتاب الدرور والطوالع
        crops: [
            { ar: 'الرطب', en: 'Rutab (Fresh Dates)', from: [6,1], to: [9,30] },
            { ar: 'البرتقال والماندرين', en: 'Oranges & Mandarin', from: [11,23], to: [3,31] },
            { ar: 'الليمون المحلي', en: 'Local Lemons', from: [9,4], to: [12,31] },
            { ar: 'المانجو', en: 'Mango', from: [6,21], to: [8,10] },
            { ar: 'الرمان', en: 'Pomegranate', from: [7,31], to: [10,31] },
            { ar: 'التين', en: 'Figs', from: [7,31], to: [10,31] },
            { ar: 'العنب', en: 'Grapes', from: [7,31], to: [10,31] },
            { ar: 'البطيخ والشمام', en: 'Watermelon & Melon', from: [4,22], to: [7,31] },
            { ar: 'الطماطم والفلفل', en: 'Tomatoes & Peppers', from: [9,24], to: [4,30] },
            { ar: 'الخضروات الورقية', en: 'Leafy greens', from: [11,23], to: [3,31] },
            { ar: 'البقوليات والحبوب', en: 'Legumes & Grains', from: [4,22], to: [5,31] },
            { ar: 'البرسيم (الجت)', en: 'Alfalfa', from: [8,25], to: [4,30] },
            { ar: 'الفقع (الكمأة)', en: 'Faq\'a (Desert Truffle)', from: [10,14], to: [3,31] },
            { ar: 'البامية والملوخية', en: 'Okra & Molokhia', from: [5,1], to: [8,31] },
        ],
        // حياة فطرية — من ملخص الدرور في كتاب الدرور والطوالع
        wildlife: [
            { ar: 'تزهير السدر', en: 'Sidr tree blooming', from: [9,24], to: [11,22] },
            { ar: 'تزهير السنط (القرط والسمر)', en: 'Acacia blooming', from: [11,23], to: [4,30] },
            { ar: 'هجرة الطيور (ش←ج: حبارى، صقور، وز)', en: 'Bird migration south (Houbara, Falcons, Geese)', from: [9,14], to: [1,14] },
            { ar: 'هجرة الطيور (ج←ش: كرك، وز، سمان)', en: 'Bird migration north (Cranes, Geese, Quail)', from: [2,1], to: [5,31] },
            { ar: 'موسم القنص', en: 'Falconry/hunting season', from: [11,23], to: [2,28] },
            { ar: 'ضراب الإبل والخلفات', en: 'Camel mating & calving', from: [10,14], to: [2,28] },
            { ar: 'خروج الزواحف والهوام', en: 'Reptiles emerge from burrows', from: [3,1], to: [5,31] },
            { ar: 'تكاثر الأسماك (الحبل)', en: 'Fish spawning season', from: [11,3], to: [1,31] },
            { ar: 'نمو الفقع والأعشاب البرية', en: 'Truffle & wild herb growth', from: [10,14], to: [3,31] },
            { ar: 'نشاط النحل وإنتاج العسل', en: 'Bee activity & honey', from: [10,1], to: [3,31] },
            { ar: 'تكوينات الروايح (سحب ركامية)', en: 'Rawayih cloud formations', from: [7,29], to: [9,15] },
            { ar: 'الدوامات الغبارية والسراب', en: 'Dust devils & mirage', from: [7,3], to: [8,10] },
            { ar: 'موسم الغوص عن اللؤلؤ (قديماً)', en: 'Pearl diving season (historic)', from: [6,1], to: [8,10] },
        ],
    };

    // ─── أوصاف تفصيلية للدرور الـ 36 — من كتاب الدرور والطوالع ───────────
    // مفتاح: "mia-durr" حيث mia = 0-3 (صفري/شتاء/صيف/قيظ)، durr = 0-9
    const DURR_DETAILS = {
        // ════ المائة الأولى — الصفري (15 أغسطس – 22 نوفمبر) ════
        '0-0': {
            dates: [8,15,8,24],
            ar: 'طلوع سهيل وانكسار الحرارة. هبايب سهيل (نسائم رطبة). حصاد الرطب. بدء زراعة الخريف المبكرة (باذنجان، طماطم، فلفل في مشاتل مظللة). أسماك: البدح، النقرور، البياح. بدء هجرة الدخل والخواضير جنوباً.',
            en: 'Canopus rises, heat breaks. Suhail breezes begin. Date harvest peaks. Early autumn planting starts (eggplant, tomato, pepper in shaded nurseries). Fish: Badah, Naqrur, Bayah. Dakhel & Khawadeer birds migrate south.'
        },
        '0-1': {
            dates: [8,25,9,3],
            ar: 'وعكات سهيل (موجات حرارة مع رطوبة عالية). صرام نخل الفرض. زراعة محاصيل علفية وخضروات. أسماك: البياح، الجش.',
            en: 'Suhail heat waves with high humidity. Fardh date harvest begins. Fodder crops and vegetables planted. Fish: Bayah, Jesh.'
        },
        '0-2': {
            dates: [9,4,9,13],
            ar: 'حرة الدبس/حرة المساطيح — موجة حر تساعد على تجفيف التمور. هجرة الدخل والسمان والقميري. نضج الليمون.',
            en: 'Hot spell helps dry dates on platforms. Quail, doves migrate through. Lemons ripen.'
        },
        '0-3': {
            dates: [9,14,9,23],
            ar: 'الاعتدال الخريفي. برودة الليل. أفضل أوقات الزراعة مع طالع الجبهة. نضج أصناف التمر المتأخرة (الخصاب، الهلالي). تكاثر معظم الأسماك.',
            en: 'Autumnal equinox. Nights cool. Best planting time with Jabha star. Late date varieties ripen. Most fish species multiply.'
        },
        '0-4': {
            dates: [9,24,10,3],
            ar: 'تبرد الأجواء فجراً. تشكل الضباب صباحاً. رياح الأكيذب. تزهير أشجار السدر. زراعة البرسيم والشعير. أسماك: الجد، السولي، الشنينوه.',
            en: 'Dawn cools. Morning fog forms. Akidhib winds blow. Sidr trees bloom. Alfalfa and barley sown. Fish: Jed, Suli, Shninoh.'
        },
        '0-5': {
            dates: [10,4,10,13],
            ar: 'انكسار الحرارة. رياح الأزيب (جنوبية رطبة). تكاثر الربيان. وصول صقور الشواهين. آخر نجم من بنات نعش (الإكيذب) يطلع.',
            en: 'Heat breaks further. Aziyab moist southerlies. Shrimp breed. Shaheen falcons arrive. Last star of Ursa Major rises.'
        },
        '0-6': {
            dates: [10,14,10,23],
            ar: 'بداية موسم الوسم (16 أكتوبر). سبق الوسم — سحب من الشمال تبشر بالمطر. ظهور الفقع والأعشاب البرية. بداية ضراب الإبل. وصول الحبارى.',
            en: 'Wasm rain season begins (Oct 16). Precursor clouds from north. Truffles and wild herbs sprout. Camel breeding starts. Houbara bustards arrive.'
        },
        '0-7': {
            dates: [10,24,11,2],
            ar: 'أفضل موسم لنمو النبات. ظهور الفقع والعرايين. تكريب النخل وتقليم الزيتون والحمضيات. زراعة البقوليات والحبوب والبطاطس.',
            en: 'Best season for plant growth. Truffles appear. Palm pruning, olive and citrus trimming. Legumes, grains, potatoes planted.'
        },
        '0-8': {
            dates: [11,3,11,12],
            ar: 'ضربة الأحيمر — رياح قوية غير منتظمة. هياج البحر. تكاثر الأسماك (الحبل). هجرة البلابل والصقور.',
            en: 'Ahimar Storm — irregular strong winds. Rough seas. Fish spawning season (Habl). Bulbuls and falcons migrate.'
        },
        '0-9': {
            dates: [11,13,11,22],
            ar: 'آخر أيام الصفري. استمرار الوسم. بدء موسم القنص (الصيد بالصقور). الحمضيات تنضج.',
            en: 'Last days of Safari. Wasm continues. Falconry season begins. Citrus fruits ripen.'
        },
        // ════ المائة الثانية — الشتاء (23 نوفمبر – 2 مارس) ════
        '1-0': {
            dates: [11,23,12,2],
            ar: 'بداية الشتاء (تيرماه). سحب من الشمال. طول الليل. أفضل نمو للنباتات. أسماك: المرجان، الصافي، البياح. نضج الحمضيات (البرتقال، الماندرين). زراعة الورقيات.',
            en: 'Winter begins (Tirmah). Northern clouds. Nights lengthen. Best plant growth. Fish: Murjan, Safi, Bayah. Citrus ripens. Leafy greens planted.'
        },
        '1-1': {
            dates: [12,3,12,12],
            ar: 'تظهر علامات الشتاء. اشتداد البرد. احتمال أمطار. هياج الخليج بفعل رياح الشمال. حماية خلايا النحل من البرد.',
            en: 'Winter signs appear. Cold intensifies. Rain likely. Gulf rough from north winds. Protect beehives from cold.'
        },
        '1-2': {
            dates: [12,13,12,22],
            ar: 'بداية مربعانية الشتاء (7 ديسمبر). الانقلاب الشتوي — أقصر نهار. ظهور الكمأة والطرثوث والحماض. نهاية فترة ضربة الأحيمر.',
            en: 'Winter Marbʿaniyya begins (Dec 7). Winter solstice — shortest day. Truffles, Tartouth, Hamadh appear. Ahimar storm period ends.'
        },
        '1-3': {
            dates: [12,23,1,1],
            ar: 'بداية أربعين المريعي — أبرد 40 يوماً. رياح شمالية. سكون النبات الشتوي. لا زراعة. حماية المحاصيل. بدء طول النهار.',
            en: '40 coldest days begin (Mriʿi). North winds. Plant dormancy. No planting. Protect crops. Days start lengthening.'
        },
        '1-4': {
            dates: [1,2,1,11],
            ar: 'استمرار المربعانية وأربعين المريعي. أمطار البلي (أمطار المنخفضات الجوية). تزهير الحمضيات. بواكير طلع النخل.',
            en: 'Marbʿaniyya and Mriʿi continue. Bali rains (depression rains). Citrus blooms. Early palm pollen appears.'
        },
        '1-5': {
            dates: [1,12,1,21],
            ar: 'برد البطين/الشبط — ذروة البرد والجفاف. ضربة الستين — أقوى رياح شمالية. \"برد الستين مثل السكين\". رياح النعشي والياهي. وفرة العومة (السردين).',
            en: 'Batein/Shabat cold — peak cold and dryness. Der 60 strike — strongest north winds. "Der 60 cold cuts like a knife." Sardines abundant.'
        },
        '1-6': {
            dates: [1,22,1,31],
            ar: 'دفوة الطلع — فترة دفء نسبي. ظهور طلع النخل. أفضل وقت لتقليم الورد والحمضيات والتوت.',
            en: 'Warmth of pollen (Dafwat al-Talʿ). Palm pollen appears. Best time to prune roses, citrus, mulberry.'
        },
        '1-7': {
            dates: [2,1,2,10],
            ar: 'بداية أربعين العقربي — أمطار غزيرة متوقعة. ضربة الثمانين. أيام بذرة الست (8-13 فبراير) — أفضل 6 أيام لزراعة كل الأشجار.',
            en: 'Aqrabi Forty begins — heavy rains expected. Der 80 strike. Six Seed Days (Feb 8-13) — best 6 days to plant all trees.'
        },
        '1-8': {
            dates: [2,11,2,20],
            ar: 'موسم العقارب — البرد ينكسر تدريجياً. جريان النسغ في الأشجار. أمطار البلي مستمرة. هجرة الكرك والوز شمالاً. ظهور الفلامنجو.',
            en: 'Scorpion season — cold gradually breaks. Sap flows in trees. Bali rains continue. Cranes, geese migrate north. Flamingos appear.'
        },
        '1-9': {
            dates: [2,21,3,2],
            ar: 'برد العجوز — آخر 8 أيام باردة (25 فبراير - 4 مارس). رياح النعايات — تودع الشتاء. بدء الزراعة الربيعية. تنبيت النخيل (التلقيح). تزهير السنط.',
            en: 'Old Woman\'s Cold — last 8 cold days (Feb 25-Mar 4). Farewell winds. Spring planting begins. Palm pollination starts. Acacia blooms.'
        },
        // ════ المائة الثالثة — الصيف (3 مارس – 10 يونيو) ════
        '2-0': {
            dates: [3,3,3,12],
            ar: 'نهاية أربعين العقربي. آخر رياح النعايات الباردة. ظهور الفلامنجو والنحام الكبير. تلقيح النخيل حسب الصنف.',
            en: 'Aqrabi Forty ends. Last cold winds. Flamingos and greater flamingos appear. Palm pollination by variety.'
        },
        '2-1': {
            dates: [3,13,3,22],
            ar: 'أيام الحسوم — تقلبات جوية. الاعتدال الربيعي. بداية السرايات. تكاثر القروش والهامور والكنعد. تقليم العنب والتين. آخر ضراب للإبل.',
            en: 'Husum days — changeable weather. Vernal equinox. Spring storms begin. Sharks, grouper, kingfish breed. Grape/fig pruning. Last camel breeding.'
        },
        '2-2': {
            dates: [3,23,4,1],
            ar: 'السرايات/المراويح — عواصف رعدية ربيعية. الحميمين — ارتفاع الحرارة وعواصف ترابية (الطوز). هياج البحر.',
            en: 'Spring storms/Marawih — thunderstorms. Humaimeen — heat rises with dust storms (Tawz). Rough seas.'
        },
        '2-3': {
            dates: [4,2,4,11],
            ar: 'استمرار السرايات والحميمين. تقليم أشجار السدر. وفرة القباقيب والنغر.',
            en: 'Spring storms and Humaimeen continue. Sidr tree pruning. Gabagib (crabs) and Naghr abundant.'
        },
        '2-4': {
            dates: [4,12,4,21],
            ar: 'يوالت الثريا — اضطرابات قبل غياب الثريا. الذراعين (16 أبريل - 11 مايو) — فترة انتقالية.',
            en: 'Pre-Pleiades disturbances. Dhira\'ain (Apr 16-May 11) — transitional period between spring and heat.'
        },
        '2-5': {
            dates: [4,22,5,1],
            ar: 'نهاية السرايات. بداية كنة الثريا (28 أبريل) — 40 يوم اختفاء. حصاد القمح والحبوب. بداية زراعة الصيف (بطيخ، شمام، كوسا).',
            en: 'Spring storms end. Pleiades concealment begins (Apr 28) — 40 days hidden. Wheat/grain harvest. Summer planting begins.'
        },
        '2-6': {
            dates: [5,2,5,11],
            ar: 'استمرار كنة الثريا. نقل خلايا النحل لمراعي السمر. التمر في مرحلة الحبابو (بحجم الحمص).',
            en: 'Pleiades hidden. Beehives moved to Samr trees. Dates at Hababu stage (chickpea-sized).'
        },
        '2-7': {
            dates: [5,12,5,21],
            ar: 'بداية البوارح — رياح شمالية غربية جافة. حصاد محاصيل الخريف. التمر يأخذ حجمه النهائي ويبدأ بالتلون.',
            en: 'Bawarih begin — dry NW winds. Autumn crop harvest ends. Dates take final size and begin coloring.'
        },
        '2-8': {
            dates: [5,22,5,31],
            ar: 'بارح البطين — أول البوارح. لا زراعة ولا نقل شتلات. بشارة الرطب (أول إعلان عن نضج التمر) في ليوا والعين.',
            en: 'Batein Barih — first dry winds. No planting or transplanting. First ripe date announcement in Liwa and Al Ain.'
        },
        '2-9': {
            dates: [6,1,6,10],
            ar: 'نهاية كنة الثريا — الثريا تعود للظهور (7 يونيو). بارح الثريا — البارح الكبير، أنشط البوارح. نضج النغال. بداية القيظ.',
            en: 'Pleiades reappear (Jun 7). Thuraya Barih — Great Barih, strongest dry winds. Naghal dates ripen. Summer heat begins.'
        },
        // ════ المائة الرابعة — القيظ (11 يونيو – 14 أغسطس) ════
        '3-0': {
            dates: [6,11,6,20],
            ar: 'بداية القيظ الشديد. بارح الثريا/الدبران — رياح جافة. نضج فواكه الصيف (مانجو، ليمون، بطيخ). لا زراعة مطلقاً.',
            en: 'Extreme heat begins. Thuraya/Dabaran dry winds. Summer fruits ripen (mango, lemon, watermelon). No planting at all.'
        },
        '3-1': {
            dates: [6,21,6,30],
            ar: 'الانقلاب الصيفي — أطول نهار. بارح الدبران — عواصف ترابية. ذروة إنتاج التمور في الدولة. زيادة الري.',
            en: 'Summer solstice — longest day. Dabaran Barih — dust storms. Peak date production nationwide. Increase watering.'
        },
        '3-2': {
            dates: [7,1,7,10],
            ar: 'بارح الجوزاء. رياح السموم — أشد الرياح حراً (45-50°م). أسماك: الجش، القباب، السولي.',
            en: 'Jawza Barih. Simoom winds — hottest winds (45-50°C). Fish: Jesh, Gubab, Suli.'
        },
        '3-3': {
            dates: [7,11,7,20],
            ar: 'استمرار السموم. ذروة جمرة القيظ. بارح الجوزاء يشتد.',
            en: 'Simoom continues. Peak heat ember (Jamrat al-Qaiz). Jawza Barih intensifies.'
        },
        '3-4': {
            dates: [7,21,7,30],
            ar: 'نضج التين والرمان والعنب. تجفيف التمور في المساطيح. آخر الدشة (موسم الغوص).',
            en: 'Figs, pomegranates, grapes ripen. Dates dried on platforms. Last of pearl diving season.'
        },
        '3-5': {
            dates: [7,31,8,9],
            ar: 'طالع المرزم — جمرة القيظ في ذروتها. الروايح (سحب ركامية صيفية). أسماك: السولي، الشنينوه. بدء هجرة الطيور المبكرة جنوباً.',
            en: 'Mirzam rising — peak heat ember. Summer cumulus clouds (Rawayih). Fish: Suli, Shninoh. Early bird migration south begins.'
        },
        '3-6': {
            dates: [8,10,8,14],
            ar: 'در المساريق — تتوغل الرطوبة العالية، وتكون الأجواء مجهدة من ارتفاع الرطوبة مع الحرارة العالية، ويبرد باطن الأرض.',
            en: 'Dur Al-Masariq — Deep humidity penetrates, exhausting weather from humidity combined with high heat, and the earth\'s interior begins to cool.'
        },
    };

    // ─── المواسم الخاصة — فترات مناخية معروفة في الجزيرة العربية ───────
    const SPECIAL_SEASONS = [
        { ar: 'موسم الوسم', en: 'Wasm (Rain Season)', from: [10,16], to: [12,6], desc_ar: 'أفضل موسم مطر — رطوبة عالية وتبخر قليل، ينبت الفقع والأعشاب', desc_en: 'Best rain season — high residual moisture, truffles and herbs sprout', icon: '🌧️' },
        { ar: 'مربعانية الشتاء', en: 'Winter Forty', from: [12,7], to: [1,14], desc_ar: '40 يوماً من البرد الشديد والأمطار', desc_en: '40 days of intense cold and rain', icon: '❄️' },
        { ar: 'أربعون المريعي', en: 'Coldest Forty', from: [12,23], to: [1,31], desc_ar: 'أبرد 40 يوماً في السنة — سكون النبات', desc_en: 'Coldest 40 days of the year — plant dormancy', icon: '🥶' },
        { ar: 'برد البطين (الشبط)', en: 'Batein Cold', from: [1,15], to: [2,9], desc_ar: 'ذروة البرد والجفاف — ازيرق الأطراف', desc_en: 'Peak cold and dryness', icon: '🧊' },
        { ar: 'أربعون العقربي', en: 'Scorpion Forty', from: [2,1], to: [3,12], desc_ar: '40 يوماً من الأمطار الغزيرة المتوقعة', desc_en: '40 days of expected heavy rains', icon: '🌊' },
        { ar: 'برد العجوز', en: 'Old Woman\'s Cold', from: [2,25], to: [3,4], desc_ar: 'آخر 8 أيام باردة في الشتاء', desc_en: 'Last 8 cold days of winter', icon: '👵' },
        { ar: 'أيام بذرة الست', en: 'Six Seed Days', from: [2,8], to: [2,13], desc_ar: 'أفضل 6 أيام لزراعة جميع الأشجار والمحاصيل', desc_en: 'Best 6 days for planting all trees and crops', icon: '🌱' },
        { ar: 'الحميمين', en: 'Humaimeen Heat', from: [3,21], to: [4,15], desc_ar: 'ارتفاع الحرارة وعواصف ترابية ربيعية', desc_en: 'Heat rises with spring dust storms', icon: '🌪️' },
        { ar: 'السرايات (المراويح)', en: 'Spring Storms', from: [3,20], to: [4,28], desc_ar: 'عواصف رعدية ربيعية عنيفة', desc_en: 'Violent spring thunderstorms', icon: '⛈️' },
        { ar: 'كنة الثريا', en: 'Pleiades Concealment', from: [4,28], to: [6,6], desc_ar: '40 يوم اختفاء نجم الثريا خلف الشمس', desc_en: '40 days Pleiades hidden behind the sun', icon: '✨' },
        { ar: 'البوارح', en: 'Dry NW Winds', from: [5,12], to: [7,28], desc_ar: 'رياح شمالية غربية جافة — لا أمطار ولا سحب', desc_en: 'Dry NW winds — no rain, no clouds', icon: '💨' },
        { ar: 'جمرة القيظ', en: 'Summer Heat Ember', from: [7,3], to: [8,23], desc_ar: 'أشد فترات الحرارة — السموم تتجاوز 50 درجة', desc_en: 'Most extreme heat period — Simoom exceeds 50°C', icon: '🔥' },
        { ar: 'موسم الكليبين', en: 'Klibin Season', from: [8,11], to: [8,23], desc_ar: 'كتفا الجوزاء — شدة الإجهاد والتعب من الحرارة والرطوبة', desc_en: 'Shoulders of Gemini — extreme heat exhaustion with humidity', icon: '🌡️' },
        { ar: 'مرخيات القلايد', en: 'Loosened Girths', from: [8,11], to: [9,5], desc_ar: 'ارتخاء أحزمة الإبل من شدة الحر أو ثقل عراجين التمر', desc_en: 'Camel girths loosen from heat or heavy date clusters', icon: '🐪' },
        { ar: 'دفوة الطلع', en: 'Pollen Warmth', from: [1,22], to: [1,31], desc_ar: 'فترة دفء نسبي — ظهور طلع النخل الذكر', desc_en: 'Warm spell — male palm pollen appears', icon: '🌴' },
        { ar: 'موسم القنص', en: 'Falconry Season', from: [11,1], to: [2,28], desc_ar: 'موسم الصيد بالصقور — صيد الحبارى والقطا', desc_en: 'Falconry season — hunting Houbara and sandgrouse', icon: '🦅' },
        { ar: 'موسم غلق البحر', en: 'Sea Closure', from: [6,20], to: [9,15], desc_ar: 'منع الإبحار في المحيط الهندي بسبب عواصف الرياح الموسمية', desc_en: 'No sailing in Indian Ocean due to monsoon storms', icon: '⛵' },
        { ar: 'أمطار البلي', en: 'Bali Rains', from: [1,2], to: [3,2], desc_ar: 'أمطار المنخفضات الجوية الشتوية', desc_en: 'Winter depression rains', icon: '🌦️' },
    ];

    // ─── الأحداث الفلكية السنوية ───────────────────────────────────
    const ASTRO_EVENTS = [
        { ar: 'طلوع سهيل', en: 'Canopus Rising', date: [8,15], desc_ar: 'ثاني ألمع نجوم السماء — يعلن انكسار الحرارة وبداية السنة السهيلية', desc_en: 'Second brightest star — marks heat break and start of Suhaili year', icon: '⭐' },
        { ar: 'غروب سهيل (كنة سهيل)', en: 'Canopus Setting', date: [5,15], desc_ar: 'اختفاء سهيل خلف الشمس حتى منتصف أغسطس', desc_en: 'Canopus disappears behind the sun until mid-August', icon: '🌅' },
        { ar: 'طلوع الثريا', en: 'Pleiades Rising', date: [6,7], desc_ar: 'عودة الثريا للظهور بعد 40 يوم اختفاء — بداية موسم القيظ', desc_en: 'Pleiades reappear after 40-day concealment — summer begins', icon: '✨' },
        { ar: 'غروب الثريا (كنة الثريا)', en: 'Pleiades Setting', date: [4,28], desc_ar: 'اختفاء الثريا خلف الشمس لمدة 40 يوماً', desc_en: 'Pleiades disappear behind the sun for 40 days', icon: '🌙' },
        { ar: 'غياب الأحيمر (قلب العقرب)', en: 'Antares Disappearance', date: [11,11], desc_ar: 'اختفاء النجم الأحمر لـ 40 يوماً — مصحوب بعواصف بحرية', desc_en: 'Red star disappears for 40 days — accompanied by sea storms', icon: '🔴' },
        { ar: 'عودة الأحيمر', en: 'Antares Return', date: [12,20], desc_ar: 'عودة قلب العقرب للظهور فجراً', desc_en: 'Antares reappears at dawn', icon: '🔴' },
        { ar: 'الاعتدال الربيعي', en: 'Vernal Equinox', date: [3,20], desc_ar: 'تعامد الشمس على خط الاستواء — تساوي الليل والنهار', desc_en: 'Sun crosses equator northward — equal day and night', icon: '🌍' },
        { ar: 'الانقلاب الصيفي', en: 'Summer Solstice', date: [6,21], desc_ar: 'أطول نهار في السنة — الشمس على مدار السرطان', desc_en: 'Longest day — sun on Tropic of Cancer', icon: '☀️' },
        { ar: 'الاعتدال الخريفي', en: 'Autumnal Equinox', date: [9,22], desc_ar: 'تعامد الشمس على خط الاستواء — تساوي الليل والنهار', desc_en: 'Sun crosses equator southward — equal day and night', icon: '🍂' },
        { ar: 'الانقلاب الشتوي', en: 'Winter Solstice', date: [12,21], desc_ar: 'أقصر نهار في السنة — الشمس على مدار الجدي', desc_en: 'Shortest day — sun on Tropic of Capricorn', icon: '🌑' },
        { ar: 'زخات البرشاويات (شهب)', en: 'Perseids Meteor Shower', date: [8,12], desc_ar: 'أشهر زخة شهب — حوالي 100 شهاب/ساعة', desc_en: 'Famous meteor shower — ~100 meteors/hour', icon: '☄️' },
        { ar: 'زخات التوأميات (شهب)', en: 'Geminids Meteor Shower', date: [12,14], desc_ar: 'أغزر زخة شهب — حوالي 120 شهاب/ساعة', desc_en: 'Most abundant meteor shower — ~120 meteors/hour', icon: '☄️' },
    ];

    // ─── أمثال شعبية مرتبطة بالنجوم والمواسم ───────────────────────
    const FOLK_PROVERBS = [
        // أمثال سهيل
        { trigger: 'suhail', ar: 'إذا طلع سهيل، طاب الليل، وامتنع القيل، والم الفصيلَ الويل، ورفع الكيل', en: 'When Canopus rises, night becomes pleasant, siesta ends, young camels are weaned' },
        { trigger: 'suhail', ar: 'لا طلع سهيل، لا تأمن السيل', en: 'When Canopus rises, beware of floods' },
        { trigger: 'suhail', ar: 'إذا طلع سهيل، تلمّس التمر بالليل', en: 'When Canopus rises, feel for ripe dates at night' },
        { trigger: 'suhail', ar: 'أسعد من سهيل طلعته', en: 'Luckiest is the rising of Canopus' },
        // أمثال الطوالع
        { trigger: 'jabha', ar: 'لولا الجبهة ما كان للعرب إبل', en: 'Without Jabha\'s rain, Arabs would have no camels' },
        { trigger: 'jabha', ar: 'إذا طلعت الجبهة، انكسر الحر وامتد الظمأ', en: 'When Jabha rises, heat breaks and thirst extends' },
        { trigger: 'zubra', ar: 'إذا طلعت الزبرة طاب الزمان، وجني البسر في كل مكان', en: 'When Zubra rises, times are good, dates harvested everywhere' },
        { trigger: 'sarfa', ar: 'إذا طلعت الصرفة، احتال كل ذي حرفة', en: 'When Sarfa rises, every craftsman prepares' },
        { trigger: 'awa', ar: 'إذا طلع العواء، ضُرب الخباء، وطاب الهواء وكُره العراء', en: 'When Awa rises, tents are pitched and air improves' },
        { trigger: 'simak', ar: 'إذا طلع السماك، ذهبت العكاك، وقلّ على الماء اللكاك', en: 'When Simak rises, heat is gone, no crowding at water' },
        { trigger: 'zabana', ar: 'إذا طلعت الزبانا، أحدثت لكل ذي عيال شأنا', en: 'When Zabana rises, every family has concerns (cold coming)' },
        { trigger: 'iklil', ar: 'إذا طلع الإكليل هاجت الفحول، وشُمّرت الذيول، وتُخوّفت السيول', en: 'When Iklil rises, bull camels rut, garments hitched up, floods feared' },
        { trigger: 'naayem', ar: 'إذا طلعت النعائم ابيضّت البهائم من الصقيع الدائم', en: 'When Naaim rises, animals whiten from permanent frost' },
        { trigger: 'balda', ar: 'إذا طلعت البلدة أولها محرق وآخرها مورق', en: 'When Balda rises, its start burns with cold, its end brings green' },
        { trigger: 'saad_dhabih', ar: 'إذا طلع سعد الذابح، حمى أهله النابح، ونفع أهله الرائح', en: 'When Saad al-Dhabih rises, dogs guard loyally, shepherds benefit from going out' },
        { trigger: 'saad_bula', ar: 'إذا طلع سعد بلع، اقتحم الربع، وصار في الأرض لمع', en: 'When Saad Bula rises, young camels grow strong, greenery appears' },
        { trigger: 'mirzam', ar: 'إذا طلع المرزم مُلئ المحزم', en: 'When Mirzam rises, belts are full (dates abundant)' },
        { trigger: 'dhiraa', ar: 'إذا طلعت الذراع، ترقرق السراب بكل قاع', en: 'When Dhiraa rises, mirages shimmer in every valley' },
        { trigger: 'tarfa', ar: 'إذا طلعت الطرفة، بكّرت الخُرفة، وكثُرت الطُرفة', en: 'When Tarfa rises, harvest hastens and gifts abound' },
        { trigger: 'nathra', ar: 'إذا طلعت النثرة، قنأت البسرة وجُني النخل بكرة', en: 'When Nathra rises, dates darken and palms are harvested early' },
        // أمثال قران الثريا
        { trigger: 'qiran', ar: 'قران حادي، برد بادي', en: '1st conjunction: cold is apparent' },
        { trigger: 'qiran', ar: 'قران تاسع، برد لاسع', en: '9th conjunction: biting cold' },
        { trigger: 'qiran', ar: 'قران سابع، مجيع وشابع', en: '7th conjunction: hungry and full (pasture varies)' },
        { trigger: 'qiran', ar: 'قران خامس، ربيع طامس', en: '5th conjunction: spring overflowing' },
        { trigger: 'qiran', ar: 'قران ثالث، ربيع ذالف', en: '3rd conjunction: spring departing' },
        // أمثال الدرور
        { trigger: 'durr_60_winter', ar: 'برد الستين مثل السكين', en: 'Der 60 winter cold cuts like a knife' },
        { trigger: 'aqrabi', ar: 'العقربي تسقي بر وبحر', en: 'Aqrabi rains water land and sea' },
        { trigger: 'klibin', ar: 'الكليبين مد ومدين', en: 'Klibin: abundance upon abundance' },
    ];

    // ─── اقتران الثريا مع القمر — 14 قران سنوي ───────────────────────
    const THURAYA_CONJUNCTIONS = [
        { night: 27, ar: 'طالع الثريا', en: 'Thuraya', from: [6,7], to: [6,19], nickname_ar: 'قران أول القيظ', nickname_en: 'First summer conjunction', desc_ar: 'مع طلوع الثريا يبدأ القيظ ويشتد الحر', desc_en: 'With Pleiades rising, summer begins and heat intensifies' },
        { night: 25, ar: 'طالع الهقعة', en: 'Haq\'a', from: [7,3], to: [7,15], nickname_ar: 'قران وسط القيظ', nickname_en: 'Mid-summer conjunction', desc_ar: 'القيظ وذروة الحر', desc_en: 'Peak summer heat' },
        { night: 23, ar: 'طالع الذراع/المرزم', en: 'Dhiraa/Mirzam', from: [7,29], to: [8,10], nickname_ar: 'قران آخر القيظ', nickname_en: 'Last summer conjunction', desc_ar: 'القيظ وذروة الحر', desc_en: 'Peak summer heat' },
        { night: 21, ar: 'طالع الجبهة', en: 'Jabha', from: [9,6], to: [9,19], nickname_ar: 'قران أول الصفري', nickname_en: 'First Safri conjunction', desc_ar: 'ارتفاع نسبة الرطوبة ودرجات الحرارة', desc_en: 'Humidity and temperature rise' },
        { night: 19, ar: 'طالع الصرفة', en: 'Sarfa', from: [10,3], to: [10,15], nickname_ar: 'قران آخر الصفري', nickname_en: 'Last Safri conjunction', desc_ar: 'مع تغيّر الجو وانصراف الحر', desc_en: 'Weather changes, heat departs' },
        { night: 17, ar: 'طالع السماك', en: 'Simak', from: [10,29], to: [11,10], nickname_ar: 'قران أول الوسم', nickname_en: 'First Wasm conjunction', desc_ar: 'أفضل أوقات المطر — أمطاره تسم الأرض بالعشب', desc_en: 'Best rain time — rain marks earth with green' },
        { night: 15, ar: 'طالع الغفر', en: 'Ghafr', from: [11,11], to: [11,23], nickname_ar: 'قران آخر الوسم', nickname_en: 'Last Wasm conjunction', desc_ar: 'أفضل أوقات المطر — أمطاره تسم الأرض بالعشب', desc_en: 'Best rain time — rain marks earth with green' },
        { night: 13, ar: 'طالع الإكليل', en: 'Iklil', from: [12,7], to: [12,19], nickname_ar: 'قران أول المربعانية (أجرد)', nickname_en: 'First Marbʿaniyya conjunction', desc_ar: 'دخول البرد الحقيقي', desc_en: 'True cold begins' },
        { night: 11, ar: 'طالع القلب', en: 'Qalb', from: [12,20], to: [1,1], nickname_ar: 'قران حادي — آخر المربعانية', nickname_en: 'Hadi conjunction — End of Marbʿaniyya', desc_ar: 'بدء استشعار البرد — قران حادي، برد بادي', desc_en: 'Cold becomes apparent' },
        { night: 9, ar: 'طالع النعائم', en: 'Naaim', from: [1,15], to: [1,27], nickname_ar: 'قران تاسع', nickname_en: 'Ninth conjunction', desc_ar: 'يشتد فيه البرد — قران تاسع، برد لاسع', desc_en: 'Cold intensifies — biting cold' },
        { night: 7, ar: 'طالع سعد الذابح', en: 'Saad Dhabih', from: [2,10], to: [2,22], nickname_ar: 'قران سابع', nickname_en: 'Seventh conjunction', desc_ar: 'تعود خصوبة المرعى — مجيع وشابع', desc_en: 'Pasture fertility returns — hungry and full' },
        { night: 5, ar: 'طالع سعد السعود', en: 'Saad Suud', from: [3,8], to: [3,20], nickname_ar: 'قران خامس', nickname_en: 'Fifth conjunction', desc_ar: 'الأرض في أوج اخضرارها — ربيع طامس', desc_en: 'Earth at peak green — spring overflowing' },
        { night: 3, ar: 'طالع المقدم', en: 'Muqaddam', from: [4,3], to: [4,15], nickname_ar: 'قران ثالث', nickname_en: 'Third conjunction', desc_ar: 'مع نهاية الربيع — ربيع ذالف', desc_en: 'Spring ending — spring departing' },
        { night: 1, ar: 'طالع الرشا', en: 'Risha', from: [4,29], to: [5,11], nickname_ar: 'قران حادي', nickname_en: 'Hadi conjunction', desc_ar: 'على الماء ترادي — كناية عن كثرة طلب الماء من شدة الحر', desc_en: 'Much water seeking — metaphor for intense heat thirst' },
    ];

    // ─── المعدلات المناخية لكل برج (أبوظبي) ───────────────────────
    const CLIMATE_DATA = [
        { zodiac: 0, maxTemp: 43.5, minTemp: 31.3, humidity: 46, rain: 0, maxWind: 46 },    // الأسد
        { zodiac: 1, maxTemp: 42.1, minTemp: 24.8, humidity: 43, rain: 0, maxWind: 43 },    // السنبلة
        { zodiac: 2, maxTemp: 37.9, minTemp: 25.6, humidity: 65, rain: 0, maxWind: 39 },    // الميزان
        { zodiac: 3, maxTemp: 33.0, minTemp: 21.7, humidity: 49, rain: 2.7, maxWind: 65 },  // العقرب
        { zodiac: 4, maxTemp: 28.5, minTemp: 17.5, humidity: 55, rain: 5.0, maxWind: 55 },  // القوس
        { zodiac: 5, maxTemp: 24.7, minTemp: 14.4, humidity: 57, rain: 8.5, maxWind: 46 },  // الجدي
        { zodiac: 6, maxTemp: 25.6, minTemp: 14.6, humidity: 63, rain: 2.5, maxWind: 81 },  // الدلو
        { zodiac: 7, maxTemp: 26.5, minTemp: 15.8, humidity: 60, rain: 14.0, maxWind: 50 }, // الحوت
        { zodiac: 8, maxTemp: 33.5, minTemp: 20.9, humidity: 51, rain: 9.7, maxWind: 67 },  // الحمل
        { zodiac: 9, maxTemp: 39.0, minTemp: 26.0, humidity: 45, rain: 1.0, maxWind: 50 },  // الثور
        { zodiac: 10, maxTemp: 42.0, minTemp: 29.5, humidity: 55, rain: 0, maxWind: 45 },   // الجوزاء
        { zodiac: 11, maxTemp: 43.0, minTemp: 30.5, humidity: 50, rain: 0, maxWind: 48 },   // السرطان
    ];

    // ─── تقويم هجرة الطيور ───────────────────────────────────────
    const BIRD_MIGRATION = [
        { ar: 'الدخل والخواضير', en: 'Warblers & Wagtails', from: [8,15], to: [9,30], direction: 'south', desc_ar: 'أولى الطيور المهاجرة جنوباً عبر سماء الإمارات', desc_en: 'First birds migrating south through UAE skies' },
        { ar: 'السمان والقميري', en: 'Quail & Turtle Dove', from: [9,4], to: [9,30], direction: 'south', desc_ar: 'طيور سمينة تعبر في طوالع الصفري', desc_en: 'Plump birds crossing during Safri mansions' },
        { ar: 'الحبارى والكروان', en: 'Houbara Bustard & Curlew', from: [10,1], to: [11,30], direction: 'south', desc_ar: 'طيور الصيد المفضلة — وصول موسم القنص', desc_en: 'Prized hunting birds — falconry season arrives' },
        { ar: 'الشواهين والصقور', en: 'Shaheen & Falcons', from: [10,4], to: [11,15], direction: 'south', desc_ar: 'وصول طيور الصيد الجارحة', desc_en: 'Birds of prey arrive' },
        { ar: 'القطا والوز والكرك', en: 'Sandgrouse, Geese & Cranes', from: [12,1], to: [1,31], direction: 'south', desc_ar: 'طيور الشتاء الكبيرة', desc_en: 'Large winter birds' },
        { ar: 'الفلامنجو (النحام)', en: 'Flamingos', from: [2,11], to: [4,30], direction: 'resident', desc_ar: 'يظهر على السواحل والخيران في أواخر الشتاء', desc_en: 'Appears on coasts and creeks in late winter' },
        { ar: 'الكرك والوز والسمان', en: 'Cranes, Geese & Quail', from: [2,1], to: [3,31], direction: 'north', desc_ar: 'عودة الطيور المهاجرة شمالاً', desc_en: 'Migratory birds returning north' },
        { ar: 'الدخل والقميري', en: 'Warblers & Doves', from: [3,15], to: [5,15], direction: 'north', desc_ar: 'آخر الطيور المهاجرة عائدة شمالاً', desc_en: 'Last migratory birds heading north' },
    ];

    // ─── قاموس المصطلحات التراثية ─────────────────────────────────
    const HERITAGE_GLOSSARY = {
        ar: {
            'الدر': 'فترة 10 أيام في حساب الدرور الفلكي',
            'سهيل': 'نجم كانوبوس — ثاني ألمع نجوم السماء',
            'منازل القمر': 'الأماكن الـ 28 التي ينزل فيها القمر',
            'الطالع': 'المنزلة القمرية المرئية عند الفجر',
            'الوسم': 'موسم المطر الأفضل (أكتوبر-ديسمبر)',
            'المربعانية': '40 يوم برد شديد في الشتاء',
            'البوارح': 'رياح شمالية غربية جافة صيفية',
            'السموم': 'رياح حارة جافة تتجاوز 50 درجة',
            'الكوس': 'رياح موسمية رطبة من بحر العرب',
            'الدشة': 'موسم الغوص عن اللؤلؤ',
            'القفال': 'نهاية موسم الغوص وعودة البحارة',
            'جمرة القيظ': 'أشد فترات الحرارة (يوليو-أغسطس)',
            'كنة الثريا': '40 يوم اختفاء الثريا خلف الشمس',
            'كنة سهيل': 'فترة اختفاء سهيل (مايو-أغسطس)',
            'الفقع': 'الكمأة — فطر صحراوي ينبت بعد الأمطار',
            'المساريق': 'در مستقل (5 أيام) — تتوغل الرطوبة العالية ويبرد باطن الأرض',
            'تنبيت النخيل': 'تلقيح النخل',
            'التبسيل': 'طبخ وتجفيف البسر (التمر غير الناضج)',
            'المسطاح': 'أرضية تجفيف التمور',
            'السكار': 'مصائد أسماك تقليدية',
            'الحبل': 'موسم تكاثر الأسماك واقترابها من الشاطئ',
            'تيرماه': 'اسم البحارة لبداية الشتاء',
            'النيروز العربي': 'رأس السنة العربية القديمة مع طالع الإكليل',
            'برد العجوز': 'آخر 8 أيام باردة من الشتاء',
            'بذرة الست': 'أفضل 6 أيام للزراعة (8-13 فبراير)',
            'دفوة الطلع': 'فترة دفء تحفز ظهور طلع النخل',
            'وغرات القيظ': 'موجات حر مسماة بأسماء نجوم',
            'السايورة': 'تيار شاحب بحري خطير في الصيف',
        },
        en: {
            'Durr': '10-day period in the Durur astronomical calendar',
            'Suhail': 'Canopus star — second brightest in the sky',
            'Lunar Mansions': 'The 28 stations where the Moon resides',
            'Tala\'a': 'The lunar mansion visible at dawn',
            'Wasm': 'Best rain season (October-December)',
            'Marbʿaniyya': '40 days of intense winter cold',
            'Bawarih': 'Dry summer NW winds',
            'Simoom': 'Hot dry winds exceeding 50°C',
            'Kaws': 'Monsoon winds from Arabian Sea',
            'Dasha': 'Pearl diving season departure',
            'Qafal': 'End of pearl diving, sailors return',
            'Jamrat al-Qaiz': 'Most extreme heat period (Jul-Aug)',
            'Kunnat al-Thuraya': '40-day Pleiades concealment',
            'Kunnat Suhail': 'Canopus concealment (May-Aug)',
            'Faq\'a': 'Desert truffle — grows after rains',
            'Masariq': '5 adjustment days to complete solar year',
            'Tanbit': 'Palm pollination',
            'Tabseel': 'Cooking and drying unripe dates',
            'Mastah': 'Date drying floor',
            'Sikkar': 'Traditional fish traps',
            'Habl': 'Fish spawning season — fish approach shore',
            'Tirmah': 'Sailor\'s name for winter start',
            'Arab Nairuz': 'Ancient Arab New Year with Iklil rising',
            'Cold of Ajuz': 'Last 8 cold days of winter',
            'Six Seed Days': 'Best 6 planting days (Feb 8-13)',
            'Dafwat al-Tal\'a': 'Warm spell triggering palm pollen',
            'Wughrat al-Qaiz': 'Heat waves named after stars',
            'Sabura': 'Dangerous summer rip current',
        }
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
            miaIdx: mia,
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

    // ─── بيانات إثرائية: getters ───
    function getSeasonalWinds(gMonth, gDay) {
        const lang = currentLang;
        return ANWA_ENRICHMENT.seasonalWinds.filter(w => _matchRange(gMonth, gDay, w.from, w.to))
            .map(w => ({ name: lang === 'en' ? w.en : w.ar, from: w.from, to: w.to }));
    }
    function getSeasonalFish(gMonth, gDay) {
        const lang = currentLang;
        return ANWA_ENRICHMENT.fish.map(f => ({
            name: lang === 'en' ? f.en : f.ar,
            inSeason: _matchRange(gMonth, gDay, f.from, f.to),
            from: f.from, to: f.to
        }));
    }
    function getSeasonalCrops(gMonth, gDay) {
        const lang = currentLang;
        return ANWA_ENRICHMENT.crops.map(c => ({
            name: lang === 'en' ? c.en : c.ar,
            inSeason: _matchRange(gMonth, gDay, c.from, c.to),
            from: c.from, to: c.to
        }));
    }
    function getSeasonalWildlife(gMonth, gDay) {
        const lang = currentLang;
        return ANWA_ENRICHMENT.wildlife.map(w => ({
            name: lang === 'en' ? w.en : w.ar,
            inSeason: _matchRange(gMonth, gDay, w.from, w.to),
            from: w.from, to: w.to
        }));
    }

    /** الحصول على تفاصيل الدر الحالي */
    function getDurrDetails(gMonth, gDay, gYear) {
        const d = getDurr(gMonth, gDay, gYear);
        const sDay = _suhailDay(gMonth, gDay, gYear);
        let mia;
        if (sDay <= 100) mia = 0;
        else if (sDay <= 200) mia = 1;
        else if (sDay <= 300) mia = 2;
        else mia = 3;
        const durrIdx = (mia === 3 && sDay > 360) ? 6 : (Math.ceil((sDay - mia * 100) / 10) - 1);
        const key = mia + '-' + Math.min(Math.max(durrIdx, 0), (mia === 3 ? 6 : 9));
        const details = DURR_DETAILS[key];
        return details ? { ...d, desc_ar: details.ar, desc_en: details.en, dates: details.dates } : d;
    }

    /** الحصول على المواسم الخاصة النشطة حالياً */
    function getActiveSeasons(gMonth, gDay) {
        return SPECIAL_SEASONS.filter(s => _matchRange(gMonth, gDay, s.from, s.to));
    }

    /** الحصول على الأحداث الفلكية القريبة (خلال 15 يوم) */
    function getUpcomingAstroEvents(gMonth, gDay) {
        return ASTRO_EVENTS.filter(e => {
            const diff = (e.date[0] - gMonth) * 30 + (e.date[1] - gDay);
            return diff >= -1 && diff <= 15;
        });
    }

    /** الحصول على أمثال مناسبة للموسم الحالي */
    function getSeasonalProverbs(gMonth, gDay, gYear) {
        const tale3 = getTale3(gMonth, gDay);
        const durr = getDurr(gMonth, gDay, gYear);
        const results = [];
        // أمثال الطوالع
        const triggers = [];
        if (tale3) {
            const n = (tale3.nameEn || tale3.en || '').toLowerCase();
            if (n.includes('jabha')) triggers.push('jabha');
            if (n.includes('zubra')) triggers.push('zubra');
            if (n.includes('sarfa')) triggers.push('sarfa');
            if (n.includes('awa')) triggers.push('awa');
            if (n.includes('simak')) triggers.push('simak');
            if (n.includes('zabana')) triggers.push('zabana');
            if (n.includes('iklil')) triggers.push('iklil');
            if (n.includes('naaim') || n.includes('na\'aim')) triggers.push('naayem');
            if (n.includes('balda')) triggers.push('balda');
            if (n.includes('dhabih')) triggers.push('saad_dhabih');
            if (n.includes('bula') || n.includes('bul\'a')) triggers.push('saad_bula');
            if (n.includes('mirzam')) triggers.push('mirzam');
            if (n.includes('dhiraa') || n.includes('dhira')) triggers.push('dhiraa');
            if (n.includes('tarfa')) triggers.push('tarfa');
            if (n.includes('nathra')) triggers.push('nathra');
        }
        // سهيل
        if (_matchRange(gMonth, gDay, [8,10], [9,30])) triggers.push('suhail');
        // أمثال القران
        if (_matchRange(gMonth, gDay, [11,1], [5,15])) triggers.push('qiran');
        FOLK_PROVERBS.forEach(p => {
            if (triggers.includes(p.trigger)) results.push(p);
        });
        return results;
    }

    /** الحصول على اقتران الثريا القادم */
    function getNextThurayaConjunction(gMonth, gDay) {
        const d = gMonth * 100 + gDay;
        for (const c of THURAYA_CONJUNCTIONS) {
            const f = c.from[0] * 100 + c.from[1];
            if (f >= d) return c;
        }
        return THURAYA_CONJUNCTIONS[0]; // wrap around
    }

    /** الحصول على المعدلات المناخية للبرج الحالي */
    function getClimateData(gMonth, gDay) {
        const z = getZodiac(gMonth, gDay);
        if (!z) return null;
        const idx = ZODIAC.findIndex(zz => zz.ar === z.nameAr);
        return idx >= 0 ? CLIMATE_DATA[idx] : null;
    }

    /** الحصول على الطيور المهاجرة حالياً */
    function getActiveBirdMigration(gMonth, gDay) {
        return BIRD_MIGRATION.filter(b => _matchRange(gMonth, gDay, b.from, b.to));
    }

    /** الحصول على مصطلح من القاموس */
    function getGlossaryTerm(term) {
        const lang = currentLang;
        return HERITAGE_GLOSSARY[lang] ? HERITAGE_GLOSSARY[lang][term] : null;
    }

    // ─── الزمن العربي ─────────────────────────────────────────
    /** تحديد اسم الزمن العربي الحالي بناءً على الوقت وأوقات الشروق والغروب */
    function getArabicTimeName(nowDec, sunriseDec, maghribDec) {
        const lang = currentLang;
        const isDay = nowDec >= sunriseDec && nowDec < maghribDec;
        let idx, progress;
        if (isDay) {
            const dayLen = maghribDec - sunriseDec;
            const period = dayLen / 12;
            const elapsed = nowDec - sunriseDec;
            idx = Math.min(Math.floor(elapsed / period), 11);
            progress = (elapsed - idx * period) / period;
            const t = ARAB_DAY_TIMES[idx];
            return { name: t[lang] || t.ar, nameEn: t.en, nameAr: t.ar, descAr: t.descAr, descEn: t.descEn, index: idx, isDay: true, progress };
        } else {
            const nightLen = 24 - (maghribDec - sunriseDec);
            const period = nightLen / 12;
            let elapsed;
            if (nowDec >= maghribDec) {
                elapsed = nowDec - maghribDec;
            } else {
                elapsed = (24 - maghribDec) + nowDec;
            }
            idx = Math.min(Math.floor(elapsed / period), 11);
            progress = (elapsed - idx * period) / period;
            const t = ARAB_NIGHT_TIMES[idx];
            return { name: t[lang] || t.ar, nameEn: t.en, nameAr: t.ar, descAr: t.descAr, descEn: t.descEn, index: idx, isDay: false, progress };
        }
    }

    // ─── أطوار القمر ──────────────────────────────────────────
    const MOON_PHASES = {
        ar: ['محاق', 'هلال أول', 'تربيع أول', 'أحدب متزايد', 'بدر', 'أحدب متناقص', 'تربيع أخير', 'هلال أخير'],
        en: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
    };
    // رموز أصلية بلون القمر الطبيعي (أبيض/رمادي)
    const MOON_SYMBOLS = ['●', '◗', '◑', '◕', '○', '◔', '◐', '◖'];

    // حدود الأطوار الأربعة الرئيسية (كنسبة من الدورة القمرية)
    // محاق=0, تربيع أول=0.25, بدر=0.5, تربيع أخير=0.75
    const MAJOR_PHASE_FRACTIONS = [0, 0.25, 0.5, 0.75];
    const MAJOR_PHASE_INDICES = [0, 2, 4, 6]; // indices in MOON_PHASES

    // أنواع المد والجزر
    const TIDE_TYPES = {
        ar: {
            spring: 'مد عالٍ (مد ربيعي)',
            neap: 'مد منخفض (مد محاقي)',
            rising: 'مد متزايد',
            falling: 'مد متناقص'
        },
        en: {
            spring: 'Spring Tide (High)',
            neap: 'Neap Tide (Low)',
            rising: 'Rising Tide',
            falling: 'Falling Tide'
        }
    };

    // مناطق المد اليومي (مد واحد + جزر واحد في 24 ساعة)
    // تشمل: خليج المكسيك، بحر الصين الجنوبي، بعض سواحل جنوب شرق آسيا
    function _isDiurnalTideRegion(lat, lng) {
        if (!lat && !lng) return false;
        // خليج المكسيك (الساحل الشمالي)
        if (lat >= 25 && lat <= 31 && lng >= -98 && lng <= -82) return true;
        // بحر الصين الجنوبي (فيتنام، تايلاند)
        if (lat >= 5 && lat <= 22 && lng >= 99 && lng <= 110) return true;
        // بعض سواحل أستراليا الشمالية
        if (lat >= -18 && lat <= -10 && lng >= 125 && lng <= 142) return true;
        return false;
    }

    /**
     * حساب طور القمر لتاريخ ميلادي
     * يستخدم خوارزمية Jean Meeus للمحاق ثم يحسب عمر القمر
     * @param {number} gYear - السنة الميلادية
     * @param {number} gMonth - الشهر الميلادي
     * @param {number} gDay - اليوم الميلادي
     * @param {number} [lat] - خط العرض (اختياري)
     * @param {number} [lng] - خط الطول (اختياري)
     * المُخرج: { phase, name, symbol, age, illumination, nextPhase, tide }
     */
    function getMoonPhase(gYear, gMonth, gDay, lat, lng) {
        const jdn = gregorianToJDN(gYear, gMonth, gDay);
        const jde = jdn + 0.5;

        const decYear = gYear + (gMonth - 1) / 12 + (gDay - 1) / 365.25;
        const kApprox = (decYear - 2000.0) * 12.3685;
        const k0 = Math.floor(kApprox);

        let bestK = k0;
        let bestJDE = Astronomical.newMoonJDE(k0);

        for (let dk = -2; dk <= 2; dk++) {
            const testK = k0 + dk;
            const testJDE = Astronomical.newMoonJDE(testK);
            if (testJDE <= jde && testJDE > bestJDE) {
                bestK = testK;
                bestJDE = testJDE;
            }
        }

        if (bestJDE > jde) {
            for (let dk = -5; dk <= 0; dk++) {
                const testK = k0 + dk;
                const testJDE = Astronomical.newMoonJDE(testK);
                if (testJDE <= jde) {
                    bestK = testK;
                    bestJDE = testJDE;
                    break;
                }
            }
        }

        const moonAge = jde - bestJDE;
        const synodicMonth = 29.530588861;

        const phaseAngle = (moonAge / synodicMonth) * 2 * Math.PI;
        const illumination = Math.round((1 - Math.cos(phaseAngle)) / 2 * 100);

        const phaseFraction = moonAge / synodicMonth;
        let phaseIdx;
        if (phaseFraction < 0.0625)       phaseIdx = 0;
        else if (phaseFraction < 0.1875)  phaseIdx = 1;
        else if (phaseFraction < 0.3125)  phaseIdx = 2;
        else if (phaseFraction < 0.4375)  phaseIdx = 3;
        else if (phaseFraction < 0.5625)  phaseIdx = 4;
        else if (phaseFraction < 0.6875)  phaseIdx = 5;
        else if (phaseFraction < 0.8125)  phaseIdx = 6;
        else if (phaseFraction < 0.9375)  phaseIdx = 7;
        else                               phaseIdx = 0;

        // ── الطور القادم والأيام المتبقية ──
        let nextMajorIdx = -1;
        let daysToNext = Infinity;
        for (let i = 0; i < MAJOR_PHASE_FRACTIONS.length; i++) {
            let diff = MAJOR_PHASE_FRACTIONS[i] - phaseFraction;
            if (diff <= 0.01) diff += 1.0;
            const days = diff * synodicMonth;
            if (days < daysToNext) {
                daysToNext = days;
                nextMajorIdx = i;
            }
        }
        const nextPhaseIdx = MAJOR_PHASE_INDICES[nextMajorIdx];
        daysToNext = Math.round(daysToNext * 10) / 10;

        // ── المد والجزر ──
        const lang = currentLang;
        let tideType, tideStrength;
        const distToNew = Math.min(phaseFraction, 1 - phaseFraction) * synodicMonth;
        const distToFull = Math.abs(phaseFraction - 0.5) * synodicMonth;
        const distToQ1 = Math.abs(phaseFraction - 0.25) * synodicMonth;
        const distToQ3 = Math.abs(phaseFraction - 0.75) * synodicMonth;
        const distToQuarter = Math.min(distToQ1, distToQ3);
        const distToSpring = Math.min(distToNew, distToFull);

        if (distToSpring <= 2) {
            tideType = TIDE_TYPES[lang].spring;
            tideStrength = 100;
        } else if (distToQuarter <= 2) {
            tideType = TIDE_TYPES[lang].neap;
            tideStrength = 30;
        } else if (phaseFraction < 0.25 || (phaseFraction > 0.5 && phaseFraction < 0.75)) {
            tideType = TIDE_TYPES[lang].falling;
            tideStrength = 65;
        } else {
            tideType = TIDE_TYPES[lang].rising;
            tideStrength = 65;
        }

        // حساب أوقات المد مع مراعاة خط الطول
        // المد يتأخر ~50.47 دقيقة يومياً بسبب حركة القمر
        const lngOffset = lng ? Math.round((lng / 360) * (12 * 60 + 25)) : 0;
        const baseMin = (Math.round(moonAge * 50.47) + lngOffset) % (12 * 60 + 25);
        const baseMinPositive = ((baseMin % (12 * 60 + 25)) + (12 * 60 + 25)) % (12 * 60 + 25);

        const formatTime = (totalMin) => {
            const m = ((totalMin % 1440) + 1440) % 1440;
            return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
        };

        const highLbl = currentLang === 'en' ? 'High' : 'مد';
        const lowLbl = currentLang === 'en' ? 'Low' : 'جزر';
        const diurnal = _isDiurnalTideRegion(lat, lng);

        // ترتيب الأحداث زمنياً: مد1، جزر1، [مد2، جزر2]
        const h1 = baseMinPositive;
        const events = [];
        if (diurnal) {
            // مد يومي: مد واحد + جزر واحد
            const l1 = (h1 + 6 * 60 + 12) % 1440;
            const sorted = [
                { time: h1, label: highLbl, type: 'high' },
                { time: l1, label: lowLbl, type: 'low' }
            ].sort((a, b) => a.time - b.time);
            events.push(...sorted);
        } else {
            // مد نصف يومي: مدّان + جزران
            const h2 = (h1 + 12 * 60 + 25) % 1440;
            const l1 = (h1 + 6 * 60 + 12) % 1440;
            const l2 = (h2 + 6 * 60 + 12) % 1440;
            const sorted = [
                { time: h1, label: highLbl, type: 'high' },
                { time: l1, label: lowLbl, type: 'low' },
                { time: h2, label: highLbl, type: 'high' },
                { time: l2, label: lowLbl, type: 'low' }
            ].sort((a, b) => a.time - b.time);
            events.push(...sorted);
        }

        // تنسيق الأوقات
        const tideEvents = events.map(e => ({
            label: e.label,
            time: formatTime(e.time),
            type: e.type
        }));

        return {
            phase: phaseIdx,
            phaseFraction: phaseFraction,
            name: MOON_PHASES[currentLang][phaseIdx],
            nameAr: MOON_PHASES.ar[phaseIdx],
            nameEn: MOON_PHASES.en[phaseIdx],
            symbol: MOON_SYMBOLS[phaseIdx],
            age: Math.round(moonAge * 10) / 10,
            illumination: illumination,
            nextPhase: {
                name: MOON_PHASES[currentLang][nextPhaseIdx],
                symbol: MOON_SYMBOLS[nextPhaseIdx],
                daysRemaining: daysToNext
            },
            tide: {
                type: tideType,
                strength: tideStrength,
                events: tideEvents,
                diurnal: diurnal
            }
        };
    }

    // ─── زاوية ميلان إضاءة القمر (Position Angle of Bright Limb - Parallactic Angle) ──

    /**
     * حساب زاوية ميلان الجزء المضيء من القمر كما يراها المراقب
     * تعتمد على موقع الشمس والقمر في السماء وخط عرض المراقب
     * @param {number} gYear - السنة الميلادية
     * @param {number} gMonth - الشهر الميلادي
     * @param {number} gDay - اليوم
     * @param {number} hour - الساعة (بالتوقيت المحلي، عشري: 20.5 = 8:30 مساءً)
     * @param {number} lat - خط العرض (بالدرجات)
     * @param {number} lng - خط الطول (بالدرجات)
     * @returns {number} زاوية الميلان بالراديان (0 = رأسي، π/2 = أفقي "ابتسامة")
     */
    function getMoonTiltAngle(gYear, gMonth, gDay, hour, lat, lng) {
        const DEG = Math.PI / 180;
        const mod360 = x => ((x % 360) + 360) % 360;

        // تحويل التوقيت المحلي إلى UTC (تقريب من خط الطول)
        const tzApprox = lng / 15;
        const hourUT = hour - tzApprox;

        // أيام جوليان منذ J2000.0 بالتوقيت العالمي
        const jdn = gregorianToJDN(gYear, gMonth, gDay);
        const D = jdn - 2451545.0 + (hourUT - 12) / 24;
        const T = D / 36525;

        // ── إحداثيات الشمس الاستوائية (RA, Dec) ──
        const L0s = mod360(280.46646 + 36000.76983 * T);
        const Ms = mod360(357.52911 + 35999.05029 * T) * DEG;
        const Cs = (1.914602 - 0.004817 * T) * Math.sin(Ms)
                 + 0.019993 * Math.sin(2 * Ms);
        const lambdaSun = mod360(L0s + Cs) * DEG;
        const eps = (23.439291 - 0.013004167 * T) * DEG;
        const sunRA = Math.atan2(Math.cos(eps) * Math.sin(lambdaSun), Math.cos(lambdaSun));
        const sunDec = Math.asin(Math.sin(eps) * Math.sin(lambdaSun));

        // ── إحداثيات القمر الاستوائية (RA, Dec) — تقريب دقيق ──
        const Lm = mod360(218.3165 + 481267.8813 * T) * DEG;
        const Mm = mod360(134.9634 + 477198.8676 * T) * DEG;
        const Fm = mod360(93.2721 + 483202.0175 * T) * DEG;
        const Dm = mod360(297.8502 + 445267.1115 * T) * DEG;
        const lambdaMoon = Lm
            + 6.289 * DEG * Math.sin(Mm)
            - 1.274 * DEG * Math.sin(2 * Dm - Mm)
            + 0.658 * DEG * Math.sin(2 * Dm)
            + 0.214 * DEG * Math.sin(2 * Mm)
            - 0.186 * DEG * Math.sin(Ms);
        const betaMoon = 5.128 * DEG * Math.sin(Fm);
        const moonRA = Math.atan2(
            Math.sin(lambdaMoon) * Math.cos(eps) - Math.tan(betaMoon) * Math.sin(eps),
            Math.cos(lambdaMoon)
        );
        const moonDec = Math.asin(
            Math.sin(betaMoon) * Math.cos(eps) + Math.cos(betaMoon) * Math.sin(eps) * Math.sin(lambdaMoon)
        );

        // ── زاوية موضع الطرف المضيء (PAB) — Meeus Ch.48 ──
        const dRA = sunRA - moonRA;
        const PAB = Math.atan2(
            Math.cos(sunDec) * Math.sin(dRA),
            Math.sin(sunDec) * Math.cos(moonDec) - Math.cos(sunDec) * Math.sin(moonDec) * Math.cos(dRA)
        );

        // ── الزاوية البارالاكتية ──
        const LST = mod360(280.46061837 + 360.98564736629 * D + lng) * DEG;
        const HA = LST - moonRA;
        const latRad = lat * DEG;
        const parallactic = Math.atan2(
            Math.sin(HA),
            Math.tan(latRad) * Math.cos(moonDec) - Math.sin(moonDec) * Math.cos(HA)
        );

        // زاوية الميلان المرئية
        return PAB - parallactic;
    }

    // ─── ولادة الهلال ──────────────────────────────────────────

    /**
     * حساب وقت ولادة الهلال (الاقتران) وموقعه المتوقع في السماء
     * لتحديد بداية الشهر الهجري
     * @param {number} hijriYear - السنة الهجرية
     * @param {number} hijriMonth - الشهر الهجري (1-12)
     * @param {number} lat - خط العرض
     * @param {number} lng - خط الطول
     * @param {number} tz - فرق التوقيت عن UTC بالساعات
     * @returns {object} معلومات الهلال
     */
    function getHilalInfo(hijriYear, hijriMonth, lat, lng, tz) {
        if (!lat && !lng) return null;
        if (tz === undefined) tz = 0;

        const toRad = Math.PI / 180;
        const toDeg = 180 / Math.PI;

        // إيجاد الاقتران المقابل لهذا الشهر عبر بداية الشهر الفعلية
        // monthStartJDN يعطينا أول يوم من الشهر الهجري
        // الاقتران يحدث قبل بداية الشهر بيوم أو يومين
        const monthStart = Astronomical.monthStartJDN(hijriYear, hijriMonth);
        const targetJDE = monthStart - 1.0; // تقريب: الاقتران قبل بداية الشهر

        // إيجاد k الأقرب لهذا التاريخ
        const decYear = (targetJDE - 2451545.0) / 365.25 + 2000.0;
        const kApprox = (decYear - 2000.0) * 12.3685;
        let bestK = Math.round(kApprox);

        // نجرب k-1, k, k+1 لإيجاد الاقتران الأقرب قبل بداية الشهر
        let conjJDE = Astronomical.newMoonJDE(bestK);
        for (let dk = -1; dk <= 1; dk++) {
            const testK = Math.round(kApprox) + dk;
            const testJDE = Astronomical.newMoonJDE(testK);
            // نريد أقرب اقتران قبل بداية الشهر
            if (testJDE < monthStart && testJDE > conjJDE) {
                bestK = testK;
                conjJDE = testJDE;
            }
        }
        // تأكد أن الاقتران قبل بداية الشهر
        if (conjJDE >= monthStart) {
            conjJDE = Astronomical.newMoonJDE(bestK - 1);
        }

        // تحويل JDE إلى تاريخ ووقت ميلادي
        const conjLocal = _jdeToLocalDate(conjJDE, tz);

        // حساب غروب الشمس في يوم الاقتران واليومين التاليين
        const conjJDN = Math.floor(conjJDE + 0.5);
        const conjGreg = jdnToGregorian(conjJDN);
        const lang = currentLang;

        // نحسب بيانات الرؤية لكل غروب بعد الاقتران (حتى 3 أيام)
        function _calcSighting(sunsetJDE, sunsetGregDate) {
            const ageHrs = (sunsetJDE - conjJDE) * 24;
            const mPos = _moonPosition(sunsetJDE);
            const sPos = _sunPosition(sunsetJDE);
            const mH = _equatorialToHorizontal(mPos.ra, mPos.dec, sunsetJDE, lat, lng);
            const sH = _equatorialToHorizontal(sPos.ra, sPos.dec, sunsetJDE, lat, lng);
            const elong = _angularSeparation(mPos.ra, mPos.dec, sPos.ra, sPos.dec);
            const av = mH.alt - sH.alt;

            let vis;
            if (ageHrs < 12 || elong < 7 || mH.alt < 2) {
                vis = lang === 'en' ? 'Impossible' : 'مستحيلة';
            } else if (ageHrs < 17 || elong < 10 || av < 4) {
                vis = lang === 'en' ? 'Difficult (telescope)' : 'صعبة (تلسكوب)';
            } else if (ageHrs < 21 || elong < 12 || av < 6) {
                vis = lang === 'en' ? 'Possible (binoculars)' : 'ممكنة (منظار)';
            } else {
                vis = lang === 'en' ? 'Visible (naked eye)' : 'ممكنة (بالعين)';
            }

            const local = _jdeToLocalDate(sunsetJDE, tz);
            return {
                sunset: { date: local.dateStr, time: local.timeStr, gregDate: sunsetGregDate },
                moonAge: Math.round(ageHrs * 10) / 10,
                altitude: Math.round(mH.alt * 10) / 10,
                azimuth: Math.round(mH.az * 10) / 10,
                azimuthDir: _azimuthDirection(mH.az, lang),
                elongation: Math.round(elong * 10) / 10,
                arcv: Math.round(av * 10) / 10,
                visibility: vis
            };
        }

        // نحسب لغروبين: أول غروب بعد الاقتران، والغروب التالي
        const sightings = [];
        for (let d = 0; d <= 2; d++) {
            const g = jdnToGregorian(conjJDN + d);
            const ss = _sunsetJDE(g.year, g.month, g.day, lat, lng, tz);
            if (ss > conjJDE) {
                sightings.push(_calcSighting(ss, g));
                if (sightings.length >= 2) break;
            }
        }

        // المساء الأفضل = أول مساء بإمكانية رؤية غير مستحيلة، أو الثاني
        let best = sightings[0];
        if (sightings.length > 1) {
            const vis0 = sightings[0].visibility;
            const impossible = (vis0 === 'مستحيلة' || vis0 === 'Impossible');
            if (impossible) best = sightings[1];
        }

        return {
            conjunction: {
                date: conjLocal.dateStr,
                time: conjLocal.timeStr,
                jde: conjJDE
            },
            // المساء الأفضل للترائي
            sunset: best.sunset,
            moonAge: best.moonAge,
            altitude: best.altitude,
            azimuth: best.azimuth,
            azimuthDir: best.azimuthDir,
            elongation: best.elongation,
            arcv: best.arcv,
            visibility: best.visibility,
            // كل المساءات للمقارنة
            sightings: sightings
        };
    }

    // ─── دوال فلكية مساعدة ──────────────────────────────────

    /** تحويل JDE إلى تاريخ ووقت محلي */
    function _jdeToLocalDate(jde, tz) {
        // JDE = Julian Ephemeris Day (TDT)
        // نهمل delta-T (بضع ثوانٍ) للعرض
        const jd = jde;
        const z = Math.floor(jd + 0.5);
        const f = jd + 0.5 - z;

        let a;
        if (z < 2299161) {
            a = z;
        } else {
            const alpha = Math.floor((z - 1867216.25) / 36524.25);
            a = z + 1 + alpha - Math.floor(alpha / 4);
        }

        const b = a + 1524;
        const c = Math.floor((b - 122.1) / 365.25);
        const d = Math.floor(365.25 * c);
        const e = Math.floor((b - d) / 30.6001);

        const day = b - d - Math.floor(30.6001 * e);
        const month = e < 14 ? e - 1 : e - 13;
        const year = month > 2 ? c - 4716 : c - 4715;

        // الوقت UTC
        let hours = f * 24;
        // إضافة المنطقة الزمنية
        hours += tz;
        let dy = day;
        if (hours >= 24) { hours -= 24; dy++; }
        if (hours < 0) { hours += 24; dy--; }

        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);

        return {
            dateStr: `${year}/${String(month).padStart(2, '0')}/${String(dy).padStart(2, '0')}`,
            timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            year, month, day: dy, hours: h, minutes: m
        };
    }

    /** حساب وقت غروب الشمس (JDE) لتاريخ وموقع */
    function _sunsetJDE(gYear, gMonth, gDay, lat, lng, tz) {
        const toRad = Math.PI / 180;
        const jdn = gregorianToJDN(gYear, gMonth, gDay);
        const n = jdn - 2451545.0 + 0.0008;

        // المعادلة الشمسية المبسطة
        const Jstar = n - (lng / 360);
        const M = (357.5291 + 0.98560028 * Jstar) % 360;
        const Mr = M * toRad;
        const C = 1.9148 * Math.sin(Mr) + 0.0200 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
        const lambda = (M + C + 180 + 102.9372) % 360;
        const lambdaR = lambda * toRad;

        const sinDec = Math.sin(lambdaR) * Math.sin(23.4393 * toRad);
        const dec = Math.asin(sinDec);
        const cosDec = Math.cos(dec);

        // زاوية الساعة عند الغروب (الشمس تحت الأفق -0.833°)
        const latR = lat * toRad;
        const cosH = (Math.sin(-0.8333 * toRad) - Math.sin(latR) * sinDec) / (Math.cos(latR) * cosDec);

        if (cosH > 1 || cosH < -1) {
            // لا غروب (قطبي)
            return jdn + 0.75; // تقريب: 18:00
        }

        const H = Math.acos(cosH) * 180 / Math.PI;

        // العبور (الظهر الشمسي)
        const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lambdaR);
        const Jset = Jtransit + (H / 360);

        return Jset;
    }

    /** حساب الموقع الظاهري للقمر (خطوط عرض وطول مسارية → RA/Dec) */
    function _moonPosition(jde) {
        const toRad = Math.PI / 180;
        const T = (jde - 2451545.0) / 36525;

        // خط الطول المتوسط للقمر (L')
        const Lp = (218.3165 + 481267.8813 * T) % 360;
        // الشذوذ المتوسط للقمر (M')
        const Mp = (134.9634 + 477198.8676 * T) % 360;
        // الشذوذ المتوسط للشمس (M)
        const M = (357.5291 + 35999.0503 * T) % 360;
        // حجة خط العرض (F)
        const F = (93.2720 + 483202.0175 * T) % 360;
        // الاستطالة المتوسطة (D)
        const D = (297.8502 + 445267.1115 * T) % 360;

        const LpR = Lp * toRad, MpR = Mp * toRad, MR = M * toRad;
        const FR = F * toRad, DR = D * toRad;

        // تصحيحات أساسية لخط الطول
        let dLon = 6.289 * Math.sin(MpR)
            + 1.274 * Math.sin(2 * DR - MpR)
            + 0.658 * Math.sin(2 * DR)
            + 0.214 * Math.sin(2 * MpR)
            - 0.186 * Math.sin(MR)
            - 0.114 * Math.sin(2 * FR);

        // تصحيحات أساسية لخط العرض
        let dLat = 5.128 * Math.sin(FR)
            + 0.281 * Math.sin(MpR + FR)
            + 0.278 * Math.sin(MpR - FR)
            + 0.173 * Math.sin(2 * DR - FR);

        const moonLon = (Lp + dLon) * toRad;
        const moonLat = dLat * toRad;

        // ميل محور الأرض
        const eps = (23.4393 - 0.01300 * T) * toRad;

        // تحويل مسارية → استوائية
        const sinLon = Math.sin(moonLon);
        const cosLon = Math.cos(moonLon);
        const sinLat = Math.sin(moonLat);
        const cosLat = Math.cos(moonLat);
        const sinEps = Math.sin(eps);
        const cosEps = Math.cos(eps);

        const ra = Math.atan2(sinLon * cosEps - Math.tan(moonLat) * sinEps, cosLon);
        const dec = Math.asin(sinLat * cosEps + cosLat * sinEps * sinLon);

        return { ra: ra * 180 / Math.PI, dec: dec * 180 / Math.PI };
    }

    /** حساب الموقع الظاهري للشمس */
    function _sunPosition(jde) {
        const toRad = Math.PI / 180;
        const T = (jde - 2451545.0) / 36525;

        const L0 = (280.46646 + 36000.76983 * T) % 360;
        const M = (357.52911 + 35999.05029 * T) % 360;
        const MR = M * toRad;

        const C = (1.914602 - 0.004817 * T) * Math.sin(MR)
            + 0.019993 * Math.sin(2 * MR);
        const sunLon = (L0 + C) * toRad;

        const eps = (23.4393 - 0.01300 * T) * toRad;

        const ra = Math.atan2(Math.cos(eps) * Math.sin(sunLon), Math.cos(sunLon));
        const dec = Math.asin(Math.sin(eps) * Math.sin(sunLon));

        return { ra: ra * 180 / Math.PI, dec: dec * 180 / Math.PI };
    }

    /** تحويل إحداثيات استوائية (RA, Dec) إلى أفقية (Alt, Az) */
    function _equatorialToHorizontal(ra, dec, jde, lat, lng) {
        const toRad = Math.PI / 180;
        // الزمن النجمي في غرينتش
        const T = (jde - 2451545.0) / 36525;
        const GMST = (280.46061837 + 360.98564736629 * (jde - 2451545.0)
            + 0.000387933 * T * T) % 360;
        // الزمن النجمي المحلي
        const LST = (GMST + lng) % 360;
        // زاوية الساعة
        const H = (LST - ra) * toRad;

        const latR = lat * toRad;
        const decR = dec * toRad;

        // الارتفاع
        const sinAlt = Math.sin(latR) * Math.sin(decR)
            + Math.cos(latR) * Math.cos(decR) * Math.cos(H);
        const alt = Math.asin(sinAlt) * 180 / Math.PI;

        // السمت
        const cosAz = (Math.sin(decR) - Math.sin(latR) * sinAlt)
            / (Math.cos(latR) * Math.cos(Math.asin(sinAlt)));
        let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
        if (Math.sin(H) > 0) az = 360 - az;

        return { alt, az };
    }

    /** حساب الفصل الزاوي بين نقطتين سماويتين */
    function _angularSeparation(ra1, dec1, ra2, dec2) {
        const toRad = Math.PI / 180;
        const d = Math.acos(
            Math.sin(dec1 * toRad) * Math.sin(dec2 * toRad)
            + Math.cos(dec1 * toRad) * Math.cos(dec2 * toRad)
                * Math.cos((ra1 - ra2) * toRad)
        );
        return d * 180 / Math.PI;
    }

    /** تحويل السمت لوصف اتجاه */
    function _azimuthDirection(az, lang) {
        const dirs = lang === 'en'
            ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
            : ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
        const idx = Math.round(az / 45) % 8;
        return dirs[idx];
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

        return { isLeapYear, daysInMonth, daysInYear, hijriToJDN, jdnToHijri, monthStartJDN, newMoonJDE, _approxK };
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
        monthName, dayName, gregMonthName, isSacredMonth,

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

        // الأنواء والمواسم والأبراج والدرور وأطوار القمر والهلال
        getTale3, getZodiac, getSeason, getDurr, getMoonPhase, getMoonTiltAngle, getHilalInfo,

        // بيانات إثرائية + مصفوفات مكشوفة
        TAWALIE, SEASONS, DUROR_LABELS, DUROR_MIA, DUROR_ALIASES, ANWA_ENRICHMENT, ZODIAC,
        getSeasonalWinds, getSeasonalFish, getSeasonalCrops, getSeasonalWildlife,
        _matchRange, _suhailDay,

        // بيانات كتاب الدرور والطوالع
        DURR_DETAILS, SPECIAL_SEASONS, ASTRO_EVENTS, FOLK_PROVERBS,
        THURAYA_CONJUNCTIONS, CLIMATE_DATA, BIRD_MIGRATION, HERITAGE_GLOSSARY,
        getDurrDetails, getActiveSeasons, getUpcomingAstroEvents, getSeasonalProverbs,
        getNextThurayaConjunction, getClimateData, getActiveBirdMigration, getGlossaryTerm,

        // الأزمنة العربية
        getArabicTimeName, ARAB_DAY_TIMES, ARAB_NIGHT_TIMES,

        // مساعدات
        toArabicNumerals,
        MONTH_NAMES, MONTH_NAMES_EN, DAY_NAMES, GREGORIAN_MONTH_NAMES, GREGORIAN_MONTH_NAMES_EN,
        EPOCH_JDN
    };
})();

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
        uae:        { id: 'uae',        fajr: 18.2, isha: 18.2, ishaType: 'angle', maghribAngle: null, ihtiyat: { fajr: 0, sunrise: -2, dhuhr: 1.25, asr: 0.5, maghrib: 1.5, isha: -1 }, nameAr: 'الهيئة العامة للشؤون الإسلامية – الإمارات', nameEn: 'UAE - GAIAE' },
        sharjah:    { id: 'sharjah',    fajr: 18.2, isha: 18.2, ishaType: 'angle', maghribAngle: null, ihtiyat: { fajr: -2, sunrise: -4, dhuhr: 0.25, asr: -1, maghrib: -2, isha: -3 }, nameAr: 'دائرة الشؤون الإسلامية – الشارقة', nameEn: 'Sharjah - DSIA' },
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

    // ─── جدول أوقات الشارقة الرسمي 1447هـ ─────────────────
    // 355 يوم من 2025-06-26 إلى 2026-06-15
    // كل يوم = 24 حرف (HHMM × 6 صلوات: فجر، شروق، ظهر، عصر، مغرب، عشاء)
    const _SHARJAH_EPOCH = new Date(2025, 5, 26); // June 26, 2025
    const _SHARJAH_DAYS = 355;
    const _SHARJAH_DATA = '035905261224154519152042040005271224154519162042040005271224154519162042040005271224154519162042040105281224154619162042040105281225154619162042040205281225154619162042040205291225154619162042040305291225154719162042040305291225154719162042040405301225154719162042040405301226154719162042040505311226154819152041040505311226154819152041040605321226154819152041040605321226154919152040040705321226154919152040040805331226154919152040040805331227154919142039040905341227155019142039040905341227155019142038041005351227155019132038041105351227155019132037041105361227155019132037041205361227155119122036041305371227155119122036041305371227155119122035041405381227155119112035041505381227155119112034041505391227155219102033041605391227155219102033041705401227155219092032041805401227155219092031041805411227155219082030041905411227155219082030042005421227155219072029042005421227155219062028042105421227155319062027042205431227155319052026042205431227155319052025042305441227155319042024042405441227155319032024042405451226155319022023042505451226155319022022042605461226155319012021042605461226155319002020042705471226155318592019042805471226155318592018042805481225155218582017042905481225155218572016043005491225155218562015043005491225155218552014043105491225155218542013043205501224155218542012043205501224155218532011043305511224155118522009043305511224155118512008043405521223155118502007043505521223155118492006043505521223155118482005043605531223155018472004043605531222155018462003043705541222155018452002043805541222154918442000043805541222154918431959043905551221154918421958043905551221154818411957044005561221154818401956044005561220154818391955044105561220154718381953044105571220154718371952044205571219154618361951044205581219154618351950044305581219154618341949044305581218154518331948044405591218154518321946044405591218154418301945044505591217154418291944044506001217154318281943044606001217154318271942044606011216154218261940044706011216154218251939044706011215154118241938044706021215154118231937044806021215154018221936044806021214153918211935044906031214153918201934044906031214153818191932045006041213153818171931045006041213153718161930045106041213153618151929045106051212153618141928045106051212153518131927045206061212153518121926045206061211153418111925045306061211153318101923045306071211153318091922045406071210153218081921045406081210153218071920045406081210153118061919045506081209153018051918045506091209153018041917045606091209152918031916045606101208152818021915045606101208152818011914045706111208152718001913045706111208152617591912045806121207152617581911045806121207152517571910045906121207152517561909045906131207152417551909045906131206152317541908050006141206152317531907050006141206152217521906050106151206152217511905050106151206152117501904050206161205152017491903050206161205152017481903050306171205151917481902050306181205151917471901050406181205151817461900050406191205151817451900050506191205151717441859050506201204151717441858050606201204151617431858050606211204151517421857050706221204151517421856050706221204151517411856050806231204151417401855050806231204151417401855050906241204151317391854050906251204151317381854051006251204151217381853051006261204151217371853051106271204151217371852051106271204151117361852051206281204151117361852051206291205151017351851051306291205151017351851051406301205151017341851051406311205151017341850051506311205150917331850051506321205150917331850051606331205150917331849051706331206150917321849051706341206150817321849051806351206150817321849051806351206150817321849051906361206150817311849052006371207150817311849052006381207150817311849052106381207150817311848052106391208150817311848052206401208150817311848052306411208150817311849052306411209150817311849052406421209150817311849052506431209150817311849052506431210150817311849052606441210150817311849052606451210150817311849052706451211150817311849052806461211150917311850052806471212150917311850052906481212150917311850052906481213150917321850053006491213151017321851053106501213151017321851053106501214151017321851053206511214151017331852053206511215151117331852053306521215151117331852053406531216151217341853053406531216151217341853053506541217151217341854053506541217151317351854053606551218151317351854053606551218151417361855053706561219151417361855053706561219151517371856053806571220151517371856053806571220151617381857053906581221151617381858053906581221151717391858054006591222151717401859054006591222151817401859054006591223151917411900054107001223151917411900054107001224152017421901054207001224152117431902054207011225152117431902054207011225152217441903054207011225152217451903054307011226152317451904054307021226152417461905054307021227152417471905054307021227152517481906054407021228152617481907054407021228152617491907054407021228152717501908054407021229152817501909054407021229152817511909054407021230152917521910054407021230153017531911054407021230153117531911054407021231153117541912054407021231153217551912054407021231153317561913054407021232153317561914054407021232153417571914054407011232153517581915054407011232153517591916054407011233153618001916054407011233153618001917054407001233153718011918054307001233153818021918054307001233153818021919054306591234153918031920054306591234153918041920054206581234154018051921054206581234154118051921054206581234154118061922054106571234154218071923054106571234154218071923054006561235154318081924054006551235154318091924054006551235154418101925053906541235154418101926053906541235154518111926053806531235154518121927053706521235154618121927053706521235154618131928053606511235154718141928053606501235154718141929053506501235154718151929053406491235154818151930053406481235154818161931053306471234154818171931053206471234154918171932053206461234154918181932053106451234154918181933053006441234155018191933052906431234155018201934052906431234155018201934052806421234155118211935052706411233155118211935052606401233155118221936052506391233155118221936052406381233155118231937052406371233155218231937052306361233155218241938052206351232155218241938052106341232155218251939052006331232155218251939051906321232155218261940051806311231155218261940051706301231155218271941051606291231155318271941051506281231155318281942051406271230155318281942051306261230155318291943051206251230155318291943051106241230155318301944051006231229155318301944050906221229155318311944050806211229155318311945050706201228155318321945050506191228155318321946050406181228155318331946050306171227155218331947050206161227155218331948050106151227155218341948050006141227155218341949045906131226155218351949045806121226155218351950045706111226155218361950045506101225155218361951045406091225155218371951045306081225155118371952045206071224155118371952045106061224155118381953045006051224155118381953044906041224155118391954044806031223155118391954044606021223155018401955044506011223155018401956044406001222155018411956044305591222155018411957044205581222155018411957044105571222154918421958044005561221154918421959043805551221154918431959043705541221154918432000043605531221154818442000043505521220154818442001043405511220154818452002043305501220154818452002043205491220154718462003043105481220154718462004043005471219154718472004042905461219154718472005042805451219154618482006042705451219154618482006042605441219154618492007042505431218154618492008042405421218154618502008042305411218154518502009042205411218154518512010042105401218154518512010042005391218154518522011041905381218154418522012041805381217154418532013041705371217154418532013041605361217154418542014041505351217154418542015041405351217154318552016041305341217154318552016041205331217154318562017041205331217154318562018041105321217154318572018041005321217154218572019040905311217154218582020040905311217154218582021040805301217154218592021040705301217154218592022040605291217154219002023040605291217154219002024040505281217154119012024040405281217154119022025040405271217154119022026040305271217154119032026040305271217154119032027040205261217154119042028040205261218154119042029040105261218154119052029040105251218154119052030040005251218154119062031040005251218154119062031040005251218154119072032035905251218154119072032035905241218154119072033035905241219154119082034035805241219154119082034035805241219154119092035035805241219154119092035035805241219154119102036035805241219154119102036035705241220154119112037035705241220154119112037035705241220154119112038035705241220154219122038035705241220154219122039035705241221154219122039035705241221154219132040035705241221154219132040';

    function _sharjahLookup(dateObj) {
        const y = dateObj.year || dateObj.getFullYear();
        const m = dateObj.month || (dateObj.getMonth() + 1);
        const d = dateObj.day || dateObj.getDate();
        const target = new Date(y, m - 1, d);
        const dayIndex = Math.round((target - _SHARJAH_EPOCH) / 86400000);
        if (dayIndex < 0 || dayIndex >= _SHARJAH_DAYS) return null;
        const offset = dayIndex * 24;
        const s = _SHARJAH_DATA;
        const parse = (i) => {
            const hh = parseInt(s.substr(offset + i, 2));
            const mm = parseInt(s.substr(offset + i + 2, 2));
            return hh + mm / 60;
        };
        return {
            fajr: parse(0), sunrise: parse(4), dhuhr: parse(8),
            asr: parse(12), maghrib: parse(16), isha: parse(20)
        };
    }

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
        // ── الشارقة: استخدام الجدول الرسمي إن كان التاريخ ضمن النطاق ──
        if (methodId === 'sharjah') {
            const lookup = _sharjahLookup(date);
            if (lookup) {
                const r = lookup;
                const imsak = r.fajr - 10 / 60;
                const midnight = r.maghrib + (24 - r.maghrib + r.sunrise) / 2;
                return {
                    fajr: _fmt(r.fajr), sunrise: _fmt(r.sunrise),
                    dhuhr: _fmt(r.dhuhr), asr: _fmt(r.asr),
                    maghrib: _fmt(r.maghrib), isha: _fmt(r.isha),
                    imsak: _fmt(imsak), midnight: _fmt(midnight > 24 ? midnight - 24 : midnight),
                    _raw: { fajr: r.fajr, sunrise: r.sunrise, dhuhr: r.dhuhr,
                            asr: r.asr, maghrib: r.maghrib, isha: r.isha,
                            imsak, midnight: midnight > 24 ? midnight - 24 : midnight }
                };
            }
            // خارج النطاق — الرجوع للحساب الفلكي
        }

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

        // Dhuhr safety margin (+1 min) + method ihtiyat
        const dhuhrIht = (method.ihtiyat && method.ihtiyat.dhuhr) ? method.ihtiyat.dhuhr : 0;
        const dhuhrFinal = dhuhr + (1 + dhuhrIht) / 60;

        // Maghrib offset (Morocco +5min)
        if (method.maghribOffset && maghrib !== null) {
            maghrib += method.maghribOffset / 60;
        }

        // Imsak (10 min before Fajr)
        let imsak = fajr !== null ? fajr - 10 / 60 : null;

        // ─── تطبيق الاحتياط (ihtiyat) ──────────────────────────
        const iht = method.ihtiyat;
        if (iht) {
            if (iht.fajr    && fajr    !== null) fajr    += iht.fajr / 60;
            if (iht.sunrise && sunrise !== null) sunrise += iht.sunrise / 60;
            if (iht.asr     && asr     !== null) asr     += iht.asr / 60;
            if (iht.maghrib && maghrib !== null) maghrib += iht.maghrib / 60;
            if (iht.isha    && isha    !== null) isha    += iht.isha / 60;
        }

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

        // Per-prayer rounding (some authorities use floor/ceil for safety)
        const rnd = method.rounding || {};
        return {
            fajr:     _fmt(fajr, rnd.fajr),
            sunrise:  _fmt(sunrise, rnd.sunrise),
            dhuhr:    _fmt(dhuhrFinal, rnd.dhuhr),
            asr:      _fmt(asr, rnd.asr),
            maghrib:  _fmt(maghrib, rnd.maghrib),
            isha:     _fmt(isha, rnd.isha),
            imsak:    _fmt(imsak, rnd.fajr),
            midnight: _fmt(midnight),
            // Raw hours for countdown calculations
            _raw: { fajr, sunrise, dhuhr: dhuhrFinal, asr, maghrib, isha, imsak, midnight }
        };
    }

    // ─── تنسيق الوقت ──────────────────────────────────────
    // roundMode: 'round' (default), 'floor', 'ceil'
    function _fmt(hours, roundMode) {
        if (hours === null || hours === undefined || isNaN(hours)) return '--:--';
        hours = ((hours % 24) + 24) % 24;
        const h = Math.floor(hours);
        const fn = roundMode === 'floor' ? Math.floor : roundMode === 'ceil' ? Math.ceil : Math.round;
        const m = fn((hours - h) * 60);
        const actualH = m === 60 ? h + 1 : h;
        const actualM = m === 60 ? 0 : m;

        if (_timeFormat === '12h') {
            const period = actualH >= 12 ? 'PM' : 'AM';
            const h12 = actualH % 12 || 12;
            return h12 + ':' + String(actualM).padStart(2, '0') + ' ' + period;
        }
        return String(actualH).padStart(2, '0') + ':' + String(actualM).padStart(2, '0');
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
    let _timeFormat = '24h';

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
            _timeFormat = localStorage.getItem('prayer-timeformat') || '24h';
            if (_timeFormat !== '24h' && _timeFormat !== '12h') _timeFormat = '24h';
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
            localStorage.setItem('prayer-timeformat', _timeFormat);
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
        if (settings.timeFormat === '24h' || settings.timeFormat === '12h') _timeFormat = settings.timeFormat;
        _save();
    }

    function getSettings() {
        return { method: _method, asrFactor: _asrFactor, highLat: _highLat, lat: _lat, lng: _lng, tz: _tz, elevation: _elevation, timeFormat: _timeFormat };
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
        fmt: _fmt,
        _save, _load
    };
})();

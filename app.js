/**
 * تطبيق التقويم الهجري — الواجهة
 * المستوى 2 (فلكي) كافتراضي + تصحيح يدوي + تعدد اللغات + تصدير iCal
 */

const App = (() => {
    const H = HijriCalendar;
    const PT = typeof PrayerTimes !== 'undefined' ? PrayerTimes : null;
    const AI = typeof AIClient !== 'undefined' ? AIClient : null;
    const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    let currentYear, currentMonth;
    let _prayerTimer = null;
    let _notifyTimers = [];
    let _deferredInstallPrompt = null;
    let _selectedDate = null; // { year, month, day } gregorian — null means today
    let _arabicClockTimer = null;
    let _arabTimeTimer = null;
    let _needleJustReleased = false;
    let _climateStats = null;
    let _needleDragCleanup = null;

    // ─── شاشة الترحيب ──────────────────────────────────────
    function setupOnboarding() {
        const overlay = document.getElementById('onboarding-overlay');
        if (!overlay) return;

        // إذا سبق تحديد الموقع أو اكتمل الـ onboarding → أخفِ فوراً
        const hasLoc = localStorage.getItem('prayer-lat');
        if (localStorage.getItem('onboarding-done') || hasLoc) {
            overlay.style.display = 'none';
            return;
        }

        // تعريب النصوص
        document.getElementById('onboarding-title').textContent = H.t('welcomeTitle');
        document.getElementById('onboarding-msg').textContent = H.t('welcomeMsg');
        document.getElementById('onboarding-detect').textContent = H.t('welcomeDetect');
        document.getElementById('onboarding-skip').textContent = H.t('welcomeSkip');

        const dismiss = () => {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.style.display = 'none', 400);
            localStorage.setItem('onboarding-done', '1');
        };

        // زر تحديد الموقع
        document.getElementById('onboarding-detect').addEventListener('click', async () => {
            const btn = document.getElementById('onboarding-detect');
            btn.textContent = H.t('welcomeDetecting');
            btn.disabled = true;
            try {
                if (isNative()) {
                    const { Geolocation } = window.Capacitor.Plugins;
                    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
                    localStorage.setItem('prayer-lat', String(Math.round(pos.coords.latitude * 100) / 100));
                    localStorage.setItem('prayer-lng', String(Math.round(pos.coords.longitude * 100) / 100));
                    localStorage.setItem('prayer-tz', String(-new Date().getTimezoneOffset() / 60));
                    if (pos.coords.altitude) localStorage.setItem('prayer-elevation', String(Math.round(pos.coords.altitude)));
                } else if (navigator.geolocation) {
                    await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(pos => {
                            localStorage.setItem('prayer-lat', String(Math.round(pos.coords.latitude * 100) / 100));
                            localStorage.setItem('prayer-lng', String(Math.round(pos.coords.longitude * 100) / 100));
                            localStorage.setItem('prayer-tz', String(-new Date().getTimezoneOffset() / 60));
                            if (pos.coords.altitude) localStorage.setItem('prayer-elevation', String(Math.round(pos.coords.altitude)));
                            resolve();
                        }, reject, { enableHighAccuracy: true });
                    });
                }
            } catch (e) {
                console.warn('Onboarding geolocation failed', e);
            }
            dismiss();
            location.reload();
        });

        // رابط التخطي
        document.getElementById('onboarding-skip').addEventListener('click', dismiss);
    }

    // ─── تهيئة ──────────────────────────────────────────────
    function init() {
        const today = H.todayHijri();
        currentYear = today.year;
        currentMonth = today.month;

        setupOnboarding();
        setupTheme();
        setupNavigation();
        setupModeSelector();
        setupWeekStartSelector();
        setupLangSelector();
        setupCorrectionControls();
        setupGoToDate();
        setupDayViewGoTo();
        setupExport();
        setupAdhkar();
        setupShare();
        setupShareScreen();
        if (PT) setupPrayerTimes();
        if (PT) setupNotifications();
        setupDayView();
        applyLabels();
        renderCalendar();
        renderTodayInfo();
        renderAnwaCard();
        updateModeUI();
        if (PT) renderPrayerTimes();
        registerServiceWorker();

        // Launch into Day View (today)
        showDayView(null);
    }

    // ─── الوضع الداكن ──────────────────────────────────────────
    function setupTheme() {
        // Load saved theme or detect system preference
        let theme = 'light';
        try { theme = localStorage.getItem('hijri-theme') || ''; } catch (e) {}
        if (!theme) {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', theme);

        const btn = document.getElementById('theme-toggle');
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            btn.textContent = next === 'dark' ? '☀️' : '🌙';
            // Sync day view theme button
            const dvBtn = document.getElementById('dv-theme-toggle');
            if (dvBtn) dvBtn.textContent = next === 'dark' ? '☀️' : '🌙';
            try { localStorage.setItem('hijri-theme', next); } catch (e) {}
            // Update meta theme-color
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.content = next === 'dark' ? '#064e3b' : '#14553f';
        });
    }

    // ─── تحديث جميع النصوص (اللغة) ─────────────────────────
    function applyLabels() {
        const lang = H.getLang();
        const html = document.documentElement;
        html.setAttribute('lang', lang === 'ar' ? 'ar' : 'en');
        html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

        document.getElementById('app-title').textContent = H.t('title');

        // شريط الأدوات
        document.getElementById('lbl-mode').textContent = H.t('modeLabel');
        document.getElementById('opt-astro').textContent = H.t('modeAstro');
        document.getElementById('opt-tab').textContent = H.t('modeTab');
        document.getElementById('lbl-weekstart').textContent = H.t('weekStartLabel');
        document.getElementById('opt-sat').textContent = H.t('saturday');
        document.getElementById('opt-sun').textContent = H.t('sunday');
        document.getElementById('opt-mon').textContent = H.t('monday');
        document.getElementById('lbl-lang').textContent = H.t('langLabel');
        document.getElementById('opt-lang-ar').textContent = H.t('langAr');
        document.getElementById('opt-lang-en').textContent = H.t('langEn');
        document.getElementById('lbl-corr').textContent = H.t('corrLabel');
        document.getElementById('corr-reset').textContent = H.t('corrReset');
        document.getElementById('corr-minus').title = H.t('minusDay');
        document.getElementById('corr-plus').title = H.t('plusDay');
        document.getElementById('corr-reset').title = H.t('resetMonth');
        document.getElementById('lbl-corrections').textContent = H.t('corrections');
        document.getElementById('corr-clear-all').textContent = H.t('corrClearAll');

        // الانتقال إلى تاريخ (التقويم)
        document.getElementById('goto-title').textContent = H.t('goToDate');
        document.getElementById('goto-hijri-label').textContent = H.t('hijri');
        document.getElementById('goto-greg-label').textContent = H.t('gregorian');
        document.getElementById('goto-lbl-day').textContent = H.t('day');
        document.getElementById('goto-lbl-month').textContent = H.t('month');
        document.getElementById('goto-lbl-year').textContent = H.t('year');
        document.getElementById('goto-btn').textContent = H.t('go');

        // الانتقال إلى تاريخ (عرض اليوم)
        document.getElementById('dv-goto-title').textContent = H.t('goToDate');
        document.getElementById('dv-goto-hijri-label').textContent = H.t('hijri');
        document.getElementById('dv-goto-greg-label').textContent = H.t('gregorian');
        document.getElementById('dv-goto-lbl-day').textContent = H.t('day');
        document.getElementById('dv-goto-lbl-month').textContent = H.t('month');
        document.getElementById('dv-goto-lbl-year').textContent = H.t('year');
        document.getElementById('dv-goto-btn').textContent = H.t('go');

        // تصدير
        document.getElementById('export-title').textContent = H.t('exportTitle');
        document.getElementById('export-hijri-label').textContent = H.t('hijri');
        document.getElementById('export-greg-label').textContent = H.t('gregorian');
        document.getElementById('export-from-label').textContent = H.t('exportFrom');
        document.getElementById('export-to-label').textContent = H.t('exportTo');
        document.getElementById('export-from-month-lbl').textContent = H.t('exportMonth');
        document.getElementById('export-from-year-lbl').textContent = H.t('exportYear');
        document.getElementById('export-to-month-lbl').textContent = H.t('exportMonth');
        document.getElementById('export-to-year-lbl').textContent = H.t('exportYear');
        document.getElementById('export-btn').textContent = H.t('exportBtn');
        document.getElementById('export-pdf-label').textContent = H.t('exportPDF');

        // الأذكار
        const adhkarTitle = document.getElementById('adhkar-title');
        if (adhkarTitle) adhkarTitle.textContent = H.t('adhkarTitle');
        const adhkarMorning = document.getElementById('adhkar-tab-morning');
        if (adhkarMorning) adhkarMorning.textContent = H.t('adhkarMorning');
        const adhkarEvening = document.getElementById('adhkar-tab-evening');
        if (adhkarEvening) adhkarEvening.textContent = H.t('adhkarEvening');

        // المشاركة
        const shareBtn = document.getElementById('share-date-btn');
        if (shareBtn) shareBtn.title = H.t('shareTitle');
        const sharePrayerBtn = document.getElementById('share-prayer-btn');
        if (sharePrayerBtn) sharePrayerBtn.title = H.t('sharePrayerTitle');

        // التنقل
        document.getElementById('today-btn').textContent = H.t('todayBtn');
        document.getElementById('leap-badge').textContent = H.t('leapYear');
        document.getElementById('next-month').title = H.t('nextMonth');
        document.getElementById('prev-month').title = H.t('prevMonth');

        // عن المنهج
        document.getElementById('about-title').textContent = H.t('aboutTitle');
        document.getElementById('about-p1').innerHTML = H.t('aboutP1');
        document.getElementById('about-p2').innerHTML = H.t('aboutP2');
        document.getElementById('about-p3').innerHTML = H.t('aboutP3');
        document.getElementById('about-p4').innerHTML = H.t('aboutP4');

        // زر العودة للواجهة الرئيسة
        const cvBackBtn = document.getElementById('cv-back-btn');
        if (cvBackBtn) cvBackBtn.textContent = H.t('backToDayView');

        // التذييل
        document.getElementById('footer-credit').textContent = H.t('footer');
        document.getElementById('footer-version').textContent = H.t('version');
        document.getElementById('footer-tool').textContent = H.t('credit');

        // الوضع الداكن
        document.getElementById('lbl-theme').textContent = H.t('themeLabel');

        // مواقيت الصلاة
        if (PT) {
            document.getElementById('prayer-title').textContent = H.t('prayerTitle');
            document.getElementById('prayer-no-loc-text').textContent = H.t('prayerNoLocation');
            document.getElementById('prayer-detect-main-text').textContent = H.t('prayerDetect');
            document.getElementById('p-fajr-lbl').textContent = H.t('prayerFajr');
            document.getElementById('p-sunrise-lbl').textContent = H.t('prayerSunrise');
            document.getElementById('p-dhuhr-lbl').textContent = H.t('prayerDhuhr');
            document.getElementById('p-asr-lbl').textContent = H.t('prayerAsr');
            document.getElementById('p-maghrib-lbl').textContent = H.t('prayerMaghrib');
            document.getElementById('p-isha-lbl').textContent = H.t('prayerIsha');
            document.getElementById('prayer-next-label').textContent = H.t('prayerNext');
            document.getElementById('prayer-next-in').textContent = H.t('prayerIn');
            document.getElementById('prayer-settings-lbl').textContent = H.t('prayerSettings');
            document.getElementById('lbl-prayer-method').textContent = H.t('prayerMethod');
            document.getElementById('lbl-prayer-asr').textContent = H.t('prayerAsr_');
            document.getElementById('opt-shafii').textContent = H.t('prayerShafii');
            document.getElementById('opt-hanafi').textContent = H.t('prayerHanafi');
            document.getElementById('lbl-prayer-lat').textContent = H.t('prayerLat');
            document.getElementById('lbl-prayer-lng').textContent = H.t('prayerLng');
            document.getElementById('lbl-prayer-tz').textContent = H.t('prayerTz');
            document.getElementById('lbl-prayer-highlat').textContent = H.t('prayerHighLat');
            document.getElementById('lbl-prayer-elevation').textContent = H.t('prayerElevation');
            document.getElementById('timetable-lbl').textContent = H.t('monthlyTimetable');
            const tfLbl = document.getElementById('timeformat-lbl');
            if (tfLbl) tfLbl.textContent = H.t('timeFormat12h');
        }
    }

    function refreshUI() {
        applyLabels();
        renderCalendar();
        renderTodayInfo();
        renderAnwaCard();
        updateModeUI();
        updateCorrectionDisplay();
    }

    // ─── التنقل ─────────────────────────────────────────────
    function setupNavigation() {
        document.getElementById('prev-month').addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 1) { currentMonth = 12; currentYear--; }
            renderCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 12) { currentMonth = 1; currentYear++; }
            renderCalendar();
        });

        document.getElementById('today-btn').addEventListener('click', () => {
            const today = H.todayHijri();
            currentYear = today.year;
            currentMonth = today.month;
            _selectedDate = null;
            renderCalendar();
            renderTodayInfo();
            renderAnwaCard();
            if (PT) renderPrayerTimes();
        });

        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.key === 'ArrowRight') {
                currentMonth--;
                if (currentMonth < 1) { currentMonth = 12; currentYear--; }
                renderCalendar();
            } else if (e.key === 'ArrowLeft') {
                currentMonth++;
                if (currentMonth > 12) { currentMonth = 1; currentYear++; }
                renderCalendar();
            }
        });
    }

    // ─── اختيار النمط ───────────────────────────────────────
    function setupModeSelector() {
        const select = document.getElementById('mode-select');
        select.value = H.getMode();
        select.addEventListener('change', () => {
            H.setMode(select.value);
            H._saveMode();
            renderCalendar();
            renderTodayInfo();
            updateModeUI();
        });
    }

    function updateModeUI() {
        const select = document.getElementById('mode-select');
        select.value = H.getMode();

        const badge = document.getElementById('mode-badge');
        badge.textContent = H.getMode() === 'astronomical' ? H.t('badgeAstro') : H.t('badgeTab');
        badge.className = 'mode-badge ' + (H.getMode() === 'astronomical' ? 'mode-astro' : 'mode-tab');

        updateCorrectionDisplay();
    }

    // ─── اختيار بداية الأسبوع ────────────────────────────────
    function setupWeekStartSelector() {
        const select = document.getElementById('weekstart-select');
        select.value = H.getWeekStart();
        select.addEventListener('change', () => {
            H.setWeekStart(parseInt(select.value));
            H._saveWeekStart();
            renderCalendar();
        });
    }

    // ─── اختيار اللغة ───────────────────────────────────────
    function setupLangSelector() {
        const select = document.getElementById('lang-select');
        select.value = H.getLang();
        select.addEventListener('change', () => {
            H.setLang(select.value);
            H._saveLang();
            refreshUI();
        });
    }

    // ─── الانتقال إلى تاريخ (عرض اليوم) ────────────────────
    function setupDayViewGoTo() {
        document.getElementById('dv-goto-btn').addEventListener('click', () => {
            const d = parseInt(document.getElementById('dv-goto-day').value);
            const m = parseInt(document.getElementById('dv-goto-month').value);
            const y = parseInt(document.getElementById('dv-goto-year').value);

            if (!d || !m || !y || m < 1 || m > 12 || d < 1) return;

            const type = document.querySelector('input[name="dv-goto-type"]:checked').value;

            let gYear, gMonth, gDay;
            if (type === 'hijri') {
                if (d > 30 || y < 1) return;
                const greg = H.hijriToGregorian(y, m, d);
                gYear = greg.year; gMonth = greg.month; gDay = greg.day;
            } else {
                if (d > 31 || y < 622) return;
                gYear = y; gMonth = m; gDay = d;
            }

            showDayView({ year: gYear, month: gMonth, day: gDay });
        });
    }

    // ─── الانتقال إلى تاريخ (التقويم الشهري) ─────────────
    function setupGoToDate() {
        document.getElementById('goto-btn').addEventListener('click', () => {
            const d = parseInt(document.getElementById('goto-day').value);
            const m = parseInt(document.getElementById('goto-month').value);
            const y = parseInt(document.getElementById('goto-year').value);

            if (!d || !m || !y || m < 1 || m > 12 || d < 1) return;

            const type = document.querySelector('input[name="goto-type"]:checked').value;

            if (type === 'hijri') {
                if (d > 30 || y < 1) return;
                currentYear = y;
                currentMonth = m;
            } else {
                if (d > 31 || y < 622) return;
                const hijri = H.gregorianToHijri(y, m, d);
                currentYear = hijri.year;
                currentMonth = hijri.month;
            }

            renderCalendar();
            showConverterResult(type, d, m, y);
        });
    }

    // ─── تصدير iCal ─────────────────────────────────────────
    function setupExport() {
        const radios = document.querySelectorAll('input[name="export-type"]');
        radios.forEach(r => r.addEventListener('change', () => {
            const type = document.querySelector('input[name="export-type"]:checked').value;
            const now = new Date();
            if (type === 'gregorian') {
                document.getElementById('export-from-year').value = now.getFullYear();
                document.getElementById('export-to-year').value = now.getFullYear();
            } else {
                const today = H.todayHijri();
                document.getElementById('export-from-year').value = today.year;
                document.getElementById('export-to-year').value = today.year;
            }
            document.getElementById('export-from-month').value = 1;
            document.getElementById('export-to-month').value = 12;
        }));

        document.getElementById('export-btn').addEventListener('click', () => {
            const fromM = parseInt(document.getElementById('export-from-month').value);
            const fromY = parseInt(document.getElementById('export-from-year').value);
            const toM = parseInt(document.getElementById('export-to-month').value);
            const toY = parseInt(document.getElementById('export-to-year').value);
            const type = document.querySelector('input[name="export-type"]:checked').value;

            if (!fromM || !fromY || !toM || !toY) return;
            if (fromM < 1 || fromM > 12 || toM < 1 || toM > 12) return;

            const ics = generateICS(fromY, fromM, toY, toM, type);
            downloadFile('hijri-calendar.ics', ics, 'text/calendar;charset=utf-8');
        });

        setupPDFExport();
    }

    function generateICS(fromYear, fromMonth, toYear, toMonth, type) {
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Hijri Calendar//AL-TAWFIQAT//EN',
            'CALSCALE:GREGORIAN',
            'X-WR-CALNAME:Hijri Calendar',
            'X-WR-TIMEZONE:UTC',
        ];

        let startJDN, endJDN;
        if (type === 'hijri') {
            startJDN = H.hijriToJDN(fromYear, fromMonth, 1);
            endJDN = H.hijriToJDN(toYear, toMonth, H.daysInMonth(toYear, toMonth));
        } else {
            startJDN = H.gregorianToJDN(fromYear, fromMonth, 1);
            const nextM = toMonth === 12 ? 1 : toMonth + 1;
            const nextY = toMonth === 12 ? toYear + 1 : toYear;
            endJDN = H.gregorianToJDN(nextY, nextM, 1) - 1;
        }

        for (let jdn = startJDN; jdn <= endJDN; jdn++) {
            const greg = H.jdnToGregorian(jdn);
            const gregNext = H.jdnToGregorian(jdn + 1);
            const hijri = H.jdnToHijri(jdn);

            const dtStart = pad4(greg.year) + pad2(greg.month) + pad2(greg.day);
            const dtEnd = pad4(gregNext.year) + pad2(gregNext.month) + pad2(gregNext.day);

            const hijriTitle = `${hijri.day} ${H.monthName(hijri.month - 1)} ${hijri.year} ${H.t('hSuffix')}`;
            const gregTitle = `${greg.day} ${H.gregMonthName(greg.month - 1)} ${greg.year} ${H.t('gSuffix')}`;
            const uid = `hijri-${hijri.year}-${hijri.month}-${hijri.day}@al-tawfiqat`;

            lines.push('BEGIN:VEVENT');
            lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
            lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
            lines.push(`SUMMARY:${hijriTitle}`);
            lines.push(`DESCRIPTION:${gregTitle}`);
            lines.push(`UID:${uid}`);
            lines.push('END:VEVENT');
        }

        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function pad4(n) { let s = '' + n; while (s.length < 4) s = '0' + s; return s; }

    async function downloadFile(filename, content, mimeType) {
        if (isNative()) {
            try {
                const { Filesystem, Directory, Encoding } = window.Capacitor.Plugins;
                const { Share } = window.Capacitor.Plugins;
                const result = await Filesystem.writeFile({
                    path: filename,
                    data: content,
                    directory: Directory.Cache,
                    encoding: Encoding.UTF8
                });
                await Share.share({ title: filename, url: result.uri });
            } catch (e) { console.warn('Native share failed', e); }
            return;
        }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ─── أدوات التصحيح ──────────────────────────────────────
    function setupCorrectionControls() {
        document.getElementById('corr-plus').addEventListener('click', () => {
            const current = H.getCorrection(currentYear, currentMonth);
            H.setCorrection(currentYear, currentMonth, current + 1);
            renderCalendar();
            renderTodayInfo();
        });

        document.getElementById('corr-minus').addEventListener('click', () => {
            const current = H.getCorrection(currentYear, currentMonth);
            H.setCorrection(currentYear, currentMonth, current - 1);
            renderCalendar();
            renderTodayInfo();
        });

        document.getElementById('corr-reset').addEventListener('click', () => {
            H.setCorrection(currentYear, currentMonth, 0);
            renderCalendar();
            renderTodayInfo();
        });

        document.getElementById('corr-clear-all').addEventListener('click', () => {
            H.clearCorrections();
            renderCalendar();
            renderTodayInfo();
        });
    }

    function updateCorrectionDisplay() {
        const corr = H.getCorrection(currentYear, currentMonth);
        const corrEl = document.getElementById('corr-value');
        if (corr === 0) {
            corrEl.textContent = '0';
            corrEl.className = 'corr-value';
        } else {
            const sign = corr > 0 ? '+' : '';
            corrEl.textContent = sign + corr;
            corrEl.className = 'corr-value corr-active';
        }

        const all = H.getAllCorrections();
        const listEl = document.getElementById('corrections-list');
        const keys = Object.keys(all).sort();
        if (keys.length === 0) {
            listEl.innerHTML = `<span class="corr-empty">${H.t('noCorrections')}</span>`;
        } else {
            listEl.innerHTML = keys.map(key => {
                const [y, m] = key.split('-').map(Number);
                const sign = all[key] > 0 ? '+' : '';
                return `<span class="corr-tag">${H.monthName(m-1)} ${y}: ${sign}${all[key]}</span>`;
            }).join(' ');
        }
    }

    // ─── عرض التقويم ────────────────────────────────────────
    function renderCalendar() {
        const data = H.getMonthData(currentYear, currentMonth);

        const lang = H.getLang();
        const yearStr = lang === 'ar' ? H.toArabicNumerals(data.year) : data.year;
        const monthTitleEl = document.getElementById('month-title');
        monthTitleEl.textContent = `${data.monthName} ${yearStr} ${H.t('hSuffix')}`;
        document.querySelector('.nav-bar')?.classList.toggle('sacred-month', H.isSacredMonth(currentMonth));

        document.getElementById('gregorian-range').textContent = data.gregorianRange;

        const leapBadge = document.getElementById('leap-badge');
        leapBadge.style.display = 'none';

        // رؤوس الأيام الديناميكية
        const headersEl = document.getElementById('day-headers');
        headersEl.innerHTML = '';
        const weekHeader = document.createElement('div');
        weekHeader.className = 'day-header week-header';
        weekHeader.textContent = H.t('weekCol');
        headersEl.appendChild(weekHeader);
        data.orderedDayNames.forEach((name, i) => {
            const dh = document.createElement('div');
            dh.className = 'day-header';
            if (i === 5 || i === 6) dh.classList.add('day-header-weekend');
            dh.textContent = name;
            headersEl.appendChild(dh);
        });

        // شبكة التقويم
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        data.days.forEach((day, idx) => {
            if (idx % 7 === 0) {
                const weekCell = document.createElement('div');
                weekCell.className = 'week-number';
                weekCell.textContent = day.weekNumber;
                grid.appendChild(weekCell);
            }

            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            if (day.isOtherMonth) cell.classList.add('other-month');
            if (day.isToday) cell.classList.add('today');

            const hijriNum = document.createElement('span');
            hijriNum.className = 'hijri-day';
            hijriNum.textContent = day.hijriDay;
            cell.appendChild(hijriNum);

            const gregNum = document.createElement('span');
            gregNum.className = 'greg-day';
            gregNum.textContent = day.gregorian.day;
            cell.appendChild(gregNum);

            // Islamic events
            const hijriFromDay = H.jdnToHijri(day.jdn);
            const event = H.getEvent(hijriFromDay.month, hijriFromDay.day);
            if (event && !day.isOtherMonth) {
                const dot = document.createElement('span');
                dot.className = 'event-dot event-' + event.type;
                cell.appendChild(dot);
                cell.classList.add('has-event');
            }

            // مؤشر بداية طالع/موسم جديد
            if (!day.isOtherMonth) {
                const gd = day.gregorian;
                const tale3 = H.getTale3(gd.month, gd.day);
                const prevGreg = H.jdnToGregorian(day.jdn - 1);
                const prevTale3 = H.getTale3(prevGreg.month, prevGreg.day);
                if (tale3 && (!prevTale3 || tale3.nameAr !== prevTale3.nameAr)) {
                    const starDot = document.createElement('span');
                    starDot.className = 'anwa-dot anwa-dot-tale3';
                    starDot.title = tale3.name;
                    cell.appendChild(starDot);
                }
            }

            // رمز طور القمر في الخلية
            if (!day.isOtherMonth) {
                const gd = day.gregorian;
                const moon = H.getMoonPhase(gd.year, gd.month, gd.day);
                if (moon) {
                    const moonSpan = document.createElement('span');
                    moonSpan.className = 'cell-moon-phase';
                    moonSpan.textContent = moon.symbol;
                    moonSpan.title = moon.name;
                    cell.appendChild(moonSpan);
                }
            }

            const gregDate = `${day.gregorian.year}/${day.gregorian.month}/${day.gregorian.day}`;
            let titleText = `${H.dayName(day.dayOfWeek)} — ${gregDate}`;
            if (event) titleText += `\n${event.name}`;
            cell.title = titleText;

            if ((idx % 7) === 5 || (idx % 7) === 6) cell.classList.add('weekend-col');

            cell.addEventListener('click', (e) => selectDay(day, e));
            grid.appendChild(cell);
        });

        updateInfoBar(null);
        updateCorrectionDisplay();
    }

    // ─── معلومات اليوم ──────────────────────────────────────
    function renderTodayInfo() {
        const today = H.todayHijri();
        const now = new Date();
        const jdn = H.todayJDN();
        const dow = H.dayOfWeek(jdn);

        const tLang = H.getLang();
        const tDay = tLang === 'ar' ? H.toArabicNumerals(today.day) : today.day;
        const tYear = tLang === 'ar' ? H.toArabicNumerals(today.year) : today.year;
        let hijriText = `${H.dayName(dow)}، ${tDay} ${H.monthName(today.month-1)} ${tYear} ${H.t('hSuffix')}`;
        const event = H.getEvent(today.month, today.day);
        if (event) {
            hijriText += ` — ${event.name}`;
        }
        const todayHijriEl = document.getElementById('today-hijri');
        if (H.isSacredMonth(today.month)) {
            todayHijriEl.innerHTML = hijriText + '<span class="sacred-month-badge"> ✦</span>';
            todayHijriEl.closest('.today-card')?.classList.add('sacred-month');
        } else {
            todayHijriEl.textContent = hijriText;
            todayHijriEl.closest('.today-card')?.classList.remove('sacred-month');
        }

        document.getElementById('today-gregorian').textContent =
            `${now.getDate()} ${H.gregMonthName(now.getMonth())} ${now.getFullYear()}${H.t('gSuffix')}`;

        // الأنواء والمواسم
        _renderAnwaLine(now.getMonth() + 1, now.getDate(), now.getFullYear(), 'today-anwa');
    }

    /** عرض سطر الأنواء (الطالع • الموسم • الدر • القمر) */
    function _renderAnwaLine(gMonth, gDay, gYear, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const tale3 = H.getTale3(gMonth, gDay);
        const season = H.getSeason(gMonth, gDay);
        const durr = H.getDurr(gMonth, gDay, gYear);
        const moon = H.getMoonPhase(gYear, gMonth, gDay);

        const parts = [];
        if (tale3) parts.push(`${H.t('tale3Label')}: ${tale3.name}`);
        if (season) parts.push(`${H.t('seasonLabel')}: ${season.name}`);
        if (durr) parts.push(`${_formatDurrName(durr)} (${H.t('suhailLabel')} ${durr.suhailDay})`);
        if (moon) parts.push(`${moon.symbol} ${moon.name}`);

        el.textContent = parts.join(' • ');
    }

    /** عرض بطاقة الأنواء المفصلة — تقبل تاريخ ميلادي اختياري */
    function renderAnwaCard(gregDate) {
        let gMonth, gDay, gYear;
        if (gregDate) {
            gMonth = gregDate.month;
            gDay = gregDate.day;
            gYear = gregDate.year;
        } else {
            const now = new Date();
            gMonth = now.getMonth() + 1;
            gDay = now.getDate();
            gYear = now.getFullYear();
        }

        const tale3 = H.getTale3(gMonth, gDay);
        const season = H.getSeason(gMonth, gDay);
        const durr = H.getDurr(gMonth, gDay, gYear);

        // تعبئة القيم
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setVal('anwa-tale3', tale3 ? tale3.name : '—');
        setVal('anwa-season', season ? season.name : '—');
        setVal('anwa-durr', durr ? _formatDurrName(durr) : '—');
        setVal('anwa-suhail', durr ? durr.suhailDay : '—');
        setVal('anwa-mia', durr ? durr.mia : '—');

        // وصف حالة الطقس
        setVal('anwa-weather', tale3 ? tale3.weather : '');

        // طور القمر (مع إحداثيات المستخدم للمد والجزر)
        let userLat = 0, userLng = 0;
        if (typeof PT !== 'undefined' && PT.getSettings) {
            const ps = PT.getSettings();
            userLat = ps.lat || 0;
            userLng = ps.lng || 0;
        }
        const moon = H.getMoonPhase(gYear, gMonth, gDay, userLat, userLng);
        if (moon) {
            setVal('moon-symbol', moon.symbol);
            setVal('moon-name', moon.name);
            const ageText = `${moon.age} ${H.t('moonAgeDays')}`;
            const illumText = `${H.t('moonIllumination')}: ${moon.illumination}%`;
            setVal('moon-details', `${ageText} — ${illumText}`);
            const bar = document.getElementById('moon-bar');
            if (bar) bar.style.width = moon.illumination + '%';

            // الطور القادم
            setVal('moon-next-label', H.t('moonNextPhase'));
            const np = moon.nextPhase;
            setVal('moon-next-value', `${np.symbol} ${np.name} — ${H.t('moonDaysLeft')} ${np.daysRemaining} ${H.t('moonAgeDays')}`);

            // المد والجزر — أحداث مرتبة زمنياً
            const tide = moon.tide;
            setVal('tide-type', tide.type);
            const eventsEl = document.getElementById('tide-events');
            if (eventsEl) {
                eventsEl.innerHTML = tide.events.map(ev =>
                    `<div class="tide-event tide-event-${ev.type}">` +
                    `<span class="tide-event-label">${ev.label}</span>` +
                    `<span class="tide-event-time">${ev.time}</span>` +
                    `</div>`
                ).join('');
            }

            // شريط قوة المد
            const tideSec = document.getElementById('tide-section');
            if (tideSec) {
                tideSec.className = 'tide-section';
                if (tide.strength >= 90) tideSec.classList.add('tide-spring');
                else if (tide.strength <= 40) tideSec.classList.add('tide-neap');
            }
        }

        // ── ولادة الهلال — فقط عند اختيار أول يوم من الشهر الهجري ──
        const hilalSec = document.getElementById('hilal-section');
        if (hilalSec) {
            const hijriDate = H.gregorianToHijri(gYear, gMonth, gDay);
            let hilal = null;
            if (hijriDate.day === 1) {
                let userTz = 0;
                if (typeof PT !== 'undefined' && PT.getSettings) {
                    const ps = PT.getSettings();
                    userLat = ps.lat || 0;
                    userLng = ps.lng || 0;
                    userTz = ps.tz || 0;
                }
                hilal = H.getHilalInfo(hijriDate.year, hijriDate.month, userLat, userLng, userTz);
            }
            if (hilal) {
                hilalSec.style.display = '';
                setVal('hilal-title', H.t('hilalTitle'));
                const detailsEl = document.getElementById('hilal-details');
                if (detailsEl) {
                    const lang = H.getLang();
                    const conjLabel = H.t('hilalConjunction');
                    const ageLabel = H.t('hilalMoonAge');
                    const altLabel = H.t('hilalAltitude');
                    const elongLabel = H.t('hilalElongation');
                    const visLabel = H.t('hilalVisibility');
                    const hrsLabel = H.t('hilalHours');
                    const degLabel = H.t('hilalDegree');
                    const dirLabel = H.t('hilalDirection');
                    const sunsetLabel = H.t('hilalAtSunset');

                    // تقييم الرؤية: لون مختلف حسب المستوى
                    let visClass = 'hilal-vis-impossible';
                    if (hilal.moonAge >= 21 && hilal.elongation >= 12 && hilal.arcv >= 6) {
                        visClass = 'hilal-vis-visible';
                    } else if (hilal.moonAge >= 17 && hilal.elongation >= 10) {
                        visClass = 'hilal-vis-possible';
                    } else if (hilal.moonAge >= 12) {
                        visClass = 'hilal-vis-difficult';
                    }

                    detailsEl.innerHTML =
                        `<div class="hilal-grid">` +
                        `<div class="hilal-item">` +
                        `<span class="hilal-label">${conjLabel}</span>` +
                        `<span class="hilal-value">${hilal.conjunction.date}</span>` +
                        `<span class="hilal-value hilal-time">${hilal.conjunction.time}</span>` +
                        `</div>` +
                        `<div class="hilal-item">` +
                        `<span class="hilal-label">${sunsetLabel}</span>` +
                        `<span class="hilal-value">${hilal.sunset.date}</span>` +
                        `<span class="hilal-value hilal-time">${hilal.sunset.time}</span>` +
                        `</div>` +
                        `<div class="hilal-item">` +
                        `<span class="hilal-label">${ageLabel}</span>` +
                        `<span class="hilal-value">${hilal.moonAge} ${hrsLabel}</span>` +
                        `</div>` +
                        `<div class="hilal-item">` +
                        `<span class="hilal-label">${altLabel}</span>` +
                        `<span class="hilal-value">${hilal.altitude}${degLabel}</span>` +
                        `</div>` +
                        `<div class="hilal-item">` +
                        `<span class="hilal-label">${elongLabel}</span>` +
                        `<span class="hilal-value">${hilal.elongation}${degLabel}</span>` +
                        `</div>` +
                        `<div class="hilal-item">` +
                        `<span class="hilal-label">${dirLabel}</span>` +
                        `<span class="hilal-value">${hilal.azimuthDir} (${hilal.azimuth}${degLabel})</span>` +
                        `</div>` +
                        `<div class="hilal-item hilal-vis-item">` +
                        `<span class="hilal-label">${visLabel}</span>` +
                        `<span class="hilal-value ${visClass}">${hilal.visibility}</span>` +
                        `</div>` +
                        `</div>`;
                }
            } else {
                hilalSec.style.display = 'none';
            }
        }

        // العناصر الإثرائية الجديدة
        const winds = H.getSeasonalWinds(gMonth, gDay);
        const fish = H.getSeasonalFish(gMonth, gDay).filter(f => f.inSeason);
        const crops = H.getSeasonalCrops(gMonth, gDay).filter(c => c.inSeason);
        const wildlife = H.getSeasonalWildlife(gMonth, gDay).filter(w => w.inSeason);

        setVal('anwa-wind', winds.length > 0 ? winds.map(w => w.name).slice(0, 2).join('، ') : '—');
        setVal('anwa-fish', fish.length > 0 ? fish.map(f => f.name).slice(0, 2).join('، ') : '—');
        setVal('anwa-crops', crops.length > 0 ? crops.map(c => c.name).slice(0, 2).join('، ') : '—');
        setVal('anwa-wildlife', wildlife.length > 0 ? wildlife.map(w => w.name).slice(0, 2).join('، ') : '—');

        // تحديث العناوين حسب اللغة
        setVal('anwa-card-title', H.t('anwaTitle'));
        setVal('anwa-tale3-lbl', H.t('tale3Label'));
        setVal('anwa-season-lbl', H.t('seasonLabel'));
        setVal('anwa-durr-lbl', H.t('durrLabel'));
        setVal('anwa-suhail-lbl', H.t('suhailLabel'));
        setVal('anwa-mia-lbl', H.getLang() === 'en' ? 'Hundred' : 'المائة');
        setVal('anwa-wind-lbl', H.t('windLabel'));
        setVal('anwa-fish-lbl', H.t('fishLabel'));
        setVal('anwa-crops-lbl', H.t('cropsLabel'));
        setVal('anwa-wildlife-lbl', H.t('wildlifeLabel'));

        // جعل العناصر قابلة للنقر
        const anwaGrid = document.getElementById('anwa-grid');
        if (anwaGrid) {
            const types = ['tale3', 'season', 'durr', 'suhail', 'mia', 'wind', 'fish', 'crops', 'wildlife'];
            const clickableTypes = ['tale3', 'season', 'durr', 'wind', 'fish', 'crops', 'wildlife'];
            const items = anwaGrid.querySelectorAll('.anwa-item');
            items.forEach((item, i) => {
                const type = types[i];
                if (clickableTypes.includes(type)) {
                    item.classList.add('anwa-clickable');
                    item.onclick = () => showAnwaDetail(type, { year: gYear, month: gMonth, day: gDay });
                }
            });
        }
    }

    // ─── اختيار يوم ─────────────────────────────────────────
    function selectDay(day, e) {
        updateInfoBar(day);
        document.querySelectorAll('.calendar-cell.selected').forEach(el => el.classList.remove('selected'));
        e.currentTarget.classList.add('selected');

        // Update prayer times for the selected date
        if (day) {
            const g = day.gregorian;
            _selectedDate = { year: g.year, month: g.month, day: g.day };
            if (PT) renderPrayerTimes();
        }
    }

    function updateInfoBar(day) {
        const infoBar = document.getElementById('selected-info');
        if (!day) {
            infoBar.textContent = H.t('clickDay');
            return;
        }

        const greg = day.gregorian;
        const hijriFromJDN = H.jdnToHijri(day.jdn);
        let html =
            `${H.dayName(day.dayOfWeek)}، ${hijriFromJDN.day} ${H.monthName(hijriFromJDN.month-1)} ${hijriFromJDN.year} ${H.t('hSuffix')}` +
            ` — ` +
            `${greg.day} ${H.gregMonthName(greg.month-1)} ${greg.year}${H.t('gSuffix')}`;

        const event = H.getEvent(hijriFromJDN.month, hijriFromJDN.day);
        if (event) {
            html += ` <span class="info-event info-event-${event.type}">★ ${event.name}</span>`;
        }

        // الأنواء والمواسم
        const tale3 = H.getTale3(greg.month, greg.day);
        const season = H.getSeason(greg.month, greg.day);
        const durr = H.getDurr(greg.month, greg.day, greg.year);
        const moon = H.getMoonPhase(greg.year, greg.month, greg.day);

        const anwaParts = [];
        if (tale3) anwaParts.push(tale3.name);
        if (season) anwaParts.push(season.name);
        if (durr) anwaParts.push(`${_formatDurrName(durr)} (${H.t('suhailLabel')} ${durr.suhailDay})`);
        if (moon) anwaParts.push(`${moon.symbol} ${moon.name}`);

        if (anwaParts.length) {
            html += `<div class="info-anwa">${anwaParts.join(' • ')}</div>`;
        }

        infoBar.innerHTML = html;
    }

    // ─── مواقيت الصلاة ──────────────────────────────────────
    function setupPrayerTimes() {
        // Populate method dropdown
        const methodSelect = document.getElementById('prayer-method-select');
        const lang = H.getLang();
        Object.values(PT.METHODS).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = lang === 'en' ? m.nameEn : m.nameAr;
            methodSelect.appendChild(opt);
        });

        // Populate high-lat dropdown
        const highLatSelect = document.getElementById('prayer-highlat-select');
        Object.values(PT.HIGH_LAT).forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = lang === 'en' ? h.nameEn : h.nameAr;
            highLatSelect.appendChild(opt);
        });

        // Load saved settings into UI
        const s = PT.getSettings();
        methodSelect.value = s.method;
        document.getElementById('prayer-asr-select').value = s.asrFactor;
        highLatSelect.value = s.highLat;
        if (s.lat) document.getElementById('prayer-lat').value = s.lat;
        if (s.lng) document.getElementById('prayer-lng').value = s.lng;
        if (s.tz) document.getElementById('prayer-tz').value = s.tz;
        if (s.elevation) document.getElementById('prayer-elevation').value = s.elevation;

        // Time format toggle
        const tfToggle = document.getElementById('timeformat-toggle');
        if (tfToggle) tfToggle.checked = s.timeFormat === '12h';

        // Settings toggle
        document.getElementById('prayer-settings-toggle').addEventListener('click', () => {
            const panel = document.getElementById('prayer-settings');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        // Save on change
        const saveAndRender = () => {
            PT.setSettings({
                method: methodSelect.value,
                asrFactor: parseInt(document.getElementById('prayer-asr-select').value),
                highLat: highLatSelect.value,
                lat: parseFloat(document.getElementById('prayer-lat').value) || 0,
                lng: parseFloat(document.getElementById('prayer-lng').value) || 0,
                tz: parseFloat(document.getElementById('prayer-tz').value) || 0,
                elevation: parseFloat(document.getElementById('prayer-elevation').value) || 0,
                timeFormat: document.getElementById('timeformat-toggle').checked ? '12h' : '24h',
            });
            renderPrayerTimes();
        };

        // Time format toggle change
        if (tfToggle) {
            tfToggle.addEventListener('change', () => {
                saveAndRender();
                const dvPanel = document.getElementById('day-view-panel');
                if (dvPanel && dvPanel.style.display !== 'none') showDayView(null);
            });
        }

        methodSelect.addEventListener('change', saveAndRender);
        document.getElementById('prayer-asr-select').addEventListener('change', saveAndRender);
        highLatSelect.addEventListener('change', saveAndRender);
        document.getElementById('prayer-lat').addEventListener('change', saveAndRender);
        document.getElementById('prayer-lng').addEventListener('change', saveAndRender);
        document.getElementById('prayer-tz').addEventListener('change', saveAndRender);
        document.getElementById('prayer-elevation').addEventListener('change', saveAndRender);

        // Reverse geocode to get city name in a given language
        const reverseGeocode = async (lat, lng, lang) => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${lang || 'ar'}&addressdetails=1`, {
                    headers: { 'User-Agent': 'HijriCalendar/2.0' }
                });
                if (!res.ok) return { city: '', suburb: '' };
                const data = await res.json();
                const addr = data.address || {};
                // If city equals village (small settlement), prefer county as real city
                const isVillageCity = addr.city && addr.village && addr.county;
                const city = isVillageCity ? addr.county : (addr.city || addr.town || addr.county || addr.village || addr.state || data.display_name || '');
                const neighbourhood = addr.neighbourhood || addr.quarter || '';
                const suburb = addr.suburb || (isVillageCity ? addr.village : (addr.village && addr.county ? addr.village : '')) || '';
                return { city, suburb, neighbourhood };
            } catch (e) { return { city: '', suburb: '' }; }
        };

        // Detect location buttons
        const detectLocation = async () => {
            const fillLocation = async (lat, lng, altitude) => {
                document.getElementById('prayer-lat').value = Math.round(lat * 100) / 100;
                document.getElementById('prayer-lng').value = Math.round(lng * 100) / 100;
                document.getElementById('prayer-tz').value = -new Date().getTimezoneOffset() / 60;
                if (altitude) {
                    document.getElementById('prayer-elevation').value = Math.round(altitude);
                }
                // Reverse geocode for city + suburb in both languages
                const [ar, en] = await Promise.all([
                    reverseGeocode(lat, lng, 'ar'),
                    reverseGeocode(lat, lng, 'en')
                ]);
                try {
                    localStorage.setItem('prayer-loc', JSON.stringify({
                        lat, lng,
                        nameAr: ar.city, nameEn: en.city,
                        suburbAr: ar.suburb, suburbEn: en.suburb,
                        neighbourhoodAr: ar.neighbourhood, neighbourhoodEn: en.neighbourhood,
                        name: ar.city || en.city
                    }));
                } catch (e) {}
                saveAndRender();
                // Re-render day view to update location display
                if (document.getElementById('day-view').style.display !== 'none') {
                    renderDayView(_selectedDate);
                }
            };
            if (isNative()) {
                try {
                    const { Geolocation } = window.Capacitor.Plugins;
                    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
                    await fillLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude);
                } catch (e) { console.warn('Native geolocation failed', e); }
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async pos => {
                    await fillLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude);
                });
            }
        };
        document.getElementById('prayer-detect').addEventListener('click', detectLocation);
        document.getElementById('prayer-detect-main').addEventListener('click', detectLocation);

        // If coords exist but no city name yet, run reverse geocode only
        const currentSettings = PT.getSettings();
        if (currentSettings.lat && currentSettings.lng && !localStorage.getItem('prayer-loc')) {
            detectLocation();
        }

        // Timetable toggle
        const ttToggle = document.getElementById('timetable-toggle');
        if (ttToggle) {
            ttToggle.addEventListener('click', () => {
                const container = document.getElementById('timetable-container');
                if (container.style.display === 'none') {
                    container.style.display = 'block';
                    renderMonthlyTimetable();
                } else {
                    container.style.display = 'none';
                }
            });
        }
    }

    function renderPrayerTimes() {
        if (!PT) return;
        const s = PT.getSettings();

        // Check if location is set
        if (!s.lat && !s.lng) {
            document.getElementById('prayer-no-location').style.display = 'flex';
            document.getElementById('prayer-grid').style.display = 'none';
            document.getElementById('prayer-countdown').style.display = 'none';
            document.getElementById('prayer-method-info').style.display = 'none';
            return;
        }

        document.getElementById('prayer-no-location').style.display = 'none';
        document.getElementById('prayer-grid').style.display = 'grid';

        // Show current method name
        const methodInfo = document.getElementById('prayer-method-info');
        const method = PT.METHODS[s.method];
        if (method) {
            const lang = H.getLang();
            document.getElementById('prayer-method-name').textContent = lang === 'en' ? method.nameEn : method.nameAr;
            methodInfo.style.display = 'block';
        }

        // Determine date for prayer times
        let times;
        const isSelectedDate = _selectedDate !== null;
        if (isSelectedDate) {
            const hijri = H.gregorianToHijri(_selectedDate.year, _selectedDate.month, _selectedDate.day);
            const isRamadan = hijri.month === 9;
            times = PT.getForDate(_selectedDate, isRamadan);
        } else {
            const todayH = H.todayHijri();
            const isRamadan = todayH.month === 9;
            times = PT.getForToday(isRamadan);
        }

        const localizeTime = (t) => {
            if (H.getLang() === 'ar') return t.replace('AM', H.t('timeAM')).replace('PM', H.t('timePM'));
            return t;
        };
        document.getElementById('p-fajr').textContent = localizeTime(times.fajr);
        document.getElementById('p-sunrise').textContent = localizeTime(times.sunrise);
        document.getElementById('p-dhuhr').textContent = localizeTime(times.dhuhr);
        document.getElementById('p-asr').textContent = localizeTime(times.asr);
        document.getElementById('p-maghrib').textContent = localizeTime(times.maghrib);
        document.getElementById('p-isha').textContent = localizeTime(times.isha);

        // Date indicator for selected date
        const dateIndicator = document.getElementById('prayer-date-indicator');
        const countdownEl = document.getElementById('prayer-countdown');
        if (isSelectedDate) {
            // Show date indicator, hide countdown
            if (dateIndicator) {
                const d = _selectedDate;
                const hijri = H.gregorianToHijri(d.year, d.month, d.day);
                const jdn = H.gregorianToJDN(d.year, d.month, d.day);
                const dow = H.dayOfWeek(jdn);
                dateIndicator.innerHTML =
                    `<span class="prayer-date-text">${H.dayName(dow)}، ${hijri.day} ${H.monthName(hijri.month-1)} ${hijri.year} ${H.t('hSuffix')}` +
                    ` — ${d.year}/${d.month}/${d.day}</span>` +
                    `<button class="prayer-date-reset" id="prayer-date-reset">✕</button>`;
                dateIndicator.style.display = 'flex';
                document.getElementById('prayer-date-reset').addEventListener('click', () => {
                    _selectedDate = null;
                    document.querySelectorAll('.calendar-cell.selected').forEach(el => el.classList.remove('selected'));
                    renderPrayerTimes();
                });
            }
            countdownEl.style.display = 'none';
            // Remove next-prayer highlights
            document.querySelectorAll('.prayer-item.prayer-next').forEach(el => el.classList.remove('prayer-next'));
            if (_prayerTimer) { clearInterval(_prayerTimer); _prayerTimer = null; }
        } else {
            // Today — show countdown, hide date indicator
            if (dateIndicator) dateIndicator.style.display = 'none';
            countdownEl.style.display = 'block';
            _updatePrayerCountdown(times);
            if (_prayerTimer) clearInterval(_prayerTimer);
            _prayerTimer = setInterval(() => _updatePrayerCountdown(times), 30000);
        }

        // Ramadan night counter
        const hijriForRamadan = isSelectedDate
            ? H.gregorianToHijri(_selectedDate.year, _selectedDate.month, _selectedDate.day)
            : H.todayHijri();
        renderRamadanSection(hijriForRamadan, times);

        // Sun arc
        renderSunArc(times, !isSelectedDate);
    }

    function _updatePrayerCountdown(times) {
        const now = new Date();
        const nowHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

        const prayerKeys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const prayerLabels = {
            fajr: H.t('prayerFajr'), sunrise: H.t('prayerSunrise'),
            dhuhr: H.t('prayerDhuhr'), asr: H.t('prayerAsr'),
            maghrib: H.t('prayerMaghrib'), isha: H.t('prayerIsha')
        };

        // Remove previous highlights
        document.querySelectorAll('.prayer-item.prayer-next').forEach(el => el.classList.remove('prayer-next'));

        let nextPrayer = null;
        let nextTime = null;

        for (const key of prayerKeys) {
            const raw = times._raw[key];
            if (raw !== null && raw > nowHours) {
                nextPrayer = key;
                nextTime = raw;
                break;
            }
        }

        if (!nextPrayer) {
            // All prayers passed — next is Fajr tomorrow
            nextPrayer = 'fajr';
            nextTime = times._raw.fajr !== null ? times._raw.fajr + 24 : null;
        }

        // Highlight
        const items = document.querySelectorAll('.prayer-item');
        const idx = prayerKeys.indexOf(nextPrayer);
        if (idx >= 0 && items[idx]) items[idx].classList.add('prayer-next');

        // Countdown
        const countdownEl = document.getElementById('prayer-countdown');
        if (nextTime !== null) {
            const diff = nextTime - nowHours;
            const h = Math.floor(diff);
            const m = Math.floor((diff - h) * 60);
            document.getElementById('prayer-next-name').textContent = prayerLabels[nextPrayer];
            document.getElementById('prayer-next-time').textContent = `${h}:${String(m).padStart(2, '0')}`;
            countdownEl.style.display = 'block';
        } else {
            countdownEl.style.display = 'none';
        }
    }

    // ─── الجدول الشهري ───────────────────────────────────────
    function setupMonthlyTimetable() {
        // Already called from prayer settings setup
    }

    function renderMonthlyTimetable() {
        if (!PT) return;
        const container = document.getElementById('timetable-body');
        if (!container) return;
        const s = PT.getSettings();
        if (!s.lat && !s.lng) { container.innerHTML = ''; return; }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayDate = now.getDate();
        const todayH = H.todayHijri();
        const isRamadan = todayH.month === 9;

        let html = '<table class="timetable"><thead><tr>';
        html += `<th>${H.t('timetableDay')}</th><th>${H.t('timetableHijriDate')}</th><th>${H.t('timetableDate')}</th>`;
        html += `<th>${H.t('prayerFajr')}</th><th>${H.t('prayerSunrise')}</th>`;
        html += `<th>${H.t('prayerDhuhr')}</th><th>${H.t('prayerAsr')}</th>`;
        html += `<th>${H.t('prayerMaghrib')}</th><th>${H.t('prayerIsha')}</th>`;
        html += '</tr></thead><tbody>';

        const rows = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = { year, month: month + 1, day: d };
            const times = PT.calculate(date, s.lat, s.lng, s.tz, s.method, s.asrFactor, s.highLat, s.elevation, isRamadan);
            const hijri = H.gregorianToHijri(year, month + 1, d);
            const isToday = d === todayDate;
            const dayName = H.dayName(H.dayOfWeek(H.gregorianToJDN(year, month + 1, d)));
            const hijriDate = `${hijri.month}/${hijri.day}`;
            const gregDate = `${month + 1}/${d}`;

            html += `<tr class="${isToday ? 'timetable-today' : ''}">`;
            html += `<td>${dayName}</td>`;
            html += `<td class="tt-time">${hijriDate}</td>`;
            html += `<td class="tt-time">${gregDate}</td>`;
            html += `<td class="tt-time">${times.fajr}</td><td class="tt-time">${times.sunrise}</td>`;
            html += `<td class="tt-time">${times.dhuhr}</td><td class="tt-time">${times.asr}</td>`;
            html += `<td class="tt-time">${times.maghrib}</td><td class="tt-time">${times.isha}</td>`;
            html += '</tr>';

            rows.push({ day: d, dayName, hijriDate, date: gregDate, ...times });
        }
        html += '</tbody></table>';
        container.innerHTML = html;

        // CSV download button
        const csvBtn = document.getElementById('timetable-csv');
        if (csvBtn) {
            csvBtn.onclick = () => {
                let csv = `${H.t('timetableDay')},${H.t('timetableHijriDate')},${H.t('timetableDate')},${H.t('prayerFajr')},${H.t('prayerSunrise')},${H.t('prayerDhuhr')},${H.t('prayerAsr')},${H.t('prayerMaghrib')},${H.t('prayerIsha')}\n`;
                rows.forEach(r => {
                    csv += `${r.dayName},${r.hijriDate},${r.date},${r.fajr},${r.sunrise},${r.dhuhr},${r.asr},${r.maghrib},${r.isha}\n`;
                });
                downloadFile('prayer-timetable.csv', csv, 'text/csv;charset=utf-8');
            };
        }
    }

    // ─── الإشعارات ──────────────────────────────────────────
    function setupNotifications() {
        const toggle = document.getElementById('notify-toggle');
        const beforeSelect = document.getElementById('notify-before');
        if (!toggle) return;

        let enabled = false;
        let beforeMin = 5;
        try {
            enabled = localStorage.getItem('prayer-notify') === 'true';
            beforeMin = parseInt(localStorage.getItem('prayer-notify-before')) || 5;
        } catch (e) {}

        toggle.checked = enabled;
        if (beforeSelect) beforeSelect.value = beforeMin;

        toggle.addEventListener('change', async () => {
            if (toggle.checked) {
                const granted = await _requestNotifyPermission();
                if (!granted) { toggle.checked = false; return; }
                _saveNotifySettings(true, beforeMin);
                scheduleNotifications();
            } else {
                _saveNotifySettings(false, beforeMin);
                clearNotificationTimers();
            }
        });

        if (beforeSelect) {
            beforeSelect.addEventListener('change', () => {
                beforeMin = parseInt(beforeSelect.value) || 5;
                _saveNotifySettings(toggle.checked, beforeMin);
                if (toggle.checked) scheduleNotifications();
            });
        }

        _updateNotifyStatus();
        if (enabled) {
            _requestNotifyPermission().then(granted => {
                if (granted) scheduleNotifications();
            });
        }
    }

    async function _requestNotifyPermission() {
        if (isNative()) {
            try {
                const { LocalNotifications } = window.Capacitor.Plugins;
                const result = await LocalNotifications.requestPermissions();
                return result.display === 'granted';
            } catch (e) { return false; }
        }
        if ('Notification' in window) {
            if (Notification.permission === 'granted') return true;
            const perm = await Notification.requestPermission();
            return perm === 'granted';
        }
        return false;
    }

    function _saveNotifySettings(enabled, before) {
        try {
            localStorage.setItem('prayer-notify', enabled);
            localStorage.setItem('prayer-notify-before', before);
        } catch (e) {}
    }

    function _updateNotifyStatus() {
        const statusEl = document.getElementById('notify-status');
        if (!statusEl) return;
        if (isNative()) {
            statusEl.textContent = H.t('notifyGranted');
            statusEl.className = 'notify-status notify-granted';
            return;
        }
        if (!('Notification' in window)) {
            statusEl.textContent = '—';
            return;
        }
        const perm = Notification.permission;
        statusEl.textContent = H.t(perm === 'granted' ? 'notifyGranted' : perm === 'denied' ? 'notifyDenied' : 'notifyDefault');
        statusEl.className = 'notify-status notify-' + perm;
    }

    async function clearNotificationTimers() {
        _notifyTimers.forEach(t => clearTimeout(t));
        _notifyTimers = [];
        if (isNative()) {
            try {
                const { LocalNotifications } = window.Capacitor.Plugins;
                const pending = await LocalNotifications.getPending();
                if (pending.notifications.length) {
                    await LocalNotifications.cancel(pending);
                }
            } catch (e) {}
        }
    }

    async function scheduleNotifications() {
        await clearNotificationTimers();
        if (!PT) return;

        const s = PT.getSettings();
        if (!s.lat && !s.lng) return;

        let beforeMin = 5;
        try { beforeMin = parseInt(localStorage.getItem('prayer-notify-before')) || 5; } catch (e) {}

        const todayH = H.todayHijri();
        const times = PT.getForToday(todayH.month === 9);
        const now = new Date();
        const nowMs = now.getTime();

        const prayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const prayerLabels = {
            fajr: H.t('prayerFajr'), dhuhr: H.t('prayerDhuhr'),
            asr: H.t('prayerAsr'), maghrib: H.t('prayerMaghrib'), isha: H.t('prayerIsha')
        };

        if (isNative()) {
            const { LocalNotifications } = window.Capacitor.Plugins;
            const notifications = [];
            let id = 1;
            for (const key of prayerKeys) {
                const raw = times._raw[key];
                if (raw === null) continue;
                const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                    Math.floor(raw), Math.round((raw % 1) * 60));
                const notifyAt = new Date(prayerDate.getTime() - beforeMin * 60000);
                if (notifyAt.getTime() > nowMs) {
                    notifications.push({
                        id: id++,
                        title: H.t('prayerTitle'),
                        body: `${prayerLabels[key]} — ${times[key]}`,
                        schedule: { at: notifyAt },
                        sound: 'default'
                    });
                }
            }
            if (notifications.length) {
                try { await LocalNotifications.schedule({ notifications }); } catch (e) {}
            }
            return;
        }

        // Web fallback
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        for (const key of prayerKeys) {
            const raw = times._raw[key];
            if (raw === null) continue;
            const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                Math.floor(raw), Math.round((raw % 1) * 60));
            const notifyAt = prayerDate.getTime() - beforeMin * 60000;
            const delay = notifyAt - nowMs;
            if (delay > 0) {
                const timer = setTimeout(() => {
                    new Notification(H.t('prayerTitle'), {
                        body: `${prayerLabels[key]} — ${times[key]}`,
                        icon: 'icon-192.svg',
                        tag: 'prayer-' + key
                    });
                }, delay);
                _notifyTimers.push(timer);
            }
        }

        // AI smart notifications
        scheduleAINotifications();
    }

    async function scheduleAINotifications() {
        if (!AI) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const now = new Date();
        const days = [];
        for (let i = 0; i < 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            const jdn = H.gregorianToJDN(d.getFullYear(), d.getMonth() + 1, d.getDate());
            const hij = H.jdnToHijri(jdn);
            const dow = H.dayOfWeek(jdn);
            const event = H.getEvent(hij.month, hij.day);
            const moon = H.getMoonPhase(d.getFullYear(), d.getMonth() + 1, d.getDate());
            days.push({
                gregDate: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
                dayOfWeek: H.dayName(dow),
                hijriDay: hij.day,
                hijriMonthName: H.monthName(hij.month - 1),
                islamicEvent: event ? event.name : '',
                moonPhase: moon ? moon.name : '',
                isNewMoon: moon ? moon.phaseFraction < 0.03 : false
            });
        }

        try {
            const notifications = await AI.fetchSmartNotifications(days);
            if (!notifications || !notifications.length) return;

            // Schedule today's AI notifications
            const todayStr = days[0].gregDate;
            const todayNotifs = notifications.find(n => n.date === todayStr);
            if (!todayNotifs || !todayNotifs.notifications) return;

            const prayerTimes = PT ? PT.getForToday(false) : null;
            const timeMap = {};
            if (prayerTimes && prayerTimes._raw) {
                timeMap.fajr = prayerTimes._raw.fajr;
                timeMap.sunrise = prayerTimes._raw.sunrise;
                timeMap.dhuhr = prayerTimes._raw.dhuhr;
                timeMap.asr = prayerTimes._raw.asr;
                timeMap.maghrib = prayerTimes._raw.maghrib;
                timeMap.isha = prayerTimes._raw.isha;
                timeMap.morning = 7;    // 7 AM
                timeMap.evening = 17;   // 5 PM
            }

            for (const notif of todayNotifs.notifications) {
                const hour = timeMap[notif.time];
                if (hour == null) continue;
                const notifDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                    Math.floor(hour), Math.round((hour % 1) * 60));
                const delay = notifDate.getTime() - now.getTime();
                if (delay > 0) {
                    const timer = setTimeout(() => {
                        new Notification(H.t('aiSectionTitle'), {
                            body: notif.text,
                            icon: 'icon-192.svg',
                            tag: 'ai-' + notif.time
                        });
                    }, delay);
                    _notifyTimers.push(timer);
                }
            }
        } catch (e) {
            console.warn('AI notifications scheduling failed:', e.message);
        }
    }

    // ─── رمضان — عداد الليالي ─────────────────────────────────
    function renderRamadanSection(hijriDate, times) {
        const sec = document.getElementById('ramadan-section');
        if (!sec) return;
        if (!hijriDate || hijriDate.month !== 9) { sec.style.display = 'none'; return; }

        sec.style.display = '';
        const nightNum = hijriDate.day;
        const isLastTen = nightNum >= 21;
        const isQadrNight = isLastTen && (nightNum % 2 === 1); // odd nights 21,23,25,27,29
        const lang = H.getLang();

        // Night number display
        const nightEl = document.getElementById('ramadan-night');
        let nightText = `${H.t('ramadanNight')} ${lang === 'ar' ? H.toArabicNumerals(nightNum) : nightNum}`;
        if (isLastTen) nightText += ` — ${H.t('ramadanLastTen')}`;
        nightEl.textContent = nightText;

        // Styling
        sec.className = 'ramadan-section';
        if (isLastTen) sec.classList.add('ramadan-last-ten');
        if (isQadrNight) sec.classList.add('ramadan-qadr');

        // Info: imsak + fasting duration
        const infoEl = document.getElementById('ramadan-info');
        let infoHtml = '';
        if (isQadrNight) {
            infoHtml += `<span class="ramadan-qadr-text">✦ ${H.t('ramadanQadr')}</span>`;
        }
        if (times) {
            infoHtml += `<span class="ramadan-imsak">${H.t('ramadanImsak')}: ${times.imsak || ''}</span>`;
            // Fasting duration (Imsak to Maghrib)
            if (times._raw && times._raw.fajr !== null && times._raw.maghrib !== null) {
                const dur = times._raw.maghrib - times._raw.fajr;
                const h = Math.floor(dur);
                const m = Math.round((dur - h) * 60);
                const durStr = lang === 'ar'
                    ? `${H.toArabicNumerals(h)}:${H.toArabicNumerals(String(m).padStart(2, '0'))}`
                    : `${h}:${String(m).padStart(2, '0')}`;
                infoHtml += `<span class="ramadan-fasting">${H.t('ramadanFasting')}: ${durStr}</span>`;
            }
        }
        infoEl.innerHTML = infoHtml;
    }

    // ─── قوس الشمس ──────────────────────────────────────────
    function renderSunArc(times, isToday) {
        const container = document.getElementById('sun-arc-container');
        if (!container) return;
        if (!times || !times._raw || times._raw.fajr === null || times._raw.isha === null) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';
        const raw = times._raw;
        const fajr = raw.fajr, sunrise = raw.sunrise, dhuhr = raw.dhuhr;
        const asr = raw.asr, maghrib = raw.maghrib, isha = raw.isha;
        const span = isha - fajr;
        if (span <= 0) { container.style.display = 'none'; return; }

        // Generous dimensions — padding around all sides to prevent clipping
        const R = 90;
        const PAD_TOP = 40;    // space above arc for Dhuhr label
        const PAD_SIDE = 70;   // space on sides for Fajr/Isha labels
        const PAD_BOTTOM = 35; // space below baseline for labels
        const W = 2 * R + 2 * PAD_SIDE;
        const CX = W / 2;
        const CY = PAD_TOP + R;       // center of arc circle
        const TOTAL_H = CY + PAD_BOTTOM;
        const lang = H.getLang();
        const isRTL = lang === 'ar';

        // Map time to angle on the semicircle
        // RTL: Fajr on RIGHT (angle 0) → Isha on LEFT (angle π)  — natural Arabic reading order
        // LTR: Fajr on LEFT  (angle π) → Isha on RIGHT (angle 0) — natural English reading order
        const timeToAngle = isRTL
            ? (t => ((t - fajr) / span) * Math.PI)
            : (t => Math.PI - ((t - fajr) / span) * Math.PI);
        const angleToXY = (a, r) => ({ x: CX + (r || R) * Math.cos(a), y: CY - (r || R) * Math.sin(a) });

        // Prayer markers data
        const prayers = [
            { key: 'fajr', t: fajr, label: H.t('prayerFajr') },
            { key: 'sunrise', t: sunrise, label: H.t('prayerSunrise') },
            { key: 'dhuhr', t: dhuhr, label: H.t('prayerDhuhr') },
            { key: 'asr', t: asr, label: H.t('prayerAsr') },
            { key: 'maghrib', t: maghrib, label: H.t('prayerMaghrib') },
            { key: 'isha', t: isha, label: H.t('prayerIsha') },
        ];

        // Day/night sub-arcs
        const sunriseAngle = timeToAngle(sunrise);
        const maghribAngle = timeToAngle(maghrib);
        const sunriseP = angleToXY(sunriseAngle);
        const maghribP = angleToXY(maghribAngle);

        let svg = `<svg viewBox="0 0 ${W} ${TOTAL_H}" class="sun-arc-svg" xmlns="http://www.w3.org/2000/svg">`;

        // Night arc (full semicircle, dim)
        svg += `<path d="M ${CX - R} ${CY} A ${R} ${R} 0 1 1 ${CX + R} ${CY}" fill="none" stroke="var(--arc-night)" stroke-width="7" stroke-linecap="round"/>`;

        // Day arc (sunrise → maghrib, bright)
        // Sweep direction depends on layout: we always sweep counter-clockwise on the visible arc
        const angleDiff = Math.abs(sunriseAngle - maghribAngle);
        const dayLargeFlag = angleDiff > Math.PI ? 1 : 0;
        // Sweep flag: in RTL sunrise angle < maghrib angle, so sweep=0 (CCW); in LTR sunrise > maghrib, sweep=1 (CW)
        const sweepFlag = isRTL ? 0 : 1;
        svg += `<path d="M ${sunriseP.x} ${sunriseP.y} A ${R} ${R} 0 ${dayLargeFlag} ${sweepFlag} ${maghribP.x} ${maghribP.y}" fill="none" stroke="var(--arc-day)" stroke-width="7" stroke-linecap="round"/>`;

        // Prayer markers + labels
        prayers.forEach(p => {
            if (p.t === null) return;
            const a = timeToAngle(p.t);
            const pt = angleToXY(a);
            // Marker dot on the arc
            svg += `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="var(--arc-marker)"/>`;

            // Label positioned well outside the arc
            const labelR = R + 30;
            const lp = angleToXY(a, labelR);
            // Small tick from arc dot outward
            const tickEnd = angleToXY(a, R + 12);
            svg += `<line x1="${pt.x}" y1="${pt.y}" x2="${tickEnd.x}" y2="${tickEnd.y}" stroke="var(--arc-marker)" stroke-width="1.5" opacity="0.5"/>`;

            // Determine text anchor so text extends OUTWARD from arc
            // For LTR text: right side → start (extends right), left side → end (extends left)
            // For RTL text: right side → end (extends right), left side → start (extends left)
            let anchor = 'middle';
            let dx = 0;
            const cosA = Math.cos(a); // negative = left side, positive = right side
            if (cosA > 0.3) {
                // Right side of arc — text should extend rightward
                anchor = isRTL ? 'end' : 'start';
                dx = 6;
            } else if (cosA < -0.3) {
                // Left side of arc — text should extend leftward
                anchor = isRTL ? 'start' : 'end';
                dx = -6;
            }

            svg += `<text x="${lp.x + dx}" y="${lp.y + 4}" text-anchor="${anchor}" class="arc-label">${p.label}</text>`;
        });

        // Sun dot (only for today — live position)
        if (isToday) {
            const now = new Date();
            const nowH = now.getHours() + now.getMinutes() / 60;
            if (nowH >= fajr && nowH <= isha) {
                const sunAngle = timeToAngle(nowH);
                const sunPt = angleToXY(sunAngle);
                svg += `<circle cx="${sunPt.x}" cy="${sunPt.y}" r="8" fill="var(--arc-sun)" class="sun-dot"/>`;
                svg += `<circle cx="${sunPt.x}" cy="${sunPt.y}" r="12" fill="none" stroke="var(--arc-sun)" stroke-width="1.5" opacity="0.4" class="sun-dot-ring"/>`;
            }
        }

        // Arabic clock inside arc (prayer tab)
        if (isToday) {
            const now2 = new Date();
            const nowDec = now2.getHours() + now2.getMinutes() / 60 + now2.getSeconds() / 3600;
            const arabicH = nowDec - raw.maghrib + 12;
            svg += buildClockSVG(CX, CY + 6, 45, arabicH, lang);
        }

        svg += `</svg>`;

        // Day/night lengths
        const dayLen = maghrib - sunrise;
        const nightLen = 24 - dayLen;
        const fmtLen = (hrs) => {
            const h = Math.floor(hrs), m = Math.round((hrs - h) * 60);
            return lang === 'ar'
                ? `${H.toArabicNumerals(h)}:${H.toArabicNumerals(String(m).padStart(2, '0'))}`
                : `${h}:${String(m).padStart(2, '0')}`;
        };

        svg += `<div class="sun-arc-info">`;
        svg += `<span>☀️ ${H.t('sunArcDay')}: ${fmtLen(dayLen)}</span>`;
        svg += `<span>🌙 ${H.t('sunArcNight')}: ${fmtLen(nightLen)}</span>`;
        svg += `</div>`;

        container.innerHTML = svg;
    }

    // ─── تحويل التاريخ — نتيجة محسّنة ───────────────────────
    function showConverterResult(type, day, month, year) {
        const resultEl = document.getElementById('converter-result');
        if (!resultEl) return;

        let hijri, greg, jdn;
        if (type === 'hijri') {
            jdn = H.hijriToJDN(year, month, day);
            hijri = { year, month, day };
            greg = H.jdnToGregorian(jdn);
        } else {
            jdn = H.gregorianToJDN(year, month, day);
            greg = { year, month, day };
            hijri = H.jdnToHijri(jdn);
        }

        const dow = H.dayOfWeek(jdn);
        const dayStr = H.dayName(dow);
        const hijriStr = `${hijri.day} ${H.monthName(hijri.month - 1)} ${hijri.year} ${H.t('hSuffix')}`;
        const gregStr = `${greg.day} ${H.gregMonthName(greg.month - 1)} ${greg.year}${H.t('gSuffix')}`;

        let html = `<div class="converter-text">`;
        html += `<div class="converter-day">${dayStr}</div>`;
        html += `<div class="converter-hijri">📅 ${hijriStr}</div>`;
        html += `<div class="converter-greg">📆 ${gregStr}</div>`;

        const event = H.getEvent(hijri.month, hijri.day);
        if (event) html += `<div class="converter-event">🌙 ${event.name}</div>`;

        const tale3 = H.getTale3(greg.month, greg.day);
        if (tale3) html += `<div class="converter-anwa">☆ ${H.t('tale3Label')}: ${tale3.name}</div>`;

        html += `</div>`;
        html += `<button class="convert-btn converter-copy-btn" id="converter-copy-btn">${H.t('converterCopy')}</button>`;

        resultEl.innerHTML = html;
        resultEl.style.display = '';

        document.getElementById('converter-copy-btn').addEventListener('click', () => {
            const text = `${dayStr}\n${hijriStr}\n${gregStr}${event ? '\n' + event.name : ''}`;
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('converter-copy-btn');
                btn.textContent = H.t('converterCopied');
                setTimeout(() => btn.textContent = H.t('converterCopy'), 2000);
            });
        });
    }

    // ─── المشاركة ────────────────────────────────────────────
    function setupShare() {
        const dateBtn = document.getElementById('share-date-btn');
        if (dateBtn) dateBtn.addEventListener('click', () => shareInfo('date'));

        const prayerBtn = document.getElementById('share-prayer-btn');
        if (prayerBtn) prayerBtn.addEventListener('click', () => shareInfo('prayer'));
    }

    async function shareInfo(mode) {
        const now = new Date();
        let gYear, gMonth, gDay;
        if (_selectedDate) {
            gYear = _selectedDate.year; gMonth = _selectedDate.month; gDay = _selectedDate.day;
        } else {
            gYear = now.getFullYear(); gMonth = now.getMonth() + 1; gDay = now.getDate();
        }
        const hijri = H.gregorianToHijri(gYear, gMonth, gDay);
        const jdn = H.gregorianToJDN(gYear, gMonth, gDay);
        const dow = H.dayOfWeek(jdn);
        const lang = H.getLang();

        const dayStr = H.dayName(dow);
        const hijriStr = `${hijri.day} ${H.monthName(hijri.month - 1)} ${hijri.year} ${H.t('hSuffix')}`;
        const gregStr = `${gDay} ${H.gregMonthName(gMonth - 1)} ${gYear}${H.t('gSuffix')}`;

        let lines = [];
        lines.push(`📅 ${dayStr}، ${hijriStr}`);
        lines.push(`📆 ${gregStr}`);

        const event = H.getEvent(hijri.month, hijri.day);
        if (event) lines.push(`🌙 ${event.name}`);

        // Prayer times
        if (mode === 'prayer' && PT) {
            const s = PT.getSettings();
            if (s.lat || s.lng) {
                const isRamadan = hijri.month === 9;
                const times = _selectedDate ? PT.getForDate(_selectedDate, isRamadan) : PT.getForToday(isRamadan);
                lines.push(`🕌 ${H.t('prayerFajr')} ${times.fajr} | ${H.t('prayerDhuhr')} ${times.dhuhr} | ${H.t('prayerAsr')} ${times.asr} | ${H.t('prayerMaghrib')} ${times.maghrib} | ${H.t('prayerIsha')} ${times.isha}`);
            }
        }

        // Anwa
        const tale3 = H.getTale3(gMonth, gDay);
        if (tale3) {
            lines.push(`☆ ${H.t('tale3Label')}: ${tale3.name}`);
        }

        const text = lines.join('\n');

        // Try native share, then Web Share API, then clipboard
        if (isNative()) {
            try {
                const { Share } = window.Capacitor.Plugins;
                await Share.share({ title: H.t('shareTitle'), text });
                return;
            } catch (e) {}
        }
        if (navigator.share) {
            try {
                await navigator.share({ title: H.t('shareTitle'), text });
                return;
            } catch (e) {}
        }
        // Fallback: clipboard
        try {
            await navigator.clipboard.writeText(text);
            _showShareToast(H.t('shareCopied'));
        } catch (e) {
            _showShareToast(H.t('shareError'));
        }
    }

    function _showShareToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
    }

    // ─── شاشة المشاركة (بطاقة مرئية — Canvas → PNG) ─────────
    const SHARE_THEMES = [
        { id: 'basit', nameKey: 'shareThemeBasit', bg: ['#0f172a','#064e3b'], bgAngle: 135, cardBg: '#1e293b', cardBorder: 'rgba(255,255,255,0.12)', textPrimary: '#f8fafc', textSecondary: '#94a3b8', accent: '#f59e0b', separator: 'rgba(255,255,255,0.08)', decorate: null },
        { id: 'islami', nameKey: 'shareThemeIslami', bg: ['#022c22','#064e3b'], bgAngle: 135, cardBg: '#0a3d2e', cardBorder: 'rgba(39,166,120,0.3)', textPrimary: '#d4f0e3', textSecondary: '#6ee7b7', accent: '#fbbf24', separator: 'rgba(39,166,120,0.2)', decorate: null },
        { id: 'arabi', nameKey: 'shareThemeArabi', bg: ['#2c1810','#4a2c1a'], bgAngle: 135, cardBg: '#3d2517', cardBorder: 'rgba(212,163,64,0.3)', textPrimary: '#fdf3d7', textSecondary: '#d4a340', accent: '#f59e0b', separator: 'rgba(212,163,64,0.15)', decorate: 'arabi' },
        { id: 'mashrabiya', nameKey: 'shareThemeMashr', bg: ['#1a1a2e','#16213e'], bgAngle: 135, cardBg: '#1e293b', cardBorder: 'rgba(255,255,255,0.15)', textPrimary: '#f8fafc', textSecondary: '#94a3b8', accent: '#f59e0b', separator: 'rgba(255,255,255,0.08)', decorate: 'mashrabiya' },
        { id: 'qubba', nameKey: 'shareThemeQubba', bg: ['#0f172a','#1e3a5f'], bgAngle: 180, cardBg: '#1e293b', cardBorder: 'rgba(100,200,255,0.15)', textPrimary: '#f8fafc', textSecondary: '#7dd3fc', accent: '#fbbf24', separator: 'rgba(100,200,255,0.1)', decorate: 'qubba' },
        { id: 'makhtouta', nameKey: 'shareThemeMakh', bg: ['#f5e6c8','#e8d5a8'], bgAngle: 180, cardBg: '#fdf3d7', cardBorder: 'rgba(139,90,43,0.3)', textPrimary: '#3d2517', textSecondary: '#8b5a2b', accent: '#8b5a2b', separator: 'rgba(139,90,43,0.2)', decorate: 'makhtouta' }
    ];

    let _shareThemeIndex = 0;
    let _shareBlob = null;

    function collectDayData() {
        const now = new Date();
        let gYear, gMonth, gDay;
        if (_selectedDate) { gYear = _selectedDate.year; gMonth = _selectedDate.month; gDay = _selectedDate.day; }
        else { gYear = now.getFullYear(); gMonth = now.getMonth() + 1; gDay = now.getDate(); }
        const jdn = H.gregorianToJDN(gYear, gMonth, gDay);
        const hijri = H.jdnToHijri(jdn);
        const dow = H.dayOfWeek(jdn);
        const isRamadan = hijri.month === 9;
        let prayers = null;
        if (PT) {
            const s = PT.getSettings();
            if (s.lat || s.lng) prayers = _selectedDate ? PT.getForDate(_selectedDate, isRamadan) : PT.getForToday(isRamadan);
        }
        return {
            dayName: H.dayName(dow),
            hijriDay: hijri.day, hijriMonth: H.monthName(hijri.month - 1), hijriYear: hijri.year, hijriSuffix: H.t('hSuffix'),
            gregDay: gDay, gregMonth: H.gregMonthName(gMonth - 1), gregYear: gYear, gregSuffix: H.t('gSuffix'),
            event: (H.getEvent(hijri.month, hijri.day) || {}).name || null,
            isRamadan, prayers,
            tale3: (H.getTale3(gMonth, gDay) || {}).name || null,
            season: (H.getSeason(gMonth, gDay) || {}).name || null,
            durr: (H.getDurr(gMonth, gDay, gYear) || {}).durr || null
        };
    }

    // ─── Canvas helpers ───
    function _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function _drawDecoration(ctx, theme, cx, cy, cw, ch) {
        if (!theme.decorate) return;
        ctx.save();
        if (theme.decorate === 'arabi') {
            ctx.strokeStyle = theme.accent; ctx.globalAlpha = 0.35;
            ctx.lineWidth = 1; _roundRect(ctx, cx+6, cy+6, cw-12, ch-12, 16); ctx.stroke();
            ctx.lineWidth = 0.5; _roundRect(ctx, cx+10, cy+10, cw-20, ch-20, 13); ctx.stroke();
            ctx.globalAlpha = 0.5; ctx.fillStyle = theme.accent;
            [[cx+16,cy+16],[cx+cw-16,cy+16],[cx+16,cy+ch-16],[cx+cw-16,cy+ch-16]].forEach(([dx,dy]) => {
                ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI*2); ctx.fill();
            });
        } else if (theme.decorate === 'mashrabiya') {
            ctx.strokeStyle = theme.accent; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.3;
            const s = 5, sp = 14;
            for (let x = cx+sp; x < cx+cw; x += sp) { ctx.beginPath(); ctx.moveTo(x,cy+8-s); ctx.lineTo(x+s,cy+8); ctx.lineTo(x,cy+8+s); ctx.lineTo(x-s,cy+8); ctx.closePath(); ctx.stroke(); }
            for (let x = cx+sp; x < cx+cw; x += sp) { ctx.beginPath(); ctx.moveTo(x,cy+ch-8-s); ctx.lineTo(x+s,cy+ch-8); ctx.lineTo(x,cy+ch-8+s); ctx.lineTo(x-s,cy+ch-8); ctx.closePath(); ctx.stroke(); }
            for (let y = cy+sp; y < cy+ch; y += sp) { ctx.beginPath(); ctx.moveTo(cx+8,y-s); ctx.lineTo(cx+8+s,y); ctx.lineTo(cx+8,y+s); ctx.lineTo(cx+8-s,y); ctx.closePath(); ctx.stroke(); }
            for (let y = cy+sp; y < cy+ch; y += sp) { ctx.beginPath(); ctx.moveTo(cx+cw-8,y-s); ctx.lineTo(cx+cw-8+s,y); ctx.lineTo(cx+cw-8,y+s); ctx.lineTo(cx+cw-8-s,y); ctx.closePath(); ctx.stroke(); }
        } else if (theme.decorate === 'qubba') {
            const dw = cw * 0.4, domeX = cx + cw/2;
            ctx.beginPath(); ctx.moveTo(domeX - dw/2, cy+2); ctx.quadraticCurveTo(domeX, cy-28, domeX + dw/2, cy+2);
            ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.08; ctx.fill();
            ctx.strokeStyle = theme.accent; ctx.globalAlpha = 0.3; ctx.lineWidth = 1; ctx.stroke();
        } else if (theme.decorate === 'makhtouta') {
            ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.4;
            const s = 20, ins = 12;
            [[cx+cw-ins,cy+ins,-s,s],[cx+ins,cy+ins,s,s],[cx+cw-ins,cy+ch-ins,-s,-s],[cx+ins,cy+ch-ins,s,-s]].forEach(([x,y,dx,dy]) => {
                ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+dx*0.5,y,x+dx,y+dy*0.3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x,y+dy*0.5,x+dx*0.3,y+dy); ctx.stroke();
            });
        }
        ctx.restore();
    }

    async function renderShareCanvas(data, theme) {
        await document.fonts.ready;
        const DPR = 2, W = 400, MARGIN = 16, PAD = 20, RAD = 20;
        const IL = MARGIN + PAD, IR = W - MARGIN - PAD, IW = IR - IL, CX = W / 2;
        const FONT = "'Cairo', 'Segoe UI', Tahoma, sans-serif";

        // ── Calculate height ──
        let h = MARGIN + PAD;
        h += 36; // day name
        h += 28; // hijri
        h += 22; // greg
        if (data.event) h += 26;

        // Prayers
        const prayerList = [];
        if (data.prayers) {
            prayerList.push({ key: 'prayerFajr', val: data.prayers.fajr });
            prayerList.push({ key: 'prayerSunrise', val: data.prayers.sunrise });
            prayerList.push({ key: 'prayerDhuhr', val: data.prayers.dhuhr });
            prayerList.push({ key: 'prayerAsr', val: data.prayers.asr });
            prayerList.push({ key: 'prayerMaghrib', val: data.prayers.maghrib });
            prayerList.push({ key: 'prayerIsha', val: data.prayers.isha });
            h += 16 + 1 + 16 + 20 + prayerList.length * 26;
        }

        // Anwa
        const anwaItems = [];
        if (data.tale3) anwaItems.push({ label: H.t('tale3Label'), value: data.tale3 });
        if (data.season) anwaItems.push({ label: H.t('seasonLabel'), value: data.season });
        if (data.durr) anwaItems.push({ label: H.t('durrLabel'), value: data.durr });
        if (anwaItems.length) h += 16 + 1 + 16 + 20 + 52;

        h += 14 + 14 + 14 + 14 + PAD + MARGIN; // footer (title + name + version + tech) + padding
        const totalH = h;

        // ── Create canvas ──
        const canvas = document.createElement('canvas');
        canvas.width = W * DPR; canvas.height = totalH * DPR;
        const ctx = canvas.getContext('2d');
        ctx.scale(DPR, DPR);

        // ── Background gradient ──
        const a = (theme.bgAngle || 135) * Math.PI / 180;
        const grad = ctx.createLinearGradient(W/2 - Math.cos(a)*W/2, totalH/2 - Math.sin(a)*totalH/2, W/2 + Math.cos(a)*W/2, totalH/2 + Math.sin(a)*totalH/2);
        grad.addColorStop(0, theme.bg[0]); grad.addColorStop(1, theme.bg[1]);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, totalH);

        // ── Card ──
        const cardX = MARGIN, cardY = MARGIN, cardW = W - MARGIN*2, cardH = totalH - MARGIN*2;
        _roundRect(ctx, cardX, cardY, cardW, cardH, RAD);
        ctx.fillStyle = theme.cardBg; ctx.fill();
        ctx.strokeStyle = theme.cardBorder; ctx.lineWidth = 1.5; ctx.stroke();

        // ── Decoration ──
        _drawDecoration(ctx, theme, cardX, cardY, cardW, cardH);

        // ── Draw content ──
        let y = MARGIN + PAD;
        ctx.textBaseline = 'top'; ctx.direction = 'rtl';

        // Day name
        ctx.font = `800 28px ${FONT}`; ctx.fillStyle = theme.textPrimary; ctx.textAlign = 'center';
        ctx.fillText(data.dayName, CX, y); y += 36;

        // Hijri
        ctx.font = `700 18px ${FONT}`; ctx.fillStyle = theme.textPrimary;
        ctx.fillText(`${data.hijriDay} ${data.hijriMonth} ${data.hijriYear} ${data.hijriSuffix}`, CX, y); y += 28;

        // Gregorian
        ctx.font = `400 13px ${FONT}`; ctx.fillStyle = theme.textSecondary;
        ctx.fillText(`${data.gregDay} ${data.gregMonth} ${data.gregYear}${data.gregSuffix}`, CX, y); y += 22;

        // Event
        if (data.event) {
            ctx.font = `600 14px ${FONT}`; ctx.fillStyle = theme.accent;
            ctx.fillText(data.event, CX, y); y += 26;
        }

        // ── Prayer times ──
        if (prayerList.length) {
            y += 16;
            ctx.strokeStyle = theme.separator; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(IL + 20, y); ctx.lineTo(IR - 20, y); ctx.stroke();
            y += 16;
            ctx.font = `700 12px ${FONT}`; ctx.fillStyle = theme.textSecondary; ctx.textAlign = 'center';
            ctx.fillText(H.t('prayerTitle') || '\u0645\u0648\u0627\u0642\u064a\u062a \u0627\u0644\u0635\u0644\u0627\u0629', CX, y); y += 20;

            ctx.font = `600 14px ${FONT}`;
            prayerList.forEach(p => {
                ctx.fillStyle = theme.textPrimary;
                ctx.textAlign = 'right'; ctx.direction = 'rtl';
                ctx.fillText(H.t(p.key), IR - 10, y);
                ctx.textAlign = 'left'; ctx.direction = 'ltr';
                ctx.fillText(p.val, IL + 10, y);
                y += 26;
            });
        }

        // ── Anwa ──
        if (anwaItems.length) {
            y += 16;
            ctx.strokeStyle = theme.separator; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(IL + 20, y); ctx.lineTo(IR - 20, y); ctx.stroke();
            y += 16;
            ctx.font = `700 12px ${FONT}`; ctx.fillStyle = theme.textSecondary; ctx.textAlign = 'center'; ctx.direction = 'rtl';
            ctx.fillText(H.t('anwaSeasons'), CX, y); y += 20;

            const gap = 8, cnt = anwaItems.length, acW = (IW - gap * (cnt - 1)) / cnt, acH = 44;
            anwaItems.forEach((item, i) => {
                const ax = IR - (i + 1) * acW - i * gap;
                _roundRect(ctx, ax, y, acW, acH, 8);
                ctx.fillStyle = theme.separator; ctx.fill();
                ctx.strokeStyle = theme.cardBorder; ctx.lineWidth = 1; ctx.stroke();
                ctx.font = `400 10px ${FONT}`; ctx.fillStyle = theme.textSecondary; ctx.textAlign = 'center'; ctx.direction = 'rtl';
                ctx.fillText(item.label, ax + acW/2, y + 6);
                ctx.font = `700 12px ${FONT}`; ctx.fillStyle = theme.textPrimary;
                ctx.fillText(item.value, ax + acW/2, y + 24);
            });
            y += acH + 8;
        }

        // ── Footer ──
        y += 12;
        ctx.font = `600 10px ${FONT}`; ctx.fillStyle = theme.textSecondary; ctx.textAlign = 'center'; ctx.direction = 'rtl';
        ctx.globalAlpha = 0.6;
        ctx.fillText(H.t('title'), CX, y); y += 14;
        ctx.font = `400 9px ${FONT}`; ctx.globalAlpha = 0.4;
        ctx.fillText(H.t('creditsName'), CX, y); y += 14;
        ctx.fillText(H.t('creditsVersion'), CX, y); y += 14;
        ctx.fillText(H.t('creditsTech'), CX, y);
        ctx.globalAlpha = 1;

        return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
    }

    function setupShareScreen() {
        const shareBtn = document.getElementById('dv-share-btn');
        if (shareBtn) shareBtn.addEventListener('click', openShareScreen);
        const closeBtn = document.getElementById('share-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeShareScreen);
        const shareAction = document.getElementById('share-action-share');
        if (shareAction) shareAction.addEventListener('click', doShareAction);
        const copyAction = document.getElementById('share-action-copy');
        if (copyAction) copyAction.addEventListener('click', doCopyAction);
    }

    async function openShareScreen() {
        document.querySelector('.share-title').textContent = H.t('shareTitle');
        document.getElementById('share-action-share').textContent = H.t('shareActionShare');
        document.getElementById('share-action-copy').textContent = H.t('shareCopyBtn');
        _shareThemeIndex = 0;
        renderShareThemes();
        document.getElementById('day-view').style.display = 'none';
        document.getElementById('share-view').style.display = '';
        await updateSharePreview();
    }

    function closeShareScreen() {
        document.getElementById('share-view').style.display = 'none';
        document.getElementById('day-view').style.display = '';
        _shareBlob = null;
    }

    function renderShareThemes() {
        const container = document.getElementById('share-themes');
        container.innerHTML = '';
        SHARE_THEMES.forEach((theme, idx) => {
            const card = document.createElement('div');
            card.className = 'share-theme-card' + (idx === _shareThemeIndex ? ' active' : '');
            const mini = document.createElement('div');
            mini.className = 'share-theme-mini';
            mini.style.background = `linear-gradient(${theme.bgAngle}deg, ${theme.bg[0]}, ${theme.bg[1]})`;
            const label = document.createElement('div');
            label.className = 'share-theme-label';
            label.textContent = H.t(theme.nameKey);
            card.appendChild(mini); card.appendChild(label);
            card.addEventListener('click', async () => {
                _shareThemeIndex = idx;
                container.querySelectorAll('.share-theme-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                await updateSharePreview();
            });
            container.appendChild(card);
        });
    }

    async function updateSharePreview() {
        const data = collectDayData();
        const theme = SHARE_THEMES[_shareThemeIndex];
        _shareBlob = await renderShareCanvas(data, theme);
        const img = document.getElementById('share-preview-img');
        const url = URL.createObjectURL(_shareBlob);
        img.onload = () => URL.revokeObjectURL(url);
        img.src = url;
    }

    function _downloadBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function doShareAction() {
        if (!_shareBlob) return;
        const file = new File([_shareBlob], 'hijri-card.png', { type: 'image/png' });
        if (isNative()) {
            try {
                const { Filesystem, Share } = window.Capacitor.Plugins;
                const reader = new FileReader();
                const b64 = await new Promise(r => { reader.onloadend = () => r(reader.result.split(',')[1]); reader.readAsDataURL(_shareBlob); });
                const res = await Filesystem.writeFile({ path: 'hijri-card.png', data: b64, directory: 'CACHE' });
                await Share.share({ title: H.t('shareTitle'), url: res.uri });
                return;
            } catch (e) {}
        }
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ title: H.t('shareTitle'), files: [file] }); return; } catch (e) {}
        }
        _downloadBlob('hijri-card.png', _shareBlob);
    }

    async function doCopyAction() {
        if (!_shareBlob) return;
        try {
            if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': _shareBlob })]);
                _showShareToast(H.t('shareCopied'));
                return;
            }
        } catch (e) {}
        _downloadBlob('hijri-card.png', _shareBlob);
        _showShareToast(H.t('shareCopied'));
    }

    // ─── الأذكار ─────────────────────────────────────────────
    const ADHKAR_DATA = {
        morning: [
            { ar: 'أعوذ بالله من الشيطان الرجيم. اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ (آية الكرسي)', en: 'Ayat al-Kursi', count: 1, source: 'البخاري' },
            { ar: 'قُلْ هُوَ اللَّهُ أَحَدٌ... (الإخلاص والمعوذتين)', en: 'Al-Ikhlas, Al-Falaq, An-Nas', count: 3, source: 'أبو داود والترمذي' },
            { ar: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', en: 'Asbahna wa asbahal mulku lillah...', count: 1, source: 'مسلم' },
            { ar: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ', en: 'Allahumma bika asbahna...', count: 1, source: 'الترمذي' },
            { ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ', en: "Allahumma inni as'alukal 'afiyah...", count: 1, source: 'ابن ماجه' },
            { ar: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي', en: "Allahumma 'afini fi badani...", count: 3, source: 'أبو داود' },
            { ar: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', en: 'Bismillahil-ladhi la yadurr...', count: 3, source: 'أبو داود والترمذي' },
            { ar: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا', en: 'Raditu billahi rabba...', count: 3, source: 'أحمد' },
            { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', en: 'SubhanAllahi wa bihamdihi', count: 100, source: 'مسلم' },
            { ar: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', en: 'La ilaha illAllah wahdahu la sharika lah...', count: 10, source: 'البخاري ومسلم' },
            { ar: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', en: 'Astaghfirullaha wa atubu ilayh', count: 100, source: 'البخاري ومسلم' },
        ],
        evening: [
            { ar: 'أعوذ بالله من الشيطان الرجيم. اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ (آية الكرسي)', en: 'Ayat al-Kursi', count: 1, source: 'البخاري' },
            { ar: 'قُلْ هُوَ اللَّهُ أَحَدٌ... (الإخلاص والمعوذتين)', en: 'Al-Ikhlas, Al-Falaq, An-Nas', count: 3, source: 'أبو داود والترمذي' },
            { ar: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', en: 'Amsayna wa amsal mulku lillah...', count: 1, source: 'مسلم' },
            { ar: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ', en: 'Allahumma bika amsayna...', count: 1, source: 'الترمذي' },
            { ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ', en: "Allahumma inni as'alukal 'afiyah...", count: 1, source: 'ابن ماجه' },
            { ar: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي', en: "Allahumma 'afini fi badani...", count: 3, source: 'أبو داود' },
            { ar: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', en: 'Bismillahil-ladhi la yadurr...', count: 3, source: 'أبو داود والترمذي' },
            { ar: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا', en: 'Raditu billahi rabba...', count: 3, source: 'أحمد' },
            { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', en: 'SubhanAllahi wa bihamdihi', count: 100, source: 'مسلم' },
            { ar: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', en: "A'udhu bi kalimatillahi at-tammati...", count: 3, source: 'مسلم' },
            { ar: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', en: 'La ilaha illAllah wahdahu la sharika lah...', count: 10, source: 'البخاري ومسلم' },
        ]
    };

    let _adhkarTab = 'morning';
    function setupAdhkar() {
        const toggle = document.getElementById('adhkar-toggle');
        const body = document.getElementById('adhkar-body');
        const arrow = document.getElementById('adhkar-arrow');
        if (!toggle || !body) return;

        toggle.addEventListener('click', () => {
            const open = body.style.display !== 'none';
            body.style.display = open ? 'none' : '';
            if (arrow) arrow.textContent = open ? '▼' : '▲';
        });

        // Auto-select tab based on time of day
        const now = new Date();
        const hour = now.getHours();
        _adhkarTab = hour >= 15 ? 'evening' : 'morning'; // After 3pm → evening

        const morningBtn = document.getElementById('adhkar-tab-morning');
        const eveningBtn = document.getElementById('adhkar-tab-evening');
        if (morningBtn) morningBtn.addEventListener('click', () => { _adhkarTab = 'morning'; renderAdhkarList(); _updateAdhkarTabs(); });
        if (eveningBtn) eveningBtn.addEventListener('click', () => { _adhkarTab = 'evening'; renderAdhkarList(); _updateAdhkarTabs(); });

        _updateAdhkarTabs();
        renderAdhkarList();
    }

    function _updateAdhkarTabs() {
        const morningBtn = document.getElementById('adhkar-tab-morning');
        const eveningBtn = document.getElementById('adhkar-tab-evening');
        if (morningBtn) { morningBtn.classList.toggle('active', _adhkarTab === 'morning'); }
        if (eveningBtn) { eveningBtn.classList.toggle('active', _adhkarTab === 'evening'); }
    }

    function renderAdhkarList() {
        const list = document.getElementById('adhkar-list');
        if (!list) return;

        const data = ADHKAR_DATA[_adhkarTab];
        const lang = H.getLang();
        const today = new Date().toISOString().slice(0, 10);
        let stored = {};
        try { stored = JSON.parse(localStorage.getItem('adhkar-counts-' + today) || '{}'); } catch (e) {}

        list.innerHTML = data.map((d, i) => {
            const key = `${_adhkarTab}-${i}`;
            const remaining = stored[key] !== undefined ? stored[key] : d.count;
            const done = remaining <= 0;
            return `<div class="dhikr-item${done ? ' dhikr-done' : ''}" data-key="${key}" data-idx="${i}">` +
                `<div class="dhikr-text">${lang === 'en' ? d.en : d.ar}</div>` +
                `<div class="dhikr-meta">` +
                `<span class="dhikr-source">${d.source}</span>` +
                `<span class="dhikr-counter">${done ? H.t('adhkarDone') + ' ✓' : remaining}</span>` +
                `</div></div>`;
        }).join('');

        // Tap handlers
        list.querySelectorAll('.dhikr-item:not(.dhikr-done)').forEach(el => {
            el.addEventListener('click', () => {
                const key = el.dataset.key;
                const idx = parseInt(el.dataset.idx);
                const d = data[idx];
                const remaining = stored[key] !== undefined ? stored[key] : d.count;
                const newVal = remaining - 1;
                stored[key] = newVal;
                try { localStorage.setItem('adhkar-counts-' + today, JSON.stringify(stored)); } catch (e) {}

                const counter = el.querySelector('.dhikr-counter');
                if (newVal <= 0) {
                    el.classList.add('dhikr-done');
                    counter.textContent = H.t('adhkarDone') + ' ✓';
                } else {
                    counter.textContent = newVal;
                    el.classList.add('dhikr-pulse');
                    setTimeout(() => el.classList.remove('dhikr-pulse'), 200);
                }
            });
        });
    }

    // ─── تصدير PDF ───────────────────────────────────────────
    function setupPDFExport() {
        const btn = document.getElementById('export-pdf-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const fromM = parseInt(document.getElementById('export-from-month').value);
            const fromY = parseInt(document.getElementById('export-from-year').value);
            const toM = parseInt(document.getElementById('export-to-month').value);
            const toY = parseInt(document.getElementById('export-to-year').value);
            const type = document.querySelector('input[name="export-type"]:checked').value;
            if (!fromM || !fromY || !toM || !toY) return;
            generatePDFView(fromY, fromM, toY, toM, type);
        });
    }

    function generatePDFView(fromYear, fromMonth, toYear, toMonth, type) {
        let startJDN, endJDN;
        if (type === 'hijri') {
            startJDN = H.hijriToJDN(fromYear, fromMonth, 1);
            endJDN = H.hijriToJDN(toYear, toMonth, H.daysInMonth(toYear, toMonth));
        } else {
            startJDN = H.gregorianToJDN(fromYear, fromMonth, 1);
            const nextM = toMonth === 12 ? 1 : toMonth + 1;
            const nextY = toMonth === 12 ? toYear + 1 : toYear;
            endJDN = H.gregorianToJDN(nextY, nextM, 1) - 1;
        }

        // Group by Hijri month
        const months = {};
        for (let jdn = startJDN; jdn <= endJDN; jdn++) {
            const hijri = H.jdnToHijri(jdn);
            const greg = H.jdnToGregorian(jdn);
            const dow = H.dayOfWeek(jdn);
            const event = H.getEvent(hijri.month, hijri.day);
            const moon = H.getMoonPhase(greg.year, greg.month, greg.day);
            const key = `${hijri.year}-${hijri.month}`;
            if (!months[key]) months[key] = { year: hijri.year, month: hijri.month, days: [] };
            months[key].days.push({ hijri, greg, dow, event, moon });
        }

        const lang = H.getLang();
        const isRTL = lang === 'ar';

        let html = `<!DOCTYPE html><html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><title>${H.t('exportPDF')}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Calibri', 'Cairo', 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333; direction: ${isRTL ? 'rtl' : 'ltr'}; }
.month-block { page-break-inside: avoid; margin-bottom: 20px; }
.month-title { background: #14553f; color: #fff; padding: 8px 16px; font-size: 14pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
th { background: #f0f0f0; padding: 4px 6px; font-weight: 600; border: 1px solid #ddd; font-size: 9pt; }
td { padding: 4px 6px; border: 1px solid #ddd; font-size: 9pt; }
tr:nth-child(even) { background: #fafafa; }
.event-cell { color: #14553f; font-weight: 600; }
.friday { background: #f5fff5; }
@media print { .no-print { display: none; } body { margin: 10mm; } }
.print-bar { position: fixed; top: 0; left: 0; right: 0; background: #14553f; color: #fff; padding: 10px 20px; z-index: 100; display: flex; justify-content: space-between; align-items: center; }
.print-bar button { background: #fff; color: #14553f; border: none; padding: 8px 20px; cursor: pointer; font-weight: 700; border-radius: 4px; }
</style></head><body>
<div class="print-bar no-print"><span>${H.t('exportPDF')}</span><button onclick="window.print()">${H.t('exportPDF')}</button></div>
<div style="margin-top: 50px">`;

        Object.values(months).forEach(m => {
            const title = `${H.monthName(m.month - 1)} ${m.year} ${H.t('hSuffix')}`;
            html += `<div class="month-block"><div class="month-title">${title}</div><table>`;
            html += `<thead><tr>`;
            html += `<th>${H.t('day')}</th><th>${H.t('hijri')}</th><th>${H.t('gregorian')}</th>`;
            html += `<th>${H.t('eventsLabel')}</th><th>${H.t('moonPhaseLabel')}</th>`;
            html += `</tr></thead><tbody>`;

            m.days.forEach(d => {
                const isFriday = d.dow === 6;
                html += `<tr class="${isFriday ? 'friday' : ''}">`;
                html += `<td>${H.dayName(d.dow)}</td>`;
                html += `<td>${d.hijri.day}</td>`;
                html += `<td>${d.greg.day}/${d.greg.month}/${d.greg.year}</td>`;
                html += `<td class="${d.event ? 'event-cell' : ''}">${d.event ? d.event.name : ''}</td>`;
                html += `<td>${d.moon ? d.moon.symbol + ' ' + d.moon.name : ''}</td>`;
                html += `</tr>`;
            });

            html += `</tbody></table></div>`;
        });

        html += `</div></body></html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    }

    // ─── PWA ─────────────────────────────────────────────────
    function registerServiceWorker() {
        if (isNative()) return; // Native app — no SW needed
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js').catch(() => {});
        }
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            _deferredInstallPrompt = e;
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.style.display = 'inline-block';
                installBtn.addEventListener('click', () => {
                    if (_deferredInstallPrompt) {
                        _deferredInstallPrompt.prompt();
                        _deferredInstallPrompt = null;
                        installBtn.style.display = 'none';
                    }
                });
            }
        });
    }

    // ─── واجهة اليوم (الشاشة الرئيسية) ──────────────────────

    function renderMoonSVG(phaseFraction, size, tiltAngle) {
        size = size || 90;
        const canvas = document.createElement('canvas');
        canvas.width = size * 2;  // 2x for retina
        canvas.height = size * 2;
        const ctx = canvas.getContext('2d');
        const S = size * 2;       // work in 2x space
        const R = S / 2 - 2;     // disc radius
        const cx = S / 2;
        const cy = S / 2;
        const f = ((phaseFraction % 1) + 1) % 1;

        // --- Procedural lunar surface noise (seeded, deterministic) ---
        function hash(x, y) {
            let h = x * 374761393 + y * 668265263;
            h = (h ^ (h >> 13)) * 1274126177;
            return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
        }
        function smoothNoise(px, py, scale) {
            const sx = px / scale, sy = py / scale;
            const ix = Math.floor(sx), iy = Math.floor(sy);
            const fx = sx - ix, fy = sy - iy;
            const a = hash(ix, iy), b = hash(ix + 1, iy);
            const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
            const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
            return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
        }
        function lunarNoise(px, py) {
            return smoothNoise(px, py, 40) * 0.5 +
                   smoothNoise(px, py, 18) * 0.3 +
                   smoothNoise(px, py, 7) * 0.2;
        }

        // --- Mare (dark sea) regions — approximate real lunar maria positions ---
        // Positions normalized to [-1,1] from center, mapped to visible face
        const maria = [
            { x: -0.15, y: -0.25, rx: 0.28, ry: 0.22, d: 0.35 }, // Mare Imbrium
            { x:  0.20, y: -0.15, rx: 0.20, ry: 0.30, d: 0.30 }, // Mare Serenitatis
            { x:  0.30, y:  0.10, rx: 0.22, ry: 0.25, d: 0.28 }, // Mare Tranquillitatis
            { x: -0.05, y:  0.15, rx: 0.15, ry: 0.12, d: 0.25 }, // Mare Nubium
            { x: -0.35, y: -0.05, rx: 0.15, ry: 0.20, d: 0.22 }, // Oceanus Procellarum (part)
            { x: -0.25, y:  0.30, rx: 0.12, ry: 0.10, d: 0.20 }, // Mare Humorum
            { x:  0.15, y:  0.30, rx: 0.18, ry: 0.15, d: 0.22 }, // Mare Fecunditatis
            { x:  0.35, y: -0.30, rx: 0.10, ry: 0.12, d: 0.18 }, // Mare Crisium
        ];

        // --- Illumination geometry (Lambertian lighting for curved crescent) ---
        // f=0 (new moon): sun behind → sunZ=-1
        // f=0.25 (Q1):    sun lateral  → |lateral|=1, sunZ=0
        // f=0.5 (full):   sun in front → sunZ=+1
        const theta = Math.PI * 2 * f;
        const sunZ = -Math.cos(theta);
        let sunX, sunY;

        if (typeof tiltAngle === 'number') {
            // tiltAngle = zenith position angle of bright limb (χ = PAB - parallactic)
            // χ measured from zenith (up), counterclockwise on the sky:
            //   0° = up, 90° = left, 180° = down, 270° = right
            // Screen mapping: direction = (-sin(χ), -cos(χ))
            const lateralMag = Math.abs(Math.sin(theta));
            sunX = lateralMag * (-Math.sin(tiltAngle));
            sunY = lateralMag * (-Math.cos(tiltAngle));
        } else {
            // القيمة الافتراضية: ميلان بسيط ٢٠° (للرسوم التوضيحية بدون بيانات فلكية)
            const rawSunX = Math.sin(theta);
            const defaultTilt = 20 * Math.PI / 180;
            sunX = rawSunX * Math.cos(defaultTilt);
            sunY = rawSunX * Math.sin(defaultTilt);
        }

        // --- Render pixel by pixel ---
        const imgData = ctx.createImageData(S, S);
        const data = imgData.data;

        for (let py = 0; py < S; py++) {
            for (let px = 0; px < S; px++) {
                const dx = px - cx, dy = py - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const idx = (py * S + px) * 4;

                if (dist > R + 0.5) {
                    data[idx] = data[idx + 1] = data[idx + 2] = 0;
                    data[idx + 3] = 0; // transparent outside
                    continue;
                }

                // Anti-alias edge
                const edgeAlpha = Math.min(1, Math.max(0, R + 0.5 - dist));

                // 3D sphere coordinates (normalized)
                const nx = dx / R;  // -1 to 1
                const ny = dy / R;  // -1 to 1
                const nz2 = 1 - nx * nx - ny * ny;
                if (nz2 < 0) {
                    data[idx + 3] = 0;
                    continue;
                }
                const nz = Math.sqrt(nz2); // z-component (facing viewer)

                // --- Surface base color (highland) ---
                const noise = lunarNoise(px + 500, py + 500);
                let baseR = 220 + noise * 30 - 15;
                let baseG = 215 + noise * 25 - 12;
                let baseB = 200 + noise * 20 - 10;

                // --- Apply mare darkening ---
                let mareInfluence = 0;
                for (const m of maria) {
                    const mdx = nx - m.x, mdy = ny - m.y;
                    const ellDist = Math.sqrt((mdx * mdx) / (m.rx * m.rx) + (mdy * mdy) / (m.ry * m.ry));
                    if (ellDist < 1.5) {
                        const falloff = Math.max(0, 1 - ellDist);
                        mareInfluence = Math.max(mareInfluence, falloff * m.d);
                    }
                }
                // Mare areas are darker and slightly bluer
                const mareFactor = 1 - mareInfluence * 0.6;
                baseR *= mareFactor;
                baseG *= mareFactor;
                baseB *= mareFactor * 1.02; // slight blue tint

                // --- Small craters (procedural) ---
                const craterNoise = smoothNoise(px + 200, py + 200, 12);
                if (craterNoise > 0.75) {
                    const craterDarken = (craterNoise - 0.75) * 2;
                    baseR -= craterDarken * 25;
                    baseG -= craterDarken * 22;
                    baseB -= craterDarken * 20;
                }

                // --- Limb darkening (3D sphere effect) ---
                const limbFactor = 0.7 + 0.3 * nz;
                baseR *= limbFactor;
                baseG *= limbFactor;
                baseB *= limbFactor;

                // --- Lambertian illumination (dot product with sun direction) ---
                // Creates natural curved crescent shape from sphere geometry
                // Includes tilt for realistic tropical latitude appearance
                const dotSun = nx * sunX + ny * sunY + nz * sunZ;

                // Sharp terminator with very thin penumbra for realism
                const penumbra = 0.015;
                let illum = dotSun / (2 * penumbra) + 0.5;
                illum = Math.max(0, Math.min(1, illum));

                // --- Earthshine on dark side ---
                const earthshine = 0.04;
                const darkR = baseR * earthshine * 0.8;
                const darkG = baseG * earthshine * 0.9;
                const darkB = baseB * earthshine * 1.2;

                // --- Final color: blend lit surface with dark + earthshine ---
                let finalR = baseR * illum + darkR * (1 - illum);
                let finalG = baseG * illum + darkG * (1 - illum);
                let finalB = baseB * illum + darkB * (1 - illum);

                // Clamp
                data[idx]     = Math.max(0, Math.min(255, Math.round(finalR)));
                data[idx + 1] = Math.max(0, Math.min(255, Math.round(finalG)));
                data[idx + 2] = Math.max(0, Math.min(255, Math.round(finalB)));
                data[idx + 3] = Math.round(edgeAlpha * 255);
            }
        }

        ctx.putImageData(imgData, 0, 0);

        // Return as img tag with data URL
        const dataUrl = canvas.toDataURL('image/png');
        return `<img src="${dataUrl}" width="${size}" height="${size}" alt="moon" style="display:block;margin:auto;border-radius:50%;">`;
    }

    function renderDayViewArc(times, isToday) {
        const container = document.getElementById('dv-arc-section');
        if (!container) return;
        if (!times || !times._raw || times._raw.fajr === null || times._raw.isha === null) {
            container.innerHTML = '';
            return;
        }

        const raw = times._raw;
        const fajr = raw.fajr, sunrise = raw.sunrise, dhuhr = raw.dhuhr;
        const asr = raw.asr, maghrib = raw.maghrib, isha = raw.isha;
        const span = isha - fajr;
        if (span <= 0) { container.innerHTML = ''; return; }

        const R = 100;
        const PAD_TOP = 50;
        const PAD_SIDE = 80;
        const PAD_BOTTOM = 70;
        const W = 2 * R + 2 * PAD_SIDE;
        const CX = W / 2;
        const CY = PAD_TOP + R;
        const TOTAL_H = CY + PAD_BOTTOM;
        const lang = H.getLang();
        const isRTL = lang === 'ar';

        const timeToAngle = isRTL
            ? (t => ((t - fajr) / span) * Math.PI)
            : (t => Math.PI - ((t - fajr) / span) * Math.PI);
        const angleToXY = (a, r) => ({ x: CX + (r || R) * Math.cos(a), y: CY - (r || R) * Math.sin(a) });

        // Format time for display (e.g., "0533" or "1233")
        const fmtTime = (decimalHrs) => {
            const h = Math.floor(decimalHrs);
            const m = Math.round((decimalHrs - h) * 60);
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            return lang === 'ar' ? H.toArabicNumerals(hh) + H.toArabicNumerals(mm) : hh + mm;
        };

        const prayers = [
            { key: 'fajr', t: fajr, label: H.t('prayerFajr'), time: fmtTime(fajr) },
            { key: 'sunrise', t: sunrise, label: H.t('prayerSunrise'), time: fmtTime(sunrise) },
            { key: 'dhuhr', t: dhuhr, label: H.t('prayerDhuhr'), time: fmtTime(dhuhr) },
            { key: 'asr', t: asr, label: H.t('prayerAsr'), time: fmtTime(asr) },
            { key: 'maghrib', t: maghrib, label: H.t('prayerMaghrib'), time: fmtTime(maghrib) },
            { key: 'isha', t: isha, label: H.t('prayerIsha'), time: fmtTime(isha) },
        ];

        const sunriseAngle = timeToAngle(sunrise);
        const maghribAngle = timeToAngle(maghrib);
        const sunriseP = angleToXY(sunriseAngle);
        const maghribP = angleToXY(maghribAngle);

        let svg = `<svg viewBox="0 0 ${W} ${TOTAL_H}" class="sun-arc-svg dv-arc-svg" xmlns="http://www.w3.org/2000/svg">`;

        // Night arc
        svg += `<path d="M ${CX - R} ${CY} A ${R} ${R} 0 1 1 ${CX + R} ${CY}" fill="none" stroke="var(--arc-night)" stroke-width="5" stroke-linecap="round"/>`;

        // Day arc
        const angleDiff = Math.abs(sunriseAngle - maghribAngle);
        const dayLargeFlag = angleDiff > Math.PI ? 1 : 0;
        const sweepFlag = isRTL ? 0 : 1;
        svg += `<path d="M ${sunriseP.x} ${sunriseP.y} A ${R} ${R} 0 ${dayLargeFlag} ${sweepFlag} ${maghribP.x} ${maghribP.y}" fill="none" stroke="var(--arc-day)" stroke-width="5" stroke-linecap="round"/>`;

        // Prayer markers + labels with times
        prayers.forEach(p => {
            if (p.t === null) return;
            const a = timeToAngle(p.t);
            const pt = angleToXY(a);
            const isDawn = p.key === 'fajr' || p.key === 'isha';
            svg += `<circle cx="${pt.x}" cy="${pt.y}" r="${isDawn ? 5 : 4}" fill="${isDawn ? 'var(--arc-marker)' : 'var(--arc-day)'}"/>`;

            const labelR = R + 32;
            const lp = angleToXY(a, labelR);
            const tickEnd = angleToXY(a, R + 12);
            svg += `<line x1="${pt.x}" y1="${pt.y}" x2="${tickEnd.x}" y2="${tickEnd.y}" stroke="var(--arc-marker)" stroke-width="1.5" opacity="0.4"/>`;

            let anchor = 'middle';
            let dx = 0;
            const cosA = Math.cos(a);
            if (cosA > 0.3) { anchor = isRTL ? 'end' : 'start'; dx = 6; }
            else if (cosA < -0.3) { anchor = isRTL ? 'start' : 'end'; dx = -6; }

            // Two-line label: name + time
            svg += `<text x="${lp.x + dx}" y="${lp.y}" text-anchor="${anchor}" class="arc-label" font-size="10">${p.label}</text>`;
            svg += `<text x="${lp.x + dx}" y="${lp.y + 13}" text-anchor="${anchor}" class="arc-label arc-time" font-size="10" font-weight="700">${p.time}</text>`;
        });

        // Sun dot
        if (isToday) {
            const now = new Date();
            const nowH = now.getHours() + now.getMinutes() / 60;
            if (nowH >= fajr && nowH <= isha) {
                const sunAngle = timeToAngle(nowH);
                const sunPt = angleToXY(sunAngle);
                svg += `<circle cx="${sunPt.x}" cy="${sunPt.y}" r="8" fill="var(--arc-sun)"/>`;
                svg += `<circle cx="${sunPt.x}" cy="${sunPt.y}" r="12" fill="none" stroke="var(--arc-sun)" stroke-width="1.5" opacity="0.4"/>`;
            }
        }

        // ─── Arabic Clock inside the arc ───────────────────
        if (isToday) {
            const now2 = new Date();
            const nowDec = now2.getHours() + now2.getMinutes() / 60 + now2.getSeconds() / 3600;
            const arabicH = nowDec - raw.maghrib + 12;
            const cR = 65; // clock radius — fills inside arc
            svg += buildClockSVG(CX, CY + 8, cR, arabicH, lang);
        }

        svg += `</svg>`;

        // Day/night lengths below clock
        const dayLen = maghrib - sunrise;
        const nightLen = 24 - dayLen;
        const fmtLen = (hrs) => {
            const h = Math.floor(hrs), m = Math.round((hrs - h) * 60);
            return lang === 'ar'
                ? `${H.toArabicNumerals(h)}:${H.toArabicNumerals(String(m).padStart(2, '0'))}`
                : `${h}:${String(m).padStart(2, '0')}`;
        };

        svg += `<div class="dv-arc-info">`;
        svg += `<span>☀️ ${H.t('sunArcDay')}: ${fmtLen(dayLen)}</span>`;
        svg += `<span>🌙 ${H.t('sunArcNight')}: ${fmtLen(nightLen)}</span>`;
        svg += `</div>`;

        container.innerHTML = svg;

        // Start quartz tick for second hand
        if (isToday) {
            _arabicClockTimer && clearInterval(_arabicClockTimer);
            const secEl = document.getElementById('arabic-clock-sec');
            if (secEl) {
                const clockCX = CX, clockCY = CY + 8, sL = 65 * 0.72, sT = 12;
                _arabicClockTimer = setInterval(() => {
                    const s = new Date().getSeconds();
                    const a = (s / 60) * 360 - 90;
                    const r = a * Math.PI / 180;
                    secEl.setAttribute('x1', clockCX - sT * Math.cos(r));
                    secEl.setAttribute('y1', clockCY - sT * Math.sin(r));
                    secEl.setAttribute('x2', clockCX + sL * Math.cos(r));
                    secEl.setAttribute('y2', clockCY + sL * Math.sin(r));
                }, 1000);
            }
        }
    }

    // ─── الساعة العربية التناظرية (SVG group) ─────────────
    function buildClockSVG(cx, cy, R, arabicDecimalHours, lang) {
        const toRad = (deg) => deg * Math.PI / 180;
        const h24 = ((arabicDecimalHours % 24) + 24) % 24;
        const h12 = h24 % 12;
        const mins = Math.round((h24 - Math.floor(h24)) * 60) % 60;
        const minuteAngle = (mins / 60) * 360 - 90;
        const hourAngle = (h12 / 12) * 360 + (mins / 60) * 30 - 90;
        const arabicNums = lang === 'ar'
            ? ['١٢', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١']
            : ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

        let g = `<g class="arabic-clock-group">`;

        // Rings — silver dial (مينا فضية)
        g += `<circle cx="${cx}" cy="${cy}" r="${R + 3}" fill="none" stroke="var(--gold, #f4a940)" stroke-width="0.8" opacity="0.3"/>`;
        g += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="linear-gradient(#d0d0d0,#b0b0b0)" stroke="var(--gold, #f4a940)" stroke-width="2"/>`;
        // SVG doesn't support fill gradient inline — use a defs-based radial gradient
        g += `<defs><radialGradient id="clockDial"><stop offset="0%" stop-color="#e0e0e0"/><stop offset="100%" stop-color="#b8b8b8"/></radialGradient></defs>`;
        g += `<circle cx="${cx}" cy="${cy}" r="${R - 1}" fill="url(#clockDial)"/>`;
        g += `<circle cx="${cx}" cy="${cy}" r="${R - 1.5}" fill="none" stroke="var(--gold, #f4a940)" stroke-width="0.4" opacity="0.3"/>`;

        // Hour markers + numerals — black on silver
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * 360 - 90;
            const rad = toRad(angle);
            const isMajor = i % 3 === 0;
            const innerR = isMajor ? R - 10 : R - 6;
            const outerR = R - 2;
            g += `<line x1="${cx + innerR * Math.cos(rad)}" y1="${cy + innerR * Math.sin(rad)}" x2="${cx + outerR * Math.cos(rad)}" y2="${cy + outerR * Math.sin(rad)}" stroke="#1a1a1a" stroke-width="${isMajor ? 1.8 : 0.8}" stroke-linecap="round" opacity="${isMajor ? 1 : 0.6}"/>`;
            const labelR = R - 17;
            const x = cx + labelR * Math.cos(rad);
            const y = cy + labelR * Math.sin(rad);
            g += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="#1a1a1a" font-size="${isMajor ? 11 : 9}" font-weight="${isMajor ? 700 : 500}" opacity="${isMajor ? 1 : 0.7}">${arabicNums[i]}</text>`;
        }

        // Inner decorative ring
        g += `<circle cx="${cx}" cy="${cy}" r="${R - 27}" fill="none" stroke="#1a1a1a" stroke-width="0.4" opacity="0.12" stroke-dasharray="1.5 4"/>`;

        // Label — black
        g += `<text x="${cx}" y="${cy + 28}" text-anchor="middle" fill="#333" font-size="11" font-weight="600" opacity="0.7">${H.t('arabicTime')}</text>`;

        // Hour hand — black
        const hourLen = R * 0.48;
        const hourRad = toRad(hourAngle);
        g += `<line x1="${cx - 8 * Math.cos(hourRad)}" y1="${cy - 8 * Math.sin(hourRad)}" x2="${cx + hourLen * Math.cos(hourRad)}" y2="${cy + hourLen * Math.sin(hourRad)}" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>`;

        // Minute hand — black
        const minLen = R * 0.68;
        const minRad = toRad(minuteAngle);
        g += `<line x1="${cx - 10 * Math.cos(minRad)}" y1="${cy - 10 * Math.sin(minRad)}" x2="${cx + minLen * Math.cos(minRad)}" y2="${cy + minLen * Math.sin(minRad)}" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>`;

        // Second hand — black
        const now3 = new Date();
        const secs = now3.getSeconds();
        const secAngle = (secs / 60) * 360 - 90;
        const secLen = R * 0.72;
        const secRad = toRad(secAngle);
        g += `<line id="arabic-clock-sec" x1="${cx - 12 * Math.cos(secRad)}" y1="${cy - 12 * Math.sin(secRad)}" x2="${cx + secLen * Math.cos(secRad)}" y2="${cy + secLen * Math.sin(secRad)}" stroke="#1a1a1a" stroke-width="0.8" stroke-linecap="round" opacity="0.85"/>`;

        // Center dot — gold bezel with black center
        g += `<circle cx="${cx}" cy="${cy}" r="4" fill="var(--gold, #f4a940)"/>`;
        g += `<circle cx="${cx}" cy="${cy}" r="2" fill="#1a1a1a"/>`;

        g += `</g>`;
        return g;
    }

    // ─── Live Weather (Open-Meteo) ─────────────────────────
    async function fetchLiveWeather(gYear, gMonth, gDay, isToday) {
        const el = document.getElementById('dv-weather-live');
        if (!el) return;

        let lat = 0, lng = 0;
        try {
            if (PT) {
                const s = PT.getSettings();
                lat = s.lat; lng = s.lng;
            }
        } catch (e) {}
        if (!lat && !lng) { el.innerHTML = ''; const sec = document.getElementById('dv-weather-section'); if (sec) sec.style.display = 'none'; return; }

        const lang = H.getLang();
        const dateStr = `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;

        // Check localStorage cache
        const cacheKey = `weather_${dateStr}_${Math.round(lat*10)}_${Math.round(lng*10)}`;
        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached && Date.now() - cached.ts < 3600000) {
                renderWeatherData(el, cached.data, lang);
                return;
            }
        } catch (e) {}

        try {
            const url = isToday
                ? `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=1`
                : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,uv_index_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })); } catch (e) {}
            renderWeatherData(el, data, lang);
        } catch (err) {
            el.innerHTML = '';
            const sec = document.getElementById('dv-weather-section');
            if (sec) sec.style.display = 'none';
        }
    }

    function renderWeatherData(el, data, lang) {
        const weatherIcons = {
            0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
            45: '🌫️', 48: '🌫️',
            51: '🌦️', 53: '🌦️', 55: '🌧️',
            56: '🌨️', 57: '🌨️',
            61: '🌧️', 63: '🌧️', 65: '🌧️',
            66: '🌨️', 67: '🌨️',
            71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
            80: '🌦️', 81: '🌧️', 82: '🌧️',
            85: '🌨️', 86: '🌨️',
            95: '⛈️', 96: '⛈️', 99: '⛈️'
        };
        const weatherDesc = {
            ar: { 0: 'صافٍ', 1: 'صافٍ غالبًا', 2: 'غائم جزئيًّا', 3: 'غائم', 45: 'ضباب', 48: 'ضباب متجمد', 51: 'رذاذ خفيف', 53: 'رذاذ', 55: 'رذاذ كثيف', 61: 'مطر خفيف', 63: 'مطر', 65: 'مطر غزير', 71: 'ثلج خفيف', 73: 'ثلج', 75: 'ثلج كثيف', 80: 'زخات مطر', 81: 'زخات مطر', 82: 'زخات غزيرة', 85: 'زخات ثلج', 95: 'عاصفة رعدية', 96: 'عاصفة رعدية مع بَرَد' },
            en: { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers', 85: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail' }
        };

        let html = '<div class="dv-weather-grid">';

        if (data.current) {
            const c = data.current;
            const icon = weatherIcons[c.weather_code] || '🌡️';
            const desc = (weatherDesc[lang] || weatherDesc.ar)[c.weather_code] || '';
            html += `<div class="dv-weather-current">`;
            html += `<span class="dv-weather-icon">${icon}</span>`;
            html += `<span class="dv-weather-temp">${Math.round(c.temperature_2m)}°</span>`;
            html += `<span class="dv-weather-desc">${desc}</span>`;
            html += `</div>`;

            html += `<div class="dv-weather-details">`;
            html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherFeels')}</span><span>${Math.round(c.apparent_temperature)}°</span></div>`;
            html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherHumidity')}</span><span>${c.relative_humidity_2m}%</span></div>`;
            html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherWind')}</span><span>${Math.round(c.wind_speed_10m)} ${H.t('weatherKmh')}</span></div>`;
            if (c.precipitation > 0) {
                html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherPrecip')}</span><span>${c.precipitation} ${H.t('weatherMm')}</span></div>`;
            }
            html += `</div>`;
        }

        if (data.daily) {
            const d = data.daily;
            const maxT = d.temperature_2m_max ? Math.round(d.temperature_2m_max[0]) : null;
            const minT = d.temperature_2m_min ? Math.round(d.temperature_2m_min[0]) : null;
            const precip = d.precipitation_probability_max ? d.precipitation_probability_max[0] : null;
            const uv = d.uv_index_max ? Math.round(d.uv_index_max[0]) : null;
            const wCode = d.weather_code ? d.weather_code[0] : null;

            if (!data.current && wCode !== null) {
                const icon = weatherIcons[wCode] || '🌡️';
                const desc = (weatherDesc[lang] || weatherDesc.ar)[wCode] || '';
                html += `<div class="dv-weather-current">`;
                html += `<span class="dv-weather-icon">${icon}</span>`;
                if (maxT !== null) html += `<span class="dv-weather-temp">${maxT}° / ${minT}°</span>`;
                html += `<span class="dv-weather-desc">${desc}</span>`;
                html += `</div>`;
            }

            html += `<div class="dv-weather-details">`;
            if (data.current && maxT !== null) {
                html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherHigh')}</span><span>${maxT}°</span></div>`;
                html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherLow')}</span><span>${minT}°</span></div>`;
            }
            if (precip !== null && precip > 0) {
                html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherRainChance')}</span><span>${precip}%</span></div>`;
            }
            if (uv !== null) {
                html += `<div class="dv-weather-detail"><span class="dv-weather-detail-label">${H.t('weatherUV')}</span><span>${uv}</span></div>`;
            }
            html += `</div>`;
        }

        html += '</div>';
        el.innerHTML = html;
    }

    // ─── AI Section ──────────────────────────────────────────
    function renderAISection(hijri, gYear, gMonth, gDay, dow) {
        const el = document.getElementById('dv-ai-section');
        if (!el || !AI) { if (el) el.style.display = 'none'; return; }

        // Show skeleton loading
        el.style.display = '';
        el.innerHTML = `
            <div class="dv-ai-title">✦ ${H.t('aiSectionTitle')}</div>
            <div class="dv-ai-skeleton">
                <div class="dv-ai-card"><div class="dv-ai-card-label">${H.t('aiVerse')}</div></div>
                <div class="dv-ai-card"><div class="dv-ai-card-label">${H.t('aiHadith')}</div></div>
                <div class="dv-ai-card"><div class="dv-ai-card-label">${H.t('aiWisdom')}</div></div>
            </div>`;

        // Build context
        const tale3 = H.getTale3(gMonth, gDay);
        const season = H.getSeason(gMonth, gDay);
        const moon = H.getMoonPhase(gYear, gMonth, gDay);
        const event = H.getEvent(hijri.month, hijri.day);
        let locCity = '';
        try {
            const loc = JSON.parse(localStorage.getItem('prayer-loc'));
            if (loc && loc.name) locCity = loc.name;
        } catch (e) {}

        const ctx = {
            hijriDay: hijri.day,
            hijriMonth: hijri.month,
            hijriMonthName: H.monthName(hijri.month - 1),
            hijriYear: hijri.year,
            gregDay: gDay,
            gregMonthName: H.gregMonthName(gMonth - 1),
            gregYear: gYear,
            dayOfWeek: H.dayName(dow),
            islamicEvent: event ? event.name : '',
            moonPhase: moon ? moon.name : '',
            anwaMansion: tale3 ? tale3.name : '',
            anwaSeason: season ? season.name : '',
            locationCity: locCity
        };

        AI.fetchDailyContent(ctx).then(data => {
            if (!data || (!data.verse && !data.reflection && !data.hadith)) {
                el.innerHTML = `<div class="dv-ai-title">✦ ${H.t('aiSectionTitle')}</div>
                    <div class="dv-ai-error">${H.t('aiOffline')}</div>`;
                return;
            }
            let html = `<div class="dv-ai-title">✦ ${H.t('aiSectionTitle')}</div>`;

            // Verse + reflection
            if (data.verse && data.verse.text) {
                html += `<div class="dv-ai-card">
                    <div class="dv-ai-card-label">${H.t('aiVerse')}</div>
                    <div class="dv-ai-card-text">﴿${data.verse.text}﴾</div>
                    <div class="dv-ai-card-source">${data.verse.surah || ''} ${data.verse.number ? '— ' + data.verse.number : ''}</div>
                </div>`;
            }
            if (data.reflection) {
                html += `<div class="dv-ai-card">
                    <div class="dv-ai-card-label">${H.t('aiReflection')}</div>
                    <div class="dv-ai-card-text">${data.reflection}</div>
                </div>`;
            }

            // Hadith
            if (data.hadith && data.hadith.text) {
                html += `<div class="dv-ai-card">
                    <div class="dv-ai-card-label">${H.t('aiHadith')}</div>
                    <div class="dv-ai-card-text">«${data.hadith.text}»</div>
                    <div class="dv-ai-card-source">${data.hadith.source || ''}</div>
                </div>`;
            }

            // Wisdom
            if (data.wisdom) {
                html += `<div class="dv-ai-card">
                    <div class="dv-ai-card-label">${H.t('aiWisdom')}</div>
                    <div class="dv-ai-card-text">${data.wisdom}</div>
                </div>`;
            }

            // Historical event
            if (data.historicalEvent) {
                html += `<div class="dv-ai-card">
                    <div class="dv-ai-card-label">${H.t('aiHistory')}</div>
                    <div class="dv-ai-card-text">${data.historicalEvent}</div>
                </div>`;
            }

            el.innerHTML = html;
        }).catch(() => {
            el.innerHTML = `<div class="dv-ai-title">✦ ${H.t('aiSectionTitle')}</div>
                <div class="dv-ai-error">${H.t('aiError')}</div>`;
        });
    }

    function renderDayView(gregDate) {
        const dayView = document.getElementById('day-view');
        if (!dayView) return;

        const lang = H.getLang();
        const now = new Date();
        let gYear, gMonth, gDay, isToday;

        if (gregDate) {
            gYear = gregDate.year; gMonth = gregDate.month; gDay = gregDate.day;
            isToday = gYear === now.getFullYear() && gMonth === (now.getMonth() + 1) && gDay === now.getDate();
        } else {
            gYear = now.getFullYear(); gMonth = now.getMonth() + 1; gDay = now.getDate();
            isToday = true;
        }

        // Show/hide "Today" button
        const dvTodayBtn = document.getElementById('dv-today-btn');
        if (dvTodayBtn) {
            dvTodayBtn.style.display = isToday ? 'none' : '';
            dvTodayBtn.textContent = H.t('today');
        }

        const jdn = H.gregorianToJDN(gYear, gMonth, gDay);
        const hijri = H.jdnToHijri(jdn);
        const dow = H.dayOfWeek(jdn);

        // Day name
        document.getElementById('dv-day-name').textContent = H.dayName(dow);

        // Hijri date
        document.getElementById('dv-hijri-day').textContent = lang === 'ar' ? H.toArabicNumerals(hijri.day) : hijri.day;
        document.getElementById('dv-hijri-month').textContent = H.monthName(hijri.month - 1);
        document.getElementById('dv-hijri-year').textContent = lang === 'ar' ? H.toArabicNumerals(hijri.year) : hijri.year;
        const dvHijriCol = document.querySelector('.dv-hijri');
        if (dvHijriCol) {
            const isSacred = H.isSacredMonth(hijri.month);
            dvHijriCol.classList.toggle('sacred-month', isSacred);
            dvHijriCol.dataset.sacredLabel = lang === 'ar' ? 'شهر حرام' : 'SM';
            dvHijriCol.title = isSacred && lang === 'en' ? 'Sacred Month — one of the four inviolable months in Islam' : '';
        }

        // Gregorian date
        document.getElementById('dv-greg-day').textContent = lang === 'ar' ? H.toArabicNumerals(gDay) : gDay;
        document.getElementById('dv-greg-month').textContent = H.gregMonthName(gMonth - 1);
        document.getElementById('dv-greg-year').textContent = lang === 'ar' ? H.toArabicNumerals(gYear) : gYear;

        // Event
        const event = H.getEvent(hijri.month, hijri.day);
        const eventEl = document.getElementById('dv-event');
        if (event) {
            eventEl.textContent = event.name;
            eventEl.style.display = '';
        } else {
            eventEl.style.display = 'none';
        }

        // Location — show city name + neighbourhood/suburb
        const locEl = document.getElementById('dv-location');
        let locCity = '', locArea = '';
        try {
            const loc = JSON.parse(localStorage.getItem('prayer-loc'));
            if (loc) {
                locCity = (lang === 'ar' ? loc.nameAr : loc.nameEn) || loc.name || '';
                // Combine suburb + neighbourhood (e.g. "مويلح، القرائن")
                const nh = lang === 'ar' ? loc.neighbourhoodAr : loc.neighbourhoodEn;
                const sb = lang === 'ar' ? loc.suburbAr : loc.suburbEn;
                locArea = [sb, nh].filter(Boolean).join('، ');
                // If we have coords but missing the current language name, fetch it
                if (!locCity && loc.lat && loc.lng) {
                    locCity = H.t('locationBased');
                    (async () => {
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json&accept-language=${lang}&addressdetails=1`, {
                                headers: { 'User-Agent': 'HijriCalendar/2.0' }
                            });
                            if (res.ok) {
                                const data = await res.json();
                                const addr = data.address || {};
                                const isVillageCity = addr.city && addr.village && addr.county;
                                const city = isVillageCity ? addr.county : (addr.city || addr.town || addr.county || addr.village || addr.state || '');
                                const neighbourhood = addr.neighbourhood || addr.quarter || '';
                                const suburb = addr.suburb || (isVillageCity ? addr.village : (addr.village && addr.county ? addr.village : '')) || '';
                                if (city) {
                                    loc[lang === 'ar' ? 'nameAr' : 'nameEn'] = city;
                                    loc[lang === 'ar' ? 'suburbAr' : 'suburbEn'] = suburb;
                                    loc[lang === 'ar' ? 'neighbourhoodAr' : 'neighbourhoodEn'] = neighbourhood;
                                    localStorage.setItem('prayer-loc', JSON.stringify(loc));
                                    const area = [suburb, neighbourhood].filter(Boolean).join('، ');
                                    locEl.innerHTML = city + (area ? '<br><span class="dv-suburb">' + area + '</span>' : '');
                                }
                            }
                        } catch (e) {}
                    })();
                }
            }
        } catch (e) {}
        if (locCity) {
            locEl.innerHTML = locCity + (locArea ? '<br><span class="dv-suburb">' + locArea + '</span>' : '');
        } else {
            locEl.textContent = H.t('locationBased');
        }

        // Prayer times & sun arc
        let times = null;
        if (PT) {
            try {
                const isRamadan = hijri.month === 9;
                if (isToday) {
                    times = PT.getForToday(isRamadan);
                } else {
                    times = PT.getForDate({ year: gYear, month: gMonth, day: gDay }, isRamadan);
                }
            } catch (e) {}
        }
        renderDayViewArc(times, isToday);

        // الزمن العربي — فقط لليوم الحالي
        _arabTimeTimer && clearInterval(_arabTimeTimer);
        const arabTimeEl = document.getElementById('dv-arab-time');
        if (arabTimeEl) {
            if (isToday && times && times._raw) {
                const _atSunrise = times._raw.sunrise, _atMaghrib = times._raw.maghrib;
                const _atNameSpan = arabTimeEl.querySelector('.dv-arab-time-name');
                const _atHelpBtn = arabTimeEl.querySelector('.dv-arab-time-help');
                if (_atHelpBtn) _atHelpBtn.textContent = lang === 'en' ? '?' : '؟';
                let _atCurrent = null;
                const updateArabTime = () => {
                    const n = new Date();
                    const nd = n.getHours() + n.getMinutes() / 60;
                    const at = H.getArabicTimeName(nd, _atSunrise, _atMaghrib);
                    _atCurrent = at;
                    if (_atNameSpan) _atNameSpan.textContent = lang === 'en' ? at.nameEn : at.nameAr;
                };
                updateArabTime();
                // (؟) — onclick يُستبدل كل render فلا تتراكم المستمعات
                if (_atHelpBtn) {
                    _atHelpBtn.onclick = (e) => {
                        e.stopPropagation();
                        const old = arabTimeEl.querySelector('.dv-arab-time-tooltip');
                        if (old) { old.remove(); return; }
                        if (!_atCurrent) return;
                        const tip = document.createElement('div');
                        tip.className = 'dv-arab-time-tooltip';
                        const titleText = lang === 'en' ? 'Arabic Time Name' : '\u0627\u0644\u0632\u0645\u0646 \u0627\u0644\u0639\u0631\u0628\u064a';
                        const desc = lang === 'en' ? _atCurrent.descEn : _atCurrent.descAr;
                        const src = lang === 'en'
                            ? 'From: Fiqh al-Lugha \u2014 al-Tha\u02bfalibi'
                            : '\u0627\u0644\u0645\u0635\u062f\u0631: \u0641\u0642\u0647 \u0627\u0644\u0644\u063a\u0629 \u0648\u0633\u0631 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u2014 \u0627\u0644\u062b\u0639\u0627\u0644\u0628\u064a';
                        const intro = lang === 'en'
                            ? 'The Arabs divided day and night into 12 periods each, varying in length by season.'
                            : '\u0642\u0633\u0651\u0645 \u0627\u0644\u0639\u0631\u0628 \u0627\u0644\u0646\u0647\u0627\u0631 \u0648\u0627\u0644\u0644\u064a\u0644 \u0625\u0644\u0649 12 \u0632\u0645\u0646\u0627\u064b \u0644\u0643\u0644\u0651 \u0645\u0646\u0647\u0645\u0627\u060c \u062a\u062a\u063a\u064a\u0631 \u0623\u0637\u0648\u0627\u0644\u0647\u0627 \u062d\u0633\u0628 \u0627\u0644\u0641\u0635\u0644.';
                        tip.innerHTML = '<div class="att-title">' + titleText + '</div>'
                            + '<div class="att-desc">' + desc + '</div>'
                            + '<div class="att-desc" style="font-size:0.75rem;opacity:0.6;margin-top:4px">' + intro + '</div>'
                            + '<div class="att-src">' + src + '</div>';
                        arabTimeEl.appendChild(tip);
                        const closeTip = (ev) => {
                            if (!tip.contains(ev.target) && ev.target !== _atHelpBtn) {
                                tip.remove();
                                document.removeEventListener('click', closeTip);
                            }
                        };
                        setTimeout(() => document.addEventListener('click', closeTip), 10);
                    };
                }
                arabTimeEl.style.display = '';
                _arabTimeTimer = setInterval(updateArabTime, 60000);
            } else {
                arabTimeEl.style.display = 'none';
            }
        }

        // Moon phase
        const moonContainer = document.getElementById('dv-moon-container');
        const moon = H.getMoonPhase(gYear, gMonth, gDay);
        let mLat = 0, mLng = 0;
        if (typeof PT !== 'undefined' && PT.getSettings) { const ps = PT.getSettings(); mLat = ps.lat || 0; mLng = ps.lng || 0; }
        if (moon) {
            const now = new Date();
            const moonTilt = H.getMoonTiltAngle(gYear, gMonth, gDay, now.getHours() + now.getMinutes() / 60, mLat, mLng);
            let moonHtml = `<div class="dv-moon-face">${renderMoonSVG(moon.phaseFraction, 90, moonTilt)}</div>`;
            moonHtml += `<div class="dv-moon-label">${moon.name}</div>`;
            moonHtml += `<div class="dv-moon-illumination">${H.t('moonIllumination')} ${moon.illumination}%</div>`;
            moonContainer.innerHTML = moonHtml;
            moonContainer.classList.add('dv-moon-clickable');
            moonContainer.onclick = () => {
                showAnwaDetail('moon-phases', { year: gYear, month: gMonth, day: gDay });
            };
        }

        // Moonrise / Moonset
        const moonriseEl = document.getElementById('dv-moonrise-section');
        if (mLat || mLng) {
            const mTz = -(new Date(gYear, gMonth - 1, gDay).getTimezoneOffset()) / 60;
            const mrs = H.getMoonriseMoonset(gYear, gMonth, gDay, mLat, mLng, mTz);
            if (mrs && (mrs.rise || mrs.set)) {
                let mrsHtml = '<div class="dv-moonrise-row">';
                if (mrs.rise) {
                    const rAz = lang === 'en' ? mrs.rise.az + '°' : H.toArabicNumerals(String(mrs.rise.az)) + '°';
                    mrsHtml += `<span class="dv-moonrise-item"><span class="dv-moonrise-icon">🌒</span> ${H.t('moonriseLabel')} <strong>${mrs.rise.time}</strong> <span class="dv-moonrise-dir">${mrs.rise.dir} ${rAz}</span></span>`;
                }
                if (mrs.set) {
                    const sAz = lang === 'en' ? mrs.set.az + '°' : H.toArabicNumerals(String(mrs.set.az)) + '°';
                    mrsHtml += `<span class="dv-moonrise-item"><span class="dv-moonrise-icon">🌘</span> ${H.t('moonsetLabel')} <strong>${mrs.set.time}</strong> <span class="dv-moonrise-dir">${mrs.set.dir} ${sAz}</span></span>`;
                }
                mrsHtml += '</div>';
                moonriseEl.innerHTML = mrsHtml;
                moonriseEl.style.display = '';
            } else {
                moonriseEl.style.display = 'none';
            }
        } else {
            moonriseEl.style.display = 'none';
        }

        // Tide
        const tideEl = document.getElementById('dv-tide-section');
        if (moon && moon.tide && moon.tide.events && moon.tide.events.length > 0) {
            const tideTypes = { spring: H.t('tideSpring'), neap: H.t('tideNeap'), rising: H.t('tideRising'), falling: H.t('tideFalling') };
            const tideName = tideTypes[moon.tide.type] || moon.tide.type;
            let tideHtml = `<div class="dv-section-title">${H.t('tideMovements')}</div>`;
            tideHtml += `<div class="dv-tide-events">`;
            moon.tide.events.forEach(e => {
                const label = e.type === 'high' ? H.t('tideHigh') : H.t('tideLow');
                tideHtml += `<span class="dv-tide-item${e.type === 'high' ? ' dv-tide-high' : ''}">${label} ${e.time}</span>`;
            });
            tideHtml += `</div>`;
            tideEl.innerHTML = tideHtml;
            tideEl.style.display = '';
        } else {
            tideEl.style.display = 'none';
        }

        // Weather — live data only
        const weatherEl = document.getElementById('dv-weather-section');
        const tale3 = H.getTale3(gMonth, gDay);
        weatherEl.style.display = '';
        let weatherHtml = `<div class="dv-section-title">${H.t('weatherTitle')}</div>`;
        weatherHtml += `<div class="dv-weather-live" id="dv-weather-live"></div>`;
        weatherEl.innerHTML = weatherHtml;
        fetchLiveWeather(gYear, gMonth, gDay, isToday);

        // Anwa summary + Anwa weather description
        const anwaEl = document.getElementById('dv-anwa-section');
        const season = H.getSeason(gMonth, gDay);
        const durr = H.getDurr(gMonth, gDay, gYear);
        const winds = H.getSeasonalWinds(gMonth, gDay);
        const fishList = H.getSeasonalFish(gMonth, gDay).filter(f => f.inSeason);
        const cropsList = H.getSeasonalCrops(gMonth, gDay).filter(c => c.inSeason);
        const wildlifeList = H.getSeasonalWildlife(gMonth, gDay).filter(w => w.inSeason);

        const helpBtn = lang === 'en' ? `<button class="info-help-btn" id="dv-anwa-help-btn" aria-label="What is this?">?</button>` : '';
        let anwaHtml = `<div class="dv-section-title">${H.t('anwaSeasons')}${helpBtn}</div>`;
        if (lang === 'en') {
            anwaHtml += `<div class="info-help-popup" id="dv-anwa-help-popup"><h4>${H.t('anwaExplainTitle')}</h4><p>${H.t('anwaExplain').replace(/\n/g, '<br>')}</p></div>`;
        }
        anwaHtml += `<div class="dv-anwa-grid">`;
        if (tale3) anwaHtml += `<div class="dv-anwa-card"><div class="dv-anwa-label">${H.t('tale3Label')}</div><div class="dv-anwa-value">${tale3.name}</div></div>`;
        if (season) anwaHtml += `<div class="dv-anwa-card"><div class="dv-anwa-label">${H.t('seasonLabel')}</div><div class="dv-anwa-value">${season.name}</div></div>`;
        if (durr) anwaHtml += `<div class="dv-anwa-card"><div class="dv-anwa-label">${H.t('durrLabel')}</div><div class="dv-anwa-value">${_formatDurrName(durr)}</div></div>`;
        anwaHtml += `</div>`;
        // زر ديرة الدرور
        anwaHtml += `<button class="durur-more-btn dv-anwa-clickable" data-anwa-type="durur-circle">${H.t('dururCircleMore')}</button>`;
        if (tale3 && tale3.weather) {
            anwaHtml += `<div class="dv-anwa-weather">${tale3.weather}</div>`;
        }
        anwaEl.innerHTML = anwaHtml;

        // Click handlers for anwa cards
        anwaEl.querySelectorAll('.dv-anwa-clickable').forEach(card => {
            card.addEventListener('click', () => {
                showAnwaDetail(card.dataset.anwaType, { year: gYear, month: gMonth, day: gDay });
            });
        });

        // Setup help (?) buttons (English only)
        _setupHelpButtons();

        // بطاقات الإثراء انتقلت إلى داخل ديرة الدرور (_renderDururCircle)

        // AI content
        renderAISection(hijri, gYear, gMonth, gDay, dow);

        // Back button label
        document.getElementById('dv-back-btn').textContent = H.t('backToCalendar');

        // Language toggle active state
        const curLang = H.getLang();
        const langArBtn = document.getElementById('dv-lang-ar');
        const langEnBtn = document.getElementById('dv-lang-en');
        if (langArBtn) langArBtn.classList.toggle('active', curLang === 'ar');
        if (langEnBtn) langEnBtn.classList.toggle('active', curLang === 'en');

        // Share & back button labels
        document.getElementById('dv-share-btn').textContent = H.t('share');
        const paletteBtn = document.getElementById('dv-palette-btn');
        if (paletteBtn) paletteBtn.textContent = H.t('palette');

        // Credits
        const creditsName = document.querySelector('.dv-credits-name');
        if (creditsName) creditsName.textContent = H.t('creditsName');
        const creditsVer = document.querySelector('.dv-credits-version');
        if (creditsVer) creditsVer.textContent = H.t('creditsVersion');
        const creditsTech = document.querySelector('.dv-credits-tech');
        if (creditsTech) creditsTech.textContent = H.t('creditsTech');
    }

    function showDayView(gregDate) {
        // Set _selectedDate
        if (gregDate) {
            const now = new Date();
            const isToday = gregDate.year === now.getFullYear() && gregDate.month === (now.getMonth() + 1) && gregDate.day === now.getDate();
            _selectedDate = isToday ? null : gregDate;
        } else {
            _selectedDate = null;
        }

        renderDayView(gregDate);
        document.getElementById('day-view').style.display = '';
        document.getElementById('calendar-view').style.display = 'none';
    }

    function showCalendarView() {
        document.getElementById('day-view').style.display = 'none';
        document.getElementById('calendar-view').style.display = '';
        // Refresh calendar view state
        renderCalendar();
        renderTodayInfo();
        renderAnwaCard(_selectedDate);
        if (PT) renderPrayerTimes();
    }

    function getDayViewDate() {
        // Return the current Day View date as {year, month, day}
        if (_selectedDate) return _selectedDate;
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    }

    function navigateDayView(offset) {
        const cur = getDayViewDate();
        const d = new Date(cur.year, cur.month - 1, cur.day + offset);
        showDayView({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
    }

    // ─── Anwa Detail View ───
    let _anwaDetailOrigin = 'day'; // 'day' or 'calendar'

    // ─── Help (?) buttons — English only ───
    function _setupHelpButtons() {
        document.querySelectorAll('.info-help-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const popup = btn.parentElement.nextElementSibling;
                if (popup && popup.classList.contains('info-help-popup')) {
                    popup.classList.toggle('show');
                } else {
                    // For dirat help btn in header — find popup inside container
                    const diratPopup = document.getElementById('dirat-help-popup');
                    if (diratPopup) diratPopup.classList.toggle('show');
                }
            });
        });
    }

    // ── حساب أطوار القمر لشهر هجري معين ──
    function _getMoonPhasesForMonth(hijriYear, hijriMonth) {
        const SYNODIC = 29.530588861;
        const PHASE_FRACTIONS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
        const NAMES_AR = ['محاق', 'هلال أول', 'تربيع أول', 'أحدب متزايد', 'بدر', 'أحدب متناقص', 'تربيع أخير', 'هلال أخير'];
        const NAMES_EN = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
        // نسب الإضاءة المعتمدة لكل طور
        const STD_ILLUMINATION = [0, 25, 50, 75, 100, 75, 50, 25];

        // إيجاد اقتران القمر (المحاق) لهذا الشهر
        // نستخدم أول يوم من الشهر الهجري كمرجع لإيجاد الاقتران الصحيح
        const monthStart = H.Astronomical.monthStartJDN(hijriYear, hijriMonth);
        const approxK = H.Astronomical._approxK(hijriYear, hijriMonth);
        const k0 = Math.round(approxK);
        let bestK = k0, bestDist = Infinity;
        for (let dk = -1; dk <= 1; dk++) {
            const testJDE = H.Astronomical.newMoonJDE(k0 + dk);
            const dist = monthStart - Math.round(testJDE);
            if (dist >= 0 && dist < bestDist) { bestDist = dist; bestK = k0 + dk; }
        }
        const newMoonJDE = H.Astronomical.newMoonJDE(bestK);

        return PHASE_FRACTIONS.map((frac, idx) => {
            const phaseJDE = newMoonJDE + frac * SYNODIC;
            const phaseJDN = Math.round(phaseJDE);
            const greg = H.jdnToGregorian(phaseJDN);
            const hijri = H.jdnToHijri(phaseJDN);
            const moonData = H.getMoonPhase(greg.year, greg.month, greg.day);
            return {
                phaseIndex: idx,
                phaseFraction: frac,
                jdn: phaseJDN,
                greg, hijri,
                illumination: STD_ILLUMINATION[idx],
                nameAr: NAMES_AR[idx],
                nameEn: NAMES_EN[idx]
            };
        });
    }

    // ── عرض صفحة أطوار القمر — يوم بيوم ──
    function _renderMoonPhasesDetail(hijriYear, hijriMonth, currentGYear, currentGMonth, currentGDay, lang) {
        const totalDays = H.daysInMonth(hijriYear, hijriMonth);
        const currentJDN = H.gregorianToJDN(currentGYear, currentGMonth, currentGDay);

        // الحصول على إحداثيات المراقب
        let pLat = 0, pLng = 0;
        if (typeof PT !== 'undefined' && PT.getSettings) { const ps = PT.getSettings(); pLat = ps.lat || 0; pLng = ps.lng || 0; }

        let html = '<div class="moon-phases-timeline moon-daily-grid">';
        for (let day = 1; day <= totalDays; day++) {
            const greg = H.hijriToGregorian(hijriYear, hijriMonth, day);
            const jdn = H.gregorianToJDN(greg.year, greg.month, greg.day);
            const moonData = H.getMoonPhase(greg.year, greg.month, greg.day);
            const tilt = H.getMoonTiltAngle(greg.year, greg.month, greg.day, 20, pLat, pLng);
            const isCurrent = jdn === currentJDN;
            const phaseName = lang === 'en' ? moonData.nameEn : moonData.nameAr;
            const hDayStr = lang === 'en' ? String(day) : H.toArabicNumerals(String(day));
            const gDayMonth = greg.day + ' ' + H.gregMonthName(greg.month - 1);

            html += `<div class="moon-phase-item moon-daily-item${isCurrent ? ' current' : ''}">`;
            html += `<div class="moon-daily-day">${hDayStr}</div>`;
            html += `<div class="moon-phase-visual">${renderMoonSVG(moonData.phaseFraction, 40, tilt)}</div>`;
            html += `<div class="moon-phase-illum">${moonData.illumination}%</div>`;
            html += `<div class="moon-phase-greg-date">${gDayMonth}</div>`;
            html += `</div>`;
        }
        html += '</div>';
        return html;
    }

    // ─── تحميل وعرض البيانات المناخية التاريخية ─────────────
    async function _loadClimateStats() {
        if (_climateStats) return _climateStats;
        try {
            const r = await fetch('./climate-stats.json');
            if (r.ok) _climateStats = await r.json();
        } catch (e) { /* ملف غير متوفر — offline أو غير موجود */ }
        return _climateStats;
    }

    function _renderClimateBar(cs, lang) {
        if (!cs || !cs.temp) return '';
        const isAr = lang !== 'en';
        const toAr = (v) => isAr ? H.toArabicNumerals(String(v)) : v;
        let html = '<div class="climate-bar">';
        html += `<span class="climate-pill" title="${isAr ? 'متوسط الحرارة' : 'Avg Temperature'}">🌡️ ${toAr(cs.temp.aMin)}°–${toAr(cs.temp.aMax)}°</span>`;
        html += `<span class="climate-pill" title="${isAr ? 'احتمال المطر' : 'Rain prob.'}">🌧️ ${toAr(Math.round(cs.rain.prob * 100))}%</span>`;
        html += `<span class="climate-pill" title="${isAr ? 'سرعة الرياح' : 'Wind speed'}">💨 ${toAr(cs.wind.aMax)} ${isAr ? 'كم/س' : 'km/h'}</span>`;
        html += `<span class="climate-pill" title="${isAr ? 'الرطوبة' : 'Humidity'}">💧 ${toAr(Math.round(cs.hum))}%</span>`;
        if (cs.match != null) html += _renderMatchBadge(cs.match, lang);
        html += `<span class="climate-note">${isAr ? '٨٠ سنة' : '80yr'}</span>`;
        html += '</div>';
        return html;
    }

    function _renderMatchBadge(score, lang) {
        if (score == null) return '';
        const isAr = lang !== 'en';
        const colorClass = score >= 80 ? 'match-high' : score >= 60 ? 'match-mid' : 'match-low';
        const val = isAr ? H.toArabicNumerals(String(score)) : score;
        return `<span class="match-badge ${colorClass}" title="${isAr ? 'نسبة التطابق' : 'Match score'}">✓ ${val}%</span>`;
    }

    function _enrichAnwaWithClimate(container, lang) {
        const cs = _climateStats;
        if (!cs || !cs.anwa) return;
        const items = container.querySelectorAll('.anwa-detail-item');
        items.forEach((el, i) => {
            if (cs.anwa[i]) {
                const bar = document.createElement('div');
                bar.innerHTML = _renderClimateBar(cs.anwa[i], lang);
                el.appendChild(bar.firstElementChild || bar);
            }
        });
    }

    function _enrichDurrWithClimate(container, lang) {
        const cs = _climateStats;
        if (!cs || !cs.duror) return;
        const isAr = lang !== 'en';
        const toAr = (v) => isAr ? H.toArabicNumerals(String(v)) : v;
        const miaGroups = container.querySelectorAll('.anwa-detail-mia');
        miaGroups.forEach((miaEl, miaIdx) => {
            const durrs = miaEl.querySelectorAll('.anwa-detail-durr');
            durrs.forEach((dEl, dIdx) => {
                const key = `${miaIdx}-${dIdx}`;
                const d = cs.duror[key];
                if (d) {
                    const statsEl = document.createElement('div');
                    statsEl.className = 'anwa-detail-durr-stats';
                    statsEl.textContent = `${toAr(d.temp.aMean)}° | 🌧${toAr(Math.round(d.rain.prob * 100))}%`;
                    if (d.match != null) {
                        const badge = document.createElement('span');
                        badge.className = 'match-badge-sm ' + (d.match >= 80 ? 'match-high' : d.match >= 60 ? 'match-mid' : 'match-low');
                        badge.textContent = `${toAr(d.match)}%`;
                        statsEl.appendChild(badge);
                    }
                    dEl.appendChild(statsEl);
                }
            });
        });
    }

    function _enrichWindWithClimate(container, lang) {
        const cs = _climateStats;
        if (!cs || !cs.winds) return;
        const isAr = lang !== 'en';
        const toAr = (v) => isAr ? H.toArabicNumerals(String(v)) : v;
        // الرياح الموسمية — تبدأ بعد البوصلة
        const windItems = container.querySelectorAll('.anwa-detail-list:last-of-type .anwa-detail-item');
        windItems.forEach((el, i) => {
            if (cs.winds[i]) {
                const w = cs.winds[i];
                const stat = document.createElement('div');
                stat.className = 'climate-wind-stat';
                stat.innerHTML = `💨 ${toAr(w.wind.aMax)} ${isAr ? 'كم/س' : 'km/h'} | ${isAr ? 'السائد' : 'Dom.'}: ${w.wind.dirAr}`;
                el.appendChild(stat);
            }
        });
    }

    function _enrichSeasonWithClimate(container, lang) {
        const cs = _climateStats;
        if (!cs || !cs.seasons) return;
        const items = container.querySelectorAll('.anwa-detail-item');
        items.forEach((el, i) => {
            if (cs.seasons[i]) {
                const bar = document.createElement('div');
                bar.innerHTML = _renderClimateBar(cs.seasons[i], lang);
                el.appendChild(bar.firstElementChild || bar);
            }
        });
    }

    function showAnwaDetail(type, gregDate) {
        const { year: gYear, month: gMonth, day: gDay } = gregDate;
        const lang = H.getLang();
        const container = document.getElementById('anwa-detail-content');
        const titleEl = document.getElementById('anwa-detail-title');
        const backBtn = document.getElementById('anwa-detail-back');
        backBtn.textContent = H.t('anwaDetailBack');

        let html = '';
        if (type === 'tale3') {
            titleEl.textContent = H.t('anwaAllStars');
            html = _renderTale3Detail(gMonth, gDay, gYear, lang);
        } else if (type === 'season') {
            titleEl.textContent = H.t('anwaAllSeasons');
            html = _renderSeasonDetail(gMonth, gDay, lang);
        } else if (type === 'durr') {
            titleEl.textContent = H.t('anwaAllDurr');
            html = _renderDurrDetail(gMonth, gDay, gYear, lang);
        } else if (type === 'wind') {
            titleEl.textContent = H.t('anwaWindCompass');
            html = _renderWindDetail(gMonth, gDay, lang);
        } else if (type === 'fish') {
            titleEl.textContent = H.t('anwaAllFish');
            html = _renderListDetail('fish', gMonth, gDay, lang);
        } else if (type === 'crops') {
            titleEl.textContent = H.t('anwaAllCrops');
            html = _renderListDetail('crops', gMonth, gDay, lang);
        } else if (type === 'wildlife') {
            titleEl.textContent = H.t('anwaAllWildlife');
            html = _renderListDetail('wildlife', gMonth, gDay, lang);
        } else if (type === 'durur-circle') {
            // عنوان الديرة مع السنة الميلادية والهجرية
            const _hStart = H.gregorianToHijri(gYear, 1, 1);
            const _hEnd = H.gregorianToHijri(gYear, 12, 31);
            const _hijriYearsArr = _hStart.year === _hEnd.year ? [_hStart.year] : [_hStart.year, _hEnd.year];
            const _yearLabel = lang === 'en'
                ? `${gYear} — ${_hijriYearsArr.join('/')}`
                : `${H.toArabicNumerals(String(gYear))} — ${_hijriYearsArr.map(y => H.toArabicNumerals(String(y))).join('/')}`;
            titleEl.textContent = H.t('dururCircleTitle') + '  ' + _yearLabel;
            if (lang === 'en') {
                titleEl.innerHTML = H.t('dururCircleTitle') + '  ' + _yearLabel + ' <button class="info-help-btn" id="dirat-help-btn" aria-label="What is this?">?</button>';
            }
            html = _renderDururCircle(gMonth, gDay, gYear, lang);
        } else if (type === 'moon-phases') {
            const hijri = H.gregorianToHijri(gYear, gMonth, gDay);
            const monthLabel = H.monthName(hijri.month - 1) + ' ' + (lang === 'en' ? hijri.year : H.toArabicNumerals(String(hijri.year)));
            titleEl.textContent = H.t('moonPhasesTitle') + ' — ' + monthLabel;
            html = _renderMoonPhasesDetail(hijri.year, hijri.month, gYear, gMonth, gDay, lang);
        }

        // توسيط وتكبير عنوان ديرة الدرور
        const header = document.querySelector('.anwa-detail-header');
        if (type === 'durur-circle') {
            header.classList.add('dirat-duror-header');
        } else {
            header.classList.remove('dirat-duror-header');
        }

        container.innerHTML = html;

        // Setup help (?) button event listeners (English only)
        _setupHelpButtons();

        // Determine origin (day-view or calendar-view)
        const dvVisible = document.getElementById('day-view').style.display !== 'none';
        _anwaDetailOrigin = dvVisible ? 'day' : 'calendar';

        document.getElementById('day-view').style.display = 'none';
        document.getElementById('calendar-view').style.display = 'none';
        document.getElementById('anwa-detail-view').style.display = '';

        // Setup durur circle interactivity after DOM insertion
        if (type === 'durur-circle') {
            setTimeout(() => {
                _setupDururCircleEvents(container);
                _populateArchiveCard(container);
            }, 50);
        }

        // Scroll to current item
        const current = container.querySelector('.anwa-detail-item.current') || container.querySelector('.moon-daily-item.current');
        if (current) {
            setTimeout(() => current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 150);
        }

        // إثراء بالبيانات المناخية (لاحق — async)
        if (['tale3', 'durr', 'wind', 'season'].includes(type)) {
            _loadClimateStats().then(stats => {
                if (!stats) return;
                if (type === 'tale3') _enrichAnwaWithClimate(container, lang);
                else if (type === 'durr') _enrichDurrWithClimate(container, lang);
                else if (type === 'wind') _enrichWindWithClimate(container, lang);
                else if (type === 'season') _enrichSeasonWithClimate(container, lang);
            });
        }
    }

    function closeAnwaDetail() {
        document.getElementById('anwa-detail-view').style.display = 'none';
        if (_anwaDetailOrigin === 'calendar') {
            document.getElementById('calendar-view').style.display = '';
        } else {
            document.getElementById('day-view').style.display = '';
        }
    }

    function _fmtDateRange(from, to, lang) {
        const mNames = lang === 'en'
            ? ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            : ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        return `${from[1]} ${mNames[from[0]]} — ${to[1]} ${mNames[to[0]]}`;
    }

    function _renderTale3Detail(gMonth, gDay, gYear, lang) {
        const allStars = H.TAWALIE;
        const currentTale3 = H.getTale3(gMonth, gDay);
        let html = '<div class="anwa-detail-list">';
        allStars.forEach((star, i) => {
            const name = lang === 'en' ? star.en : star.ar;
            const weather = lang === 'en' ? star.weatherEn : star.weatherAr;
            const isCurrent = currentTale3 && currentTale3.nameAr === star.ar;
            html += `<div class="anwa-detail-item${isCurrent ? ' current' : ''}">`;
            html += `<div class="anwa-detail-item-header">`;
            html += `<span class="anwa-detail-item-num">${i + 1}</span>`;
            html += `<span class="anwa-detail-item-name">${name}</span>`;
            if (isCurrent) html += `<span class="anwa-detail-badge">${H.t('anwaCurrent')}</span>`;
            html += `</div>`;
            html += `<div class="anwa-detail-item-dates">${H.t('anwaDates')}: ${_fmtDateRange(star.from, star.to, lang)}</div>`;
            html += `<div class="anwa-detail-item-weather">${weather}</div>`;
            html += `</div>`;
        });
        html += '</div>';
        return html;
    }

    function _renderSeasonDetail(gMonth, gDay, lang) {
        const allSeasons = H.SEASONS;
        const currentSeason = H.getSeason(gMonth, gDay);
        let html = '<div class="anwa-detail-list">';
        allSeasons.forEach((season, i) => {
            const name = lang === 'en' ? season.en : season.ar;
            const isCurrent = currentSeason && currentSeason.nameAr === season.ar;
            // Find related tawalie
            const relatedStars = H.TAWALIE.filter(t => {
                const tMid = t.from[0] * 100 + Math.floor((t.from[1] + t.to[1]) / 2);
                return H._matchRange(t.from[0], t.from[1], season.from, season.to) ||
                       H._matchRange(t.to[0], t.to[1], season.from, season.to);
            });
            html += `<div class="anwa-detail-item${isCurrent ? ' current' : ''}">`;
            html += `<div class="anwa-detail-item-header">`;
            html += `<span class="anwa-detail-item-num">${i + 1}</span>`;
            html += `<span class="anwa-detail-item-name">${name}</span>`;
            if (isCurrent) html += `<span class="anwa-detail-badge">${H.t('anwaCurrent')}</span>`;
            html += `</div>`;
            html += `<div class="anwa-detail-item-dates">${H.t('anwaDates')}: ${_fmtDateRange(season.from, season.to, lang)}</div>`;
            if (relatedStars.length > 0) {
                html += `<div class="anwa-detail-item-related">${H.t('tale3Label')}: ${relatedStars.map(s => lang === 'en' ? s.en : s.ar).join('، ')}</div>`;
            }
            html += `</div>`;
        });
        html += '</div>';
        return html;
    }

    function _renderDurrDetail(gMonth, gDay, gYear, lang) {
        const currentDurr = H.getDurr(gMonth, gDay, gYear);
        const miaNames = H.DUROR_MIA[lang];
        const durrNames = H.DUROR_LABELS[lang];
        let html = '';

        // Suhail day counter
        html += `<div class="anwa-detail-suhail">`;
        html += `<div class="anwa-detail-suhail-label">${H.t('anwaSuhailDay')}</div>`;
        html += `<div class="anwa-detail-suhail-value">${currentDurr.suhailDay}</div>`;
        html += `<div class="anwa-detail-suhail-sub">${currentDurr.mia}</div>`;
        html += `</div>`;

        // 4 hundreds
        miaNames.forEach((miaName, miaIdx) => {
            const isMiaCurrent = currentDurr.mia === miaName;
            const maxDurrs = miaIdx === 3 ? 7 : 10;
            html += `<div class="anwa-detail-mia${isMiaCurrent ? ' current-mia' : ''}">`;
            html += `<div class="anwa-detail-mia-header">${miaName}</div>`;
            html += `<div class="anwa-detail-durr-grid">`;
            for (let d = 0; d < maxDurrs; d++) {
                const durrName = durrNames[d] || `در ${(d + 1) * 10}`;
                const isDurrCurrent = isMiaCurrent && currentDurr.durr === durrNames[d];
                html += `<div class="anwa-detail-durr${isDurrCurrent ? ' current' : ''}">`;
                html += `<span class="anwa-detail-durr-name">${durrName}</span>`;
                if (isDurrCurrent) html += `<span class="anwa-detail-badge">${H.t('anwaCurrent')}</span>`;
                html += `</div>`;
            }
            html += `</div></div>`;
        });
        return html;
    }

    function _renderWindDetail(gMonth, gDay, lang) {
        const compass = H.ANWA_ENRICHMENT.windCompass;
        const seasonal = H.ANWA_ENRICHMENT.seasonalWinds;
        const currentWinds = H.getSeasonalWinds(gMonth, gDay);
        let html = '';

        // Wind compass SVG
        html += `<div class="anwa-detail-compass">`;
        html += `<svg viewBox="-160 -160 320 320" class="wind-compass-svg">`;
        // Outer circle
        html += `<circle cx="0" cy="0" r="140" fill="none" stroke="var(--papyrus-border)" stroke-width="1.5"/>`;
        html += `<circle cx="0" cy="0" r="70" fill="none" stroke="var(--papyrus-border)" stroke-width="0.5" stroke-dasharray="4,4"/>`;
        // Lines and labels for 16 directions
        compass.forEach(w => {
            const rad = (w.degree - 90) * Math.PI / 180;
            const x1 = Math.cos(rad) * 130;
            const y1 = Math.sin(rad) * 130;
            const x2 = Math.cos(rad) * 145;
            const y2 = Math.sin(rad) * 145;
            const tx = Math.cos(rad) * 110;
            const ty = Math.sin(rad) * 110;
            const name = lang === 'en' ? w.en.split('(')[0].trim() : w.ar.split('(').pop().replace(')', '').trim() || w.ar;
            const shortName = lang === 'en' ? w.en.split('(')[0].trim() : w.ar.replace(/.*\(|\).*/g, '') || w.ar.split(' ')[0];
            html += `<line x1="0" y1="0" x2="${x1}" y2="${y1}" stroke="var(--papyrus-border)" stroke-width="0.5"/>`;
            html += `<circle cx="${x2}" cy="${y2}" r="3" fill="var(--gold, #d4a017)"/>`;
            const fontSize = w.degree % 90 === 0 ? 9 : 7;
            html += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" fill="var(--papyrus-text)" font-family="var(--font-arabic)">${shortName}</text>`;
        });
        // Center dot
        html += `<circle cx="0" cy="0" r="4" fill="var(--gold, #d4a017)"/>`;
        html += `</svg></div>`;

        // Full compass list
        html += `<div class="anwa-detail-list">`;
        compass.forEach(w => {
            const name = lang === 'en' ? w.en : w.ar;
            html += `<div class="anwa-detail-item anwa-detail-item-compact">`;
            html += `<div class="anwa-detail-item-header">`;
            html += `<span class="anwa-detail-item-num">${w.degree}°</span>`;
            html += `<span class="anwa-detail-item-name">${name}</span>`;
            html += `</div></div>`;
        });
        html += `</div>`;

        // Seasonal winds
        html += `<div class="anwa-detail-section-title">${H.t('anwaSeasonalWinds')}</div>`;
        html += `<div class="anwa-detail-list">`;
        seasonal.forEach(w => {
            const name = lang === 'en' ? w.en : w.ar;
            const isCurrent = H._matchRange(gMonth, gDay, w.from, w.to);
            html += `<div class="anwa-detail-item${isCurrent ? ' current' : ''}">`;
            html += `<div class="anwa-detail-item-header">`;
            html += `<span class="anwa-detail-item-name">${name}</span>`;
            if (isCurrent) html += `<span class="anwa-detail-badge">${H.t('anwaCurrent')}</span>`;
            html += `</div>`;
            html += `<div class="anwa-detail-item-dates">${_fmtDateRange(w.from, w.to, lang)}</div>`;
            html += `</div>`;
        });
        html += `</div>`;
        return html;
    }

    function _renderListDetail(category, gMonth, gDay, lang) {
        const items = category === 'fish' ? H.getSeasonalFish(gMonth, gDay)
                    : category === 'crops' ? H.getSeasonalCrops(gMonth, gDay)
                    : H.getSeasonalWildlife(gMonth, gDay);
        const rawItems = H.ANWA_ENRICHMENT[category];
        let html = '<div class="anwa-detail-list">';
        items.forEach((item, i) => {
            const raw = rawItems[i];
            html += `<div class="anwa-detail-item${item.inSeason ? ' current' : ''}">`;
            html += `<div class="anwa-detail-item-header">`;
            html += `<span class="anwa-detail-item-num">${i + 1}</span>`;
            html += `<span class="anwa-detail-item-name">${item.name}</span>`;
            if (item.inSeason) html += `<span class="anwa-detail-badge">${H.t('anwaInSeason')}</span>`;
            else html += `<span class="anwa-detail-badge anwa-badge-off">${H.t('anwaOutSeason')}</span>`;
            html += `</div>`;
            html += `<div class="anwa-detail-item-dates">${_fmtDateRange(raw.from, raw.to, lang)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
        return html;
    }

    // ─── ديرة الدرور (Dirat al-Duror) ───

    // ألوان الحلقات
    const _RING_COLORS = {
        mia: ['#c4956a', '#6b9dba', '#7ab87a', '#c75050'], // صفري، شتاء، صيف، قيظ
        miaDark: ['#8a6540', '#4a7090', '#508050', '#904040'],
        zodiac: ['#e8c170', '#d4a855', '#c49440', '#b8842e', '#a87420', '#c49440',
                 '#e8c170', '#d4a855', '#c49440', '#b8842e', '#a87420', '#c49440'],
        zodiacDark: ['#6a5530', '#605028', '#584825', '#504020', '#483818', '#504020',
                     '#6a5530', '#605028', '#584825', '#504020', '#483818', '#504020'],
        star: '#f5edd5', starDark: '#2a2418',
        starCurrent: '#f0d890', starCurrentDark: '#4a3d20',
        // ألوان الدرور — متدرجة حسب المائة (الفصل)
        durrMia: [
            // المائة الأولى (صفري) — تدرجات برتقالي/ترابي
            ['#d4a878','#d0a470','#cca068','#c89c60','#c49858','#c09450','#bc9048','#b88c40','#b48838','#b08430'],
            // المائة الثانية (شتاء) — تدرجات أزرق
            ['#82b0cc','#7cacc8','#76a8c4','#70a4c0','#6aa0bc','#649cb8','#5e98b4','#5894b0','#5290ac','#4c8ca8'],
            // المائة الثالثة (صيف) — تدرجات أخضر
            ['#8cc898','#86c490','#80c088','#7abc80','#74b878','#6eb470','#68b068','#62ac60','#5ca858','#56a450'],
            // المائة الرابعة (قيظ) — تدرجات أحمر (7 فقط)
            ['#d06868','#cc6060','#c85858','#c45050','#c04848','#bc4040','#b83838']
        ],
        durrMiaDark: [
            ['#6a5030','#664c2c','#624828','#5e4424','#5a4020','#563c1c','#523818','#4e3414','#4a3010','#462c0c'],
            ['#3a6080','#38607c','#365e78','#345c74','#325a70','#30586c','#2e5668','#2c5464','#2a5260','#28505c'],
            ['#3a6840','#38643c','#366038','#345c34','#325830','#30542c','#2e5028','#2c4c24','#2a4820','#28441c'],
            ['#703838','#6c3434','#683030','#642c2c','#602828','#5c2424','#582020']
        ],
        durrCurrent: '#d4a855', durrCurrentDark: '#6a5530',
        wind: '#a8c0d4', windDark: '#2a3848',
        windCurrent: '#5a8fad', windCurrentDark: '#3a5a7a',
        seasonSummer: '#e8c4a0', seasonSummerDark: '#6a5030',
        seasonAutumn: '#d4b896', seasonAutumnDark: '#5a4428',
        seasonWinter: '#a8c8dc', seasonWinterDark: '#3a5a7a',
        seasonSpring: '#a8d4a8', seasonSpringDark: '#3a6840',
        seasonCurrent: '#f0d890', seasonCurrentDark: '#5a4a20',
        outer: '#f0ebe0', outerDark: '#1e1c18',
    };

    // _diratYear — السنة الميلادية المستخدمة لحساب زوايا الديرة (تُضبط في _renderDururCircle)
    let _diratYear = new Date().getFullYear();

    function _isLeapGregorian(y) {
        return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    }

    function _dateToAngle(month, day) {
        // حساب يوم السنة من Date مباشرة — يتعامل مع الكبيسة تلقائياً
        const dt = new Date(_diratYear, month - 1, day);
        const jan1 = new Date(_diratYear, 0, 1);
        const doy = Math.floor((dt - jan1) / 86400000) + 1;
        const totalDays = _isLeapGregorian(_diratYear) ? 366 : 365;
        // 20 يونيو = أعلى الديرة (0°)، الاتجاه عكس عقارب الساعة
        const jun20 = new Date(_diratYear, 5, 20);
        const JUN20 = Math.floor((jun20 - jan1) / 86400000) + 1;
        const offset = ((JUN20 - doy) % totalDays + totalDays) % totalDays;
        return (offset / totalDays) * 360;
    }
    // زاوية نهاية اليوم (= بداية اليوم التالي) — لسد الفجوات بين القطاعات المتجاورة
    function _dateToAngleEnd(month, day) {
        const d = new Date(_diratYear, month - 1, day + 1);
        return _dateToAngle(d.getMonth() + 1, d.getDate());
    }

    // تحويل زاوية في الديرة إلى تاريخ ميلادي (عكس _dateToAngle)
    function _angleToDate(angleDeg) {
        const totalDays = _isLeapGregorian(_diratYear) ? 366 : 365;
        const jan1 = new Date(_diratYear, 0, 1);
        const jun20 = new Date(_diratYear, 5, 20);
        const JUN20 = Math.floor((jun20 - jan1) / 86400000) + 1;
        const normAngle = ((angleDeg % 360) + 360) % 360;
        const offset = Math.round((normAngle / 360) * totalDays);
        let doy = ((JUN20 - offset) % totalDays + totalDays) % totalDays;
        if (doy === 0) doy = totalDays;
        const resultDate = new Date(jan1.getTime() + (doy - 1) * 86400000);
        return { month: resultDate.getMonth() + 1, day: resultDate.getDate() };
    }

    // تغميق لون لإنتاج لون إطار مميز
    function _darkenColor(hex, amount = 0.25) {
        const c = hex.replace('#', '');
        const r = Math.max(0, Math.round(parseInt(c.substring(0, 2), 16) * (1 - amount)));
        const g = Math.max(0, Math.round(parseInt(c.substring(2, 4), 16) * (1 - amount)));
        const b = Math.max(0, Math.round(parseInt(c.substring(4, 6), 16) * (1 - amount)));
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    function _arcPath(startDeg, endDeg, innerR, outerR, cx, cy) {
        const toRad = d => (d - 90) * Math.PI / 180;
        const s = toRad(startDeg), e = toRad(endDeg);
        const large = (endDeg - startDeg) > 180 ? 1 : 0;
        const ox1 = cx + outerR * Math.cos(s), oy1 = cy + outerR * Math.sin(s);
        const ox2 = cx + outerR * Math.cos(e), oy2 = cy + outerR * Math.sin(e);
        const ix2 = cx + innerR * Math.cos(e), iy2 = cy + innerR * Math.sin(e);
        const ix1 = cx + innerR * Math.cos(s), iy1 = cy + innerR * Math.sin(s);
        return `M${ox1},${oy1} A${outerR},${outerR} 0 ${large} 1 ${ox2},${oy2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large} 0 ${ix1},${iy1}Z`;
    }

    function _radialText(text, midDeg, radius, cx, cy, fontSize, bold, extraClass, extraAttrs) {
        const rad = (midDeg - 90) * Math.PI / 180;
        const x = cx + radius * Math.cos(rad);
        const y = cy + radius * Math.sin(rad);
        let rot = midDeg;
        if (midDeg > 90 && midDeg < 270) rot += 180;
        const fw = bold ? ' font-weight="700"' : '';
        const cls = extraClass ? `durur-text ${extraClass}` : 'durur-text';
        const attrs = extraAttrs ? ` ${extraAttrs}` : '';
        return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}"${fw} fill="var(--papyrus-text)" font-family="Calibri, sans-serif" transform="rotate(${rot},${x},${y})" class="${cls}"${attrs}>${text}</text>`;
    }

    // نص طولي (على الشعاع) — كل حرف على نقطة مختلفة
    function _radialTextVertical(text, midDeg, innerR, outerR, cx, cy, fontSize, bold) {
        if (!text) return '';
        const midR = (innerR + outerR) / 2;
        const rad = (midDeg - 90) * Math.PI / 180;
        const x = cx + midR * Math.cos(rad);
        const y = cy + midR * Math.sin(rad);
        // النص يُكتب ككلمة متصلة عادية، مُدارة بزاوية الشعاع
        // midDeg - 90 يجعل النص مائلاً على طول الشعاع
        const isBottom = midDeg > 90 && midDeg < 270;
        let rot = midDeg - 90;
        if (isBottom) rot += 180;
        const fw = bold ? ' font-weight="700"' : '';
        // نستخدم foreignObject مع div عربي لضمان اتصال الحروف
        const boxW = outerR - innerR;
        const boxH = fontSize * 1.4;
        // نقطة الـ foreignObject: مركزها على الشعاع
        const foX = x - boxW / 2;
        const foY = y - boxH / 2;
        return `<foreignObject x="${foX}" y="${foY}" width="${boxW}" height="${boxH}" transform="rotate(${rot},${x},${y})" class="durur-text-fo">` +
               `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:Calibri,sans-serif;font-size:${fontSize}px;${fw ? 'font-weight:700;' : ''}color:var(--papyrus-text);direction:rtl;text-align:center;white-space:nowrap;overflow:hidden;line-height:1;pointer-events:none;">${text}</div>` +
               `</foreignObject>`;
    }

    // توزيع الرياح على 5 حلقات فرعية — مطابق للصورة المرجعية
    // Lane 4 (خارجي) = رياح مظلة كبيرة، Lane 0 (داخلي) = رياح قصيرة
    // الرياح الأم في الحلقات الخارجية، والرياح الفرعية تتداخل تحتها
    const WIND_LANE_MAP = [
        4, // [0]  هبايب سهيل
        3, // [1]  رياح الكوس
        0, // [2]  الروايح
        0, // [3]  رياح الأكيذب
        2, // [4]  الأزيب
        4, // [5]  السهيلي
        0, // [6]  ضربة الأحيمر (ريح)
        1, // [7]  العقربي
        3, // [8]  رياح الشمال
        2, // [9]  الياهي
        1, // [10] النعشي
        0, // [11] النعايات
        3, // [12] الصبا (المطلعي)
        4, // [13] السرايات (المراويح)
        2, // [14] الطوز — فوق البوارح، تحت السرايات
        0, // [15] البوارح
        1, // [16] بارح البطين
        1, // [17] بارح الثريا
        1, // [18] بارح الجوزاء — فوق البوارح
        2, // [19] رياح السموم
        3, // [20] الغربي — فوق بارح البطين وبارح الثريا
        4, // [21] بارح المرزم — فوق الروايح
    ];
    function _assignWindLanes(winds) {
        // استخدام الخريطة الثابتة المطابقة للأصل
        if (winds.length === WIND_LANE_MAP.length) return [...WIND_LANE_MAP];
        // fallback: خوارزمية greedy إذا تغيرت البيانات
        const NUM_LANES = 5;
        const items = winds.map((w, i) => {
            const aFrom = _dateToAngle(w.from[0], w.from[1]);
            const aTo = _dateToAngleEnd(w.to[0], w.to[1]);
            let arcStart = aTo, arcEnd = aFrom;
            if (arcEnd < arcStart) arcEnd += 360;
            return { index: i, a1: arcStart, a2: arcEnd, span: arcEnd - arcStart };
        });
        const sorted = [...items].sort((a, b) => b.span - a.span);
        const lanes = Array.from({ length: NUM_LANES }, () => []);
        const laneAssignment = new Array(winds.length).fill(0);
        for (const item of sorted) {
            let placed = false;
            for (let lane = NUM_LANES - 1; lane >= 0; lane--) {
                let conflict = false;
                for (const existing of lanes[lane]) {
                    if (_anglesOverlap(item.a1, item.a2, existing.a1, existing.a2)) { conflict = true; break; }
                }
                if (!conflict) { lanes[lane].push(item); laneAssignment[item.index] = lane; placed = true; break; }
            }
            if (!placed) { lanes[0].push(item); laneAssignment[item.index] = 0; }
        }
        return laneAssignment;
    }

    // حساب يوم السنة من Date — يدعم الكبيسة
    function _doyOf(month, day) {
        const dt = new Date(_diratYear, month - 1, day);
        const jan1 = new Date(_diratYear, 0, 1);
        return Math.floor((dt - jan1) / 86400000) + 1;
    }

    // تحديد فصل الريح بناءً على منتصف فترتها
    function _windSeason(w) {
        const fm = w.from[0], fd = w.from[1], tm = w.to[0], td = w.to[1];
        const totalDays = _isLeapGregorian(_diratYear) ? 366 : 365;
        const doyFrom = _doyOf(fm, fd);
        let doyTo = _doyOf(tm, td);
        if (doyTo < doyFrom) doyTo += totalDays;
        const midDoy = ((doyFrom + doyTo) / 2) % totalDays || totalDays;
        // الفصول: صيف (القيظ)=Jun21-Sep22, خريف (الصفري)=Sep23-Dec21, شتاء=Dec22-Mar20, ربيع (الصيف)=Mar21-Jun20
        if (midDoy >= 172 && midDoy <= 265) return 'summer';   // القيظ (يونيو-سبتمبر)
        if (midDoy >= 266 && midDoy <= 355) return 'autumn';   // الصفري (سبتمبر-ديسمبر)
        if (midDoy >= 356 || midDoy <= 79)  return 'winter';   // الشتاء (ديسمبر-مارس)
        return 'spring'; // الصيف/الربيع (مارس-يونيو)
    }

    // فحص تداخل فترتين زاويتين (a1→a2 و b1→b2 حيث a2 >= a1 دائماً، قد يتجاوز 360)
    function _anglesOverlap(a1, a2, b1, b2) {
        const margin = 2; // هامش أمان 2 درجات
        // تطبيع البداية إلى 0-360، والنهاية نسبة لها
        const norm = (s, e) => {
            const ns = ((s % 360) + 360) % 360;
            let ne = ns + (e - s);
            return [ns, ne];
        };
        const [na1, na2] = norm(a1, a2);
        const [nb1, nb2] = norm(b1, b2);
        // نحول كل فترة إلى قائمة أجزاء [0-360]
        const segments = (s, e) => {
            if (e <= 360) return [[s, e]];
            return [[s, 360], [0, e - 360]];
        };
        const segsA = segments(na1, na2);
        const segsB = segments(nb1, nb2);
        // فحص تقاطع أي جزء من A مع أي جزء من B
        for (const [as, ae] of segsA) {
            for (const [bs, be] of segsB) {
                if (as - margin < be && bs - margin < ae) return true;
            }
        }
        return false;
    }

    // ══════════════════════════════════════════════════════════════
    // ⚠️  أنصاف الأقطار وتخطيط الحلقات — مُقفل (LOCKED v4.58)
    //     لا يجوز تعديل الترتيب أو الأنصاف أو عدد الحلقات
    //     المرجع: DIRAT_DUROR_SPEC.md
    // ══════════════════════════════════════════════════════════════

    // ─── تنسيق اسم الدر مع رقم المئة كحرف علوي ───
    const _SUPERSCRIPTS = ['¹','²','³','⁴'];
    function _formatDurrName(durr) {
        if (!durr || durr.miaIdx == null) return durr ? durr.durr : '—';
        return _SUPERSCRIPTS[durr.miaIdx] + durr.durrNum;
    }

    // ─── حساب تاريخ وسط النطاق ───
    function _getMidDate(from, to) {
        const dim = [0,31,28,31,30,31,30,31,31,30,31,30,31];
        function toDOY(m, d) { let s = 0; for (let i = 1; i < m; i++) s += dim[i]; return s + d; }
        function fromDOY(doy) { if (doy < 1) doy += 365; let m = 1; while (m <= 12 && doy > dim[m]) { doy -= dim[m]; m++; } return [Math.min(m, 12), Math.max(doy, 1)]; }
        let d1 = toDOY(from[0], from[1]);
        let d2 = toDOY(to[0], to[1]);
        if (d2 < d1) d2 += 365;
        const mid = ((d1 + d2) >> 1);
        return fromDOY(mid > 365 ? mid - 365 : mid);
    }

    // ─── بطاقة تاريخ الإبرة المسحوبة ───
    function _showNeedleDateCard(gMonth, gDay, lang, infoPanel, container) {
        if (!infoPanel) return;
        const gYear = _diratYear || new Date().getFullYear();
        const mNames = lang === 'en'
            ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            : ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        const hijri = H.gregorianToHijri(gYear, gMonth, gDay);
        const hMonthNames = lang === 'en' ? H.MONTH_NAMES_EN : H.MONTH_NAMES;

        let detail = `<div style="font-size:1.05rem;font-weight:700;margin-bottom:4px">`;
        detail += `${gDay} ${mNames[gMonth - 1]} ${gYear}`;
        detail += `</div>`;
        detail += `<div style="font-size:0.9rem;opacity:0.8;margin-bottom:8px">`;
        detail += `${hijri.day} ${hMonthNames[hijri.month - 1]} ${hijri.year}`;
        detail += `</div>`;

        // ملخص كل الحلقات لهذا اليوم
        const summary = _buildRingSummaryHTML(gMonth, gDay, gMonth, gDay, gYear, lang);
        if (summary) {
            detail += `<div style="font-size:13px;line-height:1.7">${summary}</div>`;
        }

        // الأحداث الإسلامية
        const eventKey = hijri.month + '-' + hijri.day;
        const events = H.ISLAMIC_EVENTS;
        if (events && events[eventKey]) {
            const ev = events[eventKey];
            const evName = lang === 'en' ? ev.en : ev.ar;
            detail += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--papyrus-border,#ccc);text-align:center">`;
            detail += `<span style="font-size:1.2em">🌙</span> <strong>${evName}</strong>`;
            detail += `</div>`;
        }

        infoPanel.innerHTML = detail;
        infoPanel.style.display = '';

        // تحديث الأقسام الموسمية أسفل الديرة
        const seasonalEl = container.querySelector('#durur-seasonal-section');
        if (seasonalEl) {
            seasonalEl.innerHTML = _buildSeasonalHTML(gMonth, gDay, gYear, lang);
            _populateArchiveCard(seasonalEl);
        }
    }

    // ─── ملخص حلقات الديرة لنطاق شهر كامل ───
    // تجمع: الفصل، البرج، الأنواء، الدرور، الرياح، الضربات البحرية، المواسم الكبرى
    function _buildRingSummaryHTML(fromMonth, fromDay, toMonth, toDay, gYear, lang, excludeRing) {
        const dim = [0,31,28,31,30,31,30,31,31,30,31,30,31];
        if (_isLeapGregorian(gYear)) dim[2] = 29;
        function toDOY(m, d) { let s = 0; for (let i = 1; i < m; i++) s += dim[i]; return s + d; }
        function fromDOY(doy) { if (doy < 1) doy += 365; if (doy > 365) doy -= 365; let m = 1; while (m <= 12 && doy > dim[m]) { doy -= dim[m]; m++; } return [Math.min(m, 12), Math.max(doy, 1)]; }

        let d1 = toDOY(fromMonth, fromDay);
        let d2 = toDOY(toMonth, toDay);
        if (d2 < d1) d2 += 365;

        // نقاط معاينة كل 3 أيام لدقة أعلى
        const pts = [];
        for (let d = d1; d <= d2; d += 3) {
            const [m, dy] = fromDOY(d > 365 ? d - 365 : d);
            pts.push([m, dy]);
        }
        const [lm, ld] = fromDOY(d2 > 365 ? d2 - 365 : d2);
        pts.push([lm, ld]);

        // تجميع القيم الفريدة
        const seasons = new Map(), zodiacs = new Map(), stars = new Map();
        const durrs = new Map(), winds = new Map(), strikes = new Map(), bigSeasons = new Map();

        pts.forEach(([m, d]) => {
            const se = H.getSeason(m, d);
            if (se) seasons.set(se.name, se);
            const zo = H.getZodiac(m, d);
            if (zo) zodiacs.set(zo.name, zo);
            const ta = H.getTale3(m, d);
            if (ta) stars.set(ta.name, ta);
            const du = H.getDurr(m, d, gYear);
            if (du) durrs.set(_formatDurrName(du), du);
            H.getSeasonalWinds(m, d).forEach(w => winds.set(w.name, w));
            // الضربات البحرية
            H.ANWA_ENRICHMENT.seaStrikes.forEach(s => {
                if (H._matchRange(m, d, s.from, s.to)) {
                    const sName = lang === 'en' ? s.en : s.ar;
                    strikes.set(sName, s);
                }
            });
            // ضربة الأحيمر البحرية (المنقولة لحلقة الرياح)
            if (H._matchRange(m, d, [11,1], [11,10])) {
                strikes.set(lang === 'en' ? 'Ahimar Strike (Sea)' : 'ضربة الأحيمر (بحرية)', { from: [11,1], to: [11,10] });
            }
            H.getActiveSeasons(m, d).forEach(s => {
                const sn = lang === 'en' ? s.en : s.ar;
                bigSeasons.set(sn, s);
            });
        });

        let html = '';
        const section = (icon, title, items) => {
            if (items.length === 0) return '';
            return `<div style="margin:6px 0"><span style="opacity:0.7">${icon}</span> <strong>${title}:</strong> ${items.join('، ')}</div>`;
        };

        if (excludeRing !== 'season' && excludeRing !== 'mia') html += section('🌍', lang === 'en' ? 'Season' : 'الفصل', [...seasons.keys()]);
        if (excludeRing !== 'zodiac') html += section('♈', lang === 'en' ? 'Zodiac' : 'البرج', [...zodiacs.keys()]);
        if (excludeRing !== 'star') html += section('⭐', lang === 'en' ? 'Stars' : 'الأنواء', [...stars.keys()]);
        if (excludeRing !== 'durr') html += section('📜', lang === 'en' ? 'Durr' : 'الدرور', [...durrs.keys()]);
        if (excludeRing !== 'wind') html += section('💨', lang === 'en' ? 'Winds' : 'الرياح', [...winds.keys()]);
        if (strikes.size > 0 && excludeRing !== 'sea-strike' && excludeRing !== 'sea-strike-wind') html += section('⚓', lang === 'en' ? 'Sea Strikes' : 'الضربات البحرية', [...strikes.keys()]);
        if (bigSeasons.size > 0) html += section('🗓️', lang === 'en' ? 'Major Seasons' : 'المواسم', [...bigSeasons.keys()]);

        return html;
    }

    // ─── بناء HTML لنطاق زمني كامل (تجميع عدة نقاط) ───
    // تُستخدم عند النقر على شهر هجري يمتد عبر أكثر من شهر ميلادي
    function _buildSeasonalRangeHTML(fromDate, toDate, gYear, lang) {
        // إنشاء نقاط معاينة عبر النطاق (كل 7 أيام تقريباً)
        const dim = [0,31,28,31,30,31,30,31,31,30,31,30,31];
        if (_isLeapGregorian(gYear)) dim[2] = 29;
        function toDOY(m, d) { let s = 0; for (let i = 1; i < m; i++) s += dim[i]; return s + d; }
        function fromDOY(doy) { if (doy < 1) doy += 365; if (doy > 365) doy -= 365; let m = 1; while (m <= 12 && doy > dim[m]) { doy -= dim[m]; m++; } return [Math.min(m, 12), Math.max(doy, 1)]; }

        let d1 = toDOY(fromDate[0], fromDate[1]);
        let d2 = toDOY(toDate[0], toDate[1]);
        if (d2 < d1) d2 += 365;

        // نقاط معاينة كل 5 أيام
        const samplePoints = [];
        for (let d = d1; d <= d2; d += 5) {
            const [sm, sd] = fromDOY(d > 365 ? d - 365 : d);
            samplePoints.push([sm, sd]);
        }
        // تأكد من تضمين آخر يوم
        const [lastM, lastD] = fromDOY(d2 > 365 ? d2 - 365 : d2);
        samplePoints.push([lastM, lastD]);

        // تجميع النتائج الفريدة
        const fishSet = new Map();
        const cropsSet = new Map();
        const wildlifeSet = new Map();
        const seasonsSet = new Map();
        const birdsSet = new Map();
        const proverbsSet = new Map();
        const astroSet = new Map();
        let durrDetails = null;
        let nextConj = null;

        samplePoints.forEach(([sm, sd]) => {
            H.getSeasonalFish(sm, sd).filter(f => f.inSeason).forEach(f => fishSet.set(f.name, f));
            H.getSeasonalCrops(sm, sd).filter(c => c.inSeason).forEach(c => cropsSet.set(c.name, c));
            H.getSeasonalWildlife(sm, sd).filter(w => w.inSeason).forEach(w => wildlifeSet.set(w.name, w));
            const as = H.getActiveSeasons(sm, sd);
            as.forEach(s => seasonsSet.set(lang === 'en' ? s.en : s.ar, s));
            const bm = H.getActiveBirdMigration(sm, sd);
            bm.forEach(b => birdsSet.set(lang === 'en' ? b.en : b.ar, b));
            const pv = H.getSeasonalProverbs(sm, sd, gYear);
            pv.forEach(p => proverbsSet.set(lang === 'en' ? p.en : p.ar, p));
            const ae = H.getUpcomingAstroEvents(sm, sd);
            ae.forEach(e => astroSet.set(lang === 'en' ? e.en : e.ar, e));
            if (!durrDetails) durrDetails = H.getDurrDetails(sm, sd, gYear);
            if (!nextConj) nextConj = H.getNextThurayaConjunction(sm, sd);
        });

        // بناء HTML — نفس البنية مثل _buildSeasonalHTML لكن مع النتائج المجمّعة
        let html = '';

        const fishActive = [...fishSet.values()];
        const cropsActive = [...cropsSet.values()];
        const wildlifeActive = [...wildlifeSet.values()];

        if (fishActive.length > 0) {
            html += `<div class="durur-list-section">`;
            html += `<div class="durur-list-title">${H.t('anwaAllFish')}</div>`;
            html += `<div class="durur-list-grid">`;
            fishActive.forEach(f => { html += `<span class="durur-list-tag in-season">${f.name}</span>`; });
            html += `</div></div>`;
        }

        if (cropsActive.length > 0) {
            html += `<div class="durur-list-section">`;
            html += `<div class="durur-list-title">${H.t('anwaAllCrops')}</div>`;
            html += `<div class="durur-list-grid">`;
            cropsActive.forEach(c => { html += `<span class="durur-list-tag in-season">${c.name}</span>`; });
            html += `</div></div>`;
        }

        if (wildlifeActive.length > 0) {
            html += `<div class="durur-list-section">`;
            html += `<div class="durur-list-title">${H.t('anwaAllWildlife')}</div>`;
            html += `<div class="durur-list-grid">`;
            wildlifeActive.forEach(w => { html += `<span class="durur-list-tag in-season">${w.name}</span>`; });
            html += `</div></div>`;
        }

        html += `<div class="durur-source">${H.t('anwaSource')}</div>`;

        // بطاقات الإثراء
        html += `<div class="durur-enrich-section">`;

        // الدر
        if (durrDetails && durrDetails.desc_ar) {
            const durrDesc = lang === 'en' ? durrDetails.desc_en : durrDetails.desc_ar;
            html += `<div class="dv-enrich-card dv-enrich-durr">`;
            html += `<div class="dv-enrich-icon">📜</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${_formatDurrName(durrDetails)} — ${durrDetails.mia}</div>`;
            html += `<div class="dv-enrich-desc">${durrDesc}</div>`;
            html += `</div></div>`;
        }

        // المواسم
        const activeSeasons = [...seasonsSet.values()];
        if (activeSeasons.length > 0) {
            html += `<div class="dv-enrich-card dv-enrich-seasons">`;
            html += `<div class="dv-enrich-icon">🗓️</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Active Seasons' : 'المواسم الحالية'}</div>`;
            activeSeasons.forEach(s => {
                const sName = lang === 'en' ? s.en : s.ar;
                const sDesc = lang === 'en' ? s.desc_en : s.desc_ar;
                html += `<div class="dv-enrich-season-item"><span class="dv-enrich-season-icon">${s.icon}</span> <strong>${sName}</strong>: ${sDesc}</div>`;
            });
            html += `</div></div>`;
        }

        // أمثال
        const proverbs = [...proverbsSet.values()];
        if (proverbs.length > 0) {
            const randomProverb = proverbs[Math.floor(Math.random() * proverbs.length)];
            html += `<div class="dv-enrich-card dv-enrich-proverb">`;
            html += `<div class="dv-enrich-icon">💬</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Proverb of the Day' : 'مثل اليوم'}</div>`;
            html += `<div class="dv-enrich-quote">"${lang === 'en' ? randomProverb.en : randomProverb.ar}"</div>`;
            if (lang === 'ar' && randomProverb.en) html += `<div class="dv-enrich-quote-sub">${randomProverb.en}</div>`;
            html += `</div></div>`;
        }

        // أحداث فلكية
        const upcomingAstro = [...astroSet.values()];
        if (upcomingAstro.length > 0) {
            html += `<div class="dv-enrich-card dv-enrich-astro">`;
            html += `<div class="dv-enrich-icon">🔭</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Upcoming Astronomical Events' : 'أحداث فلكية قريبة'}</div>`;
            upcomingAstro.forEach(ev => {
                const evName = lang === 'en' ? ev.en : ev.ar;
                const evDesc = lang === 'en' ? ev.desc_en : ev.desc_ar;
                const evDate = lang === 'en' ? `${ev.date[1]}/${ev.date[0]}` : H.toArabicNumerals(`${ev.date[1]}/${ev.date[0]}`);
                html += `<div class="dv-enrich-astro-item">${ev.icon} <strong>${evName}</strong> (${evDate})<br><span class="dv-enrich-astro-desc">${evDesc}</span></div>`;
            });
            html += `</div></div>`;
        }

        // هجرة الطيور
        const birdsMigration = [...birdsSet.values()];
        if (birdsMigration.length > 0) {
            html += `<div class="dv-enrich-card dv-enrich-birds">`;
            html += `<div class="dv-enrich-icon">🦅</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Bird Migration' : 'هجرة الطيور'}</div>`;
            birdsMigration.forEach(b => {
                const bName = lang === 'en' ? b.en : b.ar;
                const bDesc = lang === 'en' ? b.desc_en : b.desc_ar;
                const dirIcon = b.direction === 'south' ? '⬇️' : b.direction === 'north' ? '⬆️' : '📍';
                html += `<div class="dv-enrich-bird-item">${dirIcon} <strong>${bName}</strong>: ${bDesc}</div>`;
            });
            html += `</div></div>`;
        }

        // اقتران الثريا
        if (nextConj) {
            const cName = lang === 'en' ? nextConj.en : nextConj.ar;
            const cNick = lang === 'en' ? nextConj.nickname_en : nextConj.nickname_ar;
            const cDesc = lang === 'en' ? nextConj.desc_en : nextConj.desc_ar;
            const cDate = _fmtDateRange(nextConj.from, nextConj.to, lang);
            html += `<div class="dv-enrich-card dv-enrich-thuraya">`;
            html += `<div class="dv-enrich-icon">✨</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Next Pleiades Conjunction' : 'اقتران الثريا القادم'}</div>`;
            html += `<div class="dv-enrich-desc"><strong>${cName}</strong> — ${cNick}<br>${cDate}<br>${cDesc}</div>`;
            html += `</div></div>`;
        }

        html += `</div>`; // close durur-enrich-section
        return html;
    }

    // ─── بناء HTML الأقسام الموسمية + بطاقات الإثراء ───
    function _buildSeasonalHTML(gMonth, gDay, gYear, lang) {
        let html = '';

        // ─── الأسماك / المحاصيل / الحياة الفطرية ───
        const fishActive = H.getSeasonalFish(gMonth, gDay).filter(f => f.inSeason);
        const cropsActive = H.getSeasonalCrops(gMonth, gDay).filter(c => c.inSeason);
        const wildlifeActive = H.getSeasonalWildlife(gMonth, gDay).filter(w => w.inSeason);

        if (fishActive.length > 0) {
            html += `<div class="durur-list-section">`;
            html += `<div class="durur-list-title">${H.t('anwaAllFish')}</div>`;
            html += `<div class="durur-list-grid">`;
            fishActive.forEach(f => { html += `<span class="durur-list-tag in-season">${f.name}</span>`; });
            html += `</div></div>`;
        }

        if (cropsActive.length > 0) {
            html += `<div class="durur-list-section">`;
            html += `<div class="durur-list-title">${H.t('anwaAllCrops')}</div>`;
            html += `<div class="durur-list-grid">`;
            cropsActive.forEach(c => { html += `<span class="durur-list-tag in-season">${c.name}</span>`; });
            html += `</div></div>`;
        }

        if (wildlifeActive.length > 0) {
            html += `<div class="durur-list-section">`;
            html += `<div class="durur-list-title">${H.t('anwaAllWildlife')}</div>`;
            html += `<div class="durur-list-grid">`;
            wildlifeActive.forEach(w => { html += `<span class="durur-list-tag in-season">${w.name}</span>`; });
            html += `</div></div>`;
        }

        html += `<div class="durur-source">${H.t('anwaSource')}</div>`;

        // ─── بطاقات الإثراء ───
        html += `<div class="durur-enrich-section">`;

        // 1. وصف الدر
        const durrDetails = H.getDurrDetails(gMonth, gDay, gYear);
        if (durrDetails && durrDetails.desc_ar) {
            const durrDesc = lang === 'en' ? durrDetails.desc_en : durrDetails.desc_ar;
            html += `<div class="dv-enrich-card dv-enrich-durr">`;
            html += `<div class="dv-enrich-icon">📜</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${_formatDurrName(durrDetails)} — ${durrDetails.mia}</div>`;
            html += `<div class="dv-enrich-desc">${durrDesc}</div>`;
            html += `</div></div>`;
        }

        // 2. المواسم الخاصة النشطة
        const activeSeasons = H.getActiveSeasons(gMonth, gDay);
        if (activeSeasons.length > 0) {
            html += `<div class="dv-enrich-card dv-enrich-seasons">`;
            html += `<div class="dv-enrich-icon">🗓️</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Active Seasons' : 'المواسم الحالية'}</div>`;
            activeSeasons.forEach(s => {
                const sName = lang === 'en' ? s.en : s.ar;
                const sDesc = lang === 'en' ? s.desc_en : s.desc_ar;
                html += `<div class="dv-enrich-season-item"><span class="dv-enrich-season-icon">${s.icon}</span> <strong>${sName}</strong>: ${sDesc}</div>`;
            });
            html += `</div></div>`;
        }

        // 3. أمثال اليوم
        const proverbs = H.getSeasonalProverbs(gMonth, gDay, gYear);
        if (proverbs.length > 0) {
            const randomProverb = proverbs[Math.floor(Math.random() * proverbs.length)];
            html += `<div class="dv-enrich-card dv-enrich-proverb">`;
            html += `<div class="dv-enrich-icon">💬</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Proverb of the Day' : 'مثل اليوم'}</div>`;
            html += `<div class="dv-enrich-quote">"${lang === 'en' ? randomProverb.en : randomProverb.ar}"</div>`;
            if (lang === 'ar' && randomProverb.en) html += `<div class="dv-enrich-quote-sub">${randomProverb.en}</div>`;
            html += `</div></div>`;
        }

        // 4. أحداث فلكية قريبة
        const upcomingAstro = H.getUpcomingAstroEvents(gMonth, gDay);
        if (upcomingAstro.length > 0) {
            html += `<div class="dv-enrich-card dv-enrich-astro">`;
            html += `<div class="dv-enrich-icon">🔭</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Upcoming Astronomical Events' : 'أحداث فلكية قريبة'}</div>`;
            upcomingAstro.forEach(ev => {
                const evName = lang === 'en' ? ev.en : ev.ar;
                const evDesc = lang === 'en' ? ev.desc_en : ev.desc_ar;
                const evDate = lang === 'en' ? `${ev.date[1]}/${ev.date[0]}` : H.toArabicNumerals(`${ev.date[1]}/${ev.date[0]}`);
                html += `<div class="dv-enrich-astro-item">${ev.icon} <strong>${evName}</strong> (${evDate})<br><span class="dv-enrich-astro-desc">${evDesc}</span></div>`;
            });
            html += `</div></div>`;
        }

        // 5. هجرة الطيور
        const birdsMigration = H.getActiveBirdMigration(gMonth, gDay);
        if (birdsMigration.length > 0) {
            html += `<div class="dv-enrich-card dv-enrich-birds">`;
            html += `<div class="dv-enrich-icon">🦅</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Bird Migration' : 'هجرة الطيور'}</div>`;
            birdsMigration.forEach(b => {
                const bName = lang === 'en' ? b.en : b.ar;
                const bDesc = lang === 'en' ? b.desc_en : b.desc_ar;
                const dirIcon = b.direction === 'south' ? '⬇️' : b.direction === 'north' ? '⬆️' : '📍';
                html += `<div class="dv-enrich-bird-item">${dirIcon} <strong>${bName}</strong>: ${bDesc}</div>`;
            });
            html += `</div></div>`;
        }

        // 6. اقتران الثريا القادم
        const nextConj = H.getNextThurayaConjunction(gMonth, gDay);
        if (nextConj) {
            const cName = lang === 'en' ? nextConj.en : nextConj.ar;
            const cNick = lang === 'en' ? nextConj.nickname_en : nextConj.nickname_ar;
            const cDesc = lang === 'en' ? nextConj.desc_en : nextConj.desc_ar;
            const cDate = _fmtDateRange(nextConj.from, nextConj.to, lang);
            html += `<div class="dv-enrich-card dv-enrich-thuraya">`;
            html += `<div class="dv-enrich-icon">✨</div>`;
            html += `<div class="dv-enrich-body">`;
            html += `<div class="dv-enrich-title">${lang === 'en' ? 'Next Pleiades Conjunction' : 'اقتران الثريا القادم'}</div>`;
            html += `<div class="dv-enrich-desc"><strong>${cName}</strong> — ${cNick}<br>${cDate}<br>${cDesc}</div>`;
            html += `</div></div>`;
        }

        html += `</div>`; // close durur-enrich-section

        // ─── حاوية بطاقة الأنماط الأرشيفية (تُملأ غير متزامنياً) ───
        html += `<div id="archive-patterns-card" data-gm="${gMonth}" data-gd="${gDay}" data-gy="${gYear}"></div>`;

        return html;
    }

    // ─── بطاقة الأنماط الأرشيفية ─────────────────────────────
    function _populateArchiveCard(container) {
        const card = container.querySelector('#archive-patterns-card');
        if (!card) return;
        const gMonth = +card.dataset.gm, gDay = +card.dataset.gd, gYear = +card.dataset.gy;
        const lang = H.getLang();
        const isAr = lang !== 'en';
        const toAr = (v) => isAr ? H.toArabicNumerals(String(v)) : v;

        _loadClimateStats().then(cs => {
            if (!cs) return;

            let html = `<div class="archive-card">`;
            html += `<div class="archive-card-title">${isAr ? 'الأنماط الأرشيفية' : 'Archival Patterns'}</div>`;
            html += `<div class="archive-card-subtitle">${isAr ? 'إحصائيات مناخية مبنية على أرشيف ' + toAr(cs.meta.years[1] - cs.meta.years[0]) + ' سنة — الإمارات' : cs.meta.years[1] - cs.meta.years[0] + ' years of climate data — UAE'}</div>`;

            // ── دليل الرموز ──
            html += `<div class="archive-legend">`;
            html += `<span>🌡️ ${isAr ? 'الحرارة' : 'Temp.'}</span>`;
            html += `<span>🌧️ ${isAr ? 'احتمال المطر' : 'Rain prob.'}</span>`;
            html += `<span>💨 ${isAr ? 'سرعة الرياح' : 'Wind'}</span>`;
            html += `<span>💧 ${isAr ? 'الرطوبة' : 'Humidity'}</span>`;
            html += `<span>✓ ${isAr ? 'تطابق الوصف التراثي' : 'Heritage match'}</span>`;
            html += `</div>`;

            // ── 1. اليوم ──
            const dayOfYear = Math.floor((new Date(gYear, gMonth - 1, gDay) - new Date(gYear, 0, 1)) / 86400000) + 1;
            const daily = cs.daily[String(dayOfYear)];
            if (daily) {
                html += `<div class="archive-row">`;
                html += `<div class="archive-row-label">${isAr ? '📅 هذا اليوم' : '📅 This Day'}</div>`;
                html += `<div class="archive-row-detail">${toAr(gDay)}/${toAr(gMonth)}</div>`;
                html += `<div class="archive-row-stats">`;
                html += `<span>🌡️ ${toAr(daily.tMin)}°–${toAr(daily.tMax)}°</span>`;
                html += `<span>🌧️ ${toAr(Math.round(daily.rain * 100) / 100)} ${isAr ? 'مم' : 'mm'}</span>`;
                html += `<span>💧 ${toAr(Math.round(daily.hum))}%</span>`;
                html += `</div></div>`;
            }

            // ── 2. الطالع (النوء) ──
            const tale3 = H.getTale3(gMonth, gDay);
            if (tale3) {
                const tIdx = H.TAWALIE.findIndex(x => x.ar === tale3.nameAr);
                const tcs = tIdx >= 0 ? cs.anwa[tIdx] : null;
                if (tcs) {
                    html += `<div class="archive-row">`;
                    html += `<div class="archive-row-label">${isAr ? '⭐ الطالع' : '⭐ Mansion'}</div>`;
                    html += `<div class="archive-row-detail">${tale3.name}</div>`;
                    html += _archiveStats(tcs, isAr, toAr);
                    html += `</div>`;
                }
            }

            // ── 3. الدر ──
            const durr = H.getDurr(gMonth, gDay, gYear);
            if (durr) {
                const miaStart = durr.miaIdx * 100 + 1;
                const durrIdx = Math.floor((durr.suhailDay - miaStart) / 10);
                const dKey = durr.miaIdx + '-' + durrIdx;
                const dcs = cs.duror[dKey];
                if (dcs) {
                    html += `<div class="archive-row">`;
                    html += `<div class="archive-row-label">${isAr ? '🔢 الدر' : '🔢 Durr'}</div>`;
                    html += `<div class="archive-row-detail">${_formatDurrName(durr)}</div>`;
                    html += _archiveStats(dcs, isAr, toAr);
                    html += `</div>`;
                }
            }

            // ── 4. الموسم ──
            const season = H.getSeason(gMonth, gDay);
            if (season) {
                const sIdx = H.SEASONS.findIndex(x => x.ar === season.nameAr);
                const scs = sIdx >= 0 ? cs.seasons[sIdx] : null;
                if (scs) {
                    html += `<div class="archive-row">`;
                    html += `<div class="archive-row-label">${isAr ? '🌿 الموسم' : '🌿 Season'}</div>`;
                    html += `<div class="archive-row-detail">${season.name}</div>`;
                    html += _archiveStats(scs, isAr, toAr);
                    html += `</div>`;
                }
            }

            // ── 5. الرياح الموسمية ──
            const winds = H.getSeasonalWinds(gMonth, gDay);
            if (winds.length > 0) {
                const allWinds = H.ANWA_ENRICHMENT.seasonalWinds;
                const wIdx = allWinds.findIndex(aw => aw.ar === winds[0].name || aw.ar === winds[0].nameAr);
                const wcs = wIdx >= 0 ? cs.winds[wIdx] : null;
                if (wcs) {
                    html += `<div class="archive-row">`;
                    html += `<div class="archive-row-label">${isAr ? '💨 الرياح' : '💨 Winds'}</div>`;
                    html += `<div class="archive-row-detail">${winds[0].name}</div>`;
                    html += `<div class="archive-row-stats">`;
                    html += `<span>💨 ${toAr(wcs.wind.aMax)} ${isAr ? 'كم/س' : 'km/h'}</span>`;
                    html += `<span>${isAr ? 'السائد' : 'Dominant'}: ${isAr ? wcs.wind.dirAr : wcs.wind.dirAr}</span>`;
                    html += `</div></div>`;
                }
            }

            // ── 6. المواسم الخاصة النشطة ──
            const activeSpecial = H.getActiveSeasons(gMonth, gDay);
            if (activeSpecial.length > 0 && cs.special) {
                const allSpecial = H.SPECIAL_SEASONS;
                activeSpecial.forEach(sp => {
                    const spIdx = allSpecial.findIndex(x => x.ar === (sp.nameAr || sp.ar));
                    const spcs = spIdx >= 0 ? cs.special[spIdx] : null;
                    if (spcs) {
                        html += `<div class="archive-row archive-row-sub">`;
                        html += `<div class="archive-row-label">${sp.icon || '🗓️'} ${isAr ? (sp.ar || sp.nameAr) : (sp.en || sp.nameEn)}</div>`;
                        html += _archiveStats(spcs, isAr, toAr);
                        html += `</div>`;
                    }
                });
            }

            // ── 7. الضربات البحرية ──
            if (cs.strikes) {
                const allStrikes = H.ANWA_ENRICHMENT.seaStrikes;
                allStrikes.forEach((st, i) => {
                    if (H._matchRange(gMonth, gDay, st.from[0], st.from[1], st.to[0], st.to[1])) {
                        const stcs = cs.strikes[i];
                        if (stcs) {
                            html += `<div class="archive-row archive-row-sub">`;
                            html += `<div class="archive-row-label">🌊 ${isAr ? st.ar : st.en}</div>`;
                            html += _archiveStats(stcs, isAr, toAr);
                            html += `</div>`;
                        }
                    }
                });
            }

            html += `</div>`; // close archive-card
            card.innerHTML = html;
        });
    }

    function _archiveStats(cs, isAr, toAr) {
        if (!cs || !cs.temp) return '';
        let html = `<div class="archive-row-stats">`;
        html += `<span>🌡️ ${toAr(cs.temp.aMin)}°–${toAr(cs.temp.aMax)}°</span>`;
        html += `<span>🌧️ ${toAr(Math.round(cs.rain.prob * 100))}%</span>`;
        html += `<span>💨 ${toAr(cs.wind.aMax)} ${isAr ? 'كم/س' : 'km/h'}</span>`;
        html += `<span>💧 ${toAr(Math.round(cs.hum))}%</span>`;
        if (cs.match != null) {
            const cls = cs.match >= 80 ? 'match-high' : cs.match >= 60 ? 'match-mid' : 'match-low';
            html += `<span class="match-badge-sm ${cls}">${isAr ? '✓' : '✓'} ${toAr(cs.match)}%</span>`;
        }
        html += `</div>`;
        return html;
    }

    function _renderDururCircle(gMonth, gDay, gYear, lang) {
        // ضبط السنة الميلادية لحساب زوايا الديرة (يدعم السنة الكبيسة)
        _diratYear = gYear;

        let html = '';
        // Help popup for English users (appears at top of compass)
        if (lang === 'en') {
            html += `<div class="info-help-popup" id="dirat-help-popup"><h4>${H.t('dururExplainTitle')}</h4><p>${H.t('dururExplain').replace(/\n/g, '<br>')}</p></div>`;
        }

        const cx = 540, cy = 540;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const RC = _RING_COLORS;
        const todayAngle = _dateToAngle(gMonth, gDay);

        let svg = `<svg viewBox="-130 -130 1340 1340" class="durur-circle-svg" xmlns="http://www.w3.org/2000/svg">`;
        // جعل كل العناصر غير التفاعلية شفافة للنقر، فقط .durur-segment تستقبل الأحداث
        svg += `<style>
            .durur-circle-svg circle, .durur-circle-svg line, .durur-circle-svg polygon, .durur-circle-svg text,
            .durur-circle-svg foreignObject, .durur-circle-svg foreignObject * { pointer-events: none; }
            .durur-circle-svg .durur-segment { pointer-events: all; cursor: pointer; }
            .durur-circle-svg .needle-drag-handle { pointer-events: all; cursor: grab; }
            .dirat-needle-group:hover .needle-arrow { opacity: 0.8; }
        </style>`;
        // ─── تدرجات الإبرة الفولاذية ───
        svg += `<defs>`;
        svg += `<linearGradient id="needle-steel" x1="0" y1="0" x2="1" y2="0">`;
        svg += `<stop offset="0%" stop-color="${isDark ? '#606878' : '#a0a8b4'}"/>`;
        svg += `<stop offset="35%" stop-color="${isDark ? '#909aa8' : '#d0d4dc'}"/>`;
        svg += `<stop offset="50%" stop-color="${isDark ? '#b0b8c4' : '#eef0f4'}"/>`;
        svg += `<stop offset="65%" stop-color="${isDark ? '#909aa8' : '#d0d4dc'}"/>`;
        svg += `<stop offset="100%" stop-color="${isDark ? '#606878' : '#a0a8b4'}"/>`;
        svg += `</linearGradient>`;
        svg += `<radialGradient id="needle-pivot">`;
        svg += `<stop offset="0%" stop-color="${isDark ? '#c0c8d0' : '#f0f2f6'}"/>`;
        svg += `<stop offset="70%" stop-color="${isDark ? '#808890' : '#b8bcc4'}"/>`;
        svg += `<stop offset="100%" stop-color="${isDark ? '#585e68' : '#909498'}"/>`;
        svg += `</radialGradient>`;
        svg += `<radialGradient id="needle-grip">`;
        svg += `<stop offset="0%" stop-color="${isDark ? '#a8b0b8' : '#e8ecf0'}"/>`;
        svg += `<stop offset="100%" stop-color="${isDark ? '#707880' : '#b0b8c0'}"/>`;
        svg += `</radialGradient>`;
        svg += `<filter id="needle-shadow" x="-20%" y="-10%" width="140%" height="120%">`;
        svg += `<feDropShadow dx="1.5" dy="1.5" stdDeviation="1.5" flood-color="#000" flood-opacity="0.25"/>`;
        svg += `</filter>`;
        svg += `</defs>`;

        // ─── خلفيات الحلقات ───
        const _bgRing = (innerR, outerR, fill) => {
            const midR = (innerR + outerR) / 2;
            const sw = outerR - innerR;
            return `<circle cx="${cx}" cy="${cy}" r="${midR}" fill="none" stroke="${fill}" stroke-width="${sw}"/>`;
        };
        // Ring 0: Seasons (center)
        svg += `<circle cx="${cx}" cy="${cy}" r="80" fill="${isDark ? '#2a2218' : '#e8dcc0'}"/>`;
        // Ring 1: Zodiac
        svg += _bgRing(82, 140, isDark ? '#2a2218' : '#e0d0a8');
        // Ring 2: Stars
        svg += _bgRing(142, 220, isDark ? RC.starDark : RC.star);
        // Ring 3: Durr
        svg += _bgRing(222, 280, isDark ? '#28221a' : '#e8dcc0');
        // Ring 4: Winds (5 lanes)
        svg += _bgRing(282, 360, isDark ? RC.windDark : RC.wind);
        // Ring 5a: Day tick marks (inner)
        svg += _bgRing(362, 388, isDark ? '#1e1c18' : '#f5f0e8');
        // Ring 5b: Day numbers (outer)
        svg += _bgRing(390, 412, isDark ? '#252218' : '#efe8d8');
        // Ring 6: Months
        svg += _bgRing(414, 470, isDark ? RC.outerDark : RC.outer);

        // ═══════════════════════════════════════════════════
        // ─── Ring 0: الفصول الأربعة — أرباع ثابتة في المركز ───
        // ═══════════════════════════════════════════════════
        // أرباع ثابتة (90° لكل فصل) — نص أفقي مع اسمين
        // الترتيب: أعلى-يمين=الربيع(الصيف)، أعلى-يسار=الصيف(القيظ)، أسفل-يسار=الخريف(الصفري)، أسفل-يمين=الشتاء
        const miaQuadrants = [
            { startDeg: 0,   endDeg: 90,  mainLabel: lang === 'en' ? 'Spring' : 'الربيع', subLabel: lang === 'en' ? '(Sayf)' : '(الصيف)', colorIdx: 2, tx: cx + 33, ty: cy - 33 },
            { startDeg: 270, endDeg: 360, mainLabel: lang === 'en' ? 'Summer' : 'الصيف', subLabel: lang === 'en' ? '(Qayz)' : '(القيظ)', colorIdx: 3, tx: cx - 33, ty: cy - 33 },
            { startDeg: 180, endDeg: 270, mainLabel: lang === 'en' ? 'Autumn' : 'الخريف', subLabel: lang === 'en' ? '(Safari)' : '(الصفري)', colorIdx: 0, tx: cx - 33, ty: cy + 33 },
            { startDeg: 90,  endDeg: 180, mainLabel: lang === 'en' ? 'Winter' : 'الشتاء', subLabel: lang === 'en' ? '(Shita)' : '(الشتاء)', colorIdx: 1, tx: cx + 33, ty: cy + 33 },
        ];
        miaQuadrants.forEach((q, i) => {
            const fill = isDark ? RC.miaDark[q.colorIdx] : RC.mia[q.colorIdx];
            let isCurrent = false;
            if (q.startDeg === 0) {
                isCurrent = todayAngle >= 0 && todayAngle < 90;
            } else {
                isCurrent = todayAngle >= q.startDeg && todayAngle < q.endDeg;
            }
            svg += `<path d="${_arcPath(q.startDeg, q.endDeg, 0, 80, cx, cy)}" fill="${fill}" stroke="#fff" stroke-width="1.5" class="durur-segment" data-ring="mia" data-index="${i}" data-name="${q.mainLabel}"${isCurrent ? ' opacity="1"' : ' opacity="0.8"'}/>`;
            svg += `<text x="${q.tx}" y="${q.ty - 6}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="16" font-weight="bold" font-family="Calibri, sans-serif" style="text-shadow:0 1px 3px rgba(0,0,0,0.5)">${q.mainLabel}</text>`;
            svg += `<text x="${q.tx}" y="${q.ty + 12}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="10" font-family="Calibri, sans-serif" style="text-shadow:0 1px 2px rgba(0,0,0,0.4)">${q.subLabel}</text>`;
        });
        // خطوط تقسيم الأرباع (عمودي + أفقي)
        svg += `<line x1="${cx}" y1="${cy - 80}" x2="${cx}" y2="${cy + 80}" stroke="#fff" stroke-width="2"/>`;
        svg += `<line x1="${cx - 80}" y1="${cy}" x2="${cx + 80}" y2="${cy}" stroke="#fff" stroke-width="2"/>`;
        svg += `<circle cx="${cx}" cy="${cy}" r="81" fill="none" stroke="var(--papyrus-border)" stroke-width="1.5"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 1: الأبراج (12 برج) — نص طولي ───
        // ═══════════════════════════════════════════════════
        const zodiac = H.ZODIAC;
        zodiac.forEach((z, i) => {
            // في النظام العكسي: from → زاوية أكبر، to → زاوية أصغر
            const aFrom = _dateToAngle(z.from[0], z.from[1]);
            const aTo = _dateToAngleEnd(z.to[0], z.to[1]);
            let arcStart = aTo, arcEnd = aFrom;
            if (arcEnd < arcStart) arcEnd += 360;
            const fill = isDark ? RC.zodiacDark[i] : RC.zodiac[i];
            const midDeg = (arcStart + (arcEnd - arcStart) / 2) % 360;
            const isCurrent = (todayAngle >= arcStart && todayAngle < arcEnd) || (arcEnd > 360 && todayAngle < arcEnd - 360);
            svg += `<path d="${_arcPath(arcStart, arcEnd, 82, 140, cx, cy)}" fill="${fill}" stroke="${_darkenColor(fill)}" stroke-width="0.5" class="durur-segment" data-ring="zodiac" data-index="${i}" data-name="${lang === 'en' ? z.en : z.ar}"${isCurrent ? ' opacity="1"' : ' opacity="0.75"'}/>`;
            const name = lang === 'en' ? z.en : z.ar;
            svg += _radialTextVertical(name, midDeg, 86, 136, cx, cy, 17, isCurrent);
        });
        svg += `<circle cx="${cx}" cy="${cy}" r="141" fill="none" stroke="var(--papyrus-border)" stroke-width="1.5"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 2: الأنواء/الطوالع (28 نجم) — نص طولي ───
        // ═══════════════════════════════════════════════════
        const stars = H.TAWALIE;
        const currentStar = H.getTale3(gMonth, gDay);
        stars.forEach((s, i) => {
            const aFrom = _dateToAngle(s.from[0], s.from[1]);
            const aTo = _dateToAngleEnd(s.to[0], s.to[1]);
            let arcStart = aTo, arcEnd = aFrom;
            if (arcEnd < arcStart) arcEnd += 360;
            const isCurrent = currentStar && currentStar.nameAr === s.ar;
            const fill = isCurrent ? (isDark ? RC.starCurrentDark : RC.starCurrent) : (isDark ? RC.starDark : RC.star);
            svg += `<path d="${_arcPath(arcStart, arcEnd, 142, 220, cx, cy)}" fill="${fill}" stroke="${_darkenColor(fill)}" stroke-width="0.5" class="durur-segment" data-ring="star" data-index="${i}" data-name="${lang === 'en' ? s.en : s.ar}"/>`;
            const midDeg = (arcStart + (arcEnd - arcStart) / 2) % 360;
            const rawName = (lang === 'en' ? s.en : s.ar).split('(')[0].trim();
            // اختصار الأسماء الطويلة مع الحفاظ على تمييز منازل سعد والأسماء المركبة
            let shortName;
            if (rawName.length <= 10) {
                shortName = rawName;
            } else {
                const words = rawName.split(' ');
                shortName = words.length > 2 ? words.slice(0, 2).join(' ') : rawName;
            }
            svg += _radialTextVertical(shortName, midDeg, 148, 216, cx, cy, 14, isCurrent);
        });
        svg += `<circle cx="${cx}" cy="${cy}" r="221" fill="none" stroke="var(--papyrus-border)" stroke-width="1.5"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 3: الدرور (37 در) — نص طولي + ألوان الفصول ───
        // ═══════════════════════════════════════════════════
        const durrLabels = H.DUROR_LABELS[lang];
        const currentDurr = H.getDurr(gMonth, gDay, gYear);
        // تحويل يوم سهيل إلى شهر/يوم ميلادي (أغسطس 15 = يوم 1)
        const _suhailToDate = (sDay) => {
            const d = new Date(2025, 7, 15); // Aug 15
            d.setDate(d.getDate() + sDay - 1);
            return [d.getMonth() + 1, d.getDate()];
        };
        let durrDayStart = 0;
        const durrCounts = [10, 10, 10, 7];
        for (let mia = 0; mia < 4; mia++) {
            const count = durrCounts[mia];
            for (let d = 0; d < count; d++) {
                const startDay = durrDayStart;
                const endDay = durrDayStart + (mia < 3 ? 10 : (d < 6 ? 10 : 5));
                const [sm, sd] = _suhailToDate(startDay + 1);
                const [em, ed] = _suhailToDate(endDay);
                const aStart = _dateToAngle(sm, sd);
                const aEnd = _dateToAngleEnd(em, ed);
                // القوس من aEnd (الأصغر) إلى aStart (الأكبر) — عكسي
                let arcS = aEnd, arcE = aStart;
                if (arcE < arcS) arcE += 360;
                const aliasKey = `${mia}-${d}`;
                const label = (H.DUROR_ALIASES && H.DUROR_ALIASES[lang] && H.DUROR_ALIASES[lang][aliasKey]) || durrLabels[d] || `${(d + 1) * 10}`;
                const isDurrCurrent = currentDurr && currentDurr.durr === durrLabels[d] && currentDurr.mia === H.DUROR_MIA[lang][mia];
                const fill = isDurrCurrent
                    ? (isDark ? RC.durrCurrentDark : RC.durrCurrent)
                    : (isDark ? RC.durrMiaDark[mia][d] : RC.durrMia[mia][d]);
                svg += `<path d="${_arcPath(arcS, arcE, 222, 280, cx, cy)}" fill="${fill}" stroke="${_darkenColor(fill)}" stroke-width="0.5" class="durur-segment" data-ring="durr" data-index="${mia * 10 + d}" data-name="${label}" data-mia="${mia}"/>`;
                const midDeg = (arcS + (arcE - arcS) / 2) % 360;
                // رقم الدر مع حرف علوي للمئة — المساريق يبقى باسمه النصي
                const hasAlias = H.DUROR_ALIASES && H.DUROR_ALIASES[lang] && H.DUROR_ALIASES[lang][aliasKey];
                let durrDisplayLabel;
                if (hasAlias) {
                    durrDisplayLabel = hasAlias;
                } else {
                    const durrNum = (d + 1) * 10;
                    const numStr = lang === 'en' ? String(durrNum) : H.toArabicNumerals(String(durrNum));
                    durrDisplayLabel = _SUPERSCRIPTS[mia] + numStr;
                }
                svg += _radialTextVertical(durrDisplayLabel, midDeg, 226, 276, cx, cy, 12, isDurrCurrent);
                durrDayStart = endDay;
            }
        }
        svg += `<circle cx="${cx}" cy="${cy}" r="281" fill="none" stroke="var(--papyrus-border)" stroke-width="1.5"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 4: الرياح الموسمية (5 حلقات فرعية) ───
        // ═══════════════════════════════════════════════════
        const winds = H.ANWA_ENRICHMENT.seasonalWinds;
        const currentWinds = H.getSeasonalWinds(gMonth, gDay);
        const currentWindNames = currentWinds.map(w => w.name);
        const laneAssignment = _assignWindLanes(winds);
        const NUM_WIND_LANES = 5;
        const windInnerR = 282, windOuterR = 360;
        const laneW = (windOuterR - windInnerR) / NUM_WIND_LANES;
        const laneRadii = [];
        for (let l = 0; l < NUM_WIND_LANES; l++) {
            laneRadii.push({ inner: windInnerR + l * laneW, outer: windInnerR + (l + 1) * laneW });
        }

        // خلفية حلقة الرياح
        svg += `<circle cx="${cx}" cy="${cy}" r="${(windInnerR + windOuterR) / 2}" fill="none" stroke="${isDark ? '#1e2530' : '#f0ebe0'}" stroke-width="${windOuterR - windInnerR}"/>`;

        // ألوان الرياح حسب الفصل
        const windSeasonColors = {
            summer:  { light: '#e8b4a0', dark: '#7a4a38' },  // القيظ — أحمر/برتقالي فاتح
            autumn:  { light: '#d4b896', dark: '#6a5030' },  // الصفري — بني/ذهبي
            winter:  { light: '#a0c4dc', dark: '#3a5a7a' },  // الشتاء — أزرق فاتح
            spring:  { light: '#a8d4a8', dark: '#3a6840' },  // الصيف/الربيع — أخضر فاتح
        };
        const windSeasonCurrentColors = {
            summer:  { light: '#c75050', dark: '#904040' },
            autumn:  { light: '#b08040', dark: '#6a5030' },
            winter:  { light: '#5a8fad', dark: '#3a5a7a' },
            spring:  { light: '#508050', dark: '#3a6840' },
        };

        // رسم كل ريح كقطاع مستقل — مطابق للصورة المرجعية
        winds.forEach((w, i) => {
            const aFrom = _dateToAngle(w.from[0], w.from[1]);
            const aTo = _dateToAngleEnd(w.to[0], w.to[1]);
            let a1 = aTo, a2 = aFrom;
            if (a2 < a1) a2 += 360;
            const lane = laneAssignment[i];
            const lr = laneRadii[lane];
            const name = lang === 'en' ? w.en : w.ar;
            const isCurrent = currentWindNames.includes(w.ar);
            // لون الريح حسب الفصل
            const season = _windSeason(w);
            const sColors = isCurrent ? windSeasonCurrentColors[season] : windSeasonColors[season];
            const fill = isDark ? sColors.dark : sColors.light;
            // القطاع
            svg += `<path d="${_arcPath(a1, a2, lr.inner, lr.outer, cx, cy)}" fill="${fill}" stroke="${_darkenColor(fill)}" stroke-width="0.5" class="durur-segment" data-ring="wind" data-index="${i}" data-name="${name}" data-lane="${lane}" opacity="${isCurrent ? 1 : 0.85}"/>`;
            // خطوط شعاعية عند بداية ونهاية كل ريح
            const toRad = d => (d - 90) * Math.PI / 180;
            const radStart = toRad(a1), radEnd = toRad(a2 % 360);
            svg += `<line x1="${cx + lr.inner * Math.cos(radStart)}" y1="${cy + lr.inner * Math.sin(radStart)}" x2="${cx + lr.outer * Math.cos(radStart)}" y2="${cy + lr.outer * Math.sin(radStart)}" stroke="var(--papyrus-border)" stroke-width="0.8"/>`;
            svg += `<line x1="${cx + lr.inner * Math.cos(radEnd)}" y1="${cy + lr.inner * Math.sin(radEnd)}" x2="${cx + lr.outer * Math.cos(radEnd)}" y2="${cy + lr.outer * Math.sin(radEnd)}" stroke="var(--papyrus-border)" stroke-width="0.8"/>`;
            // نص الريح — foreignObject مماسي للقوس (حروف عربية متصلة)
            const span = a2 - a1;
            if (span >= 6) {
                const midR = (lr.inner + lr.outer) / 2;
                const midDeg = (a1 + span / 2) % 360;
                const mRad = (midDeg - 90) * Math.PI / 180;
                const mx = cx + midR * Math.cos(mRad);
                const my = cy + midR * Math.sin(mRad);
                const arcLen = (span / 360) * 2 * Math.PI * midR;
                const laneH = lr.outer - lr.inner;
                // الدوران المماسي
                let rot = midDeg;
                if (midDeg > 90 && midDeg < 270) rot += 180;
                const fontSize = span >= 40 ? 13 : span >= 25 ? 11 : span >= 12 ? 9 : 8;
                const shortName = name.length > 16 ? name.split(' ').slice(0, 2).join(' ') : name;
                const foW = Math.max(arcLen * 0.85, 50);
                const foH = laneH;
                svg += `<foreignObject x="${mx - foW / 2}" y="${my - foH / 2}" width="${foW}" height="${foH}" transform="rotate(${rot},${mx},${my})">` +
                       `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:Calibri,sans-serif;font-size:${fontSize}px;${isCurrent ? 'font-weight:700;' : ''}color:var(--papyrus-text);direction:rtl;text-align:center;white-space:nowrap;overflow:visible;line-height:1;pointer-events:none;">${shortName}</div>` +
                       `</foreignObject>`;
            }
        });

        // ─── ضربة الأحيمر البحرية (11/1-11/10) — قطاع أحمر داخل حلقة الرياح ───
        // تُرسم في نفس lane ضربة الأحيمر الريح (index 6, lane 0) لتوضيح فترة الذروة
        {
            const ahimarStrike = { from: [11,1], to: [11,10] };
            const asFrom = _dateToAngle(ahimarStrike.from[0], ahimarStrike.from[1]);
            const asTo = _dateToAngleEnd(ahimarStrike.to[0], ahimarStrike.to[1]);
            let as1 = asTo, as2 = asFrom;
            if (as2 < as1) as2 += 360;
            const ahimarLane = laneAssignment[6]; // lane ضربة الأحيمر الريح
            const asLr = laneRadii[ahimarLane];
            const asFill = isDark ? '#6a2020' : '#e0a0a0';
            svg += `<path d="${_arcPath(as1, as2, asLr.inner, asLr.outer, cx, cy)}" fill="${asFill}" fill-opacity="0.85" stroke="${_darkenColor(asFill)}" stroke-width="0.5" class="durur-segment" data-ring="sea-strike-wind" data-index="0" data-name="${lang === 'en' ? 'Ahimar Strike (Sea)' : 'ضربة الأحيمر (بحرية)'}" cursor="pointer"/>`;
            // خطوط شعاعية
            const toRadS = d => (d - 90) * Math.PI / 180;
            const rS1 = toRadS(as1), rS2 = toRadS(as2 % 360);
            svg += `<line x1="${cx + asLr.inner * Math.cos(rS1)}" y1="${cy + asLr.inner * Math.sin(rS1)}" x2="${cx + asLr.outer * Math.cos(rS1)}" y2="${cy + asLr.outer * Math.sin(rS1)}" stroke="var(--papyrus-border)" stroke-width="0.8"/>`;
            svg += `<line x1="${cx + asLr.inner * Math.cos(rS2)}" y1="${cy + asLr.inner * Math.sin(rS2)}" x2="${cx + asLr.outer * Math.cos(rS2)}" y2="${cy + asLr.outer * Math.sin(rS2)}" stroke="var(--papyrus-border)" stroke-width="0.8"/>`;
            // نص
            const asSpan = as2 - as1;
            if (asSpan >= 5) {
                const asMidR = (asLr.inner + asLr.outer) / 2;
                const asMidDeg = (as1 + asSpan / 2) % 360;
                const asMRad = (asMidDeg - 90) * Math.PI / 180;
                const asMx = cx + asMidR * Math.cos(asMRad);
                const asMy = cy + asMidR * Math.sin(asMRad);
                const asArcLen = (asSpan / 360) * 2 * Math.PI * asMidR;
                const asLaneH = asLr.outer - asLr.inner;
                let asRot = asMidDeg;
                if (asMidDeg > 90 && asMidDeg < 270) asRot += 180;
                const asFoW = Math.max(asArcLen * 0.85, 50);
                svg += `<foreignObject x="${asMx - asFoW / 2}" y="${asMy - asLaneH / 2}" width="${asFoW}" height="${asLaneH}" transform="rotate(${asRot},${asMx},${asMy})">` +
                       `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:Calibri,sans-serif;font-size:8px;color:var(--papyrus-text);direction:rtl;text-align:center;white-space:nowrap;overflow:visible;line-height:1;pointer-events:none;">${lang === 'en' ? 'Ahimar Strike' : 'ضربة الأحيمر'}</div>` +
                       `</foreignObject>`;
            }
        }

        svg += `<circle cx="${cx}" cy="${cy}" r="361" fill="none" stroke="var(--papyrus-border)" stroke-width="1.5"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 4b: الضربات البحرية ───
        // ═══════════════════════════════════════════════════
        const strikeInner = 362, strikeOuter = 374;
        const seaStrikes = H.ANWA_ENRICHMENT.seaStrikes;

        // خلفية حلقة الضربات
        svg += `<circle cx="${cx}" cy="${cy}" r="${(strikeInner + strikeOuter) / 2}" fill="none" stroke="${isDark ? '#2a1818' : '#f5ebe0'}" stroke-width="${strikeOuter - strikeInner}"/>`;

        seaStrikes.forEach((s, i) => {
            const aFrom = _dateToAngle(s.from[0], s.from[1]);
            const aTo = _dateToAngleEnd(s.to[0], s.to[1]);
            let a1 = aTo, a2 = aFrom;
            if (a2 < a1) a2 += 360;

            const strikeFill = isDark ? '#6a2020' : '#e0a0a0';
            svg += `<path d="${_arcPath(a1, a2, strikeInner, strikeOuter, cx, cy)}" fill="${strikeFill}" fill-opacity="0.8" stroke="${_darkenColor(strikeFill)}" stroke-width="0.5" stroke-opacity="0.8" class="durur-segment" data-ring="sea-strike" data-index="${i}" data-name="${lang === 'en' ? s.en : s.ar}" cursor="pointer"/>`;

            // اسم الضربة
            const span = a2 - a1;
            if (span >= 5) {
                const midDeg = (a1 + span / 2) % 360;
                const midR = (strikeInner + strikeOuter) / 2;
                svg += _radialText(lang === 'en' ? s.en : s.ar, midDeg, midR, cx, cy, 8, false);
            }
        });
        svg += `<circle cx="${cx}" cy="${cy}" r="${strikeOuter + 1}" fill="none" stroke="var(--papyrus-border)" stroke-width="0.8"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 5: المواسم الكبرى (حلقتان لمعالجة التداخل) ───
        // ═══════════════════════════════════════════════════
        const seasons = H.SEASONS;
        // Lane 0 (كامل العرض): المواسم العادية
        // Lane 1 (خارجية): كنة الثريا (تتداخل مع الذراعين)
        // Lane 2 (داخلية): الذراعين (أسفل الكنة)
        // ⚠️ مُقفل — لا يجوز تعديل ترتيب الحارات — DIRAT_DUROR_SPEC.md
        const SEASON_LANES = [0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0];
        const seasonLane0Inner = 376, seasonLane0Outer = 398;
        const seasonLane1Inner = 398, seasonLane1Outer = 420;
        const seasonOutermost = 420;

        // الأسماء المختصرة
        const _shortSeasonName = (ar) => {
            const map = {
                'مربعانية الشتاء': 'المربعانية',
                'برد البطين (الشبط)': 'الشبط',
                'كنة الثريا': 'الكنة',
                'الجوزاء الأولى (الهقعة)': 'الجوزاء ١',
                'الجوزاء الثانية (الهنعة)': 'الجوزاء ٢',
            };
            return map[ar] || ar;
        };

        // تحديد لون الموسم بناءً على فترته
        const _seasonColor = (s, current) => {
            const totalDays = _isLeapGregorian(_diratYear) ? 366 : 365;
            const doy1 = _doyOf(s.from[0], s.from[1]);
            let doy2 = _doyOf(s.to[0], s.to[1]);
            if (doy2 < doy1) doy2 += totalDays;
            const midDoy = ((doy1 + doy2) / 2) % totalDays;

            let season;
            if (midDoy >= 172 && midDoy <= 265) season = 'Summer';
            else if (midDoy >= 266 && midDoy <= 355) season = 'Autumn';
            else if (midDoy >= 356 || midDoy <= 79) season = 'Winter';
            else season = 'Spring';

            if (current) return isDark ? RC['seasonCurrentDark'] : RC['seasonCurrent'];
            return isDark ? RC['season' + season + 'Dark'] : RC['season' + season];
        };

        // هل الموسم الحالي؟
        const _isSeasonCurrent = (s) => {
            const today = _doyOf(gMonth, gDay);
            const start = _doyOf(s.from[0], s.from[1]);
            let end = _doyOf(s.to[0], s.to[1]);
            if (end >= start) return today >= start && today <= end;
            return today >= start || today <= end;
        };

        // خلفية حلقة المواسم (حلقة واحدة كاملة)
        svg += `<circle cx="${cx}" cy="${cy}" r="${(seasonLane0Inner + seasonOutermost) / 2}" fill="none" stroke="${isDark ? '#2a2418' : '#f5edd5'}" stroke-width="${seasonOutermost - seasonLane0Inner}"/>`;

        // المواسم العادية (Lane 0) تمتد على كامل عرض الحلقة
        // كنة الثريا (Lane 1) تُرسم فوقها في النصف الخارجي فقط
        seasons.forEach((s, i) => {
            const aFrom = _dateToAngle(s.from[0], s.from[1]);
            const aTo = _dateToAngleEnd(s.to[0], s.to[1]);
            let arcStart = aTo, arcEnd = aFrom;
            if (arcEnd < arcStart) arcEnd += 360;

            const lane = SEASON_LANES[i];
            // Lane 0: كامل العرض (376→420) — Lane 1: النصف الخارجي (398→420) — Lane 2: النصف الداخلي (376→398)
            const innerR = lane === 1 ? seasonLane1Inner : seasonLane0Inner;
            const outerR = lane === 2 ? seasonLane0Outer : seasonOutermost;

            const isCurrent = _isSeasonCurrent(s);
            const color = _seasonColor(s, isCurrent);

            svg += `<path d="${_arcPath(arcStart, arcEnd, innerR, outerR, cx, cy)}" fill="${color}" fill-opacity="${isCurrent ? 1 : 0.85}" stroke="${_darkenColor(color)}" stroke-width="0.5" stroke-opacity="${isCurrent ? 1 : 0.85}" class="durur-segment" data-ring="season" data-index="${i}" data-name="${lang === 'en' ? s.en : s.ar}" cursor="pointer"/>`;

            // النص
            const shortName = lang === 'en' ? s.en.split('(')[0].trim().split(' ').slice(0, 2).join(' ') : _shortSeasonName(s.ar);
            const span = arcEnd - arcStart;
            if (span >= 8) {
                const midDeg = (arcStart + span / 2) % 360;
                const midR = (innerR + outerR) / 2;
                const fontSize = span >= 30 ? 13 : span >= 18 ? 11 : span >= 12 ? 9 : 8;
                svg += _radialText(shortName, midDeg, midR, cx, cy, fontSize, isCurrent);
            }
        });
        svg += `<circle cx="${cx}" cy="${cy}" r="${seasonOutermost + 1}" fill="none" stroke="var(--papyrus-border)" stroke-width="1"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 6: علامات الأيام ───
        // ═══════════════════════════════════════════════════
        const febDays = _isLeapGregorian(gYear) ? 29 : 28;
        const monthDays = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const tickColor = isDark ? '#a09080' : '#4a3520';
        const tickColorLight = isDark ? '#807060' : '#6a5540';
        // ─── Ring 6a: الخطوط (أشرطة الأيام) ───
        for (let m = 1; m <= 12; m++) {
            for (let d = 1; d <= monthDays[m - 1]; d++) {
                const angle = _dateToAngle(m, d);
                const rad = (angle - 90) * Math.PI / 180;
                const isFive = d % 5 === 0;
                if (d === 1) {
                    svg += `<line x1="${cx + 422 * Math.cos(rad)}" y1="${cy + 422 * Math.sin(rad)}" x2="${cx + 447 * Math.cos(rad)}" y2="${cy + 447 * Math.sin(rad)}" stroke="${tickColor}" stroke-width="2"/>`;
                } else if (isFive) {
                    svg += `<line x1="${cx + 424 * Math.cos(rad)}" y1="${cy + 424 * Math.sin(rad)}" x2="${cx + 446 * Math.cos(rad)}" y2="${cy + 446 * Math.sin(rad)}" stroke="${tickColor}" stroke-width="1.2"/>`;
                } else {
                    svg += `<line x1="${cx + 430 * Math.cos(rad)}" y1="${cy + 430 * Math.sin(rad)}" x2="${cx + 444 * Math.cos(rad)}" y2="${cy + 444 * Math.sin(rad)}" stroke="${tickColorLight}" stroke-width="0.6" opacity="0.7"/>`;
                }
            }
        }
        svg += `<circle cx="${cx}" cy="${cy}" r="449" fill="none" stroke="var(--papyrus-border)" stroke-width="0.8"/>`;

        // ─── Ring 6b: الأرقام الخمسية ───
        for (let m = 1; m <= 12; m++) {
            for (let d = 1; d <= monthDays[m - 1]; d++) {
                if (d % 5 === 0) {
                    const angle = _dateToAngle(m, d);
                    svg += _radialText(lang === 'en' ? String(d) : H.toArabicNumerals(String(d)), angle, 460, cx, cy, 11, false);
                }
            }
        }
        svg += `<circle cx="${cx}" cy="${cy}" r="471" fill="none" stroke="var(--papyrus-border)" stroke-width="1"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 7: الأشهر الميلادية ───
        // ═══════════════════════════════════════════════════
        const gMonthNames = lang === 'en' ? H.GREGORIAN_MONTH_NAMES_EN : H.GREGORIAN_MONTH_NAMES;
        const monthLineColor = isDark ? '#a09080' : '#4a3520';
        for (let m = 0; m < 12; m++) {
            const aFirst = _dateToAngle(m + 1, 1);
            const aLast = _dateToAngleEnd(m + 1, monthDays[m]);
            let arcStart = aLast, arcEnd = aFirst;
            if (arcEnd < arcStart) arcEnd += 360;
            // قطاع شفاف قابل للنقر
            svg += `<path d="${_arcPath(arcStart, arcEnd, 422, 519, cx, cy)}" fill="transparent" stroke="none" class="durur-segment" data-ring="month" data-index="${m}" data-name="${gMonthNames[m]}" style="cursor:pointer"/>`;
            // خط شعاعي عند بداية كل شهر
            {
                const rad1 = (aFirst - 90) * Math.PI / 180;
                svg += `<line x1="${cx + 422 * Math.cos(rad1)}" y1="${cy + 422 * Math.sin(rad1)}" x2="${cx + 519 * Math.cos(rad1)}" y2="${cy + 519 * Math.sin(rad1)}" stroke="${monthLineColor}" stroke-width="1.5" pointer-events="none"/>`;
            }
            // اسم الشهر في منتصف القوس
            const midDeg = (arcStart + (arcEnd - arcStart) / 2) % 360;
            svg += _radialText(gMonthNames[m], midDeg, 497, cx, cy, 22, false);
        }
        svg += `<circle cx="${cx}" cy="${cy}" r="520" fill="none" stroke="var(--papyrus-border)" stroke-width="2"/>`;

        // ═══════════════════════════════════════════════════
        // ─── Ring 8: الشهور الهجرية (حلقة متغيرة) ───
        // ═══════════════════════════════════════════════════
        {
            // ─── ألوان الحلقة الهجرية ───
            // لونان مختلفان للسنتين الهجريتين: الأقدم (دافئ) والأحدث (بارد)
            const hijriOlderBase = isDark ? '#3a3028' : '#8a7a5a';   // السنة الأقدم — بني دافئ
            const hijriNewerBase = isDark ? '#2a4038' : '#5a8a6a';   // السنة الأحدث — أخضر بارد
            const hijriOlderCurrent = isDark ? '#504030' : '#a89870'; // الشهر الحالي (أقدم)
            const hijriNewerCurrent = isDark ? '#3a6050' : '#7ab890'; // الشهر الحالي (أحدث)
            const hijriOlderStroke = isDark ? '#5a4a38' : '#6a5a40';
            const hijriNewerStroke = isDark ? '#3a5a48' : '#3a5a48';
            const hijriCurrent = isDark ? '#3a6050' : '#7ab890';
            const hijriText = isDark ? '#c0d8c8' : '#2a4030';
            const hijriTickColor = isDark ? '#7a9a88' : '#3a5a48';
            const hijriTickLight = isDark ? '#5a7a68' : '#5a7a68';
            const hijriLineColor = isDark ? '#7a9a88' : '#3a5a48';

            // ─── حساب الشهور الهجرية التي تقع في السنة الميلادية ───
            const hStart = H.gregorianToHijri(gYear, 1, 1);
            const hEnd = H.gregorianToHijri(gYear, 12, 31);

            // بناء قائمة كل الشهور الهجرية في النطاق
            const hijriMonths = [];
            let hY = hStart.year, hM = hStart.month;
            while (hY < hEnd.year || (hY === hEnd.year && hM <= hEnd.month)) {
                hijriMonths.push({ year: hY, month: hM });
                hM++;
                if (hM > 12) { hM = 1; hY++; }
            }

            // أنصاف الأقطار
            const hTickInner = 524, hTickOuter = 548;
            const hNumR = 557;
            const hSepR = 565;
            const hNameR = 587;
            const hOuterR = 607;

            // خلفية الحلقة
            svg += `<circle cx="${cx}" cy="${cy}" r="${(hTickInner + hOuterR) / 2}" fill="none" stroke="${isDark ? 'rgba(42,64,56,0.3)' : 'rgba(90,138,106,0.12)'}" stroke-width="${hOuterR - hTickInner}"/>`;

            // الهجري الحالي
            const todayHijri = H.gregorianToHijri(gMonth, gDay, gYear);

            // سنوات هجرية فريدة (لعنوان السنة)
            const hijriYears = [...new Set(hijriMonths.map(m => m.year))];

            hijriMonths.forEach((hm, idx) => {
                const numDays = H.daysInMonth(hm.year, hm.month);

                // أول يوم ميلادي للشهر الهجري
                let firstG = H.hijriToGregorian(hm.year, hm.month, 1);
                // آخر يوم ميلادي للشهر الهجري
                let lastG = H.hijriToGregorian(hm.year, hm.month, numDays);

                // قص: لا نعرض ما يقع خارج السنة الميلادية
                let firstDay = 1, lastDay = numDays;
                let isClippedStart = false, isClippedEnd = false;
                if (firstG.year < gYear) {
                    // الشهر يبدأ في السنة السابقة
                    const jan1H = H.gregorianToHijri(gYear, 1, 1);
                    firstDay = jan1H.day;
                    firstG = { year: gYear, month: 1, day: 1 };
                    isClippedStart = true;
                }
                if (lastG.year > gYear) {
                    // الشهر ينتهي في السنة التالية
                    const dec31H = H.gregorianToHijri(gYear, 12, 31);
                    lastDay = dec31H.day;
                    lastG = { year: gYear, month: 12, day: 31 };
                    isClippedEnd = true;
                }

                // حساب الزوايا
                const aFirst = _dateToAngle(firstG.month, firstG.day);
                const aLast = _dateToAngleEnd(lastG.month, lastG.day);
                // القوس: من نهاية آخر يوم (CCW) إلى أول يوم
                let arcStart = aLast, arcEnd = aFirst;
                if (arcEnd < arcStart) arcEnd += 360;

                // هل هذا الشهر الحالي؟ وهل هو من السنة الأقدم أم الأحدث؟
                const isCurrent = (hm.year === todayHijri.year && hm.month === todayHijri.month);
                const isOlderYear = hijriYears.length > 1 && hm.year === hijriYears[0];
                const baseColor = isOlderYear ? hijriOlderBase : hijriNewerBase;
                const currentColor = isOlderYear ? hijriOlderCurrent : hijriNewerCurrent;
                const strokeColor = isOlderYear ? hijriOlderStroke : hijriNewerStroke;
                const fillColor = isCurrent ? currentColor : baseColor;

                // القطاع التفاعلي
                const mName = lang === 'en' ? H.MONTH_NAMES_EN[hm.month - 1] : H.MONTH_NAMES[hm.month - 1];
                svg += `<path d="${_arcPath(arcStart, arcEnd, hTickInner, hOuterR, cx, cy)}" fill="${fillColor}" fill-opacity="${isCurrent ? 0.5 : 0.25}" stroke="${strokeColor}" stroke-width="1.2" class="durur-segment" data-ring="hijri-month" data-index="${idx}" data-name="${mName}" data-hyear="${hm.year}" data-hmonth="${hm.month}"/>`;

                // ─── أشرطة الأيام الهجرية ───
                for (let d = firstDay; d <= lastDay; d++) {
                    const dG = H.hijriToGregorian(hm.year, hm.month, d);
                    if (dG.year !== gYear) continue;
                    const angle = _dateToAngle(dG.month, dG.day);
                    const rad = (angle - 90) * Math.PI / 180;
                    const isFive = d % 5 === 0;
                    if (d === 1) {
                        svg += `<line x1="${cx + hTickInner * Math.cos(rad)}" y1="${cy + hTickInner * Math.sin(rad)}" x2="${cx + hTickOuter * Math.cos(rad)}" y2="${cy + hTickOuter * Math.sin(rad)}" stroke="${hijriTickColor}" stroke-width="2"/>`;
                    } else if (isFive) {
                        svg += `<line x1="${cx + (hTickInner + 2) * Math.cos(rad)}" y1="${cy + (hTickInner + 2) * Math.sin(rad)}" x2="${cx + (hTickOuter - 2) * Math.cos(rad)}" y2="${cy + (hTickOuter - 2) * Math.sin(rad)}" stroke="${hijriTickColor}" stroke-width="1.2"/>`;
                    } else {
                        svg += `<line x1="${cx + (hTickInner + 6) * Math.cos(rad)}" y1="${cy + (hTickInner + 6) * Math.sin(rad)}" x2="${cx + (hTickOuter - 4) * Math.cos(rad)}" y2="${cy + (hTickOuter - 4) * Math.sin(rad)}" stroke="${hijriTickLight}" stroke-width="0.6" opacity="0.7"/>`;
                    }
                }

                // ─── أرقام الأيام (كل 5) ───
                for (let d = firstDay; d <= lastDay; d++) {
                    if (d % 5 === 0) {
                        const dG = H.hijriToGregorian(hm.year, hm.month, d);
                        if (dG.year !== gYear) continue;
                        const angle = _dateToAngle(dG.month, dG.day);
                        svg += _radialText(lang === 'en' ? String(d) : H.toArabicNumerals(String(d)), angle, hNumR, cx, cy, 9, false);
                    }
                }

                // ─── خط فاصل عند بداية الشهر ───
                {
                    const radFirst = (aFirst - 90) * Math.PI / 180;
                    svg += `<line x1="${cx + hTickInner * Math.cos(radFirst)}" y1="${cy + hTickInner * Math.sin(radFirst)}" x2="${cx + hOuterR * Math.cos(radFirst)}" y2="${cy + hOuterR * Math.sin(radFirst)}" stroke="${hijriLineColor}" stroke-width="1.5"/>`;
                }

                // ─── اسم الشهر الهجري + السنة على يساره ───
                const span = arcEnd - arcStart;
                if (span >= 6) {
                    const midDeg = (arcStart + span / 2) % 360;
                    const yearNum = lang === 'en' ? String(hm.year) : H.toArabicNumerals(String(hm.year));
                    const label = span >= 10 ? `${mName}  ${yearNum}` : mName;
                    svg += _radialText(label, midDeg, hNameR, cx, cy, 18, isCurrent);
                }
            });

            // ─── خطوط إطار الحلقة الهجرية ───
            svg += `<circle cx="${cx}" cy="${cy}" r="${hTickInner}" fill="none" stroke="var(--papyrus-border)" stroke-width="1"/>`;
            svg += `<circle cx="${cx}" cy="${cy}" r="${hSepR}" fill="none" stroke="var(--papyrus-border)" stroke-width="0.8"/>`;
            svg += `<circle cx="${cx}" cy="${cy}" r="${hOuterR}" fill="none" stroke="var(--papyrus-border)" stroke-width="2"/>`;
        }

        // ═══════════════════════════════════════════════════
        // ─── الإطار الذهبي الخارجي المزخرف ───
        // ═══════════════════════════════════════════════════
        const goldInner = 610;
        const goldOuter = 618;
        const goldMid = (goldInner + goldOuter) / 2;
        const goldColor1 = isDark ? '#8a7030' : '#c8a040';
        const goldColor2 = isDark ? '#a08838' : '#d4b050';
        const goldColor3 = isDark ? '#6a5828' : '#b89838';

        // الحلقة الذهبية الرئيسية
        svg += `<circle cx="${cx}" cy="${cy}" r="${goldMid}" fill="none" stroke="${goldColor1}" stroke-width="${goldOuter - goldInner}" opacity="0.6"/>`;
        // خط داخلي رفيع
        svg += `<circle cx="${cx}" cy="${cy}" r="${goldInner}" fill="none" stroke="${goldColor2}" stroke-width="1.5" opacity="0.8"/>`;
        // خط خارجي رفيع
        svg += `<circle cx="${cx}" cy="${cy}" r="${goldOuter}" fill="none" stroke="${goldColor2}" stroke-width="1.5" opacity="0.8"/>`;

        // زخارف نقطية على الإطار الذهبي (كل 5 درجات)
        for (let deg = 0; deg < 360; deg += 5) {
            const radG = (deg - 90) * Math.PI / 180;
            const gx = cx + goldMid * Math.cos(radG);
            const gy = cy + goldMid * Math.sin(radG);
            const dotR = deg % 15 === 0 ? 2 : 1;
            svg += `<circle cx="${gx}" cy="${gy}" r="${dotR}" fill="${goldColor2}" opacity="${deg % 15 === 0 ? 0.9 : 0.5}"/>`;
        }

        // زخارف دائرية صغيرة كل 30 درجة (تمثل الأشهر)
        for (let deg = 0; deg < 360; deg += 30) {
            const radH = (deg - 90) * Math.PI / 180;
            const hx = cx + goldMid * Math.cos(radH);
            const hy = cy + goldMid * Math.sin(radH);
            svg += `<circle cx="${hx}" cy="${hy}" r="3.5" fill="none" stroke="${goldColor3}" stroke-width="1.2" opacity="0.7"/>`;
        }

        // ═══════════════════════════════════════════════════
        // ─── مؤشر اليوم (إبرة فولاذية — قابلة للسحب) ───
        // ═══════════════════════════════════════════════════
        const needleLen = goldOuter + 40;   // تتجاوز الإطار الذهبي بوضوح
        const tipY = cy - needleLen;        // = 540 - 658 = -118
        const baseHW = 3.5;
        const tipHW = 0.8;
        const strkCol = isDark ? '#505860' : '#8a8e96';
        const fistY = tipY;                // مركز القبضة عند طرف الإبرة
        const wingY = fistY + 22;          // الأجنحة أسفل القبضة

        svg += `<g id="dirat-needle" class="dirat-needle-group" transform="rotate(${todayAngle}, ${cx}, ${cy})" data-today-angle="${todayAngle}" data-current-angle="${todayAngle}" data-needle-len="${needleLen}">`;

        // ── ظل الإبرة ──
        svg += `<polygon points="${cx - baseHW + 1.5},${cy + 1.5} ${cx + baseHW + 1.5},${cy + 1.5} ${cx + tipHW + 1.5},${tipY + 20} ${cx - tipHW + 1.5},${tipY + 20}" fill="rgba(0,0,0,0.10)" class="today-needle"/>`;
        // ── جسم الإبرة المدبب — فولاذ فضي ──
        svg += `<polygon points="${cx - baseHW},${cy} ${cx + baseHW},${cy} ${cx + tipHW},${tipY + 18} ${cx - tipHW},${tipY + 18}" fill="url(#needle-steel)" filter="url(#needle-shadow)" class="today-needle"/>`;
        // خط لمعة
        svg += `<line x1="${cx - baseHW + 0.5}" y1="${cy}" x2="${cx - tipHW + 0.3}" y2="${tipY + 18}" stroke="${isDark ? 'rgba(200,210,220,0.3)' : 'rgba(255,255,255,0.5)'}" stroke-width="0.5" class="today-needle"/>`;

        // ── محور دوران معدني ──
        svg += `<circle cx="${cx}" cy="${cy}" r="8" fill="url(#needle-pivot)" stroke="${strkCol}" stroke-width="0.8"/>`;
        svg += `<circle cx="${cx}" cy="${cy}" r="3" fill="${isDark ? '#e0e4e8' : '#f8f9fa'}" opacity="0.6"/>`;

        // ═══ قبضة اليد (✊) عند الطرف ═══
        svg += `<g class="needle-grip-group">`;
        // ── الكف / القبضة — شكل بيضاوي مع أصابع ──
        // جسم القبضة الرئيسي (شكل بيضاوي)
        svg += `<ellipse cx="${cx}" cy="${fistY}" rx="10" ry="12" fill="url(#needle-grip)" stroke="${strkCol}" stroke-width="0.8"/>`;
        // الإبهام (جانب أيمن من القبضة)
        svg += `<ellipse cx="${cx + 8}" cy="${fistY + 2}" rx="4" ry="5.5" fill="url(#needle-grip)" stroke="${strkCol}" stroke-width="0.6" transform="rotate(-15,${cx + 8},${fistY + 2})"/>`;
        // أصابع مطوية (4 خطوط مقوسة أفقية)
        svg += `<path d="M${cx - 7},${fistY - 7} Q${cx},${fistY - 9} ${cx + 6},${fistY - 7}" fill="none" stroke="${strkCol}" stroke-width="0.7" opacity="0.5"/>`;
        svg += `<path d="M${cx - 7},${fistY - 3.5} Q${cx},${fistY - 5.5} ${cx + 6},${fistY - 3.5}" fill="none" stroke="${strkCol}" stroke-width="0.7" opacity="0.5"/>`;
        svg += `<path d="M${cx - 7},${fistY + 0.5} Q${cx},${fistY - 1.5} ${cx + 6},${fistY + 0.5}" fill="none" stroke="${strkCol}" stroke-width="0.6" opacity="0.4"/>`;
        svg += `<path d="M${cx - 6},${fistY + 4} Q${cx},${fistY + 2.5} ${cx + 5},${fistY + 4}" fill="none" stroke="${strkCol}" stroke-width="0.6" opacity="0.35"/>`;

        // ═══ جناحا طير مفرودان — أسفل القبضة ═══
        // الجناح الأيسر (يشير لليسار = عكس عقارب الساعة)
        svg += `<path d="M${cx - 3},${wingY} C${cx - 18},${wingY - 8} ${cx - 32},${wingY - 4} ${cx - 42},${wingY - 12} C${cx - 36},${wingY - 2} ${cx - 22},${wingY + 4} ${cx - 3},${wingY + 3} Z" fill="${isDark ? '#808890' : '#b0b8c4'}" stroke="${strkCol}" stroke-width="0.5" opacity="0.6" class="needle-arrow"/>`;
        // ريشات الجناح الأيسر
        svg += `<line x1="${cx - 12}" y1="${wingY - 1}" x2="${cx - 20}" y2="${wingY - 5}" stroke="${strkCol}" stroke-width="0.4" opacity="0.35"/>`;
        svg += `<line x1="${cx - 20}" y1="${wingY - 2}" x2="${cx - 30}" y2="${wingY - 7}" stroke="${strkCol}" stroke-width="0.4" opacity="0.3"/>`;
        svg += `<line x1="${cx - 28}" y1="${wingY - 3}" x2="${cx - 38}" y2="${wingY - 9}" stroke="${strkCol}" stroke-width="0.3" opacity="0.25"/>`;

        // الجناح الأيمن (يشير لليمين = مع عقارب الساعة)
        svg += `<path d="M${cx + 3},${wingY} C${cx + 18},${wingY - 8} ${cx + 32},${wingY - 4} ${cx + 42},${wingY - 12} C${cx + 36},${wingY - 2} ${cx + 22},${wingY + 4} ${cx + 3},${wingY + 3} Z" fill="${isDark ? '#808890' : '#b0b8c4'}" stroke="${strkCol}" stroke-width="0.5" opacity="0.6" class="needle-arrow"/>`;
        // ريشات الجناح الأيمن
        svg += `<line x1="${cx + 12}" y1="${wingY - 1}" x2="${cx + 20}" y2="${wingY - 5}" stroke="${strkCol}" stroke-width="0.4" opacity="0.35"/>`;
        svg += `<line x1="${cx + 20}" y1="${wingY - 2}" x2="${cx + 30}" y2="${wingY - 7}" stroke="${strkCol}" stroke-width="0.4" opacity="0.3"/>`;
        svg += `<line x1="${cx + 28}" y1="${wingY - 3}" x2="${cx + 38}" y2="${wingY - 9}" stroke="${strkCol}" stroke-width="0.3" opacity="0.25"/>`;

        svg += `</g>`;
        // مقبض سحب شفاف (منطقة لمس واسعة تغطي القبضة والأجنحة)
        svg += `<circle cx="${cx}" cy="${fistY + 5}" r="45" fill="transparent" class="needle-drag-handle"/>`;
        svg += `</g>`;

        svg += `</svg>`;

        // ─── Info panel + أقسام إضافية ───
        html += `<div class="durur-circle-container">${svg}</div>`;
        html += `<div class="durur-info-panel" id="durur-info-panel" style="display:none"></div>`;

        // ─── الأقسام الموسمية + بطاقات الإثراء (قابلة للتحديث عند النقر) ───
        html += `<div id="durur-seasonal-section" data-orig-month="${gMonth}" data-orig-day="${gDay}" data-orig-year="${gYear}">`;
        html += _buildSeasonalHTML(gMonth, gDay, gYear, lang);
        html += `</div>`;

        // ─── معلومات التذييل ───
        html += `<div class="dv-credits" style="opacity:0.5">`;
        html += `<div class="dv-credits-name">${H.t('footer')}</div>`;
        html += `<div class="dv-credits-version">${H.t('version')}</div>`;
        html += `<div class="dv-credits-tech">${H.t('credit')}</div>`;
        html += `</div>`;

        return html;
    }

    function _setupDururCircleEvents(container) {
        const infoPanel = container.querySelector('#durur-info-panel');
        if (!infoPanel) return;
        const lang = H.getLang();

        container.querySelectorAll('.durur-segment').forEach(seg => {
            seg.addEventListener('click', (e) => {
                e.stopPropagation();
                container.querySelectorAll('.durur-segment-active').forEach(el => el.classList.remove('durur-segment-active'));
                seg.classList.add('durur-segment-active');

                const ring = seg.dataset.ring;
                const idx = parseInt(seg.dataset.index);
                const name = seg.dataset.name;
                let detail = '';
                let ringFrom = null, ringTo = null; // لحساب ملخص الحلقات

                if (ring === 'star') {
                    const star = H.TAWALIE[idx];
                    if (star) {
                        const weather = lang === 'en' ? star.weatherEn : star.weatherAr;
                        detail = `<strong>${name}</strong><br><span class="durur-info-dates">${_fmtDateRange(star.from, star.to, lang)}</span><br><span class="durur-info-desc">${weather}</span>`;
                        ringFrom = star.from; ringTo = star.to;
                    }
                } else if (ring === 'zodiac') {
                    const z = H.ZODIAC[idx];
                    if (z) {
                        detail = `<strong>${z.symbol} ${name}</strong><br><span class="durur-info-dates">${_fmtDateRange(z.from, z.to, lang)}</span>`;
                        ringFrom = z.from; ringTo = z.to;
                    }
                } else if (ring === 'durr') {
                    const miaIdx = parseInt(seg.dataset.mia || '0');
                    const miaName = H.DUROR_MIA[lang][miaIdx];
                    const durrIdxInMia = idx % 10;
                    const durrKey = miaIdx + '-' + durrIdxInMia;
                    const durrInfo = H.DURR_DETAILS[durrKey];
                    detail = `<strong>${name}</strong><br><span class="durur-info-desc">${miaName}</span>`;
                    if (durrInfo) {
                        const desc = lang === 'en' ? durrInfo.en : durrInfo.ar;
                        const dateStr = durrInfo.dates ? _fmtDateRange([durrInfo.dates[0], durrInfo.dates[1]], [durrInfo.dates[2], durrInfo.dates[3]], lang) : '';
                        detail += dateStr ? `<br><span class="durur-info-dates">${dateStr}</span>` : '';
                        detail += `<br><span class="durur-info-desc" style="margin-top:6px;display:block;font-size:13px;line-height:1.6;opacity:0.9">${desc}</span>`;
                    }
                    // حساب نطاق الدر الزمني: كل در 10 أيام ابتداءً من 15 أغسطس
                    const durrOrder = idx; // الترتيب العام (0-36)
                    const _durrGy = _diratYear || new Date().getFullYear();
                    const durrBase = new Date(_durrGy, 7, 15); // Aug 15
                    const durrStart = new Date(durrBase.getTime() + durrOrder * 10 * 86400000);
                    const durrDays = (miaIdx === 3 && durrIdxInMia === 6) ? 5 : 10; // المساريق = 5 أيام
                    const durrEnd = new Date(durrStart.getTime() + (durrDays - 1) * 86400000);
                    ringFrom = [durrStart.getMonth() + 1, durrStart.getDate()];
                    ringTo = [durrEnd.getMonth() + 1, durrEnd.getDate()];
                } else if (ring === 'wind') {
                    const w = H.ANWA_ENRICHMENT.seasonalWinds[idx];
                    if (w) {
                        const desc = lang === 'en' ? w.desc_en : w.desc_ar;
                        detail = `<strong>${name}</strong><br><span class="durur-info-dates">${_fmtDateRange(w.from, w.to, lang)}</span><br><span class="durur-info-desc">${desc}</span>`;
                        ringFrom = w.from; ringTo = w.to;
                    }
                } else if (ring === 'season') {
                    const s = H.SEASONS[idx];
                    if (s) {
                        const sName = lang === 'en' ? s.en : s.ar;
                        detail = `<strong>${sName}</strong><br><span class="durur-info-dates">${_fmtDateRange(s.from, s.to, lang)}</span>`;
                        ringFrom = s.from; ringTo = s.to;
                    }
                } else if (ring === 'sea-strike-wind') {
                    detail = `<strong>${name}</strong><br><span class="durur-info-dates">${_fmtDateRange([11,1], [11,10], lang)}</span><br><span class="durur-info-desc" style="margin-top:4px;display:block;font-size:13px;line-height:1.5;opacity:0.9;color:#c06060">${lang === 'en' ? 'Peak sea storm period — fishing and sailing not recommended' : 'فترة ذروة العواصف البحرية — لا يُنصح بالصيد أو الإبحار'}</span>`;
                    ringFrom = [11,1]; ringTo = [11,10];
                } else if (ring === 'sea-strike') {
                    const ss = H.ANWA_ENRICHMENT.seaStrikes[idx];
                    if (ss) {
                        const ssName = lang === 'en' ? ss.en : ss.ar;
                        detail = `<strong>${ssName}</strong><br><span class="durur-info-dates">${_fmtDateRange(ss.from, ss.to, lang)}</span><br><span class="durur-info-desc" style="margin-top:4px;display:block;font-size:13px;line-height:1.5;opacity:0.9;color:#c06060">${lang === 'en' ? 'Dangerous sea storm period — fishing and sailing not recommended' : 'فترة عواصف بحرية خطرة — لا يُنصح بالصيد أو الإبحار'}</span>`;
                        ringFrom = ss.from; ringTo = ss.to;
                    }
                } else if (ring === 'hijri-month') {
                    const hYear = parseInt(seg.dataset.hyear);
                    const hMonth = parseInt(seg.dataset.hmonth);
                    const numDays = H.daysInMonth(hYear, hMonth);
                    const firstG = H.hijriToGregorian(hYear, hMonth, 1);
                    const lastG = H.hijriToGregorian(hYear, hMonth, numDays);
                    const yearStr = lang === 'en' ? String(hYear) : H.toArabicNumerals(String(hYear));
                    const daysStr = lang === 'en' ? `${numDays} days` : `${H.toArabicNumerals(String(numDays))} يوم`;
                    const mNamesG = lang === 'en'
                        ? ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                        : ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
                    const d1 = `${firstG.day} ${mNamesG[firstG.month]} ${firstG.year}`;
                    const d2 = `${lastG.day} ${mNamesG[lastG.month]} ${lastG.year}`;
                    const gy = firstG.year;
                    const ringSummary = _buildRingSummaryHTML(firstG.month, firstG.day, lastG.month, lastG.day, gy, lang);
                    detail = `<strong>${name} ${yearStr}</strong><br><span class="durur-info-dates">${d1}</span><br><span class="durur-info-dates">${d2}</span><br><span class="durur-info-desc">${daysStr}</span><div style="margin-top:8px;border-top:1px solid var(--papyrus-border,#ccc);padding-top:8px;font-size:13px;line-height:1.7">${ringSummary}</div>`;
                } else if (ring === 'month') {
                    const gMonthNames = lang === 'en' ? H.GREGORIAN_MONTH_NAMES_EN : H.GREGORIAN_MONTH_NAMES;
                    const gMonthIdx = idx; // 0-based
                    const gm = gMonthIdx + 1; // 1-based month
                    const gy = _diratYear || new Date().getFullYear();
                    const febDaysG = _isLeapGregorian(gy) ? 29 : 28;
                    const mDaysArr = [31, febDaysG, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                    const numDaysG = mDaysArr[gMonthIdx];
                    const firstH = H.gregorianToHijri(gy, gm, 1);
                    const lastH = H.gregorianToHijri(gy, gm, numDaysG);
                    const hMonthNames = lang === 'en' ? H.MONTH_NAMES_EN : H.MONTH_NAMES;
                    const h1 = `${firstH.day} ${hMonthNames[firstH.month - 1]} ${firstH.year}`;
                    const h2 = `${lastH.day} ${hMonthNames[lastH.month - 1]} ${lastH.year}`;
                    const daysStrG = lang === 'en' ? `${numDaysG} days` : `${numDaysG} يوم`;
                    const ringSummaryG = _buildRingSummaryHTML(gm, 1, gm, numDaysG, gy, lang);
                    detail = `<strong>${gMonthNames[idx]} ${gy}</strong><br><span class="durur-info-dates">${h1}</span><br><span class="durur-info-dates">${h2}</span><br><span class="durur-info-desc">${daysStrG}</span><div style="margin-top:8px;border-top:1px solid var(--papyrus-border,#ccc);padding-top:8px;font-size:13px;line-height:1.7">${ringSummaryG}</div>`;
                } else if (ring === 'mia') {
                    // الفصول الأربعة (Ring 0): الربيع، الصيف، الخريف، الشتاء
                    const seasonRanges = [
                        { from: [3,21], to: [6,20] },   // 0: الربيع (الصيف)
                        { from: [6,21], to: [9,22] },   // 1: الصيف (القيظ)
                        { from: [9,23], to: [12,21] },  // 2: الخريف (الصفري)
                        { from: [12,22], to: [3,20] },  // 3: الشتاء
                    ];
                    const sr = seasonRanges[idx];
                    detail = `<strong>${name}</strong><br><span class="durur-info-dates">${_fmtDateRange(sr.from, sr.to, lang)}</span>`;
                    ringFrom = sr.from; ringTo = sr.to;
                } else {
                    detail = `<strong>${name}</strong>`;
                }

                // ─── إلحاق ملخص الحلقات لجميع العناصر ذات النطاق الزمني ───
                if (detail && ringFrom && ringTo) {
                    const _gy = _diratYear || new Date().getFullYear();
                    const summary = _buildRingSummaryHTML(ringFrom[0], ringFrom[1], ringTo[0], ringTo[1], _gy, lang, ring);
                    detail += `<div style="margin-top:8px;border-top:1px solid var(--papyrus-border,#ccc);padding-top:8px;font-size:13px;line-height:1.7">${summary}</div>`;
                }

                if (detail) {
                    infoPanel.innerHTML = detail;
                    infoPanel.style.display = '';
                }

                // ─── تحديث الأقسام الموسمية + بطاقات الإثراء بناءً على القطاع المحدد ───
                let segFrom = null, segTo = null;
                if (ring === 'star') {
                    const star = H.TAWALIE[idx];
                    if (star) { segFrom = star.from; segTo = star.to; }
                } else if (ring === 'zodiac') {
                    const z = H.ZODIAC[idx];
                    if (z) { segFrom = z.from; segTo = z.to; }
                } else if (ring === 'durr') {
                    // حساب تاريخ الدر من ترتيبه: كل در = 10 أيام ابتداءً من 15 أغسطس
                    // idx هو الترتيب العام (0-36) من data-index
                    const durrOrder = idx;
                    const startDay = durrOrder * 10; // أيام من 15 أغسطس
                    const gYear = _diratYear || new Date().getFullYear();
                    const base = new Date(gYear, 7, 15); // Aug 15
                    const d1 = new Date(base.getTime() + startDay * 86400000);
                    const d2 = new Date(d1.getTime() + 9 * 86400000); // +9 أيام
                    segFrom = [d1.getMonth() + 1, d1.getDate()];
                    segTo = [d2.getMonth() + 1, d2.getDate()];
                } else if (ring === 'wind') {
                    const w2 = H.ANWA_ENRICHMENT.seasonalWinds[idx];
                    if (w2) { segFrom = w2.from; segTo = w2.to; }
                } else if (ring === 'season') {
                    const s2 = H.SEASONS[idx];
                    if (s2) { segFrom = s2.from; segTo = s2.to; }
                } else if (ring === 'sea-strike-wind') {
                    segFrom = [11,1]; segTo = [11,10];
                } else if (ring === 'sea-strike') {
                    const ss2 = H.ANWA_ENRICHMENT.seaStrikes[idx];
                    if (ss2) { segFrom = ss2.from; segTo = ss2.to; }
                } else if (ring === 'hijri-month') {
                    const hYear = parseInt(seg.dataset.hyear);
                    const hMonth = parseInt(seg.dataset.hmonth);
                    const firstG = H.hijriToGregorian(hYear, hMonth, 1);
                    const numDays = H.daysInMonth(hYear, hMonth);
                    const lastG = H.hijriToGregorian(hYear, hMonth, numDays);
                    segFrom = [firstG.month, firstG.day];
                    segTo = [lastG.month, lastG.day];
                } else if (ring === 'month') {
                    const febDaysM = _isLeapGregorian(_diratYear || new Date().getFullYear()) ? 29 : 28;
                    const mDays = [31, febDaysM, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                    segFrom = [idx + 1, 1]; segTo = [idx + 1, mDays[idx]];
                }

                if (segFrom && segTo) {
                    const gYear = _diratYear || new Date().getFullYear();
                    const seasonalEl = container.querySelector('#durur-seasonal-section');
                    if (seasonalEl) {
                        if (ring === 'hijri-month' || ring === 'month') {
                            // ─── تجميع بيانات كامل نطاق الشهر ───
                            seasonalEl.innerHTML = _buildSeasonalRangeHTML(segFrom, segTo, gYear, lang);
                        } else {
                            const [midM, midD] = _getMidDate(segFrom, segTo);
                            seasonalEl.innerHTML = _buildSeasonalHTML(midM, midD, gYear, lang);
                        }
                    }
                }
            });
        });

        // إخفاء اللوحة عند النقر في مكان فارغ + إعادة الأقسام للتاريخ الأصلي
        container.addEventListener('click', (e) => {
            if (_needleJustReleased) return;
            if (!e.target.closest('.durur-segment') && !e.target.closest('#durur-info-panel') && !e.target.closest('#dirat-needle')) {
                container.querySelectorAll('.durur-segment-active').forEach(el => el.classList.remove('durur-segment-active'));
                infoPanel.style.display = 'none';

                // إعادة الأقسام الموسمية للتاريخ الأصلي
                const seasonalEl = container.querySelector('#durur-seasonal-section');
                if (seasonalEl) {
                    const origMonth = parseInt(seasonalEl.dataset.origMonth);
                    const origDay = parseInt(seasonalEl.dataset.origDay);
                    const origYear = parseInt(seasonalEl.dataset.origYear);
                    const gYear = origYear || _diratYear || new Date().getFullYear();
                    seasonalEl.innerHTML = _buildSeasonalHTML(origMonth, origDay, gYear, lang);
                }
            }
        });

        // إعداد سحب الإبرة
        _setupNeedleDrag(container, lang);
    }

    // ─── سحب إبرة الديرة ───
    function _setupNeedleDrag(container, lang) {
        // تنظيف الأحداث السابقة
        if (_needleDragCleanup) _needleDragCleanup();

        const svgEl = container.querySelector('.durur-circle-svg');
        const needleGroup = container.querySelector('#dirat-needle');
        const dragHandle = container.querySelector('.needle-drag-handle');
        const infoPanel = container.querySelector('#durur-info-panel');
        if (!svgEl || !needleGroup || !dragHandle) return;

        const cx = 540, cy = 540;
        let isDragging = false;

        // إنشاء تلميح التاريخ (HTML div)
        const tooltip = document.createElement('div');
        tooltip.className = 'needle-tooltip';
        tooltip.style.display = 'none';
        const circleContainer = container.querySelector('.durur-circle-container');
        if (circleContainer) {
            circleContainer.appendChild(tooltip);
        }

        const mNames = lang === 'en'
            ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            : ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

        // تحويل إحداثيات الشاشة إلى SVG
        function screenToSVG(clientX, clientY) {
            const rect = svgEl.getBoundingClientRect();
            return {
                x: -130 + (clientX - rect.left) / rect.width * 1340,
                y: -130 + (clientY - rect.top) / rect.height * 1340
            };
        }

        // حساب الزاوية من المركز إلى نقطة (0° = أعلى، اتجاه الساعة)
        function pointToAngle(svgX, svgY) {
            const dx = svgX - cx;
            const dy = svgY - cy;
            let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);
            return ((angleDeg % 360) + 360) % 360;
        }

        // ── صوت نقرة ميكانيكية (cog tick) ──
        let _tickCtx = null;
        let _prevSnapDay = null;
        function _playTick() {
            try {
                if (!_tickCtx) _tickCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = _tickCtx.createOscillator();
                const gain = _tickCtx.createGain();
                osc.connect(gain);
                gain.connect(_tickCtx.destination);
                osc.frequency.value = 3000;
                osc.type = 'square';
                gain.gain.setValueAtTime(0.08, _tickCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, _tickCtx.currentTime + 0.008);
                osc.start(_tickCtx.currentTime);
                osc.stop(_tickCtx.currentTime + 0.008);
            } catch (e) { /* ignore audio errors */ }
        }

        function onDragStart(e) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            _prevSnapDay = null;
            svgEl.classList.add('needle-dragging');
            tooltip.style.display = '';
        }

        function onDragMove(e) {
            if (!isDragging) return;
            e.preventDefault();

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const svgPt = screenToSVG(clientX, clientY);
            const rawAngle = pointToAngle(svgPt.x, svgPt.y);

            // ── سلوك كوارتز: قفز إلى أقرب يوم ──
            const dateInfo = _angleToDate(rawAngle);
            const snappedAngle = _dateToAngle(dateInfo.month, dateInfo.day);

            // ── صوت نقرة عند الانتقال ليوم جديد ──
            const snapKey = `${dateInfo.month}-${dateInfo.day}`;
            if (snapKey !== _prevSnapDay) {
                _prevSnapDay = snapKey;
                _playTick();
            }

            // تدوير الإبرة
            needleGroup.setAttribute('transform', `rotate(${snappedAngle}, ${cx}, ${cy})`);
            needleGroup.dataset.currentAngle = snappedAngle;

            // تحديث التلميح
            tooltip.textContent = `${dateInfo.day} ${mNames[dateInfo.month - 1]}`;

            // موقع التلميح — قرب طرف الإبرة
            if (circleContainer) {
                const rect = svgEl.getBoundingClientRect();
                const scale = rect.width / 1340;
                const radians = (snappedAngle - 90) * Math.PI / 180;
                const nLen = parseFloat(needleGroup.dataset.needleLen) || 658;
                const tipSvgX = cx + nLen * Math.cos(radians);
                const tipSvgY = cy + nLen * Math.sin(radians);
                tooltip.style.left = ((tipSvgX + 130) * scale) + 'px';
                tooltip.style.top = ((tipSvgY + 130) * scale - 28) + 'px';
            }
        }

        function onDragEnd(e) {
            if (!isDragging) return;
            isDragging = false;
            _prevSnapDay = null;
            svgEl.classList.remove('needle-dragging');
            tooltip.style.display = 'none';

            // حماية من تداخل مع click handler
            _needleJustReleased = true;
            setTimeout(() => { _needleJustReleased = false; }, 100);

            const currentAngle = parseFloat(needleGroup.dataset.currentAngle);
            const dateInfo = _angleToDate(currentAngle);

            // إزالة تمييز الحلقات المحددة
            container.querySelectorAll('.durur-segment-active').forEach(el => el.classList.remove('durur-segment-active'));

            // عرض بطاقة المعلومات
            _showNeedleDateCard(dateInfo.month, dateInfo.day, lang, infoPanel, container);
        }

        // أحداث الماوس
        dragHandle.addEventListener('mousedown', onDragStart);
        // أحداث اللمس
        dragHandle.addEventListener('touchstart', onDragStart, { passive: false });
        // الحركة والإفلات على document
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);

        // نقر مزدوج = إعادة الإبرة لليوم
        needleGroup.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const todayAngle = parseFloat(needleGroup.dataset.todayAngle);
            needleGroup.setAttribute('transform', `rotate(${todayAngle}, ${cx}, ${cy})`);
            needleGroup.dataset.currentAngle = todayAngle;
            infoPanel.style.display = 'none';
            // إعادة الأقسام الموسمية للتاريخ الأصلي
            const seasonalEl = container.querySelector('#durur-seasonal-section');
            if (seasonalEl) {
                const origMonth = parseInt(seasonalEl.dataset.origMonth);
                const origDay = parseInt(seasonalEl.dataset.origDay);
                const origYear = parseInt(seasonalEl.dataset.origYear);
                seasonalEl.innerHTML = _buildSeasonalHTML(origMonth, origDay, origYear || _diratYear, lang);
            }
        });

        // تنظيف
        _needleDragCleanup = () => {
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.removeEventListener('touchmove', onDragMove);
            document.removeEventListener('touchend', onDragEnd);
        };
    }

    // ─── Palette System ───
    const PALETTES = [
        { id: '',          color: '#8b5a2b', nameKey: 'palettePapyrus' },
        { id: 'emerald',   color: '#2d7a4f', nameKey: 'paletteEmerald' },
        { id: 'ocean',     color: '#2a6080', nameKey: 'paletteOcean' },
        { id: 'amethyst',  color: '#6b3a8a', nameKey: 'paletteAmethyst' },
        { id: 'gold',      color: '#a07818', nameKey: 'paletteGold' },
        { id: 'ruby',      color: '#8a3a3a', nameKey: 'paletteRuby' },
        { id: 'snow',      color: '#e8e8e8', nameKey: 'paletteSnow' },
        { id: 'noir',      color: '#222222', nameKey: 'paletteNoir' },
    ];

    function applyPalette(id) {
        if (id) {
            document.documentElement.setAttribute('data-palette', id);
        } else {
            document.documentElement.removeAttribute('data-palette');
        }
        try { localStorage.setItem('hijri-palette', id || ''); } catch (e) {}
        // Update active swatch
        document.querySelectorAll('.palette-swatch').forEach(s => {
            s.classList.toggle('active', (s.dataset.palette || '') === (id || ''));
        });
    }

    function setupPalette() {
        // Restore saved palette
        let saved = '';
        try { saved = localStorage.getItem('hijri-palette') || ''; } catch (e) {}
        applyPalette(saved);

        const btn = document.getElementById('dv-palette-btn');
        const popup = document.getElementById('palette-popup');
        const overlay = document.getElementById('palette-overlay');
        const container = document.getElementById('palette-swatches');
        const title = document.getElementById('palette-popup-title');
        if (!btn || !popup || !container) return;

        // Update title with i18n
        if (title) title.textContent = H.t('palette');

        // Build swatches
        container.innerHTML = '';
        PALETTES.forEach(p => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch' + ((saved || '') === (p.id || '') ? ' active' : '');
            swatch.style.background = p.color;
            swatch.dataset.palette = p.id;
            swatch.addEventListener('click', () => {
                applyPalette(p.id);
                setTimeout(() => {
                    popup.classList.remove('open');
                    if (overlay) overlay.classList.remove('open');
                }, 200);
            });
            const label = document.createElement('div');
            label.className = 'palette-swatch-label';
            label.textContent = H.t(p.nameKey);
            item.appendChild(swatch);
            item.appendChild(label);
            container.appendChild(item);
        });

        // Toggle popup
        btn.addEventListener('click', () => {
            const isOpen = popup.classList.contains('open');
            if (isOpen) {
                popup.classList.remove('open');
                if (overlay) overlay.classList.remove('open');
            } else {
                // refresh labels in case language changed
                if (title) title.textContent = H.t('palette');
                container.querySelectorAll('.palette-item').forEach((item, i) => {
                    const lbl = item.querySelector('.palette-swatch-label');
                    if (lbl && PALETTES[i]) lbl.textContent = H.t(PALETTES[i].nameKey);
                });
                popup.classList.add('open');
                if (overlay) overlay.classList.add('open');
            }
        });

        // Close on overlay click
        if (overlay) overlay.addEventListener('click', () => {
            popup.classList.remove('open');
            overlay.classList.remove('open');
        });
    }

    function setupDayView() {
        const backBtn = document.getElementById('dv-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', showCalendarView);
        }
        // Anwa detail back button
        const anwaBackBtn = document.getElementById('anwa-detail-back');
        if (anwaBackBtn) anwaBackBtn.addEventListener('click', closeAnwaDetail);
        // Today button
        const todayBtn = document.getElementById('dv-today-btn');
        if (todayBtn) todayBtn.addEventListener('click', () => showDayView(null));
        // Calendar view: back to day view
        const cvBackBtn = document.getElementById('cv-back-btn');
        if (cvBackBtn) cvBackBtn.addEventListener('click', () => showDayView(_selectedDate));
        // Navigation arrows
        const nextBtn = document.getElementById('dv-nav-next');
        const prevBtn = document.getElementById('dv-nav-prev');
        if (nextBtn) nextBtn.addEventListener('click', () => navigateDayView(1));
        if (prevBtn) prevBtn.addEventListener('click', () => navigateDayView(-1));

        // Language toggle buttons
        const langAr = document.getElementById('dv-lang-ar');
        const langEn = document.getElementById('dv-lang-en');
        if (langAr) langAr.addEventListener('click', () => {
            if (H.getLang() === 'ar') return;
            H.setLang('ar');
            H._saveLang();
            applyLabels();
            renderDayView(_selectedDate || null);
        });
        if (langEn) langEn.addEventListener('click', () => {
            if (H.getLang() === 'en') return;
            H.setLang('en');
            H._saveLang();
            applyLabels();
            renderDayView(_selectedDate || null);
        });

        // Theme toggle button in day view
        const dvThemeBtn = document.getElementById('dv-theme-toggle');
        if (dvThemeBtn) {
            // Sync icon with current theme
            const curTheme = document.documentElement.getAttribute('data-theme');
            dvThemeBtn.textContent = curTheme === 'dark' ? '☀️' : '🌙';
            dvThemeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                dvThemeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
                // Sync the calendar view theme button
                const cvBtn = document.getElementById('theme-toggle');
                if (cvBtn) cvBtn.textContent = next === 'dark' ? '☀️' : '🌙';
                try { localStorage.setItem('hijri-theme', next); } catch (e) {}
                const meta = document.querySelector('meta[name="theme-color"]');
                if (meta) meta.content = next === 'dark' ? '#064e3b' : '#14553f';
            });
        }

        // Palette selector
        setupPalette();

        // Swipe support for day navigation
        let touchStartX = 0;
        const dayView = document.getElementById('day-view');
        if (dayView) {
            dayView.addEventListener('touchstart', e => {
                touchStartX = e.touches[0].clientX;
            }, { passive: true });
            dayView.addEventListener('touchend', e => {
                const dx = e.changedTouches[0].clientX - touchStartX;
                if (Math.abs(dx) > 60) {
                    // RTL: swipe left = next day, swipe right = prev day
                    const isRTL = H.getLang() === 'ar';
                    if (dx < 0) navigateDayView(isRTL ? 1 : -1);
                    else navigateDayView(isRTL ? -1 : 1);
                }
            }, { passive: true });
        }
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);

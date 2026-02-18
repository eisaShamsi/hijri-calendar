/**
 * تطبيق التقويم الهجري — الواجهة
 * المستوى 2 (فلكي) كافتراضي + تصحيح يدوي + تعدد اللغات + تصدير iCal
 */

const App = (() => {
    const H = HijriCalendar;
    const PT = typeof PrayerTimes !== 'undefined' ? PrayerTimes : null;
    const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    let currentYear, currentMonth;
    let _prayerTimer = null;
    let _notifyTimers = [];
    let _deferredInstallPrompt = null;
    let _selectedDate = null; // { year, month, day } gregorian — null means today

    // ─── تهيئة ──────────────────────────────────────────────
    function init() {
        const today = H.todayHijri();
        currentYear = today.year;
        currentMonth = today.month;

        setupTheme();
        setupNavigation();
        setupModeSelector();
        setupWeekStartSelector();
        setupLangSelector();
        setupCorrectionControls();
        setupGoToDate();
        setupExport();
        setupAdhkar();
        setupShare();
        if (PT) setupPrayerTimes();
        if (PT) setupNotifications();
        applyLabels();
        renderCalendar();
        renderTodayInfo();
        renderAnwaCard();
        updateModeUI();
        if (PT) renderPrayerTimes();
        registerServiceWorker();
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

        // الانتقال إلى تاريخ
        document.getElementById('goto-title').textContent = H.t('goToDate');
        document.getElementById('goto-hijri-label').textContent = H.t('hijri');
        document.getElementById('goto-greg-label').textContent = H.t('gregorian');
        document.getElementById('goto-lbl-day').textContent = H.t('day');
        document.getElementById('goto-lbl-month').textContent = H.t('month');
        document.getElementById('goto-lbl-year').textContent = H.t('year');
        document.getElementById('goto-btn').textContent = H.t('go');

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

    // ─── الانتقال إلى تاريخ ─────────────────────────────────
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

        document.getElementById('month-title').textContent =
            `${data.monthName} ${data.year} ${H.t('hSuffix')}`;

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

        let hijriText = `${H.dayName(dow)}، ${today.day} ${H.monthName(today.month-1)} ${today.year} ${H.t('hSuffix')}`;
        const event = H.getEvent(today.month, today.day);
        if (event) {
            hijriText += ` — ${event.name}`;
        }
        document.getElementById('today-hijri').textContent = hijriText;

        document.getElementById('today-gregorian').textContent =
            `${now.getDate()} ${H.gregMonthName(now.getMonth())} ${now.getFullYear()}${H.t('gSuffix')}`;

        // الأنواء والمواسم
        _renderAnwaLine(now.getMonth() + 1, now.getDate(), now.getFullYear(), 'today-anwa');
    }

    /** عرض سطر الأنواء (الطالع • البرج • الموسم • الدر • القمر) */
    function _renderAnwaLine(gMonth, gDay, gYear, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const tale3 = H.getTale3(gMonth, gDay);
        const zodiac = H.getZodiac(gMonth, gDay);
        const season = H.getSeason(gMonth, gDay);
        const durr = H.getDurr(gMonth, gDay, gYear);
        const moon = H.getMoonPhase(gYear, gMonth, gDay);

        const parts = [];
        if (tale3) parts.push(`${H.t('tale3Label')}: ${tale3.name}`);
        if (zodiac) parts.push(`${zodiac.symbol} ${zodiac.name}`);
        if (season) parts.push(`${H.t('seasonLabel')}: ${season.name}`);
        if (durr) parts.push(`${durr.durr} (${H.t('suhailLabel')} ${durr.suhailDay})`);
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
        const zodiac = H.getZodiac(gMonth, gDay);
        const season = H.getSeason(gMonth, gDay);
        const durr = H.getDurr(gMonth, gDay, gYear);

        // تعبئة القيم
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setVal('anwa-tale3', tale3 ? tale3.name : '—');
        setVal('anwa-zodiac', zodiac ? `${zodiac.symbol} ${zodiac.name}` : '—');
        setVal('anwa-season', season ? season.name : '—');
        setVal('anwa-durr', durr ? durr.durr : '—');
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

        // تحديث العناوين حسب اللغة
        setVal('anwa-card-title', H.t('anwaTitle'));
        setVal('anwa-tale3-lbl', H.t('tale3Label'));
        setVal('anwa-zodiac-lbl', H.t('zodiacLabel'));
        setVal('anwa-season-lbl', H.t('seasonLabel'));
        setVal('anwa-durr-lbl', H.t('durrLabel'));
        setVal('anwa-suhail-lbl', H.t('suhailLabel'));
        setVal('anwa-mia-lbl', H.getLang() === 'en' ? 'Hundred' : 'المائة');
    }

    // ─── اختيار يوم ─────────────────────────────────────────
    function selectDay(day, e) {
        updateInfoBar(day);
        document.querySelectorAll('.calendar-cell.selected').forEach(el => el.classList.remove('selected'));
        e.currentTarget.classList.add('selected');

        // Update prayer times and Anwa card for the selected date
        if (day) {
            const greg = day.gregorian;
            const now = new Date();
            const isToday = greg.year === now.getFullYear() && greg.month === (now.getMonth() + 1) && greg.day === now.getDate();
            _selectedDate = isToday ? null : { year: greg.year, month: greg.month, day: greg.day };
            if (PT) renderPrayerTimes();
            renderAnwaCard(isToday ? null : greg);
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
        const zodiac = H.getZodiac(greg.month, greg.day);
        const season = H.getSeason(greg.month, greg.day);
        const durr = H.getDurr(greg.month, greg.day, greg.year);
        const moon = H.getMoonPhase(greg.year, greg.month, greg.day);

        const anwaParts = [];
        if (tale3) anwaParts.push(tale3.name);
        if (zodiac) anwaParts.push(`${zodiac.symbol} ${zodiac.name}`);
        if (season) anwaParts.push(season.name);
        if (durr) anwaParts.push(`${durr.durr} (${H.t('suhailLabel')} ${durr.suhailDay})`);
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
            });
            renderPrayerTimes();
        };

        methodSelect.addEventListener('change', saveAndRender);
        document.getElementById('prayer-asr-select').addEventListener('change', saveAndRender);
        highLatSelect.addEventListener('change', saveAndRender);
        document.getElementById('prayer-lat').addEventListener('change', saveAndRender);
        document.getElementById('prayer-lng').addEventListener('change', saveAndRender);
        document.getElementById('prayer-tz').addEventListener('change', saveAndRender);
        document.getElementById('prayer-elevation').addEventListener('change', saveAndRender);

        // Detect location buttons
        const detectLocation = async () => {
            const fillLocation = (lat, lng, altitude) => {
                document.getElementById('prayer-lat').value = Math.round(lat * 100) / 100;
                document.getElementById('prayer-lng').value = Math.round(lng * 100) / 100;
                document.getElementById('prayer-tz').value = -new Date().getTimezoneOffset() / 60;
                if (altitude) {
                    document.getElementById('prayer-elevation').value = Math.round(altitude);
                }
                saveAndRender();
            };
            if (isNative()) {
                try {
                    const { Geolocation } = window.Capacitor.Plugins;
                    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
                    fillLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude);
                } catch (e) { console.warn('Native geolocation failed', e); }
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    fillLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude);
                });
            }
        };
        document.getElementById('prayer-detect').addEventListener('click', detectLocation);
        document.getElementById('prayer-detect-main').addEventListener('click', detectLocation);

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

        document.getElementById('p-fajr').textContent = times.fajr;
        document.getElementById('p-sunrise').textContent = times.sunrise;
        document.getElementById('p-dhuhr').textContent = times.dhuhr;
        document.getElementById('p-asr').textContent = times.asr;
        document.getElementById('p-maghrib').textContent = times.maghrib;
        document.getElementById('p-isha').textContent = times.isha;

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
        const zodiac = H.getZodiac(gMonth, gDay);
        if (tale3 || zodiac) {
            const parts = [];
            if (tale3) parts.push(`${H.t('tale3Label')}: ${tale3.name}`);
            if (zodiac) parts.push(`${zodiac.symbol} ${zodiac.name}`);
            lines.push(`☆ ${parts.join(' • ')}`);
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
body { font-family: 'Cairo', 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333; direction: ${isRTL ? 'rtl' : 'ltr'}; }
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

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);

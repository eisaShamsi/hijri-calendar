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
        if (moon) parts.push(`${moon.emoji} ${moon.name}`);

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

        // طور القمر
        const moon = H.getMoonPhase(gYear, gMonth, gDay);
        if (moon) {
            setVal('moon-emoji', moon.emoji);
            setVal('moon-name', moon.name);
            const lang = H.getLang();
            const ageText = `${moon.age} ${H.t('moonAgeDays')}`;
            const illumText = `${H.t('moonIllumination')}: ${moon.illumination}%`;
            setVal('moon-details', `${ageText} — ${illumText}`);
            const bar = document.getElementById('moon-bar');
            if (bar) bar.style.width = moon.illumination + '%';
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
        if (moon) anwaParts.push(`${moon.emoji} ${moon.name}`);

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

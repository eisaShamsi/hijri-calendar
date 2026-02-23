/**
 * AI Client — وحدة التواصل مع Backend لجلب المحتوى المولّد بالذكاء الاصطناعي
 * تدعم التخزين المؤقت المحلي والعمل بدون اتصال
 */
const AIClient = (() => {
    const API_BASE = 'http://localhost:3000/api';
    const CACHE_KEY = 'hijri-ai-cache';
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    // ─── Cache helpers ──────────────────────────────────────
    function _getCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
        } catch (e) { return {}; }
    }

    function _setCache(cache) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
    }

    function _getCached(type, key) {
        const cache = _getCache();
        const entry = cache[`${type}_${key}`];
        if (!entry) return null;
        if (Date.now() - entry.ts > CACHE_TTL) return null;
        return entry.data;
    }

    function _setCached(type, key, data) {
        const cache = _getCache();
        cache[`${type}_${key}`] = { data, ts: Date.now() };
        _setCache(cache);
    }

    // ─── Daily Content ──────────────────────────────────────
    /**
     * @param {Object} ctx - سياق اليوم
     * @param {number} ctx.hijriDay
     * @param {number} ctx.hijriMonth
     * @param {string} ctx.hijriMonthName
     * @param {number} ctx.hijriYear
     * @param {number} ctx.gregDay
     * @param {string} ctx.gregMonthName
     * @param {number} ctx.gregYear
     * @param {string} ctx.dayOfWeek
     * @param {string} [ctx.islamicEvent]
     * @param {string} [ctx.moonPhase]
     * @param {string} [ctx.anwaMansion]
     * @param {string} [ctx.anwaSeason]
     * @param {string} [ctx.locationCity]
     * @returns {Promise<Object>} { verse, reflection, hadith, wisdom, historicalEvent }
     */
    async function fetchDailyContent(ctx) {
        const dateKey = `${ctx.hijriYear}-${ctx.hijriMonth}-${ctx.hijriDay}`;

        // Check local cache first
        const cached = _getCached('daily', dateKey);
        if (cached) return cached;

        try {
            const res = await fetch(`${API_BASE}/daily-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ctx)
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            _setCached('daily', dateKey, data);
            return data;

        } catch (err) {
            console.warn('AI daily content fetch failed:', err.message);
            // Return last available cached content (any date) as fallback
            return _getLastCached('daily');
        }
    }

    // ─── Smart Notifications ─────────────────────────────────
    /**
     * @param {Array} days - مصفوفة أيام مع السياق
     * @returns {Promise<Array>} [{ date, notifications: [{ time, text }] }]
     */
    async function fetchSmartNotifications(days) {
        if (!days || days.length === 0) return [];

        const cacheKey = `${days[0].gregDate}_to_${days[days.length - 1].gregDate}`;
        const cached = _getCached('notif', cacheKey);
        if (cached) return cached;

        try {
            const res = await fetch(`${API_BASE}/notifications?days=${encodeURIComponent(JSON.stringify(days))}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const notifications = data.notifications || [];
            _setCached('notif', cacheKey, notifications);
            return notifications;

        } catch (err) {
            console.warn('AI notifications fetch failed:', err.message);
            return [];
        }
    }

    // ─── Fallback: last cached content ──────────────────────
    function _getLastCached(type) {
        const cache = _getCache();
        let latest = null;
        let latestTs = 0;
        for (const [key, entry] of Object.entries(cache)) {
            if (key.startsWith(`${type}_`) && entry.ts > latestTs) {
                latest = entry.data;
                latestTs = entry.ts;
            }
        }
        return latest;
    }

    // ─── Check if backend is reachable ──────────────────────
    async function isAvailable() {
        try {
            const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    return {
        fetchDailyContent,
        fetchSmartNotifications,
        isAvailable
    };
})();

/**
 * Hijri Calendar AI Backend
 * Express server يتواصل مع Claude API لتوليد محتوى يومي وتنبيهات ذكية
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { generateDailyContent, generateSmartNotifications } = require('./claude');
const cache = require('./cache');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Health check ────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── محتوى يومي مولّد بالـ AI ─────────────────────────────
app.post('/api/daily-content', async (req, res) => {
    try {
        const ctx = req.body;

        if (!ctx.hijriDay || !ctx.hijriMonthName) {
            return res.status(400).json({ error: 'Missing required fields: hijriDay, hijriMonthName' });
        }

        // Cache key: hijri date string
        const dateKey = `${ctx.hijriYear}-${ctx.hijriMonth}-${ctx.hijriDay}`;

        // Check cache first
        const cached = cache.get('daily', dateKey);
        if (cached) {
            return res.json({ ...cached, cached: true });
        }

        // Generate new content via Claude
        const content = await generateDailyContent(ctx);

        // Cache it
        cache.set('daily', dateKey, content);

        res.json({ ...content, cached: false });

    } catch (err) {
        console.error('Daily content error:', err.message);
        res.status(500).json({ error: 'Failed to generate content', details: err.message });
    }
});

// ─── تنبيهات ذكية ─────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
    try {
        const days = req.query.days ? JSON.parse(req.query.days) : [];

        if (!Array.isArray(days) || days.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid "days" query parameter (JSON array)' });
        }

        // Cache key: first and last date
        const cacheKey = `${days[0].gregDate}_to_${days[days.length - 1].gregDate}`;
        const cached = cache.get('notifications', cacheKey);
        if (cached) {
            return res.json({ notifications: cached, cached: true });
        }

        // Generate via Claude
        const notifications = await generateSmartNotifications(days);

        // Cache
        cache.set('notifications', cacheKey, notifications);

        res.json({ notifications, cached: false });

    } catch (err) {
        console.error('Notifications error:', err.message);
        res.status(500).json({ error: 'Failed to generate notifications', details: err.message });
    }
});

// ─── Cache cleanup (manual trigger) ──────────────────────
app.post('/api/cache/cleanup', (req, res) => {
    const removed = cache.cleanup(30);
    res.json({ removed, message: `Cleaned up ${removed} cache files older than 30 days` });
});

// ─── Start server ────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🕌 Hijri Calendar AI Backend running on http://localhost:${PORT}`);
    console.log(`   API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ MISSING — set ANTHROPIC_API_KEY in .env'}`);
});

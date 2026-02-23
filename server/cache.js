/**
 * Cache — تخزين مؤقت للمحتوى المولّد
 * يخزّن كل يوم كملف JSON منفصل في server/cache/
 */
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCacheKey(type, dateStr) {
    return `${type}_${dateStr}.json`;
}

function get(type, dateStr) {
    const file = path.join(CACHE_DIR, getCacheKey(type, dateStr));
    if (!fs.existsSync(file)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return data;
    } catch (e) {
        return null;
    }
}

function set(type, dateStr, data) {
    const file = path.join(CACHE_DIR, getCacheKey(type, dateStr));
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function has(type, dateStr) {
    return fs.existsSync(path.join(CACHE_DIR, getCacheKey(type, dateStr)));
}

/**
 * Clean up cache files older than `days` days
 */
function cleanup(days = 30) {
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(CACHE_DIR);
    let removed = 0;
    for (const f of files) {
        const fp = path.join(CACHE_DIR, f);
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > maxAge) {
            fs.unlinkSync(fp);
            removed++;
        }
    }
    return removed;
}

module.exports = { get, set, has, cleanup };

# Prayer Times Feature - Implementation Plan

## Overview
Add a prayer times calculator to the Hijri Calendar app. It will be a self-contained astronomical engine (no external APIs) supporting 21+ calculation methods used across the Muslim world, with Hanafi/Shafi'i Asr toggle and high-latitude adjustments.

## Architecture

### New File: `prayer-times.js` (~400-500 lines)
A standalone module `PrayerTimes` following the same IIFE pattern as `HijriCalendar`:

```
PrayerTimes = {
  // Solar position (Jean Meeus algorithms)
  sunDeclination(jdn)
  equationOfTime(jdn)
  solarNoon(jdn, lng, tz)
  hourAngle(lat, decl, angle)

  // Prayer time calculations
  calculate(date, lat, lng, tz, method, asrFactor, highLatRule)
  // Returns: { fajr, sunrise, dhuhr, asr, maghrib, isha, imsak, midnight }

  // Method definitions (21+ presets)
  METHODS: { mwl, egyptian, karachi, ummAlQura, isna, tehran, ... }

  // High-latitude adjustments
  HIGH_LAT: { none, middleOfNight, oneSeventhNight, angleBased }

  // Settings persistence
  setMethod(), getMethod(), setAsrFactor(), ...

  // i18n keys (added to HijriCalendar._UI)
}
```

### Changes to Existing Files

**index.html** - Add 3 new sections:
1. **Prayer Times Card** (after Today Card) - Shows today's 6 prayer times with countdown to next prayer
2. **Location Settings** (in Toolbar Card) - Latitude, Longitude, Timezone, Method selector, Asr toggle
3. **Prayer Times Row in Calendar Grid** - Optional: show Fajr/Maghrib times per day

**style.css** - Add styles for:
- Prayer times card (reuse existing card pattern)
- Prayer time rows (6 prayers in a grid)
- Countdown/next-prayer highlight
- Location settings controls

**hijri.js** - Minimal changes:
- Add i18n keys for prayer-related strings to `_UI.ar` and `_UI.en`

**app.js** - Add:
- `setupPrayerTimes()` - Wire location inputs, method selector, Asr toggle
- `renderPrayerTimes()` - Display prayer times for current date
- Call from `init()` and `refreshUI()`

## Method Presets (21 methods)

Each method is a simple config object:
```js
{ id, name, nameAr, fajr, isha, ishaType, maghrib, asrDefault, regions }
```

| # | ID | Fajr | Isha | Type |
|---|-----|------|------|------|
| 1 | mwl | 18.0 | 17.0 | angle |
| 2 | egyptian | 19.5 | 17.5 | angle |
| 3 | karachi | 18.0 | 18.0 | angle |
| 4 | ummAlQura | 18.5 | 90min | offset |
| 5 | isna | 15.0 | 15.0 | angle |
| 6 | tehran | 17.7 | 14.0 | angle |
| 7 | qom | 16.0 | 14.0 | angle |
| 8 | uae | 18.2 | 18.2 | angle |
| 9 | kuwait | 18.0 | 17.5 | angle |
| 10 | qatar | 18.0 | 17.5 | angle |
| 11 | turkey | 18.0 | 17.0 | angle |
| 12 | algeria | 18.0 | 17.0 | angle |
| 13 | tunisia | 18.0 | 18.0 | angle |
| 14 | morocco | 19.0 | 17.0 | angle |
| 15 | jordan | 18.0 | 18.0 | angle |
| 16 | france | 12.0 | 12.0 | angle |
| 17 | singapore | 20.0 | 18.0 | angle |
| 18 | malaysia | 20.0 | 18.0 | angle |
| 19 | indonesia | 20.0 | 18.0 | angle |
| 20 | palestine | 19.5 | 17.5 | angle |
| 21 | libya | 19.5 | 17.5 | angle |

## User Settings (persisted in localStorage)

- `prayer-method` - Selected calculation method ID
- `prayer-asr` - 1 (Shafi'i) or 2 (Hanafi)
- `prayer-lat` - Latitude
- `prayer-lng` - Longitude
- `prayer-tz` - Timezone offset (auto-detected or manual)
- `prayer-highlat` - High latitude adjustment method
- `prayer-elevation` - Elevation in meters (optional)

## UI Layout

### Prayer Times Card (main display)
```
┌─────────────────────────────────────────┐
│  مواقيت الصلاة / Prayer Times           │
│  📍 Amman, Jordan (auto/manual)         │
├─────────────────────────────────────────┤
│  الفجر    05:12  ●  الظهر    12:18     │
│  الشروق   06:28     العصر    15:32     │
│  المغرب   17:45     العشاء   19:01     │
├─────────────────────────────────────────┤
│  ▶ Next: المغرب in 2:13:45   [===--]   │
│  Method: MWL | Asr: Shafi'i             │
└─────────────────────────────────────────┘
```

### Location & Method Settings (expandable in toolbar)
```
┌─ Prayer Settings ───────────────────────┐
│ Method: [MWL ▼]  Asr: [Shafi'i ▼]     │
│ Lat: [31.95]  Lng: [35.93]  TZ: [+3]  │
│ High Lat: [None ▼]  [📍 Detect]        │
└─────────────────────────────────────────┘
```

## Implementation Steps

1. Create `prayer-times.js` with solar position engine + all 21 methods
2. Add i18n keys to `hijri.js` (_UI.ar and _UI.en)
3. Add HTML sections to `index.html` (prayer card + settings)
4. Add CSS styles to `style.css`
5. Wire up in `app.js` (settings, rendering, countdown timer)
6. Add `<script src="prayer-times.js">` to index.html (before app.js)
7. Test against Al-Awail reference data for multiple cities

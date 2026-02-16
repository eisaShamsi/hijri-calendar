# Prayer Times Calculation Research

## Key Finding: Al-Awail Uses Country-Specific Methods

Al-Awail (al-awail.com) adapts to the officially adopted method of each country:

| City | Fajr-Sunrise | Maghrib-Isha | Identified Method |
|------|-------------|-------------|-------------------|
| Seeq, Oman | 76 min | 71 min | MWL (Fajr 18, Isha 17) |
| Amman, Jordan | 76 min | 76 min | Jordan (Fajr 18, Isha 18) |
| Makkah, Saudi | 76 min | 90 min | Umm al-Qura (Fajr 18.5, Isha 90min) |
| Cairo, Egypt | 87 min | 78 min | Egyptian (Fajr 19.5, Isha 17.5) |

## Calculation Methods Reference Table

| ID | Method | Fajr | Isha | Isha Type | Maghrib | Asr Default |
|----|--------|------|------|-----------|---------|-------------|
| 1 | MWL | 18.0 | 17.0 | angle | sunset | Shafi'i (1) |
| 2 | Egyptian (EGAS) | 19.5 | 17.5 | angle | sunset | Shafi'i (1) |
| 3 | Karachi | 18.0 | 18.0 | angle | sunset | Shafi'i (1) |
| 4 | Umm al-Qura | 18.5 | 90/120min | offset | sunset | Shafi'i (1) |
| 5 | ISNA | 15.0 | 15.0 | angle | sunset | Shafi'i (1) |
| 6 | Tehran | 17.7 | 14.0 | angle | sun@-4.5 | Shafi'i (1) |
| 7 | Qom (Shia) | 16.0 | 14.0 | angle | sun@-4.0 | Shafi'i (1) |
| 8 | UAE (GAIAE) | 18.2 | 18.2 | angle | sunset | Shafi'i (1) |
| 9 | Kuwait | 18.0 | 17.5 | angle | sunset | Shafi'i (1) |
| 10 | Qatar | 18.0 | 17.5 | angle | sunset | Shafi'i (1) |
| 11 | Turkey (Diyanet) | 18.0 | 17.0 | angle | sunset | Shafi'i (1) |
| 12 | Algeria | 18.0 | 17.0 | angle | sunset | Shafi'i (1) |
| 13 | Tunisia | 18.0 | 18.0 | angle | sunset | Shafi'i (1) |
| 14 | Morocco | 19.0 | 17.0 | angle | sunset+5m | Shafi'i (1) |
| 15 | Jordan | 18.0 | 18.0 | angle | sunset | Shafi'i (1) |
| 16 | France (UOIF) | 12.0 | 12.0 | angle | sunset | Shafi'i (1) |
| 17 | Singapore (MUIS) | 20.0 | 18.0 | angle | sunset | Shafi'i (1) |
| 18 | Malaysia (JAKIM) | 20.0 | 18.0 | angle | sunset | Shafi'i (1) |
| 19 | Indonesia (KEMENAG) | 20.0 | 18.0 | angle | sunset | Shafi'i (1) |
| 20 | Palestine | 19.5 | 17.5 | angle | sunset | Shafi'i (1) |
| 21 | Libya | 19.5 | 17.5 | angle | sunset | Shafi'i (1) |

## Asr Calculation
- **Shafi'i/Maliki/Hanbali (factor=1)**: shadow = object + noon shadow
- **Hanafi (factor=2)**: shadow = 2*object + noon shadow

## High Latitude Methods
1. Middle of the Night
2. One-Seventh of the Night
3. Angle-Based (proportional)
4. Nearest Day
5. Nearest Latitude (45 or 48.5 N)
6. Fixed Offset
7. MCW Seasonal

## Technical Constants
- Atmospheric refraction: 0.5667 degrees (34 arcminutes)
- Solar semi-diameter: 0.2667 degrees (16 arcminutes)
- Combined horizon correction: 0.8333 degrees
- Altitude correction: 0.0347 * sqrt(elevation_meters)

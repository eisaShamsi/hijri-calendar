const ASTRONOMICAL_MONTH = 29.530588861;  // mean synodic month in days
const TABULAR_CYCLE_DAYS = 10631;
const TABULAR_CYCLE_MONTHS = 360;         // 30 years * 12 months
const TABULAR_MONTH = TABULAR_CYCLE_DAYS / TABULAR_CYCLE_MONTHS;

const errorPerMonth = TABULAR_MONTH - ASTRONOMICAL_MONTH;
const errorPerYear = errorPerMonth * 12;
const errorPerCentury = errorPerYear * 100;
const errorPer1000Years = errorPerYear * 1000;
const errorPer1500Years = errorPerYear * 1500;

console.log("=== Tabular Islamic Calendar — Error Accumulation Analysis ===\n");

console.log("--- Constants ---");
console.log(`  Astronomical mean synodic month : ${ASTRONOMICAL_MONTH} days`);
console.log(`  Tabular 30-year cycle           : ${TABULAR_CYCLE_DAYS} days / ${TABULAR_CYCLE_MONTHS} months`);
console.log(`  Tabular average month           : ${TABULAR_CYCLE_DAYS}/${TABULAR_CYCLE_MONTHS} = ${TABULAR_MONTH} days`);
console.log();

console.log("--- Error (tabular minus astronomical) ---");
console.log(`  Per month    : ${errorPerMonth.toFixed(12)} days`);
console.log(`                 (${(errorPerMonth * 24 * 3600).toFixed(6)} seconds)`);
console.log(`  Per year     : ${errorPerYear.toFixed(12)} days`);
console.log(`                 (${(errorPerYear * 24 * 3600).toFixed(6)} seconds)`);
console.log(`  Per century  : ${errorPerCentury.toFixed(9)} days`);
console.log(`                 (${(errorPerCentury * 24).toFixed(6)} hours)`);
console.log(`  Per 1000 yrs : ${errorPer1000Years.toFixed(6)} days`);
console.log(`  Per 1500 yrs : ${errorPer1500Years.toFixed(6)} days`);
console.log();

console.log("--- Interpretation ---");
const sign = errorPerMonth > 0 ? "ahead of" : "behind";
console.log(`  The tabular calendar runs ${sign} the true lunar cycle.`);
console.log(`  Over 1500 years it drifts by ~${Math.abs(errorPer1500Years).toFixed(4)} days`);
console.log(`    = ~${Math.abs(errorPer1500Years * 24).toFixed(2)} hours`);
console.log(`    = ~${Math.abs(errorPer1500Years * 24 * 60).toFixed(1)} minutes.`);

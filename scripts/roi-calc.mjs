/**
 * ROI分析レポート（docs/roi-report.md）の数値を再計算する。
 *
 *   pnpm roi
 *
 * レポート本文に載せた数字はすべてこのスクリプトの出力である。
 * 前提（時間単価・月間粗利・削減時間）を変えて聞かれたときに、
 * その場で計算し直して答えられるようにしている。
 * 数字を手で書き換えないこと。ここを直して出力を貼り直す。
 */

// --- 確定値（提案書 第10項・第12項）---
const INITIAL = 440_000; // 初期費用（税込）
const MONTHLY = 3_900; // 月額実費
const MAINTENANCE = 20_000; // 月額保守（選択制）

// --- 仮定（クライアントの数値に差し替える）---
const HOURS_SAVED = [2.5, 2.0, 1.5]; // 月次レポート 3時間 からの削減時間
// 単価が不明なため5段階で振る。低い側で回収不能に近づくことを示すため2,500円まで下げている
const HOURLY_RATES = [2_500, 3_000, 4_000, 5_000, 8_000]; // 担当者の時間単価
const GROSS_PROFITS = [1_000_000, 3_000_000, 5_000_000, 10_000_000]; // 月間粗利額
const PAYBACK_MONTHS = [12, 24, 36];

// レポート本文が基準に採っている組み合わせ
const BASE_HOURS = 2.5;
const BASE_RATE = 4_000;
const BASE_SAVING = BASE_HOURS * BASE_RATE;

const yen = (n) => `${Math.round(n).toLocaleString("ja-JP")}円`;

function paybackMonths(monthlyBenefit, withMaintenance) {
  const cost = MONTHLY + (withMaintenance ? MAINTENANCE : 0);
  const net = monthlyBenefit - cost;
  return net > 0 ? INITIAL / net : null;
}

function formatPayback(months) {
  if (months === null) return "回収不能";
  const years = Math.floor(months / 12);
  const rest = Math.round(months % 12);
  return `約${months.toFixed(1)}ヶ月（約${years}年${rest}ヶ月）`;
}

console.log("■ 3. 削減できる時間");
console.log(`  月 ${BASE_HOURS}時間（3時間 → 約30分）/ 年 ${BASE_HOURS * 12}時間`);
console.log(`  年間費用: ${yen(MONTHLY * 12)}（月額 ${yen(MONTHLY)} × 12）`);

console.log("\n■ 3. 年間の人件費換算と回収期間（時間削減のみ・保守なし）");
console.log("  想定時給 | 年間効果 | 年間純便益 | 回収期間");
for (const r of HOURLY_RATES) {
  const annualBenefit = BASE_HOURS * 12 * r;
  const annualNet = annualBenefit - MONTHLY * 12;
  const years = annualNet > 0 ? INITIAL / annualNet : null;
  console.log(
    `  ${yen(r).padStart(8)} | ${yen(annualBenefit).padStart(10)}` +
      ` | ${yen(annualNet).padStart(10)} | ` +
      (years ? `${Math.round(years * 12)}ヶ月(${years.toFixed(1)}年)` : "回収不能"),
  );
}

console.log("\n■ 3. 時間削減の月額換算（削減時間 × 時間単価）");
for (const hours of HOURS_SAVED) {
  const cells = HOURLY_RATES.map((r) => yen(hours * r).padStart(10));
  console.log(`  ${hours.toFixed(1)}時間 ${cells.join("")}`);
}

console.log("\n■ 4. 時間削減だけで初期費用を回収する場合");
for (const hours of HOURS_SAVED) {
  for (const rate of HOURLY_RATES) {
    const benefit = hours * rate;
    console.log(
      `  ${hours}時間 × ${yen(rate)}` +
        ` → 月次純益 ${yen(benefit - MONTHLY)}` +
        ` → ${formatPayback(paybackMonths(benefit, false))}` +
        ` / 保守あり ${formatPayback(paybackMonths(benefit, true))}`,
    );
  }
}

console.log("\n■ 6. 回収に必要な月間効果");
for (const months of PAYBACK_MONTHS) {
  const base = INITIAL / months;
  console.log(
    `  ${months}ヶ月: 保守なし ${yen(base + MONTHLY)}` +
      ` / 保守あり ${yen(base + MONTHLY + MAINTENANCE)}`,
  );
}

console.log(`\n■ 6. うち時間削減で賄えない不足分（時間削減 ${yen(BASE_SAVING)}/月 を差し引く）`);
for (const months of PAYBACK_MONTHS) {
  const base = INITIAL / months - BASE_SAVING;
  console.log(
    `  ${months}ヶ月: 保守なし ${yen(base + MONTHLY)}` +
      ` / 保守あり ${yen(base + MONTHLY + MAINTENANCE)}`,
  );
}

console.log("\n■ 6. 不足分を月間粗利額に対する必要改善率に置き換える（保守なし）");
for (const months of [12, 24]) {
  const gap = INITIAL / months + MONTHLY - BASE_SAVING;
  console.log(`  ${months}ヶ月回収（不足 ${yen(gap)}/月）`);
  for (const gp of GROSS_PROFITS) {
    console.log(`    月間粗利 ${yen(gp)} → ${((gap / gp) * 100).toFixed(2)}%`);
  }
}

console.log("\n■ 2. 総額");
for (const years of [1, 3]) {
  const n = years * 12;
  console.log(
    `  ${years}年: 保守なし ${yen(INITIAL + MONTHLY * n)}` +
      ` / 保守あり ${yen(INITIAL + (MONTHLY + MAINTENANCE) * n)}`,
  );
}

// --- 検証: サンプルCSVで実際にAIが検出した粗利率の低下（decisions.md D-18）---
console.log("\n■ 5. サンプルデータで検出した粗利率低下の大きさ");
const months = [
  { name: "9月", revenue: 148_400, grossProfit: 93_400 },
  { name: "10月", revenue: 147_500, grossProfit: 92_600 },
  { name: "11月", revenue: 264_700, grossProfit: 163_100 },
];
const rate = (m) => (m.grossProfit / m.revenue) * 100;
for (const m of months) {
  console.log(`  ${m.name}: 売上 ${yen(m.revenue)} 粗利 ${yen(m.grossProfit)} 粗利率 ${rate(m).toFixed(1)}%`);
}
const [sep, oct, nov] = months;
const dropPoint = rate(sep) - rate(nov);
console.log(`  9月→11月の低下: ${dropPoint.toFixed(2)}ポイント（売上に対する比率）`);
console.log(`  粗利額に対する比率: ${((dropPoint / rate(sep)) * 100).toFixed(2)}%`);
console.log(
  `  10月→11月: 売上 +${((nov.revenue / oct.revenue - 1) * 100).toFixed(1)}%` +
    ` / 粗利 +${((nov.grossProfit / oct.grossProfit - 1) * 100).toFixed(1)}%`,
);

// --- 回収が成立する想定（レポート 第6項）---
// これは想定であって実績ではない。前提を変えるならここを直す。
console.log("\n■ 6. 回収が成立する想定（実績ではない）");
const ASSUMED_GROSS_PROFIT = 3_000_000; // 月間粗利
const DETECTED_RATIO = dropPoint / rate(sep); // 検出した変化の大きさ（粗利額比 2.1%）
const RECOVER_SHARE = 0.5; // そのうち取り戻せる割合
const EFFECTIVE_MONTHS = 11; // 発見の翌月から年末までの月数

const swing = ASSUMED_GROSS_PROFIT * DETECTED_RATIO;
const recovered = swing * RECOVER_SHARE;
const annual = recovered * EFFECTIVE_MONTHS;
const needed = (INITIAL / 24 + MONTHLY - BASE_SAVING) * 12;

// レポート本文は概算として丸めて記載する。仮定を重ねた数字に1円単位の精度はない
const round1k = (n) => `約${(Math.round(n / 1000) * 1000).toLocaleString("ja-JP")}円`;
console.log(`  月間粗利 ${yen(ASSUMED_GROSS_PROFIT)} × 検出した変化 ${(DETECTED_RATIO * 100).toFixed(1)}% = ${round1k(swing)}/月`);
console.log(`  うち ${RECOVER_SHARE * 100}% を取り戻す → ${round1k(recovered)}/月`);
const round10k = (n) => `約${Math.round(n / 10000)}万円`;
console.log(`  ${EFFECTIVE_MONTHS}ヶ月続く → 年 ${round10k(annual)}`);
console.log(`  24ヶ月回収に必要な不足分 → 年 ${round10k(needed)}`);
console.log(`  判定: ${annual >= needed ? "成立する" : "成立しない"}`);

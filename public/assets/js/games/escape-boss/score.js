// スコアの計算。DOM に依存しない純粋なロジック。
// スコア = (正解語数 × 100 + クリア 300 + 残り距離 × 5 + 正確率(%) × 3 + 平均打鍵速度 × 50) × 役職倍率
export const SCORE_RULES = {
  perWord: 100,
  clearBonus: 300,
  perMeter: 5,
  perAccuracyPercent: 3,
  perKeystrokePerSecond: 50,
};

// 正確率(0〜1)。1回も打っていなければ 0。
export function accuracyOf(hits, miss) {
  const total = hits + miss;
  return total === 0 ? 0 : hits / total;
}

// 平均打鍵速度(打鍵/秒)
export function speedOf(hits, elapsed) {
  return elapsed > 0 ? hits / elapsed : 0;
}

// ゲーム状態から、記録する成績(正確率・速度・スコア)を計算する
export function summarize(state, multiplier) {
  const cleared = state.status === "cleared";
  const accuracy = accuracyOf(state.hits, state.miss);
  const cps = speedOf(state.hits, state.elapsed);
  const base =
    state.correct * SCORE_RULES.perWord +
    (cleared ? SCORE_RULES.clearBonus : 0) +
    Math.max(0, state.distance) * SCORE_RULES.perMeter +
    accuracy * 100 * SCORE_RULES.perAccuracyPercent +
    cps * SCORE_RULES.perKeystrokePerSecond;
  return { accuracy, cps, score: Math.round(base * multiplier) };
}

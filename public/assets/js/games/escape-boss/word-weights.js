// 役職ごとの「文字数(語の長さ)」の出やすさ(Phase 17)。DOM・保存・乱数に触れない純粋な関数。
// roles.json の stage.word_weights に、難易度ごとの出やすさ(重み)を書く。先輩は短い語が出やすく、会長は長い語が出やすい。
// 難易度は、読みの長さの決め(単位数 ≤3 → 1、4〜5 → 2、≥6 → 3。0006)なので、難易度の重み = 文字数の出やすさ。
// 語そのものは、削らない(出やすさが変わるだけ。語が足りなくならない)。苦手な語の重み(weak.js)とは、かけ合わせる。

// 重みの範囲(外れたものは、無視して 1 とみなす。roles.json は、テストで、範囲内を検査する)
export const WEIGHT_MIN = 0.1;
export const WEIGHT_MAX = 10;
const DIFFICULTIES = ["1", "2", "3", "4", "5"];

const validWeight = (value) => Number.isFinite(value) && value >= WEIGHT_MIN && value <= WEIGHT_MAX;

/** 難易度(文字列 "1"〜"5")→ 重み の表を、検証して整える。使えない項目は捨てる。表がなければ、空 */
export function normalizeWordWeights(table) {
  if (typeof table !== "object" || table === null || Array.isArray(table)) return {};
  const result = {};
  for (const key of DIFFICULTIES) {
    if (Object.hasOwn(table, key) && validWeight(table[key])) result[key] = table[key];
  }
  return result;
}

/** 語の一覧から、役職の重み(id → 重み)を作る。表にない難易度の語は、重みなし(1 として扱われる) */
export function roleWordWeights(items, stage) {
  const table = normalizeWordWeights(stage?.word_weights);
  const weights = new Map();
  if (Object.keys(table).length === 0) return weights;
  for (const item of items) {
    const weight = table[String(item?.difficulty)];
    if (weight !== undefined) weights.set(item.id, weight);
  }
  return weights;
}

/** 重みの表(Map)を、かけ合わせる(null・空は、無視)。どれも空なら null(重みなし = ふつうのシャッフル) */
export function mergeWeights(...maps) {
  const used = maps.filter((map) => map instanceof Map && map.size > 0);
  if (used.length === 0) return null;
  const merged = new Map();
  for (const map of used) {
    for (const [id, weight] of map) {
      if (!Number.isFinite(weight) || weight <= 0) continue;
      merged.set(id, (merged.get(id) ?? 1) * weight);
    }
  }
  return merged;
}

// 苦手な語の出やすさ(出題の重み)。DOM・保存に依存しない純粋なロジックで、入力を書き換えない。
//
// 元データは、復習リストと同じ「直近のプレイでの、語ごとのミス数(wordMisses)」。新しく保存するものはない。
// 重み = 1 + 強さ × min(ミスの数, 上限)。ミスした語だけが、1 より大きくなる(最大でも、ふつうで 2 倍・多めで 3 倍)。
// 1 プレイで使う語は、職種の語の約半分なので、偏りは穏やか。同じゲームの中で、同じ語は出ない(vocabulary.js)。
import { REVIEW_PLAYS, totalWordMisses } from "./review.js";

// 出やすさの段階。off は、完全にランダム(従来どおり)。強さは、クリア率への影響を、シミュレーションで見て決めた(決定ログ 0023)
export const WEAK_LEVELS = Object.freeze({
  off: Object.freeze({ label: "なし", strength: 0, cap: 0 }),
  normal: Object.freeze({ label: "ふつう", strength: 0.25, cap: 4 }),
  high: Object.freeze({ label: "多め", strength: 0.5, cap: 4 }),
});
export const DEFAULT_WEAK_LEVEL = "normal";

/** 知っている段階の名前か。 */
export const isWeakLevel = (value) =>
  typeof value === "string" && Object.hasOwn(WEAK_LEVELS, value);

/**
 * 語の重み。results: 新しい順のプレイ結果、items: このゲームで使える語(語録の項目)。
 * 戻り値: Map(id → 重み)。ミスのない語・段階が off・語録の `weak_detection.enabled` が false の語は、入らない(重み 1)。
 * 知らない段階は、off として扱う。
 */
export function weakWeights(
  results,
  items,
  { level = DEFAULT_WEAK_LEVEL, plays = REVIEW_PLAYS } = {},
) {
  const weights = new Map();
  if (!isWeakLevel(level) || level === "off") return weights;
  const { strength, cap } = WEAK_LEVELS[level];
  const eligible = new Map();
  for (const item of items ?? []) {
    if (item?.weak_detection?.enabled !== false) eligible.set(item.id, item);
  }
  const totals = totalWordMisses(results, { plays, accepts: (id) => eligible.has(id) });
  for (const [id, { misses }] of totals) weights.set(id, 1 + strength * Math.min(misses, cap));
  return weights;
}

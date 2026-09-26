// 語録の「意味が近い語」を見つける(Phase 25)。DOM・ファイル・ネットワークに触れない、決まった計算だけの純粋関数。
// 完全一致(id・日本語表記・読み)は、すでに vocab-validate.mjs・vocab-stats.mjs が検出する。
// ここは、表記は違うが、説明の文章が近い(紛らわしい・実質同じかもしれない)組を見つける、目安の点検。
// 有料APIは使わない(文字2-gramの重なり=Dice係数という、決まった計算だけ)。しきい値以上でも、必ず
// 重複とは限らない(人間・AIが、最終確認する)。

/** 文字列の、隣り合う2文字(2-gram)の集合。1文字以下は、空集合。 */
export function bigramSet(text) {
  const chars = Array.from(text);
  const set = new Set();
  for (let i = 0; i < chars.length - 1; i += 1) set.add(chars[i] + chars[i + 1]);
  return set;
}

/** 2つの集合の Dice 係数(0〜1。1 で完全に同じ 2-gram の集合)。両方空なら 0。 */
export function diceCoefficient(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const value of a) if (b.has(value)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

export const DEFAULT_THRESHOLD = 0.6;

/**
 * 語録全体(職種をまたいだ、1つの配列)から、説明(explanation)の文章が近い組を探す。
 * 戻り値: [{ aId, aJapanese, bId, bJapanese, score }] を、score の高い順に返す(1 組 1 回だけ)。
 * threshold(既定 0.6)以上の組だけを返す。同じ id 同士・explanation がどちらか空の組は、比べない。
 */
export function similarPairs(items, { threshold = DEFAULT_THRESHOLD } = {}) {
  const withSets = items
    .filter((item) => typeof item.explanation === "string" && item.explanation.length > 0)
    .map((item) => ({ item, set: bigramSet(item.explanation) }));

  const pairs = [];
  for (let i = 0; i < withSets.length; i += 1) {
    for (let j = i + 1; j < withSets.length; j += 1) {
      const a = withSets[i];
      const b = withSets[j];
      if (a.item.id === b.item.id) continue;
      const score = diceCoefficient(a.set, b.set);
      if (score >= threshold) {
        pairs.push({
          aId: a.item.id,
          aJapanese: a.item.japanese,
          bId: b.item.id,
          bJapanese: b.item.japanese,
          score,
        });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

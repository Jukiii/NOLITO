// 打鍵ごとの集計(ミス分析・苦手文字の元データ)。DOM に依存しない純粋なロジックで、状態は不変。
//
// - keys: キーごとの { hits: 正しく打った回数, misses: そのキーを打つべきところで間違えた回数 }
// - confusions: 打ち間違えの組 "期待したキー>実際に打ったキー"(例 "i>o")の回数
// - wordMisses: 語の id ごとのミス数(復習・苦手用語の元データ。画面には出さない)
//
// 「期待したキー」は、画面に表示している標準の表記の次の1文字。し=si/shi のように複数の表記で
// 打てる場合も、標準の表記のキーとして数える。

// キーとして数える文字(ローマ字入力で使う文字だけ)
export const KEY_PATTERN = /^[a-z0-9-]$/;
export const CONFUSION_PATTERN = /^[a-z0-9-]>[a-z0-9-]$/;

export function createKeyStats() {
  return { keys: {}, confusions: {}, wordMisses: {} };
}

const bumpKey = (keys, key, field) => ({
  ...keys,
  [key]: { hits: 0, misses: 0, ...keys[key], [field]: (keys[key]?.[field] ?? 0) + 1 },
});

// 正しい打鍵を記録する。打ったキーが対象外の文字なら何もしない。
export function recordHit(stats, key) {
  if (!KEY_PATTERN.test(key)) return stats;
  return { ...stats, keys: bumpKey(stats.keys, key, "hits") };
}

// ミスを記録する。expected: 打つべきだったキー、typed: 実際に打ったキー、wordId: 出題中の語
export function recordMiss(stats, expected, typed, wordId) {
  if (!KEY_PATTERN.test(expected)) return stats;
  const next = { ...stats, keys: bumpKey(stats.keys, expected, "misses") };
  if (KEY_PATTERN.test(typed)) {
    const pair = `${expected}>${typed}`;
    next.confusions = { ...stats.confusions, [pair]: (stats.confusions[pair] ?? 0) + 1 };
  }
  if (wordId) {
    next.wordMisses = { ...stats.wordMisses, [wordId]: (stats.wordMisses[wordId] ?? 0) + 1 };
  }
  return next;
}

// 複数のプレイの集計を足し合わせる(欠けている項目は空として扱う)
export function mergeKeyStats(list) {
  const total = createKeyStats();
  for (const stats of list) {
    for (const [key, value] of Object.entries(stats?.keys ?? {})) {
      const current = total.keys[key] ?? { hits: 0, misses: 0 };
      total.keys[key] = { hits: current.hits + value.hits, misses: current.misses + value.misses };
    }
    for (const field of ["confusions", "wordMisses"]) {
      for (const [name, value] of Object.entries(stats?.[field] ?? {})) {
        total[field][name] = (total[field][name] ?? 0) + value;
      }
    }
  }
  return total;
}

// 打った回数(そのキーを打つべき場面の数)= 正しく打った回数 + 間違えた回数
export const attemptsOf = (value) => value.hits + value.misses;

/**
 * 苦手なキー(ミス率の高い順)。偶然の影響を避けるため、打鍵が minAttempts 回以上のキーだけを対象にする。
 * 同じミス率なら、打鍵の多いキーを上位にする。
 */
export function weakKeys(stats, { minAttempts = 10, limit = 10 } = {}) {
  return Object.entries(stats.keys)
    .map(([key, value]) => ({
      key,
      attempts: attemptsOf(value),
      misses: value.misses,
      rate: attemptsOf(value) === 0 ? 0 : value.misses / attemptsOf(value),
    }))
    .filter((item) => item.misses > 0 && item.attempts >= minAttempts)
    .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts || a.key.localeCompare(b.key))
    .slice(0, limit);
}

// ミスの多いキー(回数の多い順)。1回のプレイの分析に使う(打鍵が少ないため、率ではなく回数で並べる)。
export function mostMissedKeys(stats, limit = 3) {
  return Object.entries(stats.keys)
    .filter(([, value]) => value.misses > 0)
    .map(([key, value]) => ({ key, misses: value.misses, attempts: attemptsOf(value) }))
    .sort((a, b) => b.misses - a.misses || a.key.localeCompare(b.key))
    .slice(0, limit);
}

// よくある打ち間違い(回数の多い順)
export function topConfusions(stats, limit = 5) {
  return Object.entries(stats.confusions)
    .map(([pair, count]) => ({ expected: pair[0], typed: pair[2], count }))
    .sort((a, b) => b.count - a.count || a.expected.localeCompare(b.expected))
    .slice(0, limit);
}

export const totalMisses = (stats) =>
  Object.values(stats.keys).reduce((sum, value) => sum + value.misses, 0);
export const totalHits = (stats) =>
  Object.values(stats.keys).reduce((sum, value) => sum + value.hits, 0);

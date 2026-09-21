// 復習リストの作成。DOM に依存しない純粋なロジックで、入力を書き換えない。
//
// 復習リスト = 直近のプレイ(連続タイピング)でミスした語。ミスの多い順に、上限まで。
// 元データは、各プレイの結果に保存されている「語ごとのミス数(wordMisses)」。保存の形は、変えない。
// 用語確認の結果は、保存しないので、リストに入らない。
// 語録から消えた語(id が見つからないもの)は、無視する(語録を直しても、落ちない)。

export const REVIEW_PLAYS = 20; // 直近、何プレイ分を見るか(役職は問わない)
export const REVIEW_LIMIT = 20; // 何語まで並べるか

/** 語録([{ job_id, items }])から、語の id → { word, jobId } の対応を作る。 */
export function indexWords(vocabularies) {
  const index = new Map();
  for (const vocabulary of vocabularies) {
    for (const word of vocabulary?.items ?? []) {
      if (!index.has(word.id)) index.set(word.id, { word, jobId: vocabulary.job_id });
    }
  }
  return index;
}

/**
 * 直近 plays プレイの、語ごとのミスの合計。results: 新しい順のプレイ結果。
 * accepts(id) が false の語(語録にない語など)は、数えない。ミスの数が、正の整数でないものも、数えない。
 * 戻り値: Map(id → { misses, lastMissedAt })。復習リストと、苦手な語の出題(weak.js)が、同じ数え方を使う。
 */
export function totalWordMisses(results, { plays = REVIEW_PLAYS, accepts = () => true } = {}) {
  const totals = new Map();
  for (const result of (results ?? []).slice(0, plays)) {
    for (const [id, value] of Object.entries(result?.wordMisses ?? {})) {
      const misses = Number(value);
      if (!Number.isInteger(misses) || misses <= 0 || !accepts(id)) continue;
      const current = totals.get(id) ?? { misses: 0, lastMissedAt: -Infinity };
      totals.set(id, {
        misses: current.misses + misses,
        lastMissedAt: Math.max(current.lastMissedAt, Number(result.playedAt) || 0),
      });
    }
  }
  return totals;
}

/**
 * 復習リスト。results: 新しい順のプレイ結果、index: indexWords の結果。
 * 戻り値: [{ word, jobId, misses(直近のプレイでのミスの合計), lastMissedAt(最後にミスしたプレイの時刻) }]
 * 並び順: ミスの多い順 → 最近ミスした順 → id 順(毎回、同じ結果になる)。
 */
export function buildReviewList(
  results,
  index,
  { plays = REVIEW_PLAYS, limit = REVIEW_LIMIT } = {},
) {
  const totals = totalWordMisses(results, { plays, accepts: (id) => index.has(id) });
  return [...totals.entries()]
    .map(([id, { misses, lastMissedAt }]) => ({ id, misses, lastMissedAt, ...index.get(id) }))
    .sort(
      (a, b) => b.misses - a.misses || b.lastMissedAt - a.lastMissedAt || (a.id < b.id ? -1 : 1),
    )
    .slice(0, limit)
    .map(({ word, jobId, misses, lastMissedAt }) => ({ word, jobId, misses, lastMissedAt }));
}

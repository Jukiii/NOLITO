// 成績の集計。DOM に依存しない純粋なロジック。
// results は保存されているプレイ結果で、新しいものが先頭(直近 200 件まで)。

// グラフや一覧で使う指標。value は結果から値を取り出す。入力速度は「打/分」で表示する(内部は打鍵/秒)。
export const METRICS = {
  cpm: { label: "入力速度", unit: "打/分", value: (r) => r.cps * 60, digits: 0 },
  accuracy: { label: "正確率", unit: "%", value: (r) => r.accuracy * 100, digits: 0 },
  score: { label: "スコア", unit: "点", value: (r) => r.score, digits: 0 },
};

// 1回も打っていないプレイは、速度・正確率の対象にしない(値に意味がないため)
export const hasTyping = (result) => result.hits + result.miss > 0;

const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
const average = (list, pick) => (list.length === 0 ? 0 : sum(list, pick) / list.length);

// 累計の成績
export function summarizeResults(results) {
  const plays = results.length;
  const clears = results.filter((r) => r.status === "cleared").length;
  const typed = results.filter(hasTyping);
  return {
    plays,
    clears,
    clearRate: plays === 0 ? 0 : clears / plays,
    totalWords: sum(results, (r) => r.correct),
    totalSeconds: sum(results, (r) => r.elapsed),
    bestCpm: typed.length === 0 ? 0 : Math.max(...typed.map(METRICS.cpm.value)),
    bestAccuracy: typed.length === 0 ? 0 : Math.max(...typed.map(METRICS.accuracy.value)),
  };
}

// 役職ごとのベストスコア(クリアした記録の中で)。{ 役職id: { score, playedAt, jobId } }
export function bestScoresByRole(results) {
  const best = {};
  for (const r of results) {
    if (r.status !== "cleared") continue;
    if (!best[r.roleId] || r.score > best[r.roleId].score) {
      best[r.roleId] = { score: r.score, playedAt: r.playedAt, jobId: r.jobId };
    }
  }
  return best;
}

/**
 * 直近 size 回の平均と、その前の size 回の平均(前の分が minPrevious 回に満たなければ null)。
 * 速度・正確率は、打鍵のあるプレイだけで平均する。
 */
export function compareRecent(results, { size = 10, minPrevious = 3 } = {}) {
  const typed = results.filter(hasTyping);
  const describe = (list) => ({
    count: list.length,
    cpm: average(list, METRICS.cpm.value),
    accuracy: average(list, METRICS.accuracy.value),
  });
  const recent = typed.slice(0, size);
  const previous = typed.slice(size, size * 2);
  return {
    recent: describe(recent),
    previous: previous.length >= minPrevious ? describe(previous) : null,
  };
}

/**
 * 成長グラフ用の点。古い順に並べる。roleId を指定するとその役職だけ、limit は直近の何回分か。
 * 速度・正確率は打鍵のないプレイを除く。
 */
export function buildSeries(results, { metric = "cpm", roleId = null, limit = 30 } = {}) {
  const { value } = METRICS[metric];
  return results
    .filter((r) => (roleId ? r.roleId === roleId : true))
    .filter((r) => metric === "score" || hasTyping(r))
    .slice(0, limit)
    .reverse()
    .map((r, index) => ({
      n: index + 1,
      value: value(r),
      status: r.status,
      playedAt: r.playedAt,
      jobId: r.jobId,
      roleId: r.roleId,
    }));
}

// 「12分34秒」「45秒」のように、秒数を読みやすい文字列にする
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) return `${hours}時間${minutes}分`;
  if (minutes > 0) return `${minutes}分${rest}秒`;
  return `${rest}秒`;
}

// キー別の記録があるプレイの数(バージョン 1 のプレイには無い)
export const countWithKeyData = (results) =>
  results.filter((r) => Object.keys(r.keys ?? {}).length > 0).length;

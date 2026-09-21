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

// ---- 連続ノーミス・難易度・残り距離(Phase 13 PR 3) ----
// 連続ノーミス(streak)と難易度ごとの語数(wordsByDifficulty)は、バージョン 3 から記録される。
// 以前のプレイは null(記録なし)で、0 とは区別し、これらの集計から除く。

// 難易度の呼び名(語録は 1〜3 を使う。範囲外は「難易度 n」)
export const DIFFICULTY_LABELS = Object.freeze({ 1: "やさしい", 2: "ふつう", 3: "むずかしい" });
export const difficultyLabel = (difficulty) =>
  DIFFICULTY_LABELS[difficulty] ?? `難易度 ${difficulty}`;

const hasStreak = (result) => Number.isInteger(result?.streak) && result.streak >= 0;

// 難易度ごとの語数({ "1": 3, "2": 5 })。形が違う・空なら null(記録なし)
const wordsOf = (result) => {
  const counts = result?.wordsByDifficulty;
  if (counts === null || typeof counts !== "object" || Array.isArray(counts)) return null;
  return counts;
};
const totalWords = (counts) => Object.values(counts).reduce((total, value) => total + value, 0);

/** 語の難しさの平均(難易度ごとの語数から。語の数で重みをつける)。語がなければ null。 */
export function averageDifficulty(byDifficulty) {
  if (byDifficulty === null || typeof byDifficulty !== "object" || Array.isArray(byDifficulty)) {
    return null;
  }
  const words = totalWords(byDifficulty);
  if (words <= 0) return null;
  const weighted = Object.entries(byDifficulty).reduce(
    (total, [difficulty, value]) => total + Number(difficulty) * value,
    0,
  );
  return weighted / words;
}

/**
 * 成績のまとめの、追加の項目。記録のないプレイは、それぞれの項目の対象から除く。
 *   bestStreak     … 最大の連続ノーミス(語)。記録のあるプレイがなければ null
 *   avgRemaining   … クリアしたプレイの、平均の残り距離。クリアがなければ null
 *   avgDifficulty  … 打ち終えた語の、難しさの平均(語の数で重みをつける)。記録がなければ null
 *   streakPlays / difficultyPlays … それぞれの記録のあるプレイの数
 */
export function summarizeDetails(results) {
  const withStreak = results.filter(hasStreak);
  const cleared = results.filter((r) => r.status === "cleared");
  const merged = {};
  let difficultyPlays = 0;
  for (const result of results) {
    const counts = wordsOf(result);
    if (counts === null || totalWords(counts) <= 0) continue;
    difficultyPlays += 1;
    for (const [difficulty, value] of Object.entries(counts)) {
      merged[difficulty] = (merged[difficulty] ?? 0) + value;
    }
  }
  return {
    bestStreak: withStreak.length === 0 ? null : Math.max(...withStreak.map((r) => r.streak)),
    streakPlays: withStreak.length,
    avgRemaining: cleared.length === 0 ? null : average(cleared, (r) => r.distance),
    clears: cleared.length,
    avgDifficulty: averageDifficulty(merged),
    difficultyPlays,
  };
}

/**
 * 難易度別の、打った語数・ミスの数・1 語あたりのミス。
 * 難易度ごとの語数の記録があるプレイだけを対象にする(以前のプレイは、除く)。
 * ミスの数は、そのプレイの語ごとのミス数(wordMisses)を、語の難易度(difficultyOf(id))で振り分ける。
 * 語録にない語・難易度がわからない語のミスは、数えない。
 * 戻り値: { rows: [{ difficulty, label, words, misses, perWord }], plays(対象のプレイ数) }
 */
export function difficultyBreakdown(results, difficultyOf) {
  const words = {};
  const misses = {};
  let plays = 0;
  for (const result of results) {
    const counts = wordsOf(result);
    if (counts === null) continue;
    plays += 1;
    for (const [difficulty, value] of Object.entries(counts)) {
      words[difficulty] = (words[difficulty] ?? 0) + value;
    }
    for (const [id, value] of Object.entries(result.wordMisses ?? {})) {
      const difficulty = difficultyOf(id);
      if (!Number.isInteger(difficulty) || !(value > 0)) continue;
      misses[difficulty] = (misses[difficulty] ?? 0) + value;
    }
  }
  const levels = [...new Set([...Object.keys(words), ...Object.keys(misses)])]
    .map(Number)
    .sort((a, b) => a - b);
  const rows = levels.map((difficulty) => ({
    difficulty,
    label: difficultyLabel(difficulty),
    words: words[difficulty] ?? 0,
    misses: misses[difficulty] ?? 0,
    perWord: (words[difficulty] ?? 0) > 0 ? (misses[difficulty] ?? 0) / words[difficulty] : null,
  }));
  return { rows, plays };
}

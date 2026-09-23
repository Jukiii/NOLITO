// 職種別の熟練度(Phase 18)。DOM・保存・時計に触れない純粋な計算。
// 職種ごとの合計(progress.jobs[職種 ID] = { plays, clears, words, hits, miss })から、6 段階の熟練度を決める。
// 決め: その職種で打ち終えた語数と、クリア数の、両方が、段階の条件を満たしたもの。段階の値は、あとから直せる。

export const MASTERY_RANKS = Object.freeze([
  Object.freeze({ rank: 0, name: "見習い", words: 0, clears: 0 }),
  Object.freeze({ rank: 1, name: "初級", words: 30, clears: 0 }),
  Object.freeze({ rank: 2, name: "中級", words: 100, clears: 1 }),
  Object.freeze({ rank: 3, name: "上級", words: 300, clears: 3 }),
  Object.freeze({ rank: 4, name: "達人", words: 700, clears: 8 }),
  Object.freeze({ rank: 5, name: "マスター", words: 1500, clears: 15 }),
]);

const toCount = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/**
 * 1 つの職種の熟練度。stats は { plays, clears, words, hits, miss }(なければ、すべて 0)。
 * { rank, name, plays, clears, words, accuracy(打っていなければ null), next(最高段階なら null), ratio(次の段階までの、語数の割合 0〜1) }
 * next は { rank, name, wordsLeft, clearsLeft }(あと、どれだけで次の段階か)。
 */
export function masteryOf(stats) {
  const words = toCount(stats?.words);
  const clears = toCount(stats?.clears);
  const plays = toCount(stats?.plays);
  const hits = toCount(stats?.hits);
  const miss = toCount(stats?.miss);
  let current = MASTERY_RANKS[0];
  for (const step of MASTERY_RANKS) {
    if (words >= step.words && clears >= step.clears) current = step;
  }
  const next = MASTERY_RANKS[current.rank + 1] ?? null;
  return {
    rank: current.rank,
    name: current.name,
    plays,
    clears,
    words,
    accuracy: hits + miss > 0 ? hits / (hits + miss) : null,
    next: next && {
      rank: next.rank,
      name: next.name,
      wordsLeft: Math.max(0, next.words - words),
      clearsLeft: Math.max(0, next.clears - clears),
    },
    ratio: next ? Math.min(1, words / next.words) : 1,
  };
}

/** 職種の並び(jobIds)の順に、熟練度を返す。progressJobs は progress.jobs(なければ、すべて見習い) */
export const jobMasteries = (progressJobs, jobIds) =>
  jobIds.map((id) => ({
    id,
    ...masteryOf(progressJobs && Object.hasOwn(progressJobs, id) ? progressJobs[id] : undefined),
  }));

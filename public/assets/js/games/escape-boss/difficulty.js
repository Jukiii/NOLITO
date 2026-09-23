// 難易度の ID(Phase 18)。DOM・保存に触れない。記録の検証(storage.js)が使う。
// やさしい(easy)= 練習 / ふつう(normal)= これまでどおり(既定)/ むずかしい(hard)
// 難易度ごとの中身(倍率・解放の条件)は、PR 2 で `public/data/difficulties.json` に置く。

export const DIFFICULTY_IDS = Object.freeze(["easy", "normal", "hard"]);
export const DEFAULT_DIFFICULTY = "normal";

/** 決まった難易度の ID か(__proto__ などの名前・文字でない値は、false) */
export const isDifficulty = (value) => typeof value === "string" && DIFFICULTY_IDS.includes(value);

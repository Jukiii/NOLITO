// 用語確認モードの進行と、「ミスした語」の集計。DOM に依存しない純粋なロジックで、状態は不変。
//
// 用語確認は、追ってくる人も時間制限もない練習。語ごとに、日本語・読み仮名・説明を見ながら、読みを入力する。
// ミスしても罰はない。結果は、保存しない(ランキング・成績・記録には、入らない)。
import { shuffle } from "./vocabulary.js";
import { accuracyOf } from "./score.js";

export const CHECK_WORD_COUNT = 10;

/** 職種の語から、count 語を重複なしで選ぶ(役職は関係ない)。語が count より少なければ、あるだけ。 */
export function pickCheckWords(items, count = CHECK_WORD_COUNT, random = Math.random) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("確認する語がありません");
  return shuffle(items, random).slice(0, count);
}

export function createCheckState(total) {
  return { status: "playing", total, index: 0, hits: 0, miss: 0, wordMisses: {} };
}

// 正しい打鍵1回
export function checkHit(state) {
  if (state.status !== "playing") return state;
  return { ...state, hits: state.hits + 1 };
}

// ミス1回。罰はない(数えるだけ)。wordId は、出題中の語
export function checkMiss(state, wordId) {
  if (state.status !== "playing") return state;
  return {
    ...state,
    miss: state.miss + 1,
    wordMisses: { ...state.wordMisses, [wordId]: (state.wordMisses[wordId] ?? 0) + 1 },
  };
}

// 1語打ち終わった。最後の語なら、終了(done)にする
export function checkNext(state) {
  if (state.status !== "playing") return state;
  const index = state.index + 1;
  return { ...state, index, status: index >= state.total ? "done" : "playing" };
}

/**
 * ミスした語(ミスの多い順。同じ数なら、出た順)。
 * words: 出題した語(配列の順が、出た順)、wordMisses: { 語の id: ミスの数 }
 * 出題した語だけを数える(関係のない id は、無視する)。
 */
export function missedWords(words, wordMisses = {}) {
  const seen = new Set(); // 同じ語が、2 回出題されていても、1 件にまとめる
  return words
    .filter((word) => !seen.has(word.id) && seen.add(word.id))
    .map((word, order) => ({ word, misses: wordMisses[word.id] ?? 0, order }))
    .filter((entry) => entry.misses > 0)
    .sort((a, b) => b.misses - a.misses || a.order - b.order)
    .map(({ word, misses }) => ({ word, misses }));
}

/** 用語確認の結果。 */
export function summarizeCheck(state, words) {
  return {
    total: state.total,
    hits: state.hits,
    miss: state.miss,
    accuracy: accuracyOf(state.hits, state.miss),
    missed: missedWords(words, state.wordMisses),
  };
}

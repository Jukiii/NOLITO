// 追ってくる人のセリフ(Phase 16 PR 2)。DOM・時計・保存に触れない純粋なロジック。
// セリフは、役職ごとに roles.json の lines に持つ。どれも、AI の下書きを、運営者が確認する。

// 場面(いつ言うか)。start = 開始 / near = 危ない(近づいた)/ miss = ミス / clear = 逃げ切られた / over = つかまえた
export const LINE_EVENTS = Object.freeze(["start", "near", "miss", "clear", "over"]);
// いつでも言う場面(間隔の制限を受けない)。ほかは、うるさくならないよう、間隔を空ける
const ALWAYS = new Set(["start", "clear", "over"]);

export const MAX_LINE_LENGTH = 20; // 1 つのセリフの最大の長さ(文字)
export const BUBBLE_MS = 2000; // プレイ中の吹き出しを出しておく時間
export const MIN_GAP_MS = 4000; // プレイ中(near・miss)の吹き出しの最小の間隔

// 制御文字・向きを変える文字・<>(HTML と間違えられるもの)を含まない、長さが範囲内の文字列だけ
const UNSAFE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/u;
export const isValidLine = (line) =>
  typeof line === "string" &&
  line.trim() === line &&
  line.length >= 1 &&
  line.length <= MAX_LINE_LENGTH &&
  !UNSAFE.test(line);

/** 役職の、ある場面のセリフ(使えるものだけ・重複なし)。ない・壊れている場合は、空 */
export function linesOf(role, event) {
  const list = role?.lines?.[event];
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(isValidLine))];
}

/**
 * 吹き出しの出し方を決める。
 * - start・clear・over は、いつでも出す。near・miss は、前の吹き出しから MIN_GAP_MS 以上あけて出す
 * - 同じ場面で、直前と同じセリフは続けない(セリフが 2 つ以上あるとき)
 * - 乱数と時刻(ミリ秒)は、外から渡す
 */
export function createLines({ rng = Math.random, gapMs = MIN_GAP_MS } = {}) {
  let lastAt = -Infinity;
  const lastLine = new Map();

  return {
    /** 言うセリフ(文字列)。言わない(間隔・セリフなし)ときは null */
    pick(role, event, nowMs) {
      if (!LINE_EVENTS.includes(event) || !Number.isFinite(nowMs)) return null;
      const lines = linesOf(role, event);
      if (lines.length === 0) return null;
      if (!ALWAYS.has(event) && nowMs - lastAt < gapMs) return null;
      const key = `${role?.id}:${event}`;
      const choices = lines.length > 1 ? lines.filter((line) => line !== lastLine.get(key)) : lines;
      // 乱数が、範囲外・数でなくても、範囲内の番号にする
      const raw = Math.floor(rng() * choices.length);
      const index = Number.isFinite(raw) ? Math.min(choices.length - 1, Math.max(0, raw)) : 0;
      const line = choices[index];
      lastLine.set(key, line);
      lastAt = nowMs;
      return line;
    },
    /** 新しいゲームの始まりで、間隔の記憶を消す */
    reset() {
      lastAt = -Infinity;
      lastLine.clear();
    },
  };
}

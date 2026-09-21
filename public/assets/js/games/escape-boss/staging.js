// 開始・終わりの演出の進行(Phase 16 PR 2)。DOM・時計・保存に触れない純粋なロジック。
// タイマーは外から渡せる(テストでは偽物を渡す)。見た目は、view.js と CSS が行う。

// 開始の演出。「よーい…」→「スタート!」。この間、時間は進まず、入力も受け付けない
export const INTRO_STEPS = Object.freeze([
  Object.freeze({ id: "ready", text: "よーい…", ms: 900 }),
  Object.freeze({ id: "go", text: "スタート!", ms: 600 }),
]);
// 動きを減らす設定では、動かさず、短く「スタート!」だけを出す
export const INTRO_STEPS_REDUCED = Object.freeze([
  Object.freeze({ id: "go", text: "スタート!", ms: 800 }),
]);

// 終わりの演出(クリア・ゲームオーバー共通の型)。結果は、演出の前に保存済み
export const OUTRO_MS = 1200;
export const OUTRO_MS_REDUCED = 800;
const OUTRO_TEXT = Object.freeze({
  cleared: { id: "clear", text: "逃げ切った!" },
  gameover: { id: "over", text: "つかまった…" },
});

export const introSteps = (reducedMotion = false) =>
  reducedMotion ? INTRO_STEPS_REDUCED : INTRO_STEPS;

/** 終わりの演出の 1 つの段階。status は "cleared" か "gameover"(それ以外は、null) */
export function outroSteps(status, reducedMotion = false) {
  const base = OUTRO_TEXT[status];
  if (!base) return null;
  return [Object.freeze({ ...base, ms: reducedMotion ? OUTRO_MS_REDUCED : OUTRO_MS })];
}

// 演出を飛ばせるキー(入力欄にフォーカスがあるときの、Enter・スペース・Esc)。文字のキーでは、飛ばさない
export const SKIP_KEYS = Object.freeze(["Enter", " ", "Escape"]);
export const isSkipKey = (key) => SKIP_KEYS.includes(key);

/**
 * 段階の並びを、順に進める。
 * - start() … 1 つ目の段階から始める。onStep(step, index) が、段階ごとに呼ばれる
 * - skip() … 残りを飛ばして、すぐ終わる(onDone が 1 回だけ呼ばれる)
 * - cancel() … 何も呼ばずに止める(画面を離れたとき)
 * onDone は、最後まで進んでも、飛ばしても、ちょうど 1 回だけ呼ばれる。
 */
export function createTimeline(
  steps,
  { onStep = () => {}, onDone = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {},
) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new TypeError("段階が、空です");
  }
  for (const step of steps) {
    if (!Number.isFinite(step?.ms) || step.ms < 0) throw new TypeError("段階の ms が、不正です");
  }
  let timer = null;
  let running = false;

  const finish = () => {
    if (!running) return;
    running = false;
    timer = null;
    onDone();
  };
  const enter = (index) => {
    onStep(steps[index], index);
    timer = setTimer(() => {
      if (!running) return;
      if (index + 1 < steps.length) enter(index + 1);
      else finish();
    }, steps[index].ms);
  };

  return {
    get active() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      enter(0);
    },
    skip() {
      if (!running) return;
      clearTimer(timer);
      finish();
    },
    cancel() {
      if (!running) return;
      running = false;
      clearTimer(timer);
      timer = null;
    },
  };
}

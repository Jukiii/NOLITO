// 結果画面の、ドラムロール(数がカウントアップする)。DOM に触れない。時計・描画の予約は、引数で受ける。

export const ROLL_MS = 1600;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// はじめは速く、終わりに向けて、ゆっくり止まる
const easeOut = (x) => 1 - (1 - x) ** 3;

/** 経過時間 elapsedMs のときに見せる値。duration を過ぎたら、ちょうど target(壊れた値は 0) */
export function rollValue(target, elapsedMs, duration = ROLL_MS) {
  if (!Number.isFinite(target) || target <= 0) return 0;
  if (!Number.isFinite(elapsedMs) || !(duration > 0)) return Math.round(target);
  if (elapsedMs >= duration) return Math.round(target);
  return Math.round(target * easeOut(clamp01(elapsedMs / duration)));
}

/**
 * 1 つの数のドラムロール。
 * - start(target, { onFrame, onDone, duration }) … 0 から target まで数える。毎フレーム onFrame(値)。終わりに onDone() が 1 回だけ
 * - skip() … すぐ、最後の値にして、終わる(onDone は 1 回だけ)
 * - cancel() … 何も呼ばずに止める(画面を離れたとき)
 */
export function createRoll({ now, request, cancel }) {
  let frame = null;
  let current = null;

  function finish(call) {
    const run = current;
    current = null;
    if (frame !== null) cancel(frame);
    frame = null;
    if (!run) return;
    if (call) {
      run.onFrame(rollValue(run.target, Infinity, run.duration));
      run.onDone();
    }
  }

  function step() {
    frame = null;
    if (!current) return;
    const elapsed = now() - current.startedAt;
    if (elapsed >= current.duration) {
      finish(true);
      return;
    }
    current.onFrame(rollValue(current.target, elapsed, current.duration));
    frame = request(step);
  }

  return {
    start(target, { onFrame, onDone, duration = ROLL_MS }) {
      finish(false);
      current = { target, onFrame, onDone, duration, startedAt: now() };
      current.onFrame(0);
      frame = request(step);
    },
    skip() {
      finish(true);
    },
    cancel() {
      finish(false);
    },
    isRunning() {
      return current !== null;
    },
  };
}

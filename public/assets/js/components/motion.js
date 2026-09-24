// アニメーション軽減のサイト内切替(Phase 21 PR2)。<html data-reduced-motion> で上乗せする。
// 「システムの設定に合わせる」「アニメーションを減らす」の2つだけ(OSが減らす指定のとき、サイト側で
// 動きを強制的に戻す選択肢は作らない。前庭障害等への配慮)。CSS 側(base.css)が、実際の抑制ルールを持つ。
export const MOTION_KEY = "nolito:motion:v1";
export const MOTIONS = Object.freeze(["system", "reduce"]);
export const DEFAULT_MOTION = "system";

export const isMotion = (value) => MOTIONS.includes(value);

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** 保存されている設定(不正・読めなければ、既定=システム)。 */
export function loadMotion(storage = safeStorage()) {
  try {
    const value = storage?.getItem(MOTION_KEY);
    return isMotion(value) ? value : DEFAULT_MOTION;
  } catch {
    return DEFAULT_MOTION;
  }
}

/** 保存できたかを返す(保存できなくても、その場での表示は変わる。落ちない)。 */
export function saveMotion(motion, storage = safeStorage()) {
  if (!isMotion(motion) || !storage) return false;
  try {
    storage.setItem(MOTION_KEY, motion);
    return true;
  } catch {
    return false;
  }
}

/** <html data-reduced-motion> に反映する(システムは属性を外す。不正な値は、既定=システムとして扱う)。 */
export function applyMotion(motion, root = document.documentElement) {
  const value = isMotion(motion) ? motion : DEFAULT_MOTION;
  if (value === "reduce") {
    root.dataset.reducedMotion = "reduce";
  } else {
    delete root.dataset.reducedMotion;
  }
}

/** ゲームなど、JSでも動きの軽減を判定したいときに使う(サイト設定 or OSの設定のどちらか)。 */
export function prefersReducedMotion(root = document.documentElement) {
  const siteReduced = root.dataset.reducedMotion === "reduce";
  const osReduced = () => {
    try {
      return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch {
      return false;
    }
  };
  return siteReduced || osReduced();
}

/** フッターの「アニメーション」の select を初期化する(main.js が、フッター描画後に1回呼ぶ)。 */
export function initMotion(select) {
  const motion = loadMotion();
  select.value = motion;
  applyMotion(motion); // <head> のインラインスクリプトと、揃える(見えない不整合を防ぐ)
  select.addEventListener("change", () => {
    const next = isMotion(select.value) ? select.value : DEFAULT_MOTION;
    applyMotion(next);
    saveMotion(next);
  });
}

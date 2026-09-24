// サイト内の文字サイズ(Phase 21 PR2)。<html data-font-size> で切り替える。
// tokens.css 側が、実際のルートのフォントサイズを持つ(rem連動)。ここは、保存・読み込み・反映だけ。
export const FONT_SIZE_KEY = "nolito:font-size:v1";
export const FONT_SIZES = Object.freeze(["standard", "large", "xlarge"]);
export const DEFAULT_FONT_SIZE = "standard";

export const isFontSize = (value) => FONT_SIZES.includes(value);

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** 保存されている文字サイズ(不正・読めなければ、既定=標準)。 */
export function loadFontSize(storage = safeStorage()) {
  try {
    const value = storage?.getItem(FONT_SIZE_KEY);
    return isFontSize(value) ? value : DEFAULT_FONT_SIZE;
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

/** 保存できたかを返す(保存できなくても、その場での表示は変わる。落ちない)。 */
export function saveFontSize(size, storage = safeStorage()) {
  if (!isFontSize(size) || !storage) return false;
  try {
    storage.setItem(FONT_SIZE_KEY, size);
    return true;
  } catch {
    return false;
  }
}

/** <html data-font-size> に反映する(標準は属性を外す。不正な値は、既定=標準として扱う)。 */
export function applyFontSize(size, root = document.documentElement) {
  const value = isFontSize(size) ? size : DEFAULT_FONT_SIZE;
  if (value === DEFAULT_FONT_SIZE) {
    delete root.dataset.fontSize;
  } else {
    root.dataset.fontSize = value;
  }
}

/** フッターの「文字サイズ」の select を初期化する(main.js が、フッター描画後に1回呼ぶ)。 */
export function initFontSize(select) {
  const size = loadFontSize();
  select.value = size;
  applyFontSize(size); // <head> のインラインスクリプトと、揃える(見えない不整合を防ぐ)
  select.addEventListener("change", () => {
    const next = isFontSize(select.value) ? select.value : DEFAULT_FONT_SIZE;
    applyFontSize(next);
    saveFontSize(next);
  });
}

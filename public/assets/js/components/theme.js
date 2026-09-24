// ライト・ダーク・システムテーマ(Phase 21 PR1)。<html data-theme> で切り替える。
// CSS 側(tokens.css)が、実際の配色を持つ。ここは、保存・読み込み・反映だけ。
export const THEME_KEY = "nolito:theme:v1";
export const THEMES = Object.freeze(["light", "dark", "system"]);
export const DEFAULT_THEME = "system";

export const isTheme = (value) => THEMES.includes(value);

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** 保存されているテーマ(不正・プライベートブラウズ等で読めなければ、既定=システム)。 */
export function loadTheme(storage = safeStorage()) {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isTheme(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** 保存できたかを返す(保存できなくても、その場での表示は変わる。落ちない)。 */
export function saveTheme(theme, storage = safeStorage()) {
  if (!isTheme(theme) || !storage) return false;
  try {
    storage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** <html data-theme> に反映する(不正な値は、既定=システムとして扱う)。 */
export function applyTheme(theme, root = document.documentElement) {
  root.dataset.theme = isTheme(theme) ? theme : DEFAULT_THEME;
}

/** フッターの「テーマ」の select を初期化する(main.js が、フッター描画後に1回呼ぶ)。 */
export function initTheme(select) {
  const theme = loadTheme();
  select.value = theme;
  applyTheme(theme); // <head> のインラインスクリプトと、揃える(見えない不整合を防ぐ)
  select.addEventListener("change", () => {
    const next = isTheme(select.value) ? select.value : DEFAULT_THEME;
    applyTheme(next);
    saveTheme(next);
  });
}

// デザイン見本ページ(/theme-preview/)の、テーマの一覧と、選択の保存。DOM に触れない純粋な部分。
// 見本ページ専用。サイトのテーマ(components/theme.js。nolito:theme:v1)とは別のキーで、互いに影響しない。

export const PREVIEW_KEY = "nolito:theme-preview:v1";
export const DEFAULT_PREVIEW_THEME = "current";

// id は CSS(theme-preview.css)の [data-preview-theme="…"] と同じ
export const PREVIEW_THEMES = Object.freeze([
  { id: "current", name: "今のまま", note: "いまのサイトの見た目(クリーム色・紫・金色)" },
  { id: "dark", name: "ダーク", note: "いまのダークテーマ" },
  { id: "white", name: "ホワイト", note: "白と灰色・青。線が細く、すっきり" },
  { id: "cute", name: "可愛い", note: "ピンク・大きな丸み・やわらかい影" },
  { id: "cool", name: "クール", note: "濃い紺・水色。角が小さく、光る縁" },
  { id: "metal", name: "メタリック", note: "ガンメタルと銀。金属の光沢" },
]);

export function isPreviewTheme(value) {
  return PREVIEW_THEMES.some((theme) => theme.id === value);
}

/** 決め方: URL の ?theme=… → 保存された値 → 既定(今のまま)。不正な値は、無視する。 */
export function resolvePreviewTheme({ query = null, stored = null } = {}) {
  if (isPreviewTheme(query)) return query;
  if (isPreviewTheme(stored)) return stored;
  return DEFAULT_PREVIEW_THEME;
}

export function loadStoredPreviewTheme(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(PREVIEW_KEY) ?? null;
  } catch {
    return null;
  }
}

export function savePreviewTheme(theme, storage = globalThis.localStorage) {
  if (!isPreviewTheme(theme)) return false;
  try {
    storage.setItem(PREVIEW_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** <html data-preview-theme> に反映する。「今のまま」も、明示する(見本の枠と同じ規則を使うため)。 */
export function applyPreviewTheme(theme, root = document.documentElement) {
  root.dataset.previewTheme = isPreviewTheme(theme) ? theme : DEFAULT_PREVIEW_THEME;
}

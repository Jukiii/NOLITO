// ゲームの設定(いまは「プレイ中に、用語の説明も表示する」だけ)。記録(nolito:escape-boss:v1)とは、別のキーに保存する。
// 保存できない環境(backend が null・書き込みに失敗)でも、落ちない。壊れた値・知らない値は、既定に戻す。

export const SETTINGS_KEY = "nolito:escape-boss:settings:v1";

// 連続タイピングでは、集中を妨げないよう、説明は既定でオフ(用語確認では、常に表示する)
export const DEFAULT_SETTINGS = Object.freeze({ showExplanation: false });

/** 読み込んだ値を、設定の形に整える(不正なら、既定)。 */
export function normalizeSettings(raw) {
  const value = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  return { showExplanation: value.showExplanation === true };
}

export function loadSettings(backend) {
  if (!backend) return { ...DEFAULT_SETTINGS };
  try {
    const text = backend.getItem(SETTINGS_KEY);
    return text === null ? { ...DEFAULT_SETTINGS } : normalizeSettings(JSON.parse(text));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 保存できたかを返す。 */
export function saveSettings(backend, settings) {
  if (!backend) return false;
  try {
    backend.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

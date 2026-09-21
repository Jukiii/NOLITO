// ゲームの設定(「プレイ中に、用語の説明も表示する」「苦手な語の出やすさ」)。記録(nolito:escape-boss:v1)とは、別のキーに保存する。
// 保存できない環境(backend が null・書き込みに失敗)でも、落ちない。壊れた値・知らない値は、既定に戻す。

import { DEFAULT_WEAK_LEVEL, isWeakLevel } from "./weak.js";

export const SETTINGS_KEY = "nolito:escape-boss:settings:v1";

// 連続タイピングでは、集中を妨げないよう、説明は既定でオフ(用語確認では、常に表示する)
// 苦手な語は、既定で、少し出やすくする(なし にすると、完全にランダム)
export const DEFAULT_SETTINGS = Object.freeze({
  showExplanation: false,
  weakBoost: DEFAULT_WEAK_LEVEL,
});

/** 読み込んだ値を、設定の形に整える(不正なら、既定)。 */
export function normalizeSettings(raw) {
  const value = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  return {
    showExplanation: value.showExplanation === true,
    weakBoost: isWeakLevel(value.weakBoost) ? value.weakBoost : DEFAULT_SETTINGS.weakBoost,
  };
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

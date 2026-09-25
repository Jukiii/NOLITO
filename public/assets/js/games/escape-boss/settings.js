// ゲームの設定(「プレイ中に、用語の説明も表示する」「グラフィックを抑える」「苦手な語の出やすさ」
// 「ローマ字の書き方」「音」「音量」「BGMを簡略化する」「セリフの表示」「演出を自動で飛ばす」)。
// 記録(nolito:escape-boss:v1)とは、別のキーに保存する。
// 保存できない環境(backend が null・書き込みに失敗)でも、落ちない。壊れた値・知らない値は、既定に戻す。

import { DEFAULT_INPUT_STYLE, isInputStyle } from "./input-style.js";
import { DEFAULT_LINE_LEVEL, isLineLevel } from "./lines.js";
import { DEFAULT_SOUND_MODE, DEFAULT_VOLUME, isSoundMode, normalizeVolume } from "./sound.js";
import { DEFAULT_WEAK_LEVEL, isWeakLevel } from "./weak.js";

export const SETTINGS_KEY = "nolito:escape-boss:settings:v1";

// 連続タイピングでは、集中を妨げないよう、説明は既定でオフ(用語確認では、常に表示する)
// グラフィックを抑えるは、既定でオフ(低性能な端末向け。動きを減らす設定=Phase21とは別軸。Phase 22 PR3)
// 苦手な語は、既定で、少し出やすくする(なし にすると、完全にランダム)
// 音は、既定でなし(仕事中に、突然音が出ないように)。音量は 0〜100
// BGMを簡略化するは、既定でオフ(低性能な端末向け。グラフィックを抑える=Phase22 PR3とは別軸。Phase 23 PR3)
// セリフの表示は、既定で「ふつう」。演出を自動で飛ばすは、既定でオフ(Phase 23 PR2)
export const DEFAULT_SETTINGS = Object.freeze({
  showExplanation: false,
  simpleGraphics: false,
  weakBoost: DEFAULT_WEAK_LEVEL,
  inputStyle: DEFAULT_INPUT_STYLE,
  soundMode: DEFAULT_SOUND_MODE,
  volume: DEFAULT_VOLUME,
  simpleSound: false,
  lineLevel: DEFAULT_LINE_LEVEL,
  skipStaging: false,
});

/** 読み込んだ値を、設定の形に整える(不正なら、既定)。 */
export function normalizeSettings(raw) {
  const value = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  return {
    showExplanation: value.showExplanation === true,
    simpleGraphics: value.simpleGraphics === true,
    weakBoost: isWeakLevel(value.weakBoost) ? value.weakBoost : DEFAULT_SETTINGS.weakBoost,
    inputStyle: isInputStyle(value.inputStyle) ? value.inputStyle : DEFAULT_SETTINGS.inputStyle,
    soundMode: isSoundMode(value.soundMode) ? value.soundMode : DEFAULT_SETTINGS.soundMode,
    volume: normalizeVolume(value.volume),
    simpleSound: value.simpleSound === true,
    lineLevel: isLineLevel(value.lineLevel) ? value.lineLevel : DEFAULT_SETTINGS.lineLevel,
    skipStaging: value.skipStaging === true,
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

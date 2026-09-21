// 端末内の保存(LocalStorage)。保存できない環境・壊れたデータ・改ざんされたデータでもゲームが落ちないようにする。
// 保存形式にはバージョンを付ける(項目を追加するときに移行できるようにするため)。
//
// バージョン履歴
//   1: Phase 3。プロフィール・結果・ランキング・実績・進行状況
//   2: Phase 4。各結果に、キーごとの集計(keys)・打ち間違いの組(confusions)・語ごとのミス数(wordMisses)を追加
//      バージョン 1 のデータは、読み込み時に自動で 2 として扱う(追加項目は空)。移行前の元データは一度だけ退避する。
//   3: Phase 13。各結果に、最大の連続ノーミス(streak)・難易度ごとの打ち終えた語数(wordsByDifficulty)を追加
//      バージョン 1・2 のデータは、読み込み時に自動で 3 として扱う。追加項目は「記録なし」(null)で、
//      連続・難易度の集計から除く(0 とは区別する)。移行前の元データ(バージョン 2)は、一度だけ退避する。
//
// 保存先のキー名の "v1" は、キーの名前。データの中の version とは別で、変えない(変えると既存の記録が読めなくなる)。
import { CONFUSION_PATTERN, KEY_PATTERN } from "./keystats.js";

export const STORAGE_KEY = "nolito:escape-boss:v1";
const BACKUP_V1_KEY = `${STORAGE_KEY}:backup-v1`;
const BACKUP_V2_KEY = `${STORAGE_KEY}:backup-v2`;
export const DATA_VERSION = 3;
const READABLE_VERSIONS = [1, 2, 3];
// 改ざんされたデータで、保存内容が膨らみすぎないようにする上限
// (キーは a-z・0-9・- の1文字だけなので、種類は最大37で、上限は不要)
const MAX_CONFUSION_ENTRIES = 100;
const MAX_WORD_ENTRIES = 60;
const WORD_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// 難易度のキー(語録の範囲 1〜5)と、1 プレイでの語数の上限(改ざんで、値が膨らみすぎないように)
const DIFFICULTY_KEY_PATTERN = /^[1-5]$/;
const MAX_WORDS_PER_RESULT = 1000;
export const MAX_RESULTS = 200;
export const MAX_RANKING = 10;
export const NICKNAME_MAX = 12;
export const DEFAULT_NICKNAME = "ななしさん";
export const DEFAULT_TITLE_ID = "newbie";

export function createEmptyData() {
  return {
    version: DATA_VERSION,
    profile: { nickname: DEFAULT_NICKNAME, titleId: DEFAULT_TITLE_ID },
    results: [],
    rankings: {},
    achievements: {},
    progress: { totalClears: 0, totalWords: 0, clears: {}, clearedJobs: {} },
  };
}

// 表示に使う名前を安全な文字列にする(制御文字を除き、12文字まで。空なら既定名)
export function sanitizeNickname(value) {
  // 制御文字(改行・タブ・NULL など)は正規表現ではなく文字コードで除く
  const cleaned = Array.from(String(value ?? ""))
    .filter((char) => {
      const code = char.codePointAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join("")
    .trim();
  return Array.from(cleaned).slice(0, NICKNAME_MAX).join("") || DEFAULT_NICKNAME;
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isString = (value) => typeof value === "string" && value.length > 0 && value.length <= 100;
const count = (value) => (isFiniteNumber(value) && value >= 0 ? Math.floor(value) : 0);

// キーごとの集計。キー名は a-z・0-9・- の1文字だけ。
function normalizeKeys(raw) {
  const keys = {};
  if (!isObject(raw)) return keys;
  for (const [key, value] of Object.entries(raw)) {
    if (!KEY_PATTERN.test(key) || !isObject(value)) continue;
    keys[key] = { hits: count(value.hits), misses: count(value.misses) };
  }
  return keys;
}

// 名前(パターンに合うものだけ)→ 回数 の対応。回数の多いものを上限まで残す。
function normalizeCounts(raw, pattern, max) {
  if (!isObject(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([name]) => pattern.test(name) && name.length <= 40)
      .map(([name, value]) => [name, count(value)])
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max),
  );
}

// 難易度ごとの語数。形が違えば null(以前のプレイ = 記録なし)。範囲外のキー・0・不正な値は、捨てる
function normalizeDifficultyCounts(raw) {
  if (!isObject(raw)) return null;
  const counts = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!DIFFICULTY_KEY_PATTERN.test(key)) continue;
    const words = Math.min(count(value), MAX_WORDS_PER_RESULT);
    if (words > 0) counts[key] = words;
  }
  return counts;
}

function normalizeResult(raw) {
  if (!isObject(raw)) return null;
  const numbers = ["playedAt", "score", "correct", "miss", "hits", "elapsed", "distance"];
  if (!numbers.every((key) => isFiniteNumber(raw[key]))) return null;
  if (!isString(raw.jobId) || !isString(raw.roleId)) return null;
  if (raw.status !== "cleared" && raw.status !== "gameover") return null;
  return {
    playedAt: raw.playedAt,
    jobId: raw.jobId,
    roleId: raw.roleId,
    status: raw.status,
    score: raw.score,
    correct: raw.correct,
    miss: raw.miss,
    hits: raw.hits,
    elapsed: raw.elapsed,
    distance: raw.distance,
    accuracy: isFiniteNumber(raw.accuracy) ? raw.accuracy : 0,
    cps: isFiniteNumber(raw.cps) ? raw.cps : 0,
    vocabularyVersion: typeof raw.vocabularyVersion === "string" ? raw.vocabularyVersion : "",
    // バージョン 1 の結果には無い(空として扱う)
    keys: normalizeKeys(raw.keys),
    confusions: normalizeCounts(raw.confusions, CONFUSION_PATTERN, MAX_CONFUSION_ENTRIES),
    wordMisses: normalizeCounts(raw.wordMisses, WORD_ID_PATTERN, MAX_WORD_ENTRIES),
    // バージョン 1・2 の結果には無い(null = 記録なし。0 とは区別する)。連続は、正解した語数を超えない
    streak:
      isFiniteNumber(raw.streak) && raw.streak >= 0
        ? Math.min(Math.floor(raw.streak), count(raw.correct))
        : null,
    wordsByDifficulty: normalizeDifficultyCounts(raw.wordsByDifficulty),
  };
}

function normalizeRankingEntry(raw) {
  if (!isObject(raw)) return null;
  if (!isFiniteNumber(raw.score) || !isFiniteNumber(raw.playedAt)) return null;
  if (!isString(raw.jobId) || !isString(raw.roleId)) return null;
  return {
    score: raw.score,
    playedAt: raw.playedAt,
    jobId: raw.jobId,
    roleId: raw.roleId,
    nickname: sanitizeNickname(raw.nickname),
    title: typeof raw.title === "string" ? raw.title.slice(0, 40) : "",
  };
}

const sortRanking = (a, b) => b.score - a.score || a.playedAt - b.playedAt;

/**
 * 読み込んだ値を、安全な形に整える。バージョンが違う・形式が違う場合は null(=壊れたデータとして扱う)。
 * 一部の項目だけがおかしい場合は、その項目だけを捨てる。
 */
export function normalizeData(raw) {
  if (!isObject(raw) || !READABLE_VERSIONS.includes(raw.version)) return null;
  const data = createEmptyData();

  if (isObject(raw.profile)) {
    data.profile.nickname = sanitizeNickname(raw.profile.nickname);
    if (isString(raw.profile.titleId)) data.profile.titleId = raw.profile.titleId;
  }
  if (Array.isArray(raw.results)) {
    data.results = raw.results.map(normalizeResult).filter(Boolean).slice(0, MAX_RESULTS);
  }
  if (isObject(raw.rankings)) {
    for (const [roleId, list] of Object.entries(raw.rankings)) {
      if (!Array.isArray(list)) continue;
      data.rankings[roleId] = list
        .map(normalizeRankingEntry)
        .filter(Boolean)
        .sort(sortRanking)
        .slice(0, MAX_RANKING);
    }
  }
  if (isObject(raw.achievements)) {
    for (const [id, at] of Object.entries(raw.achievements)) {
      if (isFiniteNumber(at)) data.achievements[id] = at;
    }
  }
  if (isObject(raw.progress)) {
    data.progress.totalClears = count(raw.progress.totalClears);
    data.progress.totalWords = count(raw.progress.totalWords);
    for (const key of ["clears", "clearedJobs"]) {
      if (!isObject(raw.progress[key])) continue;
      for (const [id, value] of Object.entries(raw.progress[key])) {
        data.progress[key][id] = key === "clears" ? count(value) : value === true;
      }
    }
  }
  return data;
}

// 使える LocalStorage を返す。プライベートブラウズ等で使えない場合は null。
export function getBackend() {
  try {
    const storage = globalThis.localStorage;
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * 保存先(getItem / setItem を持つもの)を包む。null なら、このページを開いている間だけ記録を保持する。
 * update() は毎回読み直してから書き込む(複数のタブで開いていても、他のタブの記録を上書きしにくい)。
 */
export function createStore(backend) {
  let memory = null;
  let status = backend ? "empty" : "unavailable";

  function backUpOnce(key, text) {
    try {
      if (backend.getItem(key) === null) backend.setItem(key, text);
    } catch {
      // 退避できなくても続行する
    }
  }

  function load() {
    if (!backend) return { data: memory ?? createEmptyData(), status };
    let text;
    try {
      text = backend.getItem(STORAGE_KEY);
    } catch {
      status = "unavailable";
      return { data: memory ?? createEmptyData(), status };
    }
    if (text === null) {
      status = memory ? "ok" : "empty";
      return { data: memory ?? createEmptyData(), status };
    }
    let parsed;
    let data;
    try {
      parsed = JSON.parse(text);
      data = normalizeData(parsed);
    } catch {
      data = null;
    }
    if (data) {
      // バージョン 1・2 から移行する場合は、移行前の元データを一度だけ退避する(移行の不具合に備える)
      if (parsed.version === 1) backUpOnce(BACKUP_V1_KEY, text);
      if (parsed.version === 2) backUpOnce(BACKUP_V2_KEY, text);
      status = "ok";
      return { data, status };
    }
    // 壊れている。元の文字列を別のキーに退避してから、空の状態で始める
    try {
      backend.setItem(`${STORAGE_KEY}:corrupt`, text);
    } catch {
      // 退避できなくても続行する
    }
    status = "corrupt";
    return { data: createEmptyData(), status };
  }

  function save(data) {
    memory = data;
    if (!backend) return false;
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  // fn(現在のデータ) は { data, ...その他 } を返す。data を保存し、その他の値と保存できたかを返す。
  function update(fn) {
    const { data: current } = load();
    const { data, ...extra } = fn(current);
    const saved = save(data);
    return { data, saved, ...extra };
  }

  return {
    load,
    save,
    update,
    get status() {
      return status;
    },
  };
}

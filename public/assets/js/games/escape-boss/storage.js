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
//   4: Phase 18。各結果に難易度(difficulty)、進行状況に、累計の経験値(exp)・職種ごとの合計(jobs)・難易度ごとの
//      クリア数(difficultyClears)・自己ベスト(bests。職種 × 役職 × 難易度)を追加
//      バージョン 1〜3 のデータは、読み込み時に自動で 4 として扱う(以前の結果は「ふつう」。経験値は、これまでの累計の
//      正解語数・クリア数・実績から作る。職種ごとの合計・自己ベストは、残っている結果(最大 200)から作る。
//      難易度ごとのクリア数は、これまでの役職ごとのクリア数を「ふつう」として数える)。移行前の元データ(バージョン 3)は、
//      一度だけ退避する。読み込んだだけでは、書き換えない(次に保存するときに、版 4 で保存される)。
//   5: Phase 18 PR 2。ランキングの鍵(rankings のキー)を、役職 ID だけ(例: "senpai")から、役職:難易度
//      (例: "senpai:normal"。clearKey と同じ形)に変える。難易度は、やさしい・ふつう・むずかしいで別々に持つ
//      (やさしいはランキングに載らないので、鍵は作られない)。バージョン 1〜4 のランキングは、読み込み時に、
//      すべて「役職:normal」として扱う(それまでのプレイは、すべて「ふつう」だったため)。移行前の元データ
//      (バージョン 4)は、一度だけ退避する。
//
// 保存先のキー名の "v1" は、キーの名前。データの中の version とは別で、変えない(変えると既存の記録が読めなくなる)。
import { DEFAULT_DIFFICULTY, isDifficulty } from "./difficulty.js";
import { CONFUSION_PATTERN, KEY_PATTERN } from "./keystats.js";
import { MAX_EXP, initialExp } from "./levels.js";

export const STORAGE_KEY = "nolito:escape-boss:v1";
const BACKUP_V1_KEY = `${STORAGE_KEY}:backup-v1`;
const BACKUP_V2_KEY = `${STORAGE_KEY}:backup-v2`;
const BACKUP_V3_KEY = `${STORAGE_KEY}:backup-v3`;
const BACKUP_V4_KEY = `${STORAGE_KEY}:backup-v4`;
export const DATA_VERSION = 5;
const READABLE_VERSIONS = [1, 2, 3, 4, 5];
// 改ざんされたデータで、保存内容が膨らみすぎないようにする上限
// (キーは a-z・0-9・- の1文字だけなので、種類は最大37で、上限は不要)
const MAX_CONFUSION_ENTRIES = 100;
const MAX_WORD_ENTRIES = 60;
const WORD_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// 難易度のキー(語録の範囲 1〜5)と、1 プレイでの語数の上限(改ざんで、値が膨らみすぎないように)
const DIFFICULTY_KEY_PATTERN = /^[1-5]$/;
const MAX_WORDS_PER_RESULT = 1000;
// 職種・役職の ID(小文字・数字・ハイフンだけ)と、職種ごとの合計・難易度ごとのクリア数・自己ベストの、数の上限(改ざん対策)
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_JOB_ENTRIES = 50;
const MAX_CLEAR_ENTRIES = 300;
const MAX_BEST_ENTRIES = 600;
const MAX_TOTAL = 1_000_000_000;
export const MAX_RESULTS = 200;
export const MAX_RANKING = 10;
// JSON の書き出し・読み込み(Phase 19 PR 1。バックアップ・機種変更用)。キーみちの store.js と同じ考え方
export const EXPORT_FORMAT = "nolito-escape-boss-export";
export const MAX_IMPORT_BYTES = 1_000_000;
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
    progress: {
      totalClears: 0,
      totalWords: 0,
      clears: {},
      clearedJobs: {},
      // 版 4(Phase 18): 累計の経験値・職種ごとの合計・難易度ごとのクリア数・自己ベスト
      exp: 0,
      jobs: {},
      difficultyClears: {},
      bests: {},
    },
  };
}

// 難易度ごとのクリア数の名前(役職:難易度)と、自己ベストの名前(職種:役職:難易度)
export const clearKey = (roleId, difficulty) => `${roleId}:${difficulty}`;
export const bestKey = (jobId, roleId, difficulty) => `${jobId}:${roleId}:${difficulty}`;

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
const total = (value) => Math.min(count(value), MAX_TOTAL);
const isId = (value) => typeof value === "string" && value.length <= 40 && ID_PATTERN.test(value);

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
    // バージョン 1〜3 の結果には無い(「ふつう」として扱う)
    difficulty: isDifficulty(raw.difficulty) ? raw.difficulty : DEFAULT_DIFFICULTY,
  };
}

// 職種ごとの合計(progress.jobs)。職種 ID がおかしいもの・数でない値は捨てる(数は上限まで)
function normalizeJobs(raw) {
  const jobs = {};
  if (!isObject(raw)) return jobs;
  for (const [id, value] of Object.entries(raw).slice(0, MAX_JOB_ENTRIES * 2)) {
    if (Object.keys(jobs).length >= MAX_JOB_ENTRIES) break;
    if (!isId(id) || !isObject(value)) continue;
    jobs[id] = {
      plays: total(value.plays),
      clears: total(value.clears),
      words: total(value.words),
      hits: total(value.hits),
      miss: total(value.miss),
    };
  }
  return jobs;
}

// 難易度ごとのクリア数(名前 = 役職:難易度)
function normalizeDifficultyClears(raw) {
  const clears = {};
  if (!isObject(raw)) return clears;
  for (const [key, value] of Object.entries(raw).slice(0, MAX_CLEAR_ENTRIES * 2)) {
    if (Object.keys(clears).length >= MAX_CLEAR_ENTRIES) break;
    const [roleId, difficulty, ...rest] = key.split(":");
    if (rest.length > 0 || !isId(roleId) || !isDifficulty(difficulty)) continue;
    const n = total(value);
    if (n > 0) clears[key] = n;
  }
  return clears;
}

// 自己ベスト(名前 = 職種:役職:難易度。値 = { score, playedAt })
function normalizeBests(raw) {
  const bests = {};
  if (!isObject(raw)) return bests;
  for (const [key, value] of Object.entries(raw).slice(0, MAX_BEST_ENTRIES * 2)) {
    if (Object.keys(bests).length >= MAX_BEST_ENTRIES) break;
    const [jobId, roleId, difficulty, ...rest] = key.split(":");
    if (rest.length > 0 || !isId(jobId) || !isId(roleId) || !isDifficulty(difficulty)) continue;
    if (!isObject(value) || !isFiniteNumber(value.score) || !isFiniteNumber(value.playedAt))
      continue;
    if (value.score < 0 || value.score > MAX_TOTAL) continue;
    bests[key] = { score: value.score, playedAt: value.playedAt };
  }
  return bests;
}

// 版 1〜3 からの移行: 残っている結果から、職種ごとの合計を作る
function jobsFromResults(results) {
  const jobs = {};
  for (const result of results) {
    if (!isId(result.jobId)) continue;
    const job = (jobs[result.jobId] ??= { plays: 0, clears: 0, words: 0, hits: 0, miss: 0 });
    job.plays += 1;
    if (result.status === "cleared") job.clears += 1;
    job.words += count(result.correct);
    job.hits += count(result.hits);
    job.miss += count(result.miss);
  }
  return normalizeJobs(jobs);
}

// 版 1〜3 からの移行: 残っている結果(クリアだけ)から、自己ベスト(「ふつう」)を作る
function bestsFromResults(results) {
  const bests = {};
  for (const result of results) {
    if (result.status !== "cleared" || !isId(result.jobId) || !isId(result.roleId)) continue;
    const key = bestKey(result.jobId, result.roleId, DEFAULT_DIFFICULTY);
    const current = bests[key];
    if (!current || result.score > current.score) {
      bests[key] = { score: result.score, playedAt: result.playedAt };
    }
  }
  return normalizeBests(bests);
}

// ランキングの鍵(役職:難易度)。役職 ID・難易度の形が正しいときだけ、文字列を返す(それ以外は null)
function rankingKeyOf(roleId, difficulty) {
  return isId(roleId) && isDifficulty(difficulty) ? clearKey(roleId, difficulty) : null;
}

// 版 5 未満の鍵(役職 ID だけ。例: "senpai")を、いまの鍵の形(役職:難易度)に直す。版 5 以上は、そのままの形を検証する
function migrateRankingKey(rawKey, version) {
  if (version >= 5) {
    const [roleId, difficulty] = rawKey.split(":");
    return rankingKeyOf(roleId, difficulty);
  }
  return rankingKeyOf(rawKey, DEFAULT_DIFFICULTY);
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
    for (const [rawKey, list] of Object.entries(raw.rankings)) {
      if (!Array.isArray(list)) continue;
      const key = migrateRankingKey(rawKey, raw.version);
      if (!key) continue;
      data.rankings[key] = list
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
  if (raw.version >= 4) {
    // 版 4: 保存されていた値を、検証して読む
    const progress = isObject(raw.progress) ? raw.progress : {};
    data.progress.exp = Math.min(count(progress.exp), MAX_EXP);
    data.progress.jobs = normalizeJobs(progress.jobs);
    data.progress.difficultyClears = normalizeDifficultyClears(progress.difficultyClears);
    data.progress.bests = normalizeBests(progress.bests);
  } else {
    // 版 1〜3 からの移行: これまでの記録から、新しい項目を作る(元のデータは、消さない)
    data.progress.exp = initialExp(data.progress, Object.keys(data.achievements).length);
    data.progress.jobs = jobsFromResults(data.results);
    data.progress.difficultyClears = normalizeDifficultyClears(
      Object.fromEntries(
        Object.entries(data.progress.clears)
          .filter(([, n]) => n > 0)
          .map(([roleId, n]) => [clearKey(roleId, DEFAULT_DIFFICULTY), n]),
      ),
    );
    data.progress.bests = bestsFromResults(data.results);
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
export function createStore(backend, { now = Date.now } = {}) {
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
      // バージョン 1〜3 から移行する場合は、移行前の元データを一度だけ退避する(移行の不具合に備える)
      if (parsed.version === 1) backUpOnce(BACKUP_V1_KEY, text);
      if (parsed.version === 2) backUpOnce(BACKUP_V2_KEY, text);
      if (parsed.version === 3) backUpOnce(BACKUP_V3_KEY, text);
      if (parsed.version === 4) backUpOnce(BACKUP_V4_KEY, text);
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

  /**
   * 書き出す JSON の文字列(ファイルに保存して使う)。保存されているデータが壊れているときは null
   * (空のデータを、本物の記録のように書き出さないため)。
   */
  function exportJson() {
    const { data, status: loadStatus } = load();
    if (loadStatus === "corrupt") return null;
    return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: now(), data }, null, 2);
  }

  /**
   * 書き出した JSON を検査するだけ(保存はしない)。{ ok: true, data } か { ok: false, error }。
   * error は too-large / invalid-json / invalid-format / newer-version / invalid-data。
   */
  function parseImport(text) {
    if (typeof text !== "string") return { ok: false, error: "invalid-json" };
    if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
      return { ok: false, error: "too-large" };
    }
    let file;
    try {
      file = JSON.parse(text);
    } catch {
      return { ok: false, error: "invalid-json" };
    }
    if (!isObject(file) || file.format !== EXPORT_FORMAT || !isObject(file.data)) {
      return { ok: false, error: "invalid-format" };
    }
    if (!READABLE_VERSIONS.includes(file.data.version)) {
      const tooNew = isFiniteNumber(file.data.version) && file.data.version > DATA_VERSION;
      return { ok: false, error: tooNew ? "newer-version" : "invalid-format" };
    }
    const data = normalizeData(file.data);
    if (!data) return { ok: false, error: "invalid-data" };
    return { ok: true, data };
  }

  /**
   * 書き出した JSON を取り込んで、保存する(いまのデータを、まるごと置き換える。合わせない)。
   * 置き換える前のデータは :before-import に退避する(1回ごとに、直前のものへ上書きする)。
   * 取り込めたら { ok: true, data, saved }。取り込めなかったら { ok: false, error }(parseImport と同じ)。
   */
  function importJson(text) {
    const parsed = parseImport(text);
    if (!parsed.ok) return parsed;
    if (backend) {
      try {
        const current = backend.getItem(STORAGE_KEY);
        if (current !== null) backend.setItem(`${STORAGE_KEY}:before-import`, current);
      } catch {
        // 退避できなくても、取り込みは続ける
      }
    }
    const saved = save(parsed.data);
    return { ok: true, data: parsed.data, saved };
  }

  return {
    load,
    save,
    update,
    exportJson,
    parseImport,
    importJson,
    get status() {
      return status;
    },
  };
}

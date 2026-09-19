// 端末内の保存(LocalStorage)。保存できない環境・壊れたデータ・改ざんされたデータでもゲームが落ちないようにする。
// 保存形式にはバージョンを付ける(Phase 4・19 で項目を追加するときに移行できるようにするため)。

export const STORAGE_KEY = "nolito:escape-boss:v1";
export const DATA_VERSION = 1;
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
  if (!isObject(raw) || raw.version !== DATA_VERSION) return null;
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
    let data;
    try {
      data = normalizeData(JSON.parse(text));
    } catch {
      data = null;
    }
    if (data) {
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

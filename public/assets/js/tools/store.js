// ツール共通の、利用者のデータの保存(ブラウザ)と、JSON の書き出し・読み込み。DOM に依存しない。
// 使い方: ツールごとに createToolStore({ toolId, version, initial, ... }) で保存先を作る。
// 保存先は、ツール ID とワークスペースごとに分かれる(個人用は "personal"。将来のチーム用は、別のワークスペース)。
//
// 保存の形: キー nolito:tool:<ツールID>:<ワークスペース>:v1 に { version, savedAt, data } を JSON で入れる。
// キー名の v1 は変えない。データの形を変えるときは version を上げ、migrations に移行の関数を足す。
//   - 壊れている・読めないデータは、上書きせず :corrupt に退避する(利用者のデータを勝手に消さない)。
//   - 保存されている版が、このコードより新しいときは、読み込まず・上書きもしない(古い画面が新しいデータを壊さない)。
//   - 保存できない環境(プライベートモード・容量超過など)でも落ちず、メモリに残す。
//   - 移行のとき、元のデータを :backup-v<移行前の版> に一度だけ退避する。

export const DEFAULT_WORKSPACE = "personal";
export const EXPORT_FORMAT = "nolito-tool-export";
export const MAX_IMPORT_BYTES = 1_000_000;

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isVersion = (value) => Number.isInteger(value) && value >= 1 && value <= 1_000_000;

/** 保存先のキー。ツール ID・ワークスペースは、英小文字・数字・ハイフンだけ(キーを取り違えないため)。 */
export function storageKey(toolId, workspace = DEFAULT_WORKSPACE) {
  for (const [name, value] of [
    ["toolId", toolId],
    ["workspace", workspace],
  ]) {
    if (typeof value !== "string" || !ID_PATTERN.test(value)) {
      throw new TypeError(`${name} は、英小文字・数字・ハイフンだけにしてください: ${value}`);
    }
  }
  return `nolito:tool:${toolId}:${workspace}:v1`;
}

/** localStorage が使えれば、それを返す。使えなければ null(その場合、ストアはメモリだけで動く)。 */
export function getBackend() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = "nolito:tool:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const tryRead = (backend, key) => {
  try {
    return { ok: true, value: backend.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
};
const tryWrite = (backend, key, value) => {
  try {
    backend.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

/**
 * ツールの保存先を作る。
 * - toolId / workspace: 保存先を分ける(workspace の既定は "personal")
 * - version: いまのデータの版(1以上の整数)
 * - initial: 何も保存されていないときの、最初のデータを返す関数
 * - migrations: { <移行前の版>: (data) => <次の版のデータ> }。古い版のデータを、順に移行する
 * - normalize: (data) => 整えたデータ。読み込み・保存・取り込みのたびに通す(不正なら例外を投げる)
 * - backend: getItem / setItem / removeItem を持つもの(既定は localStorage。テストでは差し替える)
 * - now: 現在時刻(ミリ秒)を返す関数
 */
export function createToolStore({
  toolId,
  workspace = DEFAULT_WORKSPACE,
  version,
  initial,
  migrations = {},
  normalize = (data) => data,
  backend = getBackend(),
  now = Date.now,
}) {
  const key = storageKey(toolId, workspace);
  if (!isVersion(version)) throw new TypeError("version は、1以上の整数にしてください");
  if (typeof initial !== "function")
    throw new TypeError("initial は、最初のデータを返す関数にしてください");

  let memory; // 保存先に書けなかったときだけ持つ、最後のデータ(書けたら捨てる)

  const fresh = () => normalize(initial());

  // 古い版のデータを、いまの版まで順に移行する。途中の移行がなければ、読めないものとして例外
  function migrateData(data, from) {
    let current = data;
    for (let v = from; v < version; v += 1) {
      if (typeof migrations[v] !== "function") throw new Error(`版 ${v} からの移行がありません`);
      current = migrations[v](current);
    }
    return current;
  }

  // 保存されているデータが、このコードより新しい版か(新しければ、上書きしない)
  function storedIsNewer() {
    if (!backend) return false;
    const raw = tryRead(backend, key).value;
    if (raw === null) return false;
    try {
      const envelope = JSON.parse(raw);
      return isPlainObject(envelope) && isVersion(envelope.version) && envelope.version > version;
    } catch {
      return false;
    }
  }

  function quarantine(suffix, raw) {
    if (!backend || tryRead(backend, `${key}:${suffix}`).value !== null) return;
    tryWrite(backend, `${key}:${suffix}`, raw);
  }

  /** 読み込む。{ data, status }。status は empty / ok / migrated / corrupt / newer / unavailable。 */
  function load() {
    if (!backend) {
      return { data: memory === undefined ? fresh() : clone(memory), status: "unavailable" };
    }
    const read = tryRead(backend, key);
    if (!read.ok) {
      return { data: memory === undefined ? fresh() : clone(memory), status: "unavailable" };
    }
    if (read.value === null) {
      return { data: memory === undefined ? fresh() : clone(memory), status: "empty" };
    }
    let envelope;
    try {
      envelope = JSON.parse(read.value);
      if (!isPlainObject(envelope) || !isVersion(envelope.version) || !("data" in envelope)) {
        throw new Error("形式が違います");
      }
    } catch {
      quarantine("corrupt", read.value);
      return { data: fresh(), status: "corrupt" };
    }
    if (envelope.version > version) return { data: fresh(), status: "newer" };
    try {
      const migrated = envelope.version < version;
      const data = normalize(migrateData(envelope.data, envelope.version));
      if (migrated) quarantine(`backup-v${envelope.version}`, read.value);
      return { data, status: migrated ? "migrated" : "ok" };
    } catch {
      quarantine("corrupt", read.value);
      return { data: fresh(), status: "corrupt" };
    }
  }

  /** 保存する。{ saved, reason }。reason は invalid / locked / unavailable / failed。 */
  function save(data) {
    let normalized;
    try {
      normalized = normalize(clone(data));
    } catch {
      return { saved: false, reason: "invalid" };
    }
    if (storedIsNewer()) return { saved: false, reason: "locked" };
    if (!backend) {
      memory = normalized;
      return { saved: false, reason: "unavailable" };
    }
    const envelope = JSON.stringify({ version, savedAt: now(), data: normalized });
    if (tryWrite(backend, key, envelope)) {
      memory = undefined;
      return { saved: true };
    }
    memory = normalized;
    return { saved: false, reason: "failed" };
  }

  /** 毎回、読み直してから、関数で新しいデータを作って保存する(ほかのタブの変更を上書きしにくい)。 */
  function update(change) {
    const { data, status } = load();
    const next = change(data);
    return { data: next, status, ...save(next) };
  }

  /** 保存されているデータと、退避したデータを消す。 */
  function clear() {
    memory = undefined;
    if (!backend) return;
    const backups = Array.from({ length: version - 1 }, (_, i) => `:backup-v${i + 1}`);
    for (const suffix of ["", ":corrupt", ":before-import", ...backups]) {
      try {
        backend.removeItem(`${key}${suffix}`);
      } catch {
        // 消せなくても、ほかの動作は続ける
      }
    }
  }

  /**
   * 書き出す JSON の文字列(ファイルに保存して使う)。
   * 保存されているデータが、壊れている・このコードより新しいときは、書き出せるものがないので null。
   */
  function exportJson() {
    const { data, status } = load();
    if (status === "corrupt" || status === "newer") return null;
    return JSON.stringify(
      { format: EXPORT_FORMAT, toolId, workspace, version, exportedAt: now(), data },
      null,
      2,
    );
  }

  /**
   * 書き出した JSON を検査して、データにする(保存はしない)。
   * { ok: true, data } か { ok: false, error }。error は too-large / invalid-json / invalid-format /
   * wrong-tool / newer-version / invalid-data。ワークスペースは、書き出した先と違ってもよい(取り込み先に入る)。
   */
  function parseImport(text) {
    if (typeof text !== "string") return { ok: false, error: "invalid-json" };
    if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
      return { ok: false, error: "too-large" };
    let file;
    try {
      file = JSON.parse(text);
    } catch {
      return { ok: false, error: "invalid-json" };
    }
    if (
      !isPlainObject(file) ||
      file.format !== EXPORT_FORMAT ||
      !isVersion(file.version) ||
      !("data" in file)
    ) {
      return { ok: false, error: "invalid-format" };
    }
    if (file.toolId !== toolId) return { ok: false, error: "wrong-tool" };
    if (file.version > version) return { ok: false, error: "newer-version" };
    try {
      return { ok: true, data: normalize(migrateData(file.data, file.version)) };
    } catch {
      return { ok: false, error: "invalid-data" };
    }
  }

  /**
   * 書き出した JSON を取り込んで、保存する(いまのデータを置き換える)。
   * 置き換える前のデータは :before-import に退避する(取り込みの取り消しに使える)。
   * 取り込めたら { ok: true, data, saved }(saved が false のときは、保存先に書けず、メモリだけ。reason に理由)。
   * 取り込めなかったら { ok: false, error }(error は parseImport の値か locked)。
   */
  function importJson(text) {
    const parsed = parseImport(text);
    if (!parsed.ok) return parsed;
    if (storedIsNewer()) return { ok: false, error: "locked" };
    if (backend) {
      const current = tryRead(backend, key).value;
      if (current !== null) tryWrite(backend, `${key}:before-import`, current);
    }
    const result = save(parsed.data);
    return { ok: true, data: parsed.data, ...result };
  }

  return { key, load, save, update, clear, exportJson, parseImport, importJson };
}

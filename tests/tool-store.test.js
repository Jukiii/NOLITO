import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_WORKSPACE,
  EXPORT_FORMAT,
  MAX_IMPORT_BYTES,
  createToolStore,
  getBackend,
  storageKey,
} from "../public/assets/js/tools/store.js";

// localStorage の代わり。failRead / failWrite で、失敗を再現する
function fakeBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  const backend = {
    map,
    failRead: false,
    failWrite: false,
    getItem(key) {
      if (backend.failRead) throw new Error("denied");
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (backend.failWrite) throw new Error("quota");
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
  return backend;
}

const KEY = "nolito:tool:memo:personal:v1";
const make = (backend, overrides = {}) =>
  createToolStore({
    toolId: "memo",
    version: 1,
    initial: () => ({ items: [] }),
    backend,
    now: () => 1000,
    ...overrides,
  });
const envelope = (version, data, extra = {}) =>
  JSON.stringify({ version, savedAt: 1, data, ...extra });

describe("保存先のキー", () => {
  it("ツール ID とワークスペースで、キーが分かれる(既定は personal)", () => {
    assert.equal(DEFAULT_WORKSPACE, "personal");
    assert.equal(storageKey("memo"), "nolito:tool:memo:personal:v1");
    assert.equal(storageKey("memo", "team-a"), "nolito:tool:memo:team-a:v1");
    assert.notEqual(storageKey("memo"), storageKey("timer"));
  });

  it("英小文字・数字・ハイフン以外は、キーにできない(取り違え・区切りの混入を防ぐ)", () => {
    for (const bad of [
      "",
      "Memo",
      "a:b",
      "a b",
      "../x",
      "a_b",
      "-a",
      "a-",
      "あ",
      5,
      null,
      undefined,
    ]) {
      assert.throws(() => storageKey(bad), TypeError, String(bad));
      // ワークスペースは、省略(undefined)すると既定の personal になる。それ以外の不正な値は拒否する
      if (bad !== undefined) assert.throws(() => storageKey("memo", bad), TypeError, String(bad));
    }
  });

  it("作るときの引数が不正なら、例外", () => {
    assert.throws(
      () => createToolStore({ toolId: "memo", version: 0, initial: () => ({}) }),
      TypeError,
    );
    assert.throws(
      () => createToolStore({ toolId: "memo", version: 1.5, initial: () => ({}) }),
      TypeError,
    );
    assert.throws(() => createToolStore({ toolId: "memo", version: 1, initial: {} }), TypeError);
    assert.throws(
      () => createToolStore({ toolId: "Bad", version: 1, initial: () => ({}) }),
      TypeError,
    );
  });
});

describe("保存と読み込み", () => {
  it("何も保存されていないときは、最初のデータ(empty)。書き込みはしない", () => {
    const backend = fakeBackend();
    const store = make(backend);
    assert.deepEqual(store.load(), { data: { items: [] }, status: "empty" });
    assert.equal(backend.map.size, 0);
  });

  it("保存して、読み込める。版と保存時刻が入る。キー名は v1 のまま", () => {
    const backend = fakeBackend();
    const store = make(backend, { version: 3, migrations: { 1: (d) => d, 2: (d) => d } });
    assert.deepEqual(store.save({ items: ["a"] }), { saved: true });
    assert.deepEqual(JSON.parse(backend.map.get(KEY)), {
      version: 3,
      savedAt: 1000,
      data: { items: ["a"] },
    });
    assert.deepEqual(store.load(), { data: { items: ["a"] }, status: "ok" });
    assert.equal(store.key, KEY);
  });

  it("ツールごと・ワークスペースごとに、データが混ざらない", () => {
    const backend = fakeBackend();
    make(backend).save({ items: ["personal"] });
    make(backend, { workspace: "team-a" }).save({ items: ["team"] });
    make(backend, { toolId: "timer" }).save({ items: ["timer"] });
    assert.deepEqual(make(backend).load().data, { items: ["personal"] });
    assert.deepEqual(make(backend, { workspace: "team-a" }).load().data, { items: ["team"] });
    assert.deepEqual(make(backend, { toolId: "timer" }).load().data, { items: ["timer"] });
    assert.equal(backend.map.size, 3);
  });

  it("返したデータを書き換えても、保存されたものは変わらない(コピーを返す)", () => {
    const store = make(fakeBackend());
    const input = { items: ["a"] };
    store.save(input);
    input.items.push("mutated");
    const loaded = store.load().data;
    loaded.items.push("mutated2");
    assert.deepEqual(store.load().data, { items: ["a"] });
  });

  it("update は、毎回読み直してから変更する(ほかのタブの変更を上書きしにくい)", () => {
    const backend = fakeBackend();
    const store = make(backend);
    store.save({ items: ["a"] });
    // ほかのタブが、あとから追加した
    backend.map.set(KEY, envelope(1, { items: ["a", "from-other-tab"] }));
    const result = store.update((data) => ({ items: [...data.items, "b"] }));
    assert.deepEqual(result.data, { items: ["a", "from-other-tab", "b"] });
    assert.equal(result.saved, true);
    assert.deepEqual(store.load().data, { items: ["a", "from-other-tab", "b"] });
  });

  it("normalize は、読み込み・保存のたびに通る。不正なデータは、保存しない", () => {
    const backend = fakeBackend({ [KEY]: envelope(1, { items: ["<b>x</b>", 5, "ok"] }) });
    const normalize = (data) => {
      if (!Array.isArray(data?.items)) throw new Error("bad");
      return {
        items: data.items
          .filter((item) => typeof item === "string")
          .map((s) => s.replace(/[<>]/g, "")),
      };
    };
    const store = make(backend, { normalize });
    assert.deepEqual(store.load(), { data: { items: ["bx/b", "ok"] }, status: "ok" });
    const before = backend.map.get(KEY);
    assert.deepEqual(store.save({ items: "not-an-array" }), { saved: false, reason: "invalid" });
    assert.equal(backend.map.get(KEY), before);
    assert.deepEqual(
      store.save(() => 1),
      { saved: false, reason: "invalid" },
    );
  });

  it("JSON にできないデータ(循環など)は、保存しない・落ちない", () => {
    const store = make(fakeBackend());
    const circular = {};
    circular.self = circular;
    assert.deepEqual(store.save(circular), { saved: false, reason: "invalid" });
  });
});

describe("壊れたデータ", () => {
  it("読めないデータは、上書きせずに :corrupt へ退避し、最初のデータを返す", () => {
    for (const raw of [
      "{broken",
      "null",
      "5",
      "[]",
      '"x"',
      '{"data":{}}',
      '{"version":0,"data":{}}',
      '{"version":1.5,"data":{}}',
      '{"version":1}',
    ]) {
      const backend = fakeBackend({ [KEY]: raw });
      const store = make(backend);
      assert.deepEqual(store.load(), { data: { items: [] }, status: "corrupt" }, raw);
      assert.equal(backend.map.get(`${KEY}:corrupt`), raw, raw);
      assert.equal(backend.map.get(KEY), raw, "元のキーは、読み込みだけでは変えない");
    }
  });

  it("normalize が例外を投げるデータも、壊れたものとして退避する", () => {
    const raw = envelope(1, { items: "bad" });
    const backend = fakeBackend({ [KEY]: raw });
    const store = make(backend, {
      normalize: (data) => {
        if (!Array.isArray(data.items)) throw new Error("bad");
        return data;
      },
    });
    assert.equal(store.load().status, "corrupt");
    assert.equal(backend.map.get(`${KEY}:corrupt`), raw);
  });

  it("退避は、最初の1つを残す(あとの壊れたデータで、最初のを消さない)", () => {
    const backend = fakeBackend({ [KEY]: "{first" });
    const store = make(backend);
    store.load();
    backend.map.set(KEY, "{second");
    store.load();
    assert.equal(backend.map.get(`${KEY}:corrupt`), "{first");
  });

  it("壊れたあとに保存すると、新しいデータになる。退避は残る", () => {
    const backend = fakeBackend({ [KEY]: "{broken" });
    const store = make(backend);
    store.load();
    assert.equal(store.save({ items: ["new"] }).saved, true);
    assert.deepEqual(store.load(), { data: { items: ["new"] }, status: "ok" });
    assert.equal(backend.map.get(`${KEY}:corrupt`), "{broken");
  });
});

describe("版の移行", () => {
  const migrations = {
    1: (data) => ({ items: data.list.map((text) => ({ text })) }), // v1: { list: [文字] } → v2
    2: (data) => ({ ...data, done: 0 }), // v2 → v3
  };
  const v1 = envelope(1, { list: ["a", "b"] });

  it("古い版のデータを、順に移行して読める(migrated)", () => {
    const store = make(fakeBackend({ [KEY]: v1 }), { version: 3, migrations });
    assert.deepEqual(store.load(), {
      data: { items: [{ text: "a" }, { text: "b" }], done: 0 },
      status: "migrated",
    });
  });

  it("移行前の元データを、一度だけ退避する。保存すると新しい版になり、以後は退避を作らない", () => {
    const backend = fakeBackend({ [KEY]: v1 });
    const store = make(backend, { version: 3, migrations });
    store.load();
    assert.equal(backend.map.get(`${KEY}:backup-v1`), v1);
    const loaded = store.load().data;
    assert.equal(store.save(loaded).saved, true);
    assert.equal(JSON.parse(backend.map.get(KEY)).version, 3);
    backend.map.delete(`${KEY}:backup-v1`);
    assert.equal(store.load().status, "ok");
    assert.equal(backend.map.has(`${KEY}:backup-v1`), false);
  });

  it("途中の移行がなければ、壊れたものとして退避する(データを消さない)", () => {
    const backend = fakeBackend({ [KEY]: v1 });
    const store = make(backend, { version: 3, migrations: { 2: (d) => d } });
    assert.equal(store.load().status, "corrupt");
    assert.equal(backend.map.get(`${KEY}:corrupt`), v1);
  });

  it("移行の関数が例外を投げても、落ちず、壊れたものとして退避する", () => {
    const backend = fakeBackend({ [KEY]: envelope(1, "not-an-object") });
    const store = make(backend, {
      version: 2,
      migrations: {
        1: (data) => {
          if (typeof data !== "object") throw new Error("bad");
          return data;
        },
      },
    });
    assert.equal(store.load().status, "corrupt");
  });
});

describe("このコードより新しい版のデータ", () => {
  const newer = envelope(9, { items: ["from-the-future"] });

  it("読み込まず(newer)、保存も取り込みも拒否して、データを守る", () => {
    const backend = fakeBackend({ [KEY]: newer });
    const store = make(backend);
    assert.deepEqual(store.load(), { data: { items: [] }, status: "newer" });
    assert.deepEqual(store.save({ items: ["x"] }), { saved: false, reason: "locked" });
    assert.equal(backend.map.get(KEY), newer);
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { items: ["i"] },
    });
    assert.deepEqual(store.importJson(file), { ok: false, error: "locked" });
    assert.equal(backend.map.get(KEY), newer);
  });

  it("load を呼ぶ前に save しても、上書きしない(毎回、保存されている版を確認する)", () => {
    const backend = fakeBackend({ [KEY]: newer });
    const store = make(backend);
    assert.equal(store.save({ items: ["x"] }).reason, "locked");
    assert.equal(backend.map.get(KEY), newer);
  });

  it("書き出せない(null)。clear で消せば、また使える", () => {
    const backend = fakeBackend({ [KEY]: newer });
    const store = make(backend);
    assert.equal(store.exportJson(), null);
    store.clear();
    assert.equal(store.save({ items: ["x"] }).saved, true);
  });
});

describe("保存できない環境", () => {
  it("保存先がない(null)ときは、メモリに残り、落ちない", () => {
    const store = make(null);
    assert.deepEqual(store.load(), { data: { items: [] }, status: "unavailable" });
    assert.deepEqual(store.save({ items: ["a"] }), { saved: false, reason: "unavailable" });
    assert.deepEqual(store.load(), { data: { items: ["a"] }, status: "unavailable" });
    store.clear();
    assert.deepEqual(store.load().data, { items: [] });
  });

  it("読み込みが失敗する(アクセス拒否)ときも、落ちない", () => {
    const backend = fakeBackend();
    backend.failRead = true;
    const store = make(backend);
    assert.equal(store.load().status, "unavailable");
    assert.equal(store.save({ items: ["a"] }).saved, true);
  });

  it("書き込みが失敗する(容量超過)ときは、saved:false で、メモリに残る。書けたら、メモリを捨てる", () => {
    const backend = fakeBackend();
    const store = make(backend);
    backend.failWrite = true;
    assert.deepEqual(store.save({ items: ["a"] }), { saved: false, reason: "failed" });
    assert.deepEqual(store.load(), { data: { items: ["a"] }, status: "empty" });
    backend.failWrite = false;
    assert.equal(store.save({ items: ["b"] }).saved, true);
    // 保存先が消されたら、古いメモリのデータは返さない
    backend.map.delete(KEY);
    assert.deepEqual(store.load(), { data: { items: [] }, status: "empty" });
  });

  it("clear は、保存・退避したデータをすべて消す(古い版の退避も)", () => {
    const backend = fakeBackend({
      [KEY]: envelope(1, { items: [] }),
      [`${KEY}:corrupt`]: "x",
      [`${KEY}:before-import`]: "y",
      [`${KEY}:backup-v1`]: "z",
      "nolito:tool:memo:team-a:v1": "other",
    });
    make(backend, { version: 2, migrations: { 1: (d) => d } }).clear();
    assert.deepEqual([...backend.map.keys()], ["nolito:tool:memo:team-a:v1"]);
  });

  it("getBackend: localStorage がなければ null。使えれば、それを返す。書けなければ null", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    try {
      delete globalThis.localStorage;
      assert.equal(getBackend(), null);
      const working = fakeBackend();
      Object.defineProperty(globalThis, "localStorage", { value: working, configurable: true });
      assert.equal(getBackend(), working);
      assert.equal(working.map.size, 0, "確認用のキーを残さない");
      working.failWrite = true;
      assert.equal(getBackend(), null);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    }
  });
});

describe("JSON の書き出しと読み込み", () => {
  it("書き出して、別の保存先に取り込むと、同じデータになる(往復)", () => {
    const source = make(fakeBackend());
    source.save({ items: ["a", "あ", "🙂"] });
    const json = source.exportJson();
    const file = JSON.parse(json);
    assert.deepEqual(
      { ...file, exportedAt: undefined },
      {
        format: EXPORT_FORMAT,
        toolId: "memo",
        workspace: "personal",
        version: 1,
        exportedAt: undefined,
        data: { items: ["a", "あ", "🙂"] },
      },
    );
    assert.equal(file.exportedAt, 1000);
    const target = make(fakeBackend());
    const result = target.importJson(json);
    assert.deepEqual(result, { ok: true, data: { items: ["a", "あ", "🙂"] }, saved: true });
    assert.deepEqual(target.load(), { data: { items: ["a", "あ", "🙂"] }, status: "ok" });
  });

  it("何も保存していなくても、最初のデータを書き出せる", () => {
    const file = JSON.parse(make(fakeBackend()).exportJson());
    assert.deepEqual(file.data, { items: [] });
  });

  it("壊れた保存データは、書き出さない(null)", () => {
    assert.equal(make(fakeBackend({ [KEY]: "{broken" })).exportJson(), null);
  });

  it("別のワークスペースから書き出したものも、取り込み先のワークスペースに入る", () => {
    const team = make(fakeBackend(), { workspace: "team-a" });
    team.save({ items: ["t"] });
    const backend = fakeBackend();
    make(backend).importJson(team.exportJson());
    assert.deepEqual(JSON.parse(backend.map.get(KEY)).data, { items: ["t"] });
  });

  it("取り込むと、置き換える前のデータを :before-import に退避する", () => {
    const backend = fakeBackend();
    const store = make(backend);
    store.save({ items: ["old"] });
    const before = backend.map.get(KEY);
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { items: ["new"] },
    });
    assert.equal(store.importJson(file).ok, true);
    assert.equal(backend.map.get(`${KEY}:before-import`), before);
    assert.deepEqual(store.load().data, { items: ["new"] });
  });

  it("parseImport は、検査だけで、保存しない", () => {
    const backend = fakeBackend();
    const store = make(backend);
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { items: ["x"] },
    });
    assert.deepEqual(store.parseImport(file), { ok: true, data: { items: ["x"] } });
    assert.equal(backend.map.size, 0);
  });

  it("古い版の書き出しは、移行して取り込める", () => {
    const store = make(fakeBackend(), {
      version: 2,
      migrations: { 1: (data) => ({ items: data.list }) },
    });
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { list: ["a"] },
    });
    assert.deepEqual(store.parseImport(file), { ok: true, data: { items: ["a"] } });
  });

  it("不正なものは、理由つきで拒否する(保存も変更もしない)", () => {
    const backend = fakeBackend();
    const store = make(backend);
    store.save({ items: ["keep"] });
    const before = backend.map.get(KEY);
    const good = { format: EXPORT_FORMAT, toolId: "memo", version: 1, data: { items: [] } };
    const cases = [
      ["invalid-json", "{broken"],
      ["invalid-json", 5],
      ["invalid-json", null],
      ["invalid-format", "null"],
      ["invalid-format", "[]"],
      ["invalid-format", JSON.stringify({ ...good, format: "other" })],
      ["invalid-format", JSON.stringify({ ...good, version: 0 })],
      ["invalid-format", JSON.stringify({ ...good, version: "1" })],
      ["invalid-format", JSON.stringify({ format: EXPORT_FORMAT, toolId: "memo", version: 1 })],
      ["wrong-tool", JSON.stringify({ ...good, toolId: "timer" })],
      ["newer-version", JSON.stringify({ ...good, version: 2 })],
    ];
    for (const [error, input] of cases) {
      assert.deepEqual(store.parseImport(input), { ok: false, error }, String(input));
      assert.deepEqual(store.importJson(input), { ok: false, error }, String(input));
    }
    assert.equal(backend.map.get(KEY), before);
    assert.equal(backend.map.has(`${KEY}:before-import`), false);
  });

  it("中身が normalize を通らないものは、invalid-data で拒否する", () => {
    const store = make(fakeBackend(), {
      normalize: (data) => {
        if (!Array.isArray(data?.items)) throw new Error("bad");
        return data;
      },
    });
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { items: "bad" },
    });
    assert.deepEqual(store.parseImport(file), { ok: false, error: "invalid-data" });
  });

  it("大きすぎる入力は、解析せずに拒否する(上限は 1MB。バイト数で数える)", () => {
    const store = make(fakeBackend());
    const big = "x".repeat(MAX_IMPORT_BYTES + 1);
    assert.deepEqual(store.parseImport(big), { ok: false, error: "too-large" });
    // 日本語は1文字が3バイト。文字数では上限の三分の一でも、バイト数で超える
    const japanese = "あ".repeat(Math.floor(MAX_IMPORT_BYTES / 3) + 1);
    assert.deepEqual(store.parseImport(japanese), { ok: false, error: "too-large" });
    const ok = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { items: ["x".repeat(1000)] },
    });
    assert.equal(store.parseImport(ok).ok, true);
  });

  it("__proto__ を含むデータを取り込んでも、Object.prototype は汚れない", () => {
    const store = make(fakeBackend());
    const file = `{"format":"${EXPORT_FORMAT}","toolId":"memo","version":1,"data":{"__proto__":{"polluted":true},"items":[]}}`;
    const result = store.parseImport(file);
    assert.equal(result.ok, true);
    assert.equal({}.polluted, undefined);
    assert.equal(Object.prototype.polluted, undefined);
  });

  it("保存先がなくても、取り込める(メモリだけ。saved:false)", () => {
    const store = make(null);
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { items: ["m"] },
    });
    assert.deepEqual(store.importJson(file), {
      ok: true,
      data: { items: ["m"] },
      saved: false,
      reason: "unavailable",
    });
    assert.deepEqual(store.load().data, { items: ["m"] });
  });

  it("保存先に書けないときは、取り込めたが saved:false(理由つき)", () => {
    const backend = fakeBackend();
    const store = make(backend);
    backend.failWrite = true;
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      toolId: "memo",
      version: 1,
      data: { items: ["m"] },
    });
    assert.deepEqual(store.importJson(file), {
      ok: true,
      data: { items: ["m"] },
      saved: false,
      reason: "failed",
    });
  });
});

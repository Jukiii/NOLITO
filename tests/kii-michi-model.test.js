import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createToolStore } from "../public/assets/js/tools/store.js";
import {
  DATA_VERSION,
  LIMITS,
  TOOL_ID,
  addApp,
  addOperation,
  addRoute,
  addStep,
  impactOfRemovingApp,
  impactOfRemovingOperation,
  initialData,
  moveStep,
  newId,
  normalizeData,
  operationsByApp,
  removeApp,
  removeOperation,
  removeRoute,
  removeStep,
  renameApp,
  resolveRoute,
  setOs,
  stats,
  updateOperation,
  updateRoute,
  validateData,
} from "../public/assets/js/tools/kii-michi/model.js";

// 連番の id(テストを、決まった結果にする)
const counter = () => {
  let n = 0;
  return (prefix) => `${prefix}${++n}`;
};
const ok = (result) => {
  assert.equal(result.ok, true, result.message);
  return result.data;
};

// アプリ2つ・操作3つ・ルート1つ(ブラウザ: 新しいタブ / アドレスバー、エディタ: コマンド)
function sample() {
  const id = counter();
  let data = initialData();
  data = ok(addApp(data, "ブラウザ", id));
  data = ok(addApp(data, "エディタ", id));
  data = ok(
    addOperation(data, { appId: "a1", name: "新しいタブ", keysText: "Ctrl+T", note: "" }, id),
  );
  data = ok(
    addOperation(
      data,
      { appId: "a1", name: "アドレスバー", keysText: "Ctrl+L", note: "URL を入力" },
      id,
    ),
  );
  data = ok(
    addOperation(data, { appId: "a2", name: "コマンド", keysText: "Ctrl+Shift+P", note: "" }, id),
  );
  data = ok(addRoute(data, { name: "調べもの", note: "検索して、メモする" }, id));
  data = ok(addStep(data, "r6", "o3"));
  data = ok(addStep(data, "r6", "o4"));
  data = ok(addStep(data, "r6", "o5"));
  data = ok(addStep(data, "r6", "o3"));
  return data;
}

describe("データの検査", () => {
  it("最初のデータと、操作でできたデータは、問題がない", () => {
    assert.deepEqual(validateData(initialData()), []);
    assert.deepEqual(validateData(initialData("mac")), []);
    assert.deepEqual(validateData(sample()), []);
    assert.deepEqual(normalizeData(sample()), sample());
  });

  it("形が違うものは、問題として見つかる(オブジェクトでない・配列でない・OS が不正)", () => {
    for (const raw of [
      null,
      undefined,
      "x",
      5,
      [],
      { ...initialData(), apps: "no" },
      { ...initialData(), operations: {} },
      { ...initialData(), routes: null },
      { ...initialData(), settings: null },
      { ...initialData(), settings: { os: "linux" } },
      { apps: [], operations: [], routes: [] },
    ]) {
      assert.ok(validateData(raw).length > 0, JSON.stringify(raw));
      assert.throws(() => normalizeData(raw), Error, JSON.stringify(raw));
    }
  });

  it("件数の上限を超えるものは、問題", () => {
    const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
    const apps = many(LIMITS.apps + 1, (i) => ({ id: `a${i}`, name: `app${i}` }));
    assert.ok(validateData({ ...initialData(), apps }).length > 0);
    const oneApp = [{ id: "a1", name: "x" }];
    const operations = many(LIMITS.operations + 1, (i) => ({
      id: `o${i}`,
      appId: "a1",
      name: "n",
      keys: [{ ctrl: true, alt: false, shift: false, meta: false, key: "a" }],
      note: "",
    }));
    assert.ok(validateData({ ...initialData(), apps: oneApp, operations }).length > 0);
    const routes = many(LIMITS.routes + 1, (i) => ({
      id: `r${i}`,
      name: "r",
      note: "",
      steps: [],
    }));
    assert.ok(validateData({ ...initialData(), routes }).length > 0);
  });

  it("id の重複・不正な id・存在しない参照(アプリ・操作)は、問題", () => {
    const base = sample();
    const problem = (mutate) => {
      const copy = JSON.parse(JSON.stringify(base));
      mutate(copy);
      return validateData(copy).length > 0;
    };
    assert.ok(problem((d) => (d.apps[1].id = d.apps[0].id)));
    assert.ok(problem((d) => (d.apps[0].id = "A B")));
    assert.ok(problem((d) => (d.apps[0].id = "")));
    assert.ok(problem((d) => (d.apps[0].id = "x".repeat(41))));
    assert.ok(problem((d) => (d.operations[0].appId = "nope")));
    assert.ok(problem((d) => d.routes[0].steps.push("nope")));
    assert.ok(problem((d) => (d.operations[1].id = d.operations[0].id)));
  });

  it("名前・メモ・キー・手順の不正は、問題", () => {
    const base = sample();
    const problem = (mutate) => {
      const copy = JSON.parse(JSON.stringify(base));
      mutate(copy);
      return validateData(copy).length > 0;
    };
    assert.ok(problem((d) => (d.apps[0].name = "")));
    assert.ok(problem((d) => (d.apps[0].name = "   ")));
    assert.ok(problem((d) => (d.apps[0].name = "あ".repeat(LIMITS.name + 1))));
    assert.ok(problem((d) => (d.apps[0].name = 5)));
    assert.ok(problem((d) => (d.operations[0].name = "")));
    assert.ok(problem((d) => delete d.operations[0].note));
    assert.ok(problem((d) => (d.operations[0].note = "あ".repeat(LIMITS.note + 1))));
    assert.ok(problem((d) => (d.operations[0].keys = [])));
    assert.ok(problem((d) => (d.operations[0].keys = "Ctrl+T")));
    assert.ok(problem((d) => (d.operations[0].keys = Array(5).fill(d.operations[0].keys[0]))));
    assert.ok(problem((d) => (d.operations[0].keys[0].key = "Foo")));
    assert.ok(problem((d) => (d.operations[0].keys[0].ctrl = "yes")));
    assert.ok(problem((d) => (d.routes[0].name = "")));
    assert.ok(problem((d) => (d.routes[0].note = 5)));
    assert.ok(problem((d) => (d.routes[0].steps = "x")));
    assert.ok(problem((d) => (d.routes[0].steps = Array(LIMITS.steps + 1).fill("o3"))));
  });

  it("normalize は、知っている項目だけを取り出し、前後の空白を削る。渡したデータは書き換えない", () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.extra = "捨てる";
    raw.apps[0].extra = 1;
    raw.apps[0].name = "  ブラウザ  ";
    raw.operations[0].keys[0].extra = true;
    raw.operations[0].note = "  メモ  ";
    const before = JSON.stringify(raw);
    const normalized = normalizeData(raw);
    assert.equal(JSON.stringify(raw), before);
    assert.equal("extra" in normalized, false);
    assert.equal("extra" in normalized.apps[0], false);
    assert.equal("extra" in normalized.operations[0].keys[0], false);
    assert.equal(normalized.apps[0].name, "ブラウザ");
    assert.equal(normalized.operations[0].note, "メモ");
  });

  it("__proto__ を含むデータでも、Object.prototype は汚れない", () => {
    const raw = JSON.parse(
      '{"apps":[],"operations":[],"routes":[],"settings":{"os":"windows"},"__proto__":{"polluted":true}}',
    );
    normalizeData(raw);
    assert.equal({}.polluted, undefined);
  });
});

describe("アプリ", () => {
  it("追加できる。名前の前後の空白は削る。元のデータは変わらない", () => {
    const data = initialData();
    const result = addApp(data, "  ブラウザ ", counter());
    assert.equal(result.ok, true);
    assert.equal(result.id, "a1");
    assert.deepEqual(result.data.apps, [{ id: "a1", name: "ブラウザ" }]);
    assert.deepEqual(data.apps, []);
  });

  it("名前が空・長すぎる・同じ名前(大文字小文字を区別しない)・件数の上限は、理由つきで失敗する", () => {
    const data = ok(addApp(initialData(), "Chrome", counter()));
    assert.equal(addApp(data, "  ").error, "name-required");
    assert.equal(addApp(data, "あ".repeat(LIMITS.name + 1)).error, "name-too-long");
    assert.equal(addApp(data, "chrome").error, "app-duplicate");
    assert.equal(addApp(data, " CHROME ").error, "app-duplicate");
    let full = initialData();
    for (let i = 0; i < LIMITS.apps; i += 1) full = ok(addApp(full, `app${i}`));
    assert.equal(addApp(full, "one-more").error, "app-limit");
    for (const result of [addApp(data, ""), addApp(full, "x")])
      assert.ok(result.message.length > 0);
  });

  it("名前を変えられる。自分と同じ名前はよい。ほかと同じ・空・存在しないは失敗", () => {
    const data = sample();
    assert.equal(ok(renameApp(data, "a1", "Edge")).apps[0].name, "Edge");
    assert.equal(ok(renameApp(data, "a1", "ブラウザ")).apps[0].name, "ブラウザ");
    assert.equal(ok(renameApp(data, "a1", "ブラウザ")).apps[0].id, "a1");
    assert.equal(renameApp(data, "a1", "エディタ").error, "app-duplicate");
    assert.equal(renameApp(data, "a1", "").error, "name-required");
    assert.equal(renameApp(data, "nope", "x").error, "app-not-found");
  });

  it("消すと、そのアプリの操作と、ルートの中の、その操作の手順もいっしょに消える", () => {
    const data = sample();
    assert.deepEqual(impactOfRemovingApp(data, "a1"), { operations: 2, routeSteps: 3 });
    assert.deepEqual(impactOfRemovingApp(data, "a2"), { operations: 1, routeSteps: 1 });
    const after = ok(removeApp(data, "a1"));
    assert.deepEqual(
      after.apps.map((a) => a.id),
      ["a2"],
    );
    assert.deepEqual(
      after.operations.map((o) => o.id),
      ["o5"],
    );
    assert.deepEqual(after.routes[0].steps, ["o5"]);
    assert.deepEqual(validateData(after), []);
    assert.equal(removeApp(data, "nope").error, "app-not-found");
    assert.equal(data.apps.length, 2);
  });
});

describe("操作", () => {
  it("追加できる。キーは、文字から読み取って、キー操作の列として持つ", () => {
    const data = ok(addApp(initialData(), "エディタ", counter()));
    const result = addOperation(
      data,
      { appId: "a1", name: " コメント ", keysText: "ctrl+k ctrl+c", note: " 選択範囲 " },
      counter(),
    );
    assert.equal(result.ok, true);
    const operation = result.data.operations[0];
    assert.equal(operation.name, "コメント");
    assert.equal(operation.note, "選択範囲");
    assert.equal(operation.keys.length, 2);
    assert.deepEqual(operation.keys[1], {
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
      key: "c",
    });
    assert.deepEqual(validateData(result.data), []);
  });

  it("アプリがない・名前が空・キーが読めない・メモが長い・件数の上限は、理由つきで失敗する", () => {
    const data = ok(addApp(initialData(), "エディタ", counter()));
    const good = { appId: "a1", name: "n", keysText: "Ctrl+A", note: "" };
    assert.equal(addOperation(data, { ...good, appId: "nope" }).error, "app-not-found");
    assert.equal(addOperation(data, { ...good, name: "" }).error, "name-required");
    assert.equal(addOperation(data, { ...good, keysText: "" }).error, "keys-invalid");
    const bad = addOperation(data, { ...good, keysText: "Ctrl+Foo" });
    assert.equal(bad.error, "keys-invalid");
    assert.match(bad.message, /Foo/);
    assert.equal(
      addOperation(data, { ...good, note: "あ".repeat(LIMITS.note + 1) }).error,
      "note-too-long",
    );
    let full = data;
    for (let i = 0; i < LIMITS.operations; i += 1) full = ok(addOperation(full, good));
    assert.equal(addOperation(full, good).error, "operation-limit");
  });

  it("変更できる(アプリの付け替えも)。失敗するときは、何も変えない", () => {
    const data = sample();
    const changed = ok(
      updateOperation(data, "o3", {
        appId: "a2",
        name: "新規タブ",
        keysText: "Ctrl+Alt+T",
        note: "変更",
      }),
    );
    const operation = changed.operations.find((o) => o.id === "o3");
    assert.deepEqual([operation.appId, operation.name, operation.note], ["a2", "新規タブ", "変更"]);
    assert.equal(operation.keys[0].alt, true);
    assert.equal(
      updateOperation(data, "o3", { appId: "a2", name: "x", keysText: "???", note: "" }).error,
      "keys-invalid",
    );
    assert.equal(
      updateOperation(data, "nope", { appId: "a1", name: "x", keysText: "A", note: "" }).error,
      "operation-not-found",
    );
    assert.equal(
      updateOperation(data, "o3", { appId: "nope", name: "x", keysText: "A", note: "" }).error,
      "app-not-found",
    );
    assert.equal(data.operations.find((o) => o.id === "o3").name, "新しいタブ");
  });

  it("消すと、ルートの中の、その操作の手順が(何回あっても)すべて消える", () => {
    const data = sample();
    assert.deepEqual(impactOfRemovingOperation(data, "o3"), { routeSteps: 2, routes: 1 });
    assert.deepEqual(impactOfRemovingOperation(data, "o4"), { routeSteps: 1, routes: 1 });
    const after = ok(removeOperation(data, "o3"));
    assert.deepEqual(after.routes[0].steps, ["o4", "o5"]);
    assert.deepEqual(validateData(after), []);
    assert.equal(removeOperation(data, "nope").error, "operation-not-found");
  });
});

describe("ルートと手順", () => {
  it("追加・変更・削除できる", () => {
    const data = sample();
    assert.equal(
      ok(addRoute(data, { name: "  資料作り ", note: "" }, counter())).routes[1].name,
      "資料作り",
    );
    assert.equal(addRoute(data, { name: "" }).error, "name-required");
    assert.equal(
      addRoute(data, { name: "x", note: "あ".repeat(LIMITS.note + 1) }).error,
      "note-too-long",
    );
    const updated = ok(updateRoute(data, "r6", { name: "調べもの2", note: "" }));
    assert.deepEqual([updated.routes[0].name, updated.routes[0].note], ["調べもの2", ""]);
    assert.deepEqual(updated.routes[0].steps, data.routes[0].steps);
    assert.equal(updateRoute(data, "nope", { name: "x", note: "" }).error, "route-not-found");
    assert.deepEqual(ok(removeRoute(data, "r6")).routes, []);
    assert.equal(removeRoute(data, "nope").error, "route-not-found");
    let full = initialData();
    for (let i = 0; i < LIMITS.routes; i += 1)
      full = ok(addRoute(full, { name: `r${i}`, note: "" }));
    assert.equal(addRoute(full, { name: "x", note: "" }).error, "route-limit");
  });

  it("手順は、同じ操作を何度でも足せる。上限は50", () => {
    let data = ok(addRoute(sample(), { name: "長い", note: "" }, counter()));
    const id = data.routes[1].id;
    for (let i = 0; i < LIMITS.steps; i += 1) data = ok(addStep(data, id, "o3"));
    assert.equal(data.routes[1].steps.length, LIMITS.steps);
    assert.equal(addStep(data, id, "o3").error, "step-limit");
    assert.equal(addStep(data, "nope", "o3").error, "route-not-found");
    assert.equal(addStep(sample(), "r6", "nope").error, "operation-not-found");
  });

  it("手順を消せる・動かせる(端は動かせない)", () => {
    const data = sample();
    assert.deepEqual(data.routes[0].steps, ["o3", "o4", "o5", "o3"]);
    assert.deepEqual(ok(removeStep(data, "r6", 1)).routes[0].steps, ["o3", "o5", "o3"]);
    assert.deepEqual(ok(removeStep(data, "r6", 3)).routes[0].steps, ["o3", "o4", "o5"]);
    assert.equal(removeStep(data, "r6", 4).error, "index-out-of-range");
    assert.equal(removeStep(data, "r6", -1).error, "index-out-of-range");
    assert.equal(removeStep(data, "r6", 1.5).error, "index-out-of-range");
    assert.equal(removeStep(data, "nope", 0).error, "route-not-found");
    assert.deepEqual(ok(moveStep(data, "r6", 1, -1)).routes[0].steps, ["o4", "o3", "o5", "o3"]);
    assert.deepEqual(ok(moveStep(data, "r6", 1, 1)).routes[0].steps, ["o3", "o5", "o4", "o3"]);
    assert.equal(moveStep(data, "r6", 0, -1).error, "index-out-of-range");
    assert.equal(moveStep(data, "r6", 3, 1).error, "index-out-of-range");
    assert.equal(moveStep(data, "nope", 0, 1).error, "route-not-found");
    assert.deepEqual(data.routes[0].steps, ["o3", "o4", "o5", "o3"]);
  });
});

describe("設定・参照・集計", () => {
  it("OS を切り替えられる。ほかの値は失敗", () => {
    assert.equal(ok(setOs(initialData(), "mac")).settings.os, "mac");
    assert.equal(setOs(initialData(), "linux").error, "os-invalid");
    assert.equal(setOs(initialData(), undefined).error, "os-invalid");
  });

  it("アプリごとの操作・ルートの手順(アプリつき)・件数", () => {
    const data = sample();
    assert.deepEqual(
      operationsByApp(data).map(({ app, operations }) => [app.name, operations.map((o) => o.name)]),
      [
        ["ブラウザ", ["新しいタブ", "アドレスバー"]],
        ["エディタ", ["コマンド"]],
      ],
    );
    assert.deepEqual(
      resolveRoute(data, data.routes[0]).map(
        ({ app, operation }) => `${app.name}:${operation.name}`,
      ),
      ["ブラウザ:新しいタブ", "ブラウザ:アドレスバー", "エディタ:コマンド", "ブラウザ:新しいタブ"],
    );
    assert.deepEqual(stats(data), { apps: 2, operations: 3, routes: 1 });
  });

  it("id は、決まった形で、重複しない", () => {
    const ids = new Set();
    for (let i = 0; i < 500; i += 1) {
      const id = newId("o", [...ids]);
      assert.match(id, /^o[a-z0-9]{10}$/);
      assert.equal(ids.has(id), false);
      ids.add(id);
    }
    // 使われている id は、避ける
    let calls = 0;
    const original = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    const first = newId("a");
    const spy = (array) => {
      calls += 1;
      return original(array);
    };
    Object.defineProperty(globalThis.crypto, "getRandomValues", { value: spy, configurable: true });
    try {
      newId("a", [first]);
      assert.ok(calls >= 1);
    } finally {
      Object.defineProperty(globalThis.crypto, "getRandomValues", {
        value: original,
        configurable: true,
      });
    }
  });
});

describe("保存の部品との組み合わせ", () => {
  const backend = () => {
    const map = new Map();
    return {
      map,
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  };
  const make = (b) =>
    createToolStore({
      toolId: TOOL_ID,
      version: DATA_VERSION,
      initial: () => initialData(),
      normalize: normalizeData,
      backend: b,
    });

  it("保存して、読み込める。キーは nolito:tool:kii-michi:personal:v1", () => {
    const b = backend();
    const store = make(b);
    assert.equal(store.key, "nolito:tool:kii-michi:personal:v1");
    assert.equal(store.save(sample()).saved, true);
    assert.deepEqual(store.load(), { data: sample(), status: "ok" });
  });

  it("書き出して、別の保存先に取り込める(往復)", () => {
    const a = make(backend());
    a.save(sample());
    const b = make(backend());
    assert.equal(b.importJson(a.exportJson()).ok, true);
    assert.deepEqual(b.load().data, sample());
  });

  it("不正なデータの取り込みは拒否される。壊れた保存データは退避される", () => {
    const store = make(backend());
    const file = (data) =>
      JSON.stringify({ format: "nolito-tool-export", toolId: TOOL_ID, version: 1, data });
    const broken = sample();
    broken.routes[0].steps.push("存在しない");
    assert.equal(store.importJson(file(broken)).error, "invalid-data");
    assert.equal(store.importJson(file({ apps: [] })).error, "invalid-data");
    const b = backend();
    b.map.set(
      "nolito:tool:kii-michi:personal:v1",
      JSON.stringify({ version: 1, savedAt: 1, data: { apps: "x" } }),
    );
    const s2 = make(b);
    assert.equal(s2.load().status, "corrupt");
    assert.ok(b.map.has("nolito:tool:kii-michi:personal:v1:corrupt"));
  });
});

// キーみち: データ(アプリ・操作・ルート)の検査と、追加・変更・削除・並べ替え。DOM に依存しない。
// どの関数も、渡されたデータを書き換えず、新しいデータを返す。
// 利用者が入力する操作は { ok: true, data, ... } か { ok: false, error, message } を返す(message は、利用者向けの文)。
//
// データの形(保存の版 1):
//   apps:       [{ id, name }]
//   operations: [{ id, appId, name, keys: [chord…], note }]   keys は、順に押すキー操作(keys.js の chord)
//   routes:     [{ id, name, note, steps: [操作の id…] }]      同じ操作を、何度使ってもよい
//   settings:   { os: "windows" | "mac" }                     キーの表記だけを変える
import { MAX_CHORDS, OS_LIST, describeParseError, isValidChord, parseKeys } from "./keys.js";

export const TOOL_ID = "kii-michi";
export const DATA_VERSION = 1;
export const LIMITS = { apps: 50, operations: 500, routes: 50, steps: 50, name: 60, note: 200 };

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export function initialData(os = "windows") {
  return { apps: [], operations: [], routes: [], settings: { os } };
}

// ---- 検査(保存・取り込みのたびに通す) ----

const validText = (value, max, { required }) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length <= max && (!required || trimmed !== "");
};

function checkIds(items, label, problems) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (typeof item.id !== "string" || !ID_PATTERN.test(item.id)) {
      problems.push(`${label}[${index}].id が不正です`);
    } else if (seen.has(item.id)) {
      problems.push(`${label}[${index}].id が重複しています`);
    }
    seen.add(item.id);
  });
  return seen;
}

/** データの問題の一覧(なければ空)。件数・文字数・参照(存在しない id)・キー操作を検査する。 */
export function validateData(raw) {
  if (!isObject(raw)) return ["データがオブジェクトではありません"];
  const problems = [];
  const lists = [
    ["apps", LIMITS.apps],
    ["operations", LIMITS.operations],
    ["routes", LIMITS.routes],
  ];
  for (const [name, max] of lists) {
    if (!Array.isArray(raw[name]) || raw[name].length > max) {
      problems.push(`${name} は、${max}件までの配列にしてください`);
    }
    if (Array.isArray(raw[name]) && !raw[name].every(isObject)) {
      problems.push(`${name} の要素は、オブジェクトにしてください`);
    }
  }
  if (!isObject(raw.settings) || !OS_LIST.includes(raw.settings.os)) {
    problems.push(`settings.os は、${OS_LIST.join(" / ")} のどちらかにしてください`);
  }
  if (problems.length > 0) return problems;

  const appIds = checkIds(raw.apps, "apps", problems);
  raw.apps.forEach((app, i) => {
    if (!validText(app.name, LIMITS.name, { required: true }))
      problems.push(`apps[${i}].name が不正です`);
  });

  const operationIds = checkIds(raw.operations, "operations", problems);
  raw.operations.forEach((operation, i) => {
    const label = `operations[${i}]`;
    if (!appIds.has(operation.appId)) problems.push(`${label}.appId が、存在しないアプリです`);
    if (!validText(operation.name, LIMITS.name, { required: true }))
      problems.push(`${label}.name が不正です`);
    if (!validText(operation.note, LIMITS.note, { required: false }))
      problems.push(`${label}.note が不正です`);
    const keysOk =
      Array.isArray(operation.keys) &&
      operation.keys.length >= 1 &&
      operation.keys.length <= MAX_CHORDS &&
      operation.keys.every(isValidChord);
    if (!keysOk) problems.push(`${label}.keys が不正です`);
  });

  checkIds(raw.routes, "routes", problems);
  raw.routes.forEach((route, i) => {
    const label = `routes[${i}]`;
    if (!validText(route.name, LIMITS.name, { required: true }))
      problems.push(`${label}.name が不正です`);
    if (!validText(route.note, LIMITS.note, { required: false }))
      problems.push(`${label}.note が不正です`);
    const stepsOk =
      Array.isArray(route.steps) &&
      route.steps.length <= LIMITS.steps &&
      route.steps.every((id) => operationIds.has(id));
    if (!stepsOk)
      problems.push(`${label}.steps が不正です(${LIMITS.steps}手順まで。存在しない操作は不可)`);
  });
  return problems;
}

/**
 * 保存・取り込みのたびに通す(createToolStore の normalize)。問題があれば例外。
 * 知っている項目だけを取り出した、新しいデータを返す。
 */
export function normalizeData(raw) {
  const problems = validateData(raw);
  if (problems.length > 0) throw new Error(problems[0]);
  return {
    apps: raw.apps.map((app) => ({ id: app.id, name: app.name.trim() })),
    operations: raw.operations.map((operation) => ({
      id: operation.id,
      appId: operation.appId,
      name: operation.name.trim(),
      keys: operation.keys.map(({ ctrl, alt, shift, meta, key }) => ({
        ctrl,
        alt,
        shift,
        meta,
        key,
      })),
      note: operation.note.trim(),
    })),
    routes: raw.routes.map((route) => ({
      id: route.id,
      name: route.name.trim(),
      note: route.note.trim(),
      steps: [...route.steps],
    })),
    settings: { os: raw.settings.os },
  };
}

// ---- 共通の部品 ----

const fail = (error, message) => ({ ok: false, error, message });

/** 新しい id(重複しないもの)。prefix は英小文字1字など。 */
export function newId(prefix, existing = []) {
  const taken = new Set(existing);
  for (;;) {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const id =
      prefix +
      [...bytes]
        .map((byte) => byte.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 10);
    if (!taken.has(id)) return id;
  }
}

function cleanName(value) {
  const name = String(value ?? "").trim();
  if (name === "") return fail("name-required", "名前を入力してください。");
  if (name.length > LIMITS.name) return fail("name-too-long", `名前は${LIMITS.name}字までです。`);
  return { ok: true, value: name };
}

function cleanNote(value) {
  const note = String(value ?? "").trim();
  if (note.length > LIMITS.note) return fail("note-too-long", `メモは${LIMITS.note}字までです。`);
  return { ok: true, value: note };
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const findApp = (data, id) => data.apps.find((app) => app.id === id);
const findOperation = (data, id) => data.operations.find((operation) => operation.id === id);
const findRoute = (data, id) => data.routes.find((route) => route.id === id);

// ---- 参照・集計(画面と、チートシートが使う) ----

export function stats(data) {
  return { apps: data.apps.length, operations: data.operations.length, routes: data.routes.length };
}

/** アプリごとの操作([{ app, operations }])。アプリは登録順、操作も登録順。 */
export function operationsByApp(data) {
  return data.apps.map((app) => ({
    app,
    operations: data.operations.filter((operation) => operation.appId === app.id),
  }));
}

/** ルートの手順を、アプリと操作の情報つきで返す([{ app, operation }])。 */
export function resolveRoute(data, route) {
  return route.steps.map((id) => {
    const operation = findOperation(data, id);
    return { operation, app: findApp(data, operation.appId) };
  });
}

// ---- アプリ ----

export function addApp(data, name, makeId = newId) {
  const clean = cleanName(name);
  if (!clean.ok) return clean;
  if (data.apps.length >= LIMITS.apps)
    return fail("app-limit", `アプリは${LIMITS.apps}件までです。`);
  if (data.apps.some((app) => sameName(app.name, clean.value))) {
    return fail("app-duplicate", "同じ名前のアプリが、すでにあります。");
  }
  const id = makeId(
    "a",
    data.apps.map((app) => app.id),
  );
  return { ok: true, id, data: { ...data, apps: [...data.apps, { id, name: clean.value }] } };
}

export function renameApp(data, appId, name) {
  if (!findApp(data, appId)) return fail("app-not-found", "アプリが見つかりません。");
  const clean = cleanName(name);
  if (!clean.ok) return clean;
  if (data.apps.some((app) => app.id !== appId && sameName(app.name, clean.value))) {
    return fail("app-duplicate", "同じ名前のアプリが、すでにあります。");
  }
  return {
    ok: true,
    data: {
      ...data,
      apps: data.apps.map((app) => (app.id === appId ? { ...app, name: clean.value } : app)),
    },
  };
}

// 削除で、いっしょに消えるもの(確認の文に使う)
const routeStepsUsing = (data, operationIds) =>
  data.routes.reduce(
    (count, route) => count + route.steps.filter((id) => operationIds.has(id)).length,
    0,
  );

export function impactOfRemovingApp(data, appId) {
  const ids = new Set(
    data.operations
      .filter((operation) => operation.appId === appId)
      .map((operation) => operation.id),
  );
  return { operations: ids.size, routeSteps: routeStepsUsing(data, ids) };
}

export function removeApp(data, appId) {
  if (!findApp(data, appId)) return fail("app-not-found", "アプリが見つかりません。");
  const removed = new Set(
    data.operations
      .filter((operation) => operation.appId === appId)
      .map((operation) => operation.id),
  );
  return {
    ok: true,
    data: {
      ...data,
      apps: data.apps.filter((app) => app.id !== appId),
      operations: data.operations.filter((operation) => operation.appId !== appId),
      routes: data.routes.map((route) => ({
        ...route,
        steps: route.steps.filter((id) => !removed.has(id)),
      })),
    },
  };
}

// ---- 操作 ----

function cleanOperation({ name, keysText, note }) {
  const cleanedName = cleanName(name);
  if (!cleanedName.ok) return cleanedName;
  const parsed = parseKeys(keysText);
  if (!parsed.ok) return fail("keys-invalid", describeParseError(parsed));
  const cleanedNote = cleanNote(note);
  if (!cleanedNote.ok) return cleanedNote;
  return { ok: true, name: cleanedName.value, keys: parsed.keys, note: cleanedNote.value };
}

/** fields: { appId, name, keysText(文字), note }。 */
export function addOperation(data, fields, makeId = newId) {
  if (!findApp(data, fields.appId)) return fail("app-not-found", "アプリを選んでください。");
  if (data.operations.length >= LIMITS.operations) {
    return fail("operation-limit", `操作は${LIMITS.operations}件までです。`);
  }
  const clean = cleanOperation(fields);
  if (!clean.ok) return clean;
  const id = makeId(
    "o",
    data.operations.map((operation) => operation.id),
  );
  const operation = {
    id,
    appId: fields.appId,
    name: clean.name,
    keys: clean.keys,
    note: clean.note,
  };
  return { ok: true, id, data: { ...data, operations: [...data.operations, operation] } };
}

export function updateOperation(data, operationId, fields) {
  if (!findOperation(data, operationId))
    return fail("operation-not-found", "操作が見つかりません。");
  if (!findApp(data, fields.appId)) return fail("app-not-found", "アプリを選んでください。");
  const clean = cleanOperation(fields);
  if (!clean.ok) return clean;
  return {
    ok: true,
    data: {
      ...data,
      operations: data.operations.map((operation) =>
        operation.id === operationId
          ? {
              ...operation,
              appId: fields.appId,
              name: clean.name,
              keys: clean.keys,
              note: clean.note,
            }
          : operation,
      ),
    },
  };
}

export function impactOfRemovingOperation(data, operationId) {
  const ids = new Set([operationId]);
  const routes = data.routes.filter((route) => route.steps.includes(operationId)).length;
  return { routeSteps: routeStepsUsing(data, ids), routes };
}

export function removeOperation(data, operationId) {
  if (!findOperation(data, operationId))
    return fail("operation-not-found", "操作が見つかりません。");
  return {
    ok: true,
    data: {
      ...data,
      operations: data.operations.filter((operation) => operation.id !== operationId),
      routes: data.routes.map((route) => ({
        ...route,
        steps: route.steps.filter((id) => id !== operationId),
      })),
    },
  };
}

// ---- ルート ----

export function addRoute(data, { name, note }, makeId = newId) {
  const cleanedName = cleanName(name);
  if (!cleanedName.ok) return cleanedName;
  const cleanedNote = cleanNote(note);
  if (!cleanedNote.ok) return cleanedNote;
  if (data.routes.length >= LIMITS.routes)
    return fail("route-limit", `ルートは${LIMITS.routes}件までです。`);
  const id = makeId(
    "r",
    data.routes.map((route) => route.id),
  );
  const route = { id, name: cleanedName.value, note: cleanedNote.value, steps: [] };
  return { ok: true, id, data: { ...data, routes: [...data.routes, route] } };
}

export function updateRoute(data, routeId, { name, note }) {
  if (!findRoute(data, routeId)) return fail("route-not-found", "ルートが見つかりません。");
  const cleanedName = cleanName(name);
  if (!cleanedName.ok) return cleanedName;
  const cleanedNote = cleanNote(note);
  if (!cleanedNote.ok) return cleanedNote;
  return {
    ok: true,
    data: {
      ...data,
      routes: data.routes.map((route) =>
        route.id === routeId
          ? { ...route, name: cleanedName.value, note: cleanedNote.value }
          : route,
      ),
    },
  };
}

export function removeRoute(data, routeId) {
  if (!findRoute(data, routeId)) return fail("route-not-found", "ルートが見つかりません。");
  return {
    ok: true,
    data: { ...data, routes: data.routes.filter((route) => route.id !== routeId) },
  };
}

const withSteps = (data, routeId, steps) => ({
  ...data,
  routes: data.routes.map((route) => (route.id === routeId ? { ...route, steps } : route)),
});

export function addStep(data, routeId, operationId) {
  const route = findRoute(data, routeId);
  if (!route) return fail("route-not-found", "ルートが見つかりません。");
  if (!findOperation(data, operationId))
    return fail("operation-not-found", "操作を選んでください。");
  if (route.steps.length >= LIMITS.steps)
    return fail("step-limit", `1つのルートの手順は${LIMITS.steps}までです。`);
  return { ok: true, data: withSteps(data, routeId, [...route.steps, operationId]) };
}

export function removeStep(data, routeId, index) {
  const route = findRoute(data, routeId);
  if (!route) return fail("route-not-found", "ルートが見つかりません。");
  if (!Number.isInteger(index) || index < 0 || index >= route.steps.length) {
    return fail("index-out-of-range", "その手順は、ありません。");
  }
  return {
    ok: true,
    data: withSteps(
      data,
      routeId,
      route.steps.filter((_, i) => i !== index),
    ),
  };
}

/** 手順を、delta だけ動かす(-1 で1つ前、1 で1つ後)。 */
export function moveStep(data, routeId, index, delta) {
  const route = findRoute(data, routeId);
  if (!route) return fail("route-not-found", "ルートが見つかりません。");
  const target = index + delta;
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < route.steps.length;
  if (!inRange(index) || !inRange(target))
    return fail("index-out-of-range", "これ以上、動かせません。");
  const steps = [...route.steps];
  [steps[index], steps[target]] = [steps[target], steps[index]];
  return { ok: true, data: withSteps(data, routeId, steps) };
}

// ---- 設定 ----

export function setOs(data, os) {
  if (!OS_LIST.includes(os))
    return fail("os-invalid", "OS は、Windows か macOS を選んでください。");
  return { ok: true, data: { ...data, settings: { ...data.settings, os } } };
}

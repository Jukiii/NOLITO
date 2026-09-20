// キーみち: 状態(データ・表示中の画面)と、保存(store.js)をつなぐ。画面の描画は view.js。
// 変更はすべて model.js の関数で行い、成功したら保存して、描き直す。
import { createToolStore } from "../store.js";
import {
  DATA_VERSION,
  TOOL_ID,
  addApp,
  addOperation,
  addRoute,
  addStep,
  initialData,
  moveStep,
  normalizeData,
  removeApp,
  removeOperation,
  removeRoute,
  removeStep,
  renameApp,
  setOs,
  updateOperation,
  updateRoute,
} from "./model.js";
import { createView } from "./view.js";

// 最初に開いたときの、キーの表記(Mac なら macOS、それ以外は Windows)
function detectOs() {
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad/i.test(platform) ? "mac" : "windows";
}

const store = createToolStore({
  toolId: TOOL_ID,
  version: DATA_VERSION,
  initial: () => initialData(detectOs()),
  normalize: normalizeData,
});

const loaded = store.load();
const state = {
  data: loaded.data,
  status: loaded.status, // 読み込みの結果(corrupt・newer・unavailable などは、画面で案内する)
  saveProblem: null, // 直近の保存の失敗(failed・unavailable・locked)
  outdated: false, // ほかのタブが、保存を変えた
  tab: "ops",
  editingAppId: null,
  editingOperationId: null,
  editingRouteId: null,
  selectedRouteId: loaded.data.routes[0]?.id ?? null,
  sheet: { includeRoutes: true, includeList: true },
  lastAppId: null,
};

const IMPORT_ERRORS = {
  "invalid-json": "JSON として読み取れません。キーみちで書き出したファイルを選んでください。",
  "invalid-format": "キーみちの書き出しファイルではありません。",
  "wrong-tool": "ほかのツールの書き出しファイルです。",
  "newer-version":
    "新しい版の書き出しファイルです。ページを再読み込みして、もう一度お試しください。",
  "invalid-data": "ファイルの中身が正しくありません(壊れているか、書き換えられています)。",
  "too-large": "ファイルが大きすぎます(1MBまでです)。",
  locked: "保存されているデータのほうが新しい版のため、読み込めません。",
};

function resetSelection() {
  state.editingAppId = null;
  state.editingOperationId = null;
  state.editingRouteId = null;
  state.lastAppId = null;
  state.selectedRouteId = state.data.routes[0]?.id ?? null;
}

function persist() {
  const result = store.save(state.data);
  state.saveProblem = result.saved ? null : result.reason === "invalid" ? "failed" : result.reason;
  if (result.saved) state.outdated = false;
}

// 成功したら、データを入れ替えて、保存し、描き直す。after では、選択などの表示の状態を整える。
function commit(result, message, after) {
  if (!result.ok) return result;
  state.data = result.data;
  after?.(result);
  persist();
  view.render(state);
  return { ...result, message };
}

function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const dateStamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
};

const lastOf = (list) => list[list.length - 1];

const actions = {
  setTab(tab) {
    state.tab = tab;
    state.editingAppId = null;
    state.editingOperationId = null;
    state.editingRouteId = null;
    view.render(state);
  },

  // アプリ
  addApp: (name) => {
    const result = addApp(state.data, name);
    return commit(
      result,
      result.ok ? `アプリ「${lastOf(result.data.apps).name}」を追加しました。` : "",
    );
  },
  editApp(id) {
    state.editingAppId = id;
    view.render(state);
  },
  renameApp: (id, name) =>
    commit(renameApp(state.data, id, name), "アプリの名前を変更しました。", () => {
      state.editingAppId = null;
    }),
  removeApp: (id) =>
    commit(removeApp(state.data, id), "アプリを削除しました。", () => {
      if (state.lastAppId === id) state.lastAppId = null;
      state.editingOperationId = null;
    }),

  // 操作
  addOperation: (fields) => {
    const result = addOperation(state.data, fields);
    return commit(
      result,
      result.ok ? `操作「${lastOf(result.data.operations).name}」を登録しました。` : "",
      () => {
        state.lastAppId = fields.appId;
      },
    );
  },
  editOperation(id) {
    state.editingOperationId = id;
    view.render(state);
  },
  updateOperation: (id, fields) =>
    commit(updateOperation(state.data, id, fields), "操作を変更しました。", () => {
      state.editingOperationId = null;
      state.lastAppId = fields.appId;
    }),
  removeOperation: (id) =>
    commit(removeOperation(state.data, id), "操作を削除しました。", () => {
      if (state.editingOperationId === id) state.editingOperationId = null;
    }),

  // ルート・手順
  addRoute: (fields) => {
    const result = addRoute(state.data, fields);
    return commit(
      result,
      result.ok ? `ルート「${lastOf(result.data.routes).name}」を追加しました。` : "",
      (added) => {
        state.selectedRouteId = added.id;
        state.editingRouteId = null;
      },
    );
  },
  selectRoute(id) {
    state.selectedRouteId = id;
    state.editingRouteId = null;
    view.render(state);
  },
  editRoute(id) {
    state.editingRouteId = id;
    view.render(state);
  },
  updateRoute: (id, fields) =>
    commit(updateRoute(state.data, id, fields), "ルートを変更しました。", () => {
      state.editingRouteId = null;
    }),
  removeRoute: (id) =>
    commit(removeRoute(state.data, id), "ルートを削除しました。", () => {
      state.editingRouteId = null;
      state.selectedRouteId = state.data.routes.find((route) => route.id !== id)?.id ?? null;
    }),
  addStep: (routeId, operationId) => {
    const result = addStep(state.data, routeId, operationId);
    const count = result.ok
      ? result.data.routes.find((route) => route.id === routeId).steps.length
      : 0;
    return commit(result, `${count}番目の手順に追加しました。`);
  },
  removeStep: (routeId, index) =>
    commit(removeStep(state.data, routeId, index), `${index + 1}番目の手順を外しました。`),
  moveStep: (routeId, index, delta) =>
    commit(
      moveStep(state.data, routeId, index, delta),
      `${index + 1}番目の手順を、${delta < 0 ? "1つ前" : "1つ後ろ"}へ動かしました。`,
    ),

  // 表示・設定
  setSheetOption(name, value) {
    state.sheet[name] = value;
    view.render(state);
  },
  setOs: (os) =>
    commit(setOs(state.data, os), `キーの表記を${os === "mac" ? "macOS" : "Windows"}にしました。`),

  // バックアップ
  exportData() {
    const json = store.exportJson();
    if (json === null) {
      return {
        ok: false,
        message: "書き出せるデータがありません(保存されているデータが読めない状態です)。",
      };
    }
    download(`kii-michi-${dateStamp()}.json`, json, "application/json;charset=utf-8");
    return { ok: true };
  },
  importData(text) {
    const result = store.importJson(text);
    if (!result.ok) {
      return { ok: false, message: IMPORT_ERRORS[result.error] ?? "読み込めませんでした。" };
    }
    state.data = result.data;
    state.saveProblem = result.saved ? null : (result.reason ?? "failed");
    state.outdated = false;
    resetSelection();
    view.render(state);
    return {
      ok: true,
      message: result.saved
        ? "読み込みました。"
        : "読み込みました(ただし、この環境では保存できません)。",
    };
  },
  deleteAll() {
    store.clear();
    state.data = store.load().data;
    state.status = "empty";
    state.saveProblem = null;
    state.outdated = false;
    resetSelection();
    view.render(state);
    return { ok: true, message: "すべてのデータを削除しました。" };
  },
  download,
};

const view = createView(document.querySelector("[data-kii]"), actions);
view.render(state);

// ほかのタブが保存を変えたら、案内する(このタブの画面は、古いままになるため)
window.addEventListener("storage", (event) => {
  if (event.key !== store.key) return;
  state.outdated = true;
  view.render(state);
});

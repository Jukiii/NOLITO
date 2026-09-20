// キーみち: 画面の描画と、操作の受け付け(DOM に触れるのは、このファイルと main.js だけ)。
// データの変更は actions(main.js)に任せ、結果({ ok, message })を、画面に出す。
// 表示する文字列は、すべて textContent で入れる(利用者が入力したものを、HTML として読まない)。
import { el } from "../../components/dom.js";
import { sheetModel, toMarkdown } from "./cheatsheet.js";
import {
  chordFromEvent,
  describeParseError,
  formatChord,
  formatKeys,
  isImeEvent,
  parseKeys,
  reservedReason,
} from "./keys.js";
import {
  LIMITS,
  impactOfRemovingApp,
  impactOfRemovingOperation,
  operationsByApp,
  resolveRoute,
  stats,
} from "./model.js";
import { summarize } from "./practice.js";

export const TABS = ["ops", "routes", "practice", "list", "sheet", "settings"];
const MODIFIER_KEY_NAMES = ["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock", "OS"];

const NOTICES = {
  corrupt: "保存されていたデータが読めなかったため、別の場所に退避して、最初の状態から始めました。",
  newer:
    "この画面より新しい版のデータが保存されています。データを守るため、変更は保存されません。ページを再読み込みして、もう一度お試しください。",
  unavailable:
    "この環境では、データを保存できません。ページを閉じると、入力した内容が消えます。「設定」から、ファイルに書き出してバックアップしてください。",
  locked:
    "保存されているデータのほうが新しい版のため、保存できません。ページを再読み込みして、もう一度お試しください。",
  outdated:
    "別のタブで、データが変更されました。このまま操作すると、そちらの変更を上書きします。ページを再読み込みしてください。",
  failed:
    "保存できませんでした(容量がいっぱいの可能性があります)。「設定」から、ファイルに書き出してバックアップしてください。",
};

const button = (label, attrs = {}, cls = "button button--secondary") =>
  el("button", { type: "button", class: cls, ...attrs }, label);

// 1つのキー操作を1つの枠(kbd)で示す。順に押すものは、矢印でつなぐ
function keysView(keys, os) {
  const nodes = [];
  keys.forEach((chord, index) => {
    if (index > 0) nodes.push(el("span", { class: "kbd-arrow", "aria-hidden": "true" }, "→"));
    nodes.push(el("kbd", { class: "kbd" }, formatChord(chord, os)));
  });
  return el("span", { class: "kii-keys" }, ...nodes);
}

function field(labelText, control, hint) {
  return el(
    "div",
    { class: "kii-field" },
    el("label", { for: control.id }, labelText),
    control,
    hint ? el("p", { class: "kii-field__hint", id: `${control.id}-hint` }, hint) : "",
  );
}

const input = (id, name, attrs = {}) =>
  el("input", {
    class: "kii-input",
    id,
    name,
    type: "text",
    autocomplete: "off",
    ...attrs,
  });

// yyyy-mm-dd(この端末の日付)
function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createView(root, actions) {
  const $ = (selector, scope = root) => scope.querySelector(selector);
  let state = null;
  let stopRecording = null;

  // ---- 通知・案内 ----

  function announce(message) {
    if (!message) return;
    const target = $("[data-announce]");
    target.textContent = "";
    setTimeout(() => {
      target.textContent = message;
    }, 30);
  }

  function renderNotice() {
    const notice = $("[data-notice]");
    const key =
      state.saveProblem ??
      (state.outdated ? "outdated" : null) ??
      (state.status in NOTICES ? state.status : null);
    notice.hidden = !key;
    notice.textContent = key ? NOTICES[key] : "";
  }

  function confirmDialog({ title, message, okLabel }) {
    const dialog = $("[data-confirm]");
    $("[data-confirm-title]", dialog).textContent = title;
    $("[data-confirm-message]", dialog).textContent = message;
    $("[data-confirm-ok]", dialog).textContent = okLabel;
    dialog.returnValue = "";
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
      dialog.showModal();
    });
  }

  function showError(form, fieldName, message) {
    const error = $("[data-error]", form);
    error.textContent = message;
    error.hidden = false;
    const control = fieldName ? form.elements[fieldName] : null;
    if (control) {
      control.setAttribute("aria-invalid", "true");
      control.focus();
    }
  }

  const focusHeading = () => $(`#heading-${state.tab}`)?.focus();

  // ---- ①アプリ・操作 ----

  function appForm() {
    return el(
      "form",
      {
        class: "kii-form",
        novalidate: true,
        "data-form": "add-app",
        "aria-labelledby": "app-form-title",
      },
      el("h3", { id: "app-form-title" }, "アプリを追加"),
      field(
        "アプリの名前",
        input("app-name", "name", { maxlength: LIMITS.name, "aria-describedby": "app-error" }),
        "例: ブラウザ、エディタ、表計算",
      ),
      el("p", {
        class: "kii-error",
        id: "app-error",
        role: "alert",
        "data-error": true,
        hidden: true,
      }),
      el(
        "div",
        { class: "kii-row" },
        el("button", { class: "button button--primary", type: "submit" }, "追加"),
      ),
    );
  }

  function appItem(app, operationCount) {
    if (state.editingAppId === app.id) {
      return el(
        "li",
        { class: "kii-item" },
        el(
          "form",
          { class: "kii-row", novalidate: true, "data-form": "rename-app", "data-id": app.id },
          input("rename-app-name", "name", {
            maxlength: LIMITS.name,
            value: app.name,
            "aria-label": `「${app.name}」の新しい名前`,
            "aria-describedby": "rename-app-error",
          }),
          el("button", { class: "button button--primary", type: "submit" }, "保存"),
          button("キャンセル", { "data-action": "cancel-edit-app" }),
          el("p", {
            class: "kii-error",
            id: "rename-app-error",
            role: "alert",
            "data-error": true,
            hidden: true,
          }),
        ),
      );
    }
    return el(
      "li",
      { class: "kii-item" },
      el(
        "div",
        { class: "kii-item__main" },
        el("span", { class: "kii-item__name" }, app.name),
        el("span", { class: "kii-item__note" }, `操作 ${operationCount}件`),
      ),
      el(
        "div",
        { class: "kii-item__actions" },
        button("名前を変更", {
          "data-action": "edit-app",
          "data-id": app.id,
          "aria-label": `「${app.name}」の名前を変更`,
        }),
        button("削除", {
          "data-action": "remove-app",
          "data-id": app.id,
          "aria-label": `「${app.name}」を削除`,
        }),
      ),
    );
  }

  function operationForm() {
    const { data } = state;
    const editing = data.operations.find((operation) => operation.id === state.editingOperationId);
    const os = data.settings.os;
    const appSelect = el(
      "select",
      { class: "kii-input", id: "op-app", name: "appId" },
      ...data.apps.map((app) =>
        el(
          "option",
          {
            value: app.id,
            selected: app.id === (editing?.appId ?? state.lastAppId ?? data.apps[0].id),
          },
          app.name,
        ),
      ),
    );
    const keysInput = input("op-keys", "keys", {
      value: editing ? formatKeys(editing.keys, os) : "",
      placeholder: "例: Ctrl+Shift+P",
      "aria-describedby": "op-keys-hint op-preview",
    });
    return el(
      "form",
      {
        class: "kii-form",
        novalidate: true,
        "data-form": "operation",
        "data-id": editing?.id ?? "",
        "aria-labelledby": "op-form-title",
      },
      el("h3", { id: "op-form-title" }, editing ? "操作を変更" : "操作を登録"),
      field("アプリ", appSelect),
      field(
        "操作の名前",
        input("op-name", "name", {
          maxlength: LIMITS.name,
          value: editing?.name ?? "",
          placeholder: "例: コマンドパレットを開く",
        }),
      ),
      el(
        "div",
        { class: "kii-field" },
        el("label", { for: "op-keys" }, "キー"),
        el(
          "div",
          { class: "kii-row" },
          keysInput,
          button("キーを押して入力", {
            "data-action": "record",
            "aria-pressed": "false",
            id: "op-record",
          }),
        ),
        el(
          "p",
          { class: "kii-field__hint", id: "op-keys-hint" },
          "「Ctrl+Shift+P」の形で入力します。順に押すキーは、スペースで区切ります(例: Ctrl+K Ctrl+C)。Ctrl+W など、ブラウザが先に処理するキーは、押すとタブが閉じるなどするので、文字で入力してください。",
        ),
        el("p", { class: "kii-preview", id: "op-preview", "data-preview": true }),
      ),
      field(
        "メモ(任意)",
        input("op-note", "note", { maxlength: LIMITS.note, value: editing?.note ?? "" }),
      ),
      el("p", {
        class: "kii-error",
        id: "op-error",
        role: "alert",
        "data-error": true,
        hidden: true,
      }),
      el(
        "div",
        { class: "kii-row" },
        el(
          "button",
          { class: "button button--primary", type: "submit" },
          editing ? "変更を保存" : "登録",
        ),
        editing ? button("キャンセル", { "data-action": "cancel-edit-op" }) : "",
      ),
    );
  }

  function operationItem(operation, os) {
    return el(
      "li",
      { class: "kii-item" },
      el(
        "div",
        { class: "kii-item__main" },
        el("span", { class: "kii-item__name" }, operation.name),
        keysView(operation.keys, os),
        operation.note ? el("p", { class: "kii-item__note" }, operation.note) : "",
      ),
      el(
        "div",
        { class: "kii-item__actions" },
        button("編集", {
          "data-action": "edit-op",
          "data-id": operation.id,
          "aria-label": `「${operation.name}」を編集`,
        }),
        button("削除", {
          "data-action": "remove-op",
          "data-id": operation.id,
          "aria-label": `「${operation.name}」を削除`,
        }),
      ),
    );
  }

  function renderOps(panel) {
    const { data } = state;
    const os = data.settings.os;
    const nodes = [el("h2", { id: "heading-ops", tabindex: "-1" }, "アプリと操作")];
    if (data.apps.length === 0) {
      nodes.push(
        el(
          "p",
          { class: "kii-empty" },
          "はじめに、よく使うアプリの名前を追加してください。アプリごとに、キー操作を登録できます。",
        ),
      );
    }
    nodes.push(appForm());
    if (data.apps.length > 0) {
      nodes.push(el("h3", {}, "登録したアプリ"));
      nodes.push(
        el(
          "ul",
          { class: "kii-items" },
          ...operationsByApp(data).map(({ app, operations }) => appItem(app, operations.length)),
        ),
      );
      nodes.push(operationForm());
      nodes.push(el("h3", {}, "登録した操作"));
      const groups = operationsByApp(data).filter(({ operations }) => operations.length > 0);
      if (groups.length === 0)
        nodes.push(el("p", { class: "kii-empty" }, "操作は、まだありません。"));
      for (const { app, operations } of groups) {
        nodes.push(el("h4", {}, app.name));
        nodes.push(
          el(
            "ul",
            { class: "kii-items" },
            ...operations.map((operation) => operationItem(operation, os)),
          ),
        );
      }
    }
    panel.replaceChildren(...nodes);
    updatePreview();
  }

  // キーの入力欄の下に、読み取った結果(または、読み取れない理由)を出す
  function updatePreview() {
    const preview = $("[data-preview]");
    const keysInput = $("#op-keys");
    if (!preview || !keysInput) return;
    const text = keysInput.value.trim();
    preview.replaceChildren();
    if (text === "") return;
    const parsed = parseKeys(text);
    if (!parsed.ok) {
      preview.textContent = describeParseError(parsed);
      return;
    }
    const os = state.data.settings.os;
    preview.append("読み取り結果: ", keysView(parsed.keys, os));
    const reserved = parsed.keys.map((chord) => reservedReason(chord, os)).find(Boolean);
    if (reserved) preview.append(el("br"), `※ ${reserved}登録はできます。`);
  }

  // 「キーを押して入力」。押したキー1つ分を、入力欄に足す。Esc で中止する。
  function startRecording() {
    stopRecording?.();
    const recordButton = $("#op-record");
    const keysInput = $("#op-keys");
    const os = state.data.settings.os;
    recordButton.setAttribute("aria-pressed", "true");
    recordButton.textContent = "記録中(Esc で中止)";
    announce("記録を始めました。登録したいキーを押してください。Escで中止します。");

    const stop = () => {
      document.removeEventListener("keydown", onKey, true);
      recordButton.removeEventListener("focusout", stop);
      recordButton.setAttribute("aria-pressed", "false");
      recordButton.textContent = "キーを押して入力";
      stopRecording = null;
    };
    const onKey = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat || MODIFIER_KEY_NAMES.includes(event.key)) return;
      if (isImeEvent(event)) {
        announce("日本語入力(IME)がオンです。オフにして、もう一度押してください。");
        return;
      }
      const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
      if (event.code === "Escape" && plain) {
        stop();
        announce("記録を中止しました。");
        return;
      }
      const chord = chordFromEvent(event);
      if (!chord) {
        announce("このキーは、記録できません。文字で入力してください。");
        return;
      }
      const text = formatChord(chord, os);
      keysInput.value = keysInput.value.trim() === "" ? text : `${keysInput.value.trim()} ${text}`;
      stop();
      keysInput.focus();
      updatePreview();
      announce(`${text} を入力しました。`);
    };
    document.addEventListener("keydown", onKey, true);
    recordButton.addEventListener("focusout", stop);
    stopRecording = stop;
  }

  // ---- ②ルート ----

  function renderRoutes(panel) {
    const { data } = state;
    const os = data.settings.os;
    const nodes = [el("h2", { id: "heading-routes", tabindex: "-1" }, "操作ルート")];
    nodes.push(
      el(
        "p",
        {},
        "登録した操作を、自分の作業の順番に並べて、ルートにします。同じ操作を、何度使ってもかまいません。",
      ),
    );
    nodes.push(
      el(
        "form",
        {
          class: "kii-form",
          novalidate: true,
          "data-form": "add-route",
          "aria-labelledby": "route-form-title",
        },
        el("h3", { id: "route-form-title" }, "ルートを追加"),
        field(
          "ルートの名前",
          input("route-name", "name", {
            maxlength: LIMITS.name,
            "aria-describedby": "route-error",
          }),
          "例: 会議の議事録を送る",
        ),
        field("メモ(任意)", input("route-note", "note", { maxlength: LIMITS.note })),
        el("p", {
          class: "kii-error",
          id: "route-error",
          role: "alert",
          "data-error": true,
          hidden: true,
        }),
        el(
          "div",
          { class: "kii-row" },
          el("button", { class: "button button--primary", type: "submit" }, "追加"),
        ),
      ),
    );
    if (data.routes.length === 0) {
      nodes.push(el("p", { class: "kii-empty" }, "ルートは、まだありません。"));
      panel.replaceChildren(...nodes);
      return;
    }
    nodes.push(el("h3", {}, "ルートの一覧"));
    nodes.push(
      el(
        "ul",
        { class: "kii-items" },
        ...data.routes.map((route) => {
          const current = route.id === state.selectedRouteId;
          return el(
            "li",
            { class: `kii-item${current ? " is-current" : ""}` },
            button(
              `${route.name}(${route.steps.length}手順)`,
              {
                "data-action": "select-route",
                "data-id": route.id,
                "aria-current": current ? "true" : "false",
              },
              "button button--secondary",
            ),
          );
        }),
      ),
    );
    const route = data.routes.find((item) => item.id === state.selectedRouteId);
    if (route) nodes.push(routeDetail(route, os));
    panel.replaceChildren(...nodes);
  }

  function routeDetail(route, os) {
    const { data } = state;
    const steps = resolveRoute(data, route);
    const header =
      state.editingRouteId === route.id
        ? el(
            "form",
            {
              class: "kii-form",
              novalidate: true,
              "data-form": "edit-route",
              "data-id": route.id,
              "aria-labelledby": "route-edit-title",
            },
            el("h3", { id: "route-edit-title" }, "ルートの名前・メモを変更"),
            field(
              "ルートの名前",
              input("edit-route-name", "name", {
                maxlength: LIMITS.name,
                value: route.name,
                "aria-describedby": "edit-route-error",
              }),
            ),
            field(
              "メモ(任意)",
              input("edit-route-note", "note", { maxlength: LIMITS.note, value: route.note }),
            ),
            el("p", {
              class: "kii-error",
              id: "edit-route-error",
              role: "alert",
              "data-error": true,
              hidden: true,
            }),
            el(
              "div",
              { class: "kii-row" },
              el("button", { class: "button button--primary", type: "submit" }, "保存"),
              button("キャンセル", { "data-action": "cancel-edit-route" }),
            ),
          )
        : el(
            "div",
            {},
            el("h3", { id: "route-title", tabindex: "-1" }, route.name),
            route.note ? el("p", {}, route.note) : "",
            el(
              "div",
              { class: "kii-row" },
              route.steps.length > 0
                ? button(
                    "このルートを練習する",
                    { "data-action": "practice-start-route", "data-id": route.id },
                    "button button--primary",
                  )
                : "",
              button("名前・メモを変更", { "data-action": "edit-route", "data-id": route.id }),
              button("ルートを削除", { "data-action": "remove-route", "data-id": route.id }),
            ),
          );
    const list =
      steps.length === 0
        ? el(
            "p",
            { class: "kii-empty" },
            "手順は、まだありません。下の欄から、操作を足してください。",
          )
        : el(
            "ol",
            { class: "kii-steps", "aria-label": `${route.name}の手順` },
            ...steps.map(({ app, operation }, index) =>
              el(
                "li",
                {},
                el(
                  "div",
                  { class: "kii-item" },
                  el(
                    "div",
                    { class: "kii-item__main" },
                    el("span", { class: "kii-item__name" }, `${app.name}: ${operation.name}`),
                    keysView(operation.keys, os),
                  ),
                  el(
                    "div",
                    { class: "kii-item__actions" },
                    button("上へ", {
                      "data-action": "step-up",
                      "data-index": String(index),
                      disabled: index === 0,
                      "aria-label": `${index + 1}番目「${operation.name}」を1つ前へ`,
                    }),
                    button("下へ", {
                      "data-action": "step-down",
                      "data-index": String(index),
                      disabled: index === steps.length - 1,
                      "aria-label": `${index + 1}番目「${operation.name}」を1つ後ろへ`,
                    }),
                    button("削除", {
                      "data-action": "step-remove",
                      "data-index": String(index),
                      "aria-label": `${index + 1}番目「${operation.name}」を手順から外す`,
                    }),
                  ),
                ),
              ),
            ),
          );
    const addStep =
      data.operations.length === 0
        ? el("p", { class: "kii-empty" }, "先に、「操作」の画面で、操作を登録してください。")
        : el(
            "form",
            {
              class: "kii-form",
              novalidate: true,
              "data-form": "add-step",
              "data-id": route.id,
              "aria-labelledby": "step-form-title",
            },
            el("h3", { id: "step-form-title" }, "手順に操作を足す"),
            field(
              "操作",
              el(
                "select",
                { class: "kii-input", id: "step-operation", name: "operationId" },
                ...operationsByApp(data)
                  .filter(({ operations }) => operations.length > 0)
                  .map(({ app, operations }) =>
                    el(
                      "optgroup",
                      { label: app.name },
                      ...operations.map((operation) =>
                        el(
                          "option",
                          { value: operation.id },
                          `${operation.name}(${formatKeys(operation.keys, os)})`,
                        ),
                      ),
                    ),
                  ),
              ),
            ),
            el("p", {
              class: "kii-error",
              id: "step-error",
              role: "alert",
              "data-error": true,
              hidden: true,
            }),
            el(
              "div",
              { class: "kii-row" },
              el("button", { class: "button button--primary", type: "submit" }, "手順に追加"),
            ),
          );
    return el(
      "section",
      { "aria-label": `ルート「${route.name}」` },
      header,
      el("h4", {}, "手順"),
      list,
      addStep,
    );
  }

  // ---- ③一覧 ----

  function renderList(panel) {
    const { data } = state;
    const os = data.settings.os;
    const nodes = [el("h2", { id: "heading-list", tabindex: "-1" }, "ショートカット一覧")];
    const groups = operationsByApp(data).filter(({ operations }) => operations.length > 0);
    if (groups.length === 0) {
      nodes.push(
        el(
          "p",
          { class: "kii-empty" },
          "登録された操作は、まだありません。「操作」の画面で、アプリと操作を登録してください。",
        ),
      );
    }
    for (const { app, operations } of groups)
      nodes.push(
        operationTable(
          app.name,
          operations.map((operation) => ({
            name: operation.name,
            keys: formatKeys(operation.keys, os),
            note: operation.note,
          })),
        ),
      );
    panel.replaceChildren(...nodes);
  }

  function operationTable(caption, rows) {
    return el(
      "div",
      { class: "kii-scroll" },
      el(
        "table",
        { class: "kii-table" },
        el("caption", {}, caption),
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            el("th", { scope: "col" }, "操作"),
            el("th", { scope: "col" }, "キー"),
            el("th", { scope: "col" }, "メモ"),
          ),
        ),
        el(
          "tbody",
          {},
          ...rows.map((row) =>
            el(
              "tr",
              {},
              el("td", {}, row.name),
              el("td", {}, el("kbd", { class: "kbd" }, row.keys)),
              el("td", {}, row.note),
            ),
          ),
        ),
      ),
    );
  }

  // ---- ④チートシート ----

  function currentSheet() {
    const { data, sheet } = state;
    return sheetModel(data, { os: data.settings.os, ...sheet });
  }

  function renderSheet(panel) {
    const model = currentSheet();
    const check = (name, label) =>
      el(
        "label",
        {},
        el("input", {
          type: "checkbox",
          name,
          checked: state.sheet[name === "routes" ? "includeRoutes" : "includeList"],
          "data-option": name,
        }),
        label,
      );
    const sheetNodes = [
      el("h3", { class: "kii-sheet__title" }, "キーみち チートシート"),
      el(
        "p",
        { class: "kii-sheet__meta" },
        `作成日: ${today()} / キーの表記: ${model.os === "mac" ? "macOS" : "Windows"}`,
      ),
    ];
    if (model.includeRoutes) {
      sheetNodes.push(el("h3", {}, "操作ルート"));
      if (model.routes.length === 0) sheetNodes.push(el("p", {}, "ルートは、まだありません。"));
      for (const route of model.routes) {
        sheetNodes.push(el("h4", {}, route.name));
        if (route.note) sheetNodes.push(el("p", {}, route.note));
        sheetNodes.push(
          route.steps.length === 0
            ? el("p", {}, "手順は、まだありません。")
            : el(
                "ol",
                { class: "kii-steps" },
                ...route.steps.map((step) =>
                  el(
                    "li",
                    {},
                    `${step.app}: ${step.name} — `,
                    el("kbd", { class: "kbd" }, step.keys),
                    step.note ? `(${step.note})` : "",
                  ),
                ),
              ),
        );
      }
    }
    if (model.includeList) {
      sheetNodes.push(el("h3", {}, "アプリ別のショートカット"));
      if (model.apps.length === 0)
        sheetNodes.push(el("p", {}, "登録された操作は、まだありません。"));
      for (const app of model.apps) sheetNodes.push(operationTable(app.name, app.operations));
    }
    const markdown = toMarkdown(model, { date: today() });
    panel.replaceChildren(
      el("h2", { id: "heading-sheet", tabindex: "-1" }, "チートシート"),
      el(
        "p",
        {},
        "登録した内容から、自分用のチートシートを作ります。印刷(PDF に保存もできます)、Markdown のコピー、ファイルの保存ができます。",
      ),
      el(
        "div",
        { class: "kii-sheet-controls" },
        el(
          "fieldset",
          { class: "kii-field" },
          el("legend", {}, "載せるもの"),
          el(
            "div",
            { class: "kii-check" },
            check("routes", "操作ルート"),
            check("list", "アプリ別のショートカット"),
          ),
        ),
        el(
          "div",
          { class: "kii-row" },
          button("印刷 / PDF に保存", { "data-action": "print" }, "button button--primary"),
          button("Markdown をコピー", { "data-action": "copy-md" }),
          button("Markdown ファイルとして保存", { "data-action": "save-md" }),
        ),
      ),
      el("div", { class: "kii-sheet", "data-sheet": true }, ...sheetNodes),
      el(
        "details",
        { class: "kii__howto kii-markdown-box" },
        el("summary", {}, "Markdown を見る"),
        el(
          "textarea",
          {
            class: "kii-markdown",
            readonly: true,
            "aria-label": "Markdown",
            "data-markdown": true,
          },
          markdown,
        ),
      ),
    );
    $("[data-markdown]", panel).value = markdown;
  }

  // ---- ⑤設定 ----

  function renderSettings(panel) {
    const { data } = state;
    const count = stats(data);
    const radio = (value, label) =>
      el(
        "label",
        {},
        el("input", {
          type: "radio",
          name: "os",
          value,
          checked: data.settings.os === value,
          "data-option": "os",
        }),
        label,
      );
    panel.replaceChildren(
      el("h2", { id: "heading-settings", tabindex: "-1" }, "設定・バックアップ"),
      el(
        "fieldset",
        { class: "kii-field" },
        el("legend", {}, "キーの表記"),
        el(
          "div",
          { class: "kii-radio" },
          radio("windows", "Windows(Ctrl / Alt / Win)"),
          radio("mac", "macOS(Control / Option / Command)"),
        ),
        el(
          "p",
          { class: "kii-field__hint" },
          "表記だけが変わります。登録した操作の中身は、変わりません。",
        ),
      ),
      el("h3", {}, "バックアップ"),
      el(
        "p",
        {},
        `いま、アプリ ${count.apps}件・操作 ${count.operations}件・ルート ${count.routes}件が、このブラウザの中に保存されています。ブラウザのサイトデータを消すと、なくなります。`,
      ),
      el(
        "div",
        { class: "kii-form kii-form--wide" },
        el(
          "div",
          { class: "kii-row" },
          button("JSON ファイルに書き出す", { "data-action": "export" }, "button button--primary"),
        ),
        el(
          "div",
          { class: "kii-field" },
          el("label", { for: "import-file" }, "JSON ファイルから読み込む"),
          el("input", {
            class: "kii-input",
            id: "import-file",
            type: "file",
            accept: "application/json,.json",
            "data-import": true,
          }),
          el(
            "p",
            { class: "kii-field__hint" },
            "いまのデータは、読み込んだ内容に置き換わります。先に書き出しておくと安心です。",
          ),
        ),
        el("p", {
          class: "kii-error",
          id: "import-error",
          role: "alert",
          "data-error": true,
          hidden: true,
        }),
      ),
      el("h3", {}, "データの削除"),
      el("p", {}, "このブラウザに保存されている、アプリ・操作・ルートを、すべて削除します。"),
      el(
        "div",
        { class: "kii-row" },
        button("すべてのデータを削除", { "data-action": "delete-all" }),
      ),
    );
  }

  // ---- ⑥練習 ----

  const SELF_REASONS = {
    method: "答えを見て確認する方法を、選んでいます。",
    reserved:
      "このキーは、ブラウザ・OS が先に処理するため、ここでは判定できません。この画面では、押さないでください(タブが閉じるなどします)。",
    tab: "Tab は、画面の移動に使うため、判定できません。",
    marked: "「押しても反応しない」ため、自己確認にしました。",
  };
  const RESULT_LABELS = {
    ok: "できた",
    "self-ok": "自己確認: できた",
    "self-ng": "自己確認: できなかった",
    skipped: "スキップ",
  };
  const MODE_LABELS = {
    press: "キーを押して判定",
    method: "自己確認(方法の選択)",
    reserved: "自己確認(ブラウザ・OS が先に処理するキー)",
    tab: "自己確認(Tab は移動に使うため)",
    marked: "自己確認(押しても反応しなかった)",
  };

  // 直近の判定の、画面に出す文
  function describeLast(session) {
    const { last, os } = session;
    if (!last) return "";
    const pressed = last.pressed ? formatChord(last.pressed, os) : "";
    return (
      {
        miss: `✕ 違います(押したキー: ${pressed})。もう一度、押してください。`,
        partial: `○ ${pressed}。続けて、次のキーを押してください。`,
        "step-done": "○ 正解でした。次の手順です。",
        skipped: "前の手順を、飛ばしました。",
        "self-ok": "前の手順: できた。",
        "self-ng": "前の手順: できなかった。",
        revealed: "答えを表示しました。",
        marked: "この手順を、自己確認にしました。",
      }[last.type] ?? ""
    );
  }

  const promptText = (session, step) =>
    step.keys.length > 1
      ? `${session.progress + 1}つ目のキーを押してください(全${step.keys.length}つ)`
      : "キーを押してください";

  function renderPractice(panel) {
    const { session } = state.practice;
    if (!session) renderPracticeSetup(panel);
    else if (session.status === "finished") renderPracticeResult(panel, session);
    else renderPracticeStep(panel, session);
  }

  function renderPracticeSetup(panel) {
    const { settings } = state.practice;
    const routes = state.data.routes.filter((route) => route.steps.length > 0);
    const head = [
      el("h2", { id: "heading-practice", tabindex: "-1" }, "練習"),
      el(
        "p",
        {},
        "ルートの手順を、順番どおりに、キーを押して練習します。答えのキーは隠しているので、思い出して押してください。",
      ),
      el(
        "p",
        { class: "kii-field__hint" },
        "キーを押して判定する練習は、パソコンのキーボードで使います。スマートフォンなどでは、「答えを見て自己確認する」を選んでください。",
      ),
    ];
    if (routes.length === 0) {
      panel.replaceChildren(
        ...head,
        el(
          "p",
          { class: "kii-empty" },
          "練習できるルートが、まだありません。「ルート」の画面で、手順のあるルートを作ってください。",
        ),
      );
      return;
    }
    const selected = routes.some((route) => route.id === settings.routeId)
      ? settings.routeId
      : routes[0].id;
    const radio = (value, label) =>
      el(
        "label",
        {},
        el("input", {
          type: "radio",
          name: "method",
          value,
          checked: settings.method === value,
          "data-practice-setting": "method",
        }),
        label,
      );
    panel.replaceChildren(
      ...head,
      el(
        "form",
        {
          class: "kii-form",
          novalidate: true,
          "data-form": "practice-start",
          "aria-labelledby": "practice-form-title",
        },
        el("h3", { id: "practice-form-title" }, "練習を始める"),
        field(
          "ルート",
          el(
            "select",
            {
              class: "kii-input",
              id: "practice-route",
              name: "routeId",
              "data-practice-setting": "routeId",
            },
            ...routes.map((route) =>
              el(
                "option",
                { value: route.id, selected: route.id === selected },
                `${route.name}(${route.steps.length}手順)`,
              ),
            ),
          ),
        ),
        el(
          "fieldset",
          { class: "kii-field" },
          el("legend", {}, "練習の方法"),
          el(
            "div",
            { class: "kii-radio" },
            radio("press", "キーを押して判定する"),
            radio("self", "答えを見て自己確認する"),
          ),
          el(
            "p",
            { class: "kii-field__hint" },
            "「キーを押して判定する」でも、ブラウザ・OS が先に処理するキーや、Tab は、判定できないので、自己確認になります。",
          ),
        ),
        el(
          "div",
          { class: "kii-check" },
          el(
            "label",
            {},
            el("input", {
              type: "checkbox",
              name: "showKeys",
              checked: settings.showKeys,
              "data-practice-setting": "showKeys",
            }),
            "キーを最初から表示する(覚える練習)",
          ),
        ),
        el("p", {
          class: "kii-error",
          id: "practice-error",
          role: "alert",
          "data-error": true,
          hidden: true,
        }),
        el(
          "div",
          { class: "kii-row" },
          el("button", { class: "button button--primary", type: "submit" }, "はじめる"),
        ),
      ),
    );
  }

  function renderPracticeStep(panel, session) {
    const step = session.steps[session.index];
    const os = session.os;
    const keysArea = session.revealed
      ? el(
          "div",
          { class: "kii-practice__keys", "data-keys": true },
          "答え: ",
          keysView(step.keys, os),
        )
      : el(
          "p",
          { class: "kii-practice__keys kii-practice__hidden", "data-keys": true },
          "答えのキーは、隠しています。",
        );
    const buttons = [];
    let body;
    if (step.mode === "press") {
      const answer = el(
        "div",
        {
          class: "kii-practice__answer",
          id: "practice-answer",
          tabindex: "0",
          role: "application",
          "aria-label": `キー入力の受付。「${step.name}」のキーを押してください。`,
          "aria-describedby": "practice-help",
          "data-answer": true,
          "data-active": "false",
        },
        el(
          "span",
          { class: "kii-practice__state", "data-state": true },
          "停止中(この枠を選ぶと、受け付けます)",
        ),
        el(
          "span",
          { class: "kii-practice__prompt", "data-prompt": true },
          promptText(session, step),
        ),
      );
      answer.addEventListener("keydown", onPracticeKey);
      answer.addEventListener("focus", () => setAnswerState(answer, true));
      answer.addEventListener("blur", () => setAnswerState(answer, false));
      body = [
        answer,
        el(
          "p",
          { class: "kii-field__hint", id: "practice-help" },
          "この枠を選んでいるあいだ、押したキーを判定します。Tab・Shift+Tab は、判定せずに、移動に使います(Tab で、ボタンへ移れます)。Ctrl+W など、ブラウザや OS が先に処理するキーは、ここでは押さないでください(タブが閉じるなどします)。押しても反応しないキーは、「押しても反応しない」ボタンで、答えを見て確認できます。",
        ),
      ];
      if (!session.revealed)
        buttons.push(button("ヒントを見る", { "data-action": "practice-reveal" }));
      buttons.push(button("スキップ", { "data-action": "practice-skip" }));
      buttons.push(
        button("押しても反応しない(自己確認にする)", { "data-action": "practice-mark" }),
      );
    } else {
      body = [el("p", { class: "kii-practice__self" }, SELF_REASONS[step.selfReason])];
      if (!session.revealed)
        buttons.push(
          button(
            "答えを見る",
            { "data-action": "practice-reveal", "data-practice-focus": true },
            "button button--primary",
          ),
        );
      buttons.push(
        button("できた", {
          "data-action": "practice-self-ok",
          ...(session.revealed ? { "data-practice-focus": true } : {}),
        }),
      );
      buttons.push(button("できなかった", { "data-action": "practice-self-ng" }));
      buttons.push(button("スキップ", { "data-action": "practice-skip" }));
    }
    buttons.push(button("やめる", { "data-action": "practice-quit" }));
    panel.replaceChildren(
      el("h2", { id: "heading-practice", tabindex: "-1" }, `練習: ${session.routeName}`),
      el(
        "p",
        { class: "kii-practice__progress" },
        `手順 ${session.index + 1} / ${session.steps.length}`,
      ),
      el(
        "section",
        { class: "kii-practice__step", "aria-labelledby": "practice-step-title" },
        el("p", { class: "kii-practice__app" }, step.appName),
        el("h3", { id: "practice-step-title", class: "kii-practice__title" }, step.name),
        step.note ? el("p", { class: "kii-item__note" }, step.note) : "",
        keysArea,
        ...body,
        el("p", { class: "kii-practice__feedback", "data-feedback": true }, describeLast(session)),
        el("div", { class: "kii-row" }, ...buttons),
      ),
    );
  }

  // 答えの枠の状態(受け付けているか)。色だけでなく、文字と枠の線でも示す
  function setAnswerState(answer, active) {
    answer.dataset.active = String(active);
    $("[data-state]", answer).textContent = active
      ? "受け付けています"
      : "停止中(この枠を選ぶと、受け付けます)";
  }

  // 練習の枠の、文・進み具合だけを、その場で更新する(枠を作り直さない。フォーカス・読み上げを乱さないため)
  function updatePracticeFeedback() {
    const { session } = state.practice;
    const step = session.steps[session.index];
    $("[data-feedback]").textContent = describeLast(session);
    const prompt = $("[data-prompt]");
    if (prompt) prompt.textContent = promptText(session, step);
  }

  const focusPractice = () => ($("#practice-answer") ?? $("[data-practice-focus]"))?.focus();

  // 押したキーの判定。答えの枠にフォーカスがあるときだけ、ここに届く
  function onPracticeKey(event) {
    if (event.key === "Tab") return; // 移動に使う(判定しない・止めない)
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || MODIFIER_KEY_NAMES.includes(event.key)) return;
    if (isImeEvent(event)) {
      announce("日本語入力(IME)がオンです。オフにして、もう一度押してください。");
      return;
    }
    const chord = chordFromEvent(event);
    if (!chord) {
      announce("このキーは、判定できません。");
      return;
    }
    const result = actions.practicePress(chord);
    announce(result.message);
    if (result.outcome === "step-done" || result.outcome === "finished") {
      renderPractice($('[data-panel="practice"]'));
      if (result.outcome === "finished") $("#heading-practice")?.focus();
      else focusPractice();
    } else if (result.outcome !== "ignored") {
      updatePracticeFeedback();
    }
  }

  function renderPracticeResult(panel, session) {
    const result = summarize(session);
    panel.replaceChildren(
      el("h2", { id: "heading-practice", tabindex: "-1" }, `練習の結果: ${session.routeName}`),
      el(
        "ul",
        { class: "kii-practice__summary" },
        el(
          "li",
          {},
          `${result.total}手順のうち、${result.ok + result.selfOk}手順ができました(間違い・答えを見ることなく、できたのは ${result.clean}手順)。`,
        ),
        el(
          "li",
          {},
          `間違い ${result.misses}回 / 答えを見た手順 ${result.hints} / スキップ ${result.skipped} / 自己確認でできなかった ${result.selfNg}`,
        ),
      ),
      el(
        "div",
        { class: "kii-scroll" },
        el(
          "table",
          { class: "kii-table kii-table--result" },
          el("caption", {}, "手順ごとの結果"),
          el(
            "thead",
            {},
            el(
              "tr",
              {},
              ...["手順", "キー", "答え方", "結果", "間違い", "答えを見た"].map((label) =>
                el("th", { scope: "col" }, label),
              ),
            ),
          ),
          el(
            "tbody",
            {},
            ...result.steps.map((step, index) =>
              el(
                "tr",
                {},
                el("td", {}, `${index + 1}. ${step.appName}: ${step.name}`),
                el("td", {}, el("kbd", { class: "kbd" }, step.keysText)),
                el("td", {}, MODE_LABELS[step.mode === "press" ? "press" : step.selfReason]),
                el("td", {}, RESULT_LABELS[step.result] ?? "(未実施)"),
                el("td", {}, `${step.misses}回`),
                el("td", {}, step.hinted ? "見た" : ""),
              ),
            ),
          ),
        ),
      ),
      el(
        "div",
        { class: "kii-row" },
        button("もう一度", { "data-action": "practice-restart" }, "button button--primary"),
        button("ルートの画面へ", { "data-action": "practice-to-routes" }),
        button("練習の設定へ", { "data-action": "practice-quit" }),
      ),
    );
  }

  // ---- 全体の描画 ----

  const RENDERERS = {
    ops: renderOps,
    routes: renderRoutes,
    practice: renderPractice,
    list: renderList,
    sheet: renderSheet,
    settings: renderSettings,
  };

  function render(next) {
    state = next;
    stopRecording?.();
    renderNotice();
    $("[data-tablist]").hidden = false;
    for (const tab of TABS) {
      const selected = tab === state.tab;
      const tabButton = $(`[data-tab="${tab}"]`);
      tabButton.setAttribute("aria-selected", String(selected));
      tabButton.tabIndex = selected ? 0 : -1;
      $(`[data-panel="${tab}"]`).hidden = !selected;
    }
    RENDERERS[state.tab]($(`[data-panel="${state.tab}"]`));
  }

  // ---- 操作の受け付け ----

  const ask = (title, message, okLabel) => confirmDialog({ title, message, okLabel });

  async function onClick(event) {
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      actions.setTab(tab.dataset.tab);
      return;
    }
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;
    const index = Number(target.dataset.index);
    // 結果を読み上げ、成功したら、フォーカスを移す(要素が作り直されるので、行き先を決めて、移す)
    const done = (result, focus) => {
      announce(result.message);
      if (!result.ok) return;
      if (focus === "heading") focusHeading();
      else if (typeof focus === "function") focus();
    };

    switch (action) {
      case "edit-app":
        actions.editApp(id);
        $("#rename-app-name")?.focus();
        break;
      case "cancel-edit-app":
        actions.editApp(null);
        break;
      case "remove-app": {
        const app = state.data.apps.find((item) => item.id === id);
        const impact = impactOfRemovingApp(state.data, id);
        const detail =
          impact.operations > 0
            ? `このアプリの操作 ${impact.operations}件と、ルートの中のその操作の手順 ${impact.routeSteps}件も、いっしょに削除されます。`
            : "";
        if (
          await ask(
            "アプリを削除しますか?",
            `「${app.name}」を削除します。${detail}元に戻せません。`,
            "削除する",
          )
        )
          done(actions.removeApp(id), "heading");
        break;
      }
      case "record":
        startRecording();
        break;
      case "edit-op":
        actions.editOperation(id);
        $("#op-name")?.focus();
        break;
      case "cancel-edit-op":
        actions.editOperation(null);
        break;
      case "remove-op": {
        const operation = state.data.operations.find((item) => item.id === id);
        const impact = impactOfRemovingOperation(state.data, id);
        const detail =
          impact.routeSteps > 0
            ? `ルートの中のこの操作の手順 ${impact.routeSteps}件も、いっしょに削除されます。`
            : "";
        if (
          await ask(
            "操作を削除しますか?",
            `「${operation.name}」を削除します。${detail}元に戻せません。`,
            "削除する",
          )
        )
          done(actions.removeOperation(id), "heading");
        break;
      }
      case "select-route":
        actions.selectRoute(id);
        $("#route-title")?.focus();
        break;
      case "edit-route":
        actions.editRoute(id);
        $("#edit-route-name")?.focus();
        break;
      case "cancel-edit-route":
        actions.editRoute(null);
        break;
      case "remove-route": {
        const route = state.data.routes.find((item) => item.id === id);
        if (
          await ask(
            "ルートを削除しますか?",
            `「${route.name}」の手順ごと、削除します。元に戻せません。(登録した操作は、残ります。)`,
            "削除する",
          )
        )
          done(actions.removeRoute(id), "heading");
        break;
      }
      case "step-up":
      case "step-down": {
        const delta = action === "step-up" ? -1 : 1;
        const opposite = action === "step-up" ? "step-down" : "step-up";
        // 動かした手順の、同じ向きのボタンに戻す。端に着いて無効になったときは、反対向きのボタンへ
        done(actions.moveStep(state.selectedRouteId, index, delta), () => {
          const moved = index + delta;
          const same = $(`[data-action="${action}"][data-index="${moved}"]`);
          (same && !same.disabled
            ? same
            : $(`[data-action="${opposite}"][data-index="${moved}"]`)
          )?.focus();
        });
        break;
      }
      case "step-remove":
        done(actions.removeStep(state.selectedRouteId, index), () => {
          const after = $(`[data-action="step-remove"][data-index="${Math.max(0, index - 1)}"]`);
          (after ?? $("#step-operation") ?? $("#route-title"))?.focus();
        });
        break;
      case "practice-start-route": {
        const result = actions.startPractice({ routeId: id });
        announce(result.message);
        if (result.ok) focusPractice();
        break;
      }
      case "practice-reveal":
      case "practice-skip":
      case "practice-mark":
      case "practice-self-ok":
      case "practice-self-ng":
      case "practice-restart": {
        const method = {
          "practice-reveal": "practiceReveal",
          "practice-skip": "practiceSkip",
          "practice-mark": "practiceMark",
          "practice-self-ok": "practiceSelfOk",
          "practice-self-ng": "practiceSelfNg",
          "practice-restart": "practiceRestart",
        }[action];
        const result = actions[method]();
        announce(result.message);
        const { session } = state.practice;
        if (!result.ok || !session || session.status === "finished")
          $("#heading-practice")?.focus();
        else focusPractice();
        break;
      }
      case "practice-quit":
        announce(actions.practiceQuit().message);
        $("#heading-practice")?.focus();
        break;
      case "practice-to-routes":
        actions.setTab("routes");
        focusHeading();
        break;
      case "print":
        window.print();
        break;
      case "copy-md": {
        const markdown = $("[data-markdown]").value;
        try {
          await navigator.clipboard.writeText(markdown);
          announce("Markdown をコピーしました。");
        } catch {
          const details = $("[data-markdown]").closest("details");
          details.open = true;
          $("[data-markdown]").select();
          announce("コピーできませんでした。下の欄を開いたので、選んでコピーしてください。");
        }
        break;
      }
      case "save-md":
        actions.download(
          `kii-michi-cheatsheet-${today().replaceAll("-", "")}.md`,
          $("[data-markdown]").value,
          "text/markdown;charset=utf-8",
        );
        announce("Markdown ファイルを保存しました。");
        break;
      case "export": {
        const result = actions.exportData();
        if (!result.ok) showError($("[data-panel=settings]"), null, result.message);
        announce(result.ok ? "JSON ファイルに書き出しました。" : result.message);
        break;
      }
      case "delete-all":
        if (
          await ask(
            "すべてのデータを削除しますか?",
            "このブラウザに保存されている、アプリ・操作・ルートを、すべて削除します。元に戻せません。先に、書き出しておくと安心です。",
            "すべて削除する",
          )
        )
          done(actions.deleteAll(), "heading");
        break;
      default:
    }
  }

  function onSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const value = (name) => form.elements[name]?.value ?? "";
    const fail = (result, fieldName) => showError(form, fieldName, result.message);
    switch (form.dataset.form) {
      case "add-app": {
        const result = actions.addApp(value("name"));
        if (!result.ok) return fail(result, "name");
        announce(result.message);
        $("#app-name")?.focus();
        break;
      }
      case "rename-app": {
        const result = actions.renameApp(form.dataset.id, value("name"));
        if (!result.ok) return fail(result, "name");
        announce(result.message);
        $(`[data-action="edit-app"][data-id="${form.dataset.id}"]`)?.focus();
        break;
      }
      case "operation": {
        const editingId = form.dataset.id;
        const fields = {
          appId: value("appId"),
          name: value("name"),
          keysText: value("keys"),
          note: value("note"),
        };
        const result = editingId
          ? actions.updateOperation(editingId, fields)
          : actions.addOperation(fields);
        if (!result.ok)
          return fail(
            result,
            result.error === "keys-invalid"
              ? "keys"
              : result.error === "app-not-found"
                ? "appId"
                : "name",
          );
        announce(result.message);
        if (editingId) $(`[data-action="edit-op"][data-id="${editingId}"]`)?.focus();
        else $("#op-name")?.focus();
        break;
      }
      case "add-route": {
        const result = actions.addRoute({ name: value("name"), note: value("note") });
        if (!result.ok) return fail(result, "name");
        announce(result.message);
        $("#route-title")?.focus();
        break;
      }
      case "edit-route": {
        const result = actions.updateRoute(form.dataset.id, {
          name: value("name"),
          note: value("note"),
        });
        if (!result.ok) return fail(result, "name");
        announce(result.message);
        $(`[data-action="edit-route"][data-id="${form.dataset.id}"]`)?.focus();
        break;
      }
      case "practice-start": {
        const result = actions.startPractice({
          routeId: value("routeId"),
          method: value("method") || "press",
          showKeys: Boolean(form.elements.showKeys?.checked),
        });
        if (!result.ok) return fail(result, "routeId");
        announce(result.message);
        focusPractice();
        break;
      }
      case "add-step": {
        const result = actions.addStep(form.dataset.id, value("operationId"));
        if (!result.ok) return fail(result, "operationId");
        announce(result.message);
        $("#step-operation")?.focus();
        break;
      }
      default:
    }
  }

  function onInput(event) {
    if (event.target.id === "op-keys") updatePreview();
    // 入力し直したら、その入力欄の間違いの表示は消す
    if (event.target.getAttribute?.("aria-invalid") === "true") {
      event.target.removeAttribute("aria-invalid");
      const error = $("[data-error]", event.target.closest("form") ?? root);
      if (error) error.hidden = true;
    }
  }

  async function onChange(event) {
    const target = event.target;
    if (target.dataset?.practiceSetting) {
      // 練習の設定は、画面を作り直さずに、覚えるだけ(選んでいる場所を乱さない)
      const name = target.dataset.practiceSetting;
      actions.setPracticeSettings({ [name]: name === "showKeys" ? target.checked : target.value });
      return;
    }
    if (target.dataset?.option === "os") {
      announce(actions.setOs(target.value).message);
      $('[data-option="os"]:checked')?.focus();
    } else if (target.dataset?.option === "routes" || target.dataset?.option === "list") {
      actions.setSheetOption(
        target.dataset.option === "routes" ? "includeRoutes" : "includeList",
        target.checked,
      );
      $(`[data-option="${target.dataset.option}"]`)?.focus();
    } else if (target.dataset?.import !== undefined) {
      const [file] = target.files;
      target.value = "";
      if (!file) return;
      const error = $("[data-panel=settings] [data-error]");
      const show = (message) => {
        error.textContent = message;
        error.hidden = false;
        announce(message);
      };
      error.hidden = true;
      if (file.size > 1_000_000) return show("ファイルが大きすぎます(1MBまでです)。");
      const text = await file.text();
      const ok = await ask(
        "読み込んで置き換えますか?",
        `「${file.name}」を読み込みます。いまのデータは、読み込んだ内容に置き換わります。先に書き出しておくと安心です。`,
        "置き換える",
      );
      if (!ok) return;
      const result = actions.importData(text);
      if (!result.ok) return show(result.message);
      announce(result.message);
      focusHeading();
    }
  }

  // タブの矢印キー・Home・End での移動
  function onKeydown(event) {
    const current = event.target.closest?.("[data-tab]");
    if (!current) return;
    const at = TABS.indexOf(current.dataset.tab);
    const next = {
      ArrowRight: (at + 1) % TABS.length,
      ArrowLeft: (at + TABS.length - 1) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    actions.setTab(TABS[next]);
    $(`[data-tab="${TABS[next]}"]`).focus();
  }

  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("keydown", onKeydown);

  return { render, announce };
}

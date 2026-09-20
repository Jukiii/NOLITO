// キーみち: チートシート(画面・印刷・Markdown の元になるデータと、Markdown の文字列)。DOM に依存しない。
// 画面と Markdown は、同じ sheetModel から作る(内容が食い違わないように)。
import { formatKeys } from "./keys.js";
import { operationsByApp, resolveRoute } from "./model.js";

/**
 * チートシートの内容。os はキーの表記。includeRoutes / includeList で、載せるものを選ぶ。
 * routes: [{ name, note, steps: [{ app, name, keys, note }] }]
 * apps:   [{ name, operations: [{ name, keys, note }] }]   操作のないアプリは載せない
 */
export function sheetModel(
  data,
  { os = "windows", includeRoutes = true, includeList = true } = {},
) {
  const routes = includeRoutes
    ? data.routes.map((route) => ({
        name: route.name,
        note: route.note,
        steps: resolveRoute(data, route).map(({ app, operation }) => ({
          app: app.name,
          name: operation.name,
          keys: formatKeys(operation.keys, os),
          note: operation.note,
        })),
      }))
    : [];
  const apps = includeList
    ? operationsByApp(data)
        .filter(({ operations }) => operations.length > 0)
        .map(({ app, operations }) => ({
          name: app.name,
          operations: operations.map((operation) => ({
            name: operation.name,
            keys: formatKeys(operation.keys, os),
            note: operation.note,
          })),
        }))
    : [];
  return { os, includeRoutes, includeList, routes, apps };
}

// ---- Markdown ----

// Markdown として意味を持つ文字を、バックスラッシュで打ち消す。改行は空白にする(1行に収める)。
// 利用者が入力した名前・メモが、見出しや表・リンク・HTML として読まれないようにする。
// 打ち消すのは、文の途中でも意味を持つ文字(強調・リンク・HTML・表・コード・実体参照)だけ。
// # - + > = や「1.」は、行頭のときだけ意味を持つので、行頭(lineStart)のときだけ打ち消す。
export function escapeMarkdown(text, { lineStart = false } = {}) {
  const escaped = String(text)
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\`*_[\]<>|~&]/g, (char) => `\\${char}`)
    .trim();
  if (!lineStart) return escaped;
  // 「1.」「1)」は、番号のあとの記号を打ち消す(1\.)。それ以外は、行頭の記号を打ち消す
  return escaped.replace(/^(\d+)([.)])/, "$1\\$2").replace(/^([#>+\-=])/, "\\$1");
}

// `キー` の形(コードとして表示)。キー自体にバッククォートを含むとき(Ctrl+`)は、囲みを長くする。
export function codeSpan(text) {
  const runs = String(text).match(/`+/g) ?? [];
  const fence = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  const pad = String(text).startsWith("`") || String(text).endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

const OS_NAMES = { windows: "Windows", mac: "macOS" };

/** Markdown の文字列。date は「2026-09-20」の形(作成日。なければ書かない)。 */
export function toMarkdown(model, { date } = {}) {
  const lines = ["# キーみち チートシート", ""];
  const meta = [
    date ? `作成日: ${date}` : "",
    `キーの表記: ${OS_NAMES[model.os] ?? model.os}`,
  ].filter(Boolean);
  lines.push(meta.join(" / "), "");

  if (model.includeRoutes) {
    lines.push("## 操作ルート", "");
    if (model.routes.length === 0) lines.push("ルートは、まだありません。", "");
    for (const route of model.routes) {
      lines.push(`### ${escapeMarkdown(route.name)}`, "");
      if (route.note) lines.push(escapeMarkdown(route.note, { lineStart: true }), "");
      if (route.steps.length === 0) lines.push("手順は、まだありません。", "");
      route.steps.forEach((step, index) => {
        const note = step.note ? `(${escapeMarkdown(step.note)})` : "";
        lines.push(
          `${index + 1}. ${escapeMarkdown(step.app)}: ${escapeMarkdown(step.name)} — ${codeSpan(step.keys)}${note}`,
        );
      });
      if (route.steps.length > 0) lines.push("");
    }
  }

  if (model.includeList) {
    lines.push("## アプリ別のショートカット", "");
    if (model.apps.length === 0) lines.push("登録された操作は、まだありません。", "");
    for (const app of model.apps) {
      lines.push(
        `### ${escapeMarkdown(app.name)}`,
        "",
        "| 操作 | キー | メモ |",
        "| --- | --- | --- |",
      );
      for (const operation of app.operations) {
        lines.push(
          `| ${escapeMarkdown(operation.name)} | ${codeSpan(operation.keys).replace(/\|/g, "\\|")} | ${escapeMarkdown(operation.note)} |`,
        );
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

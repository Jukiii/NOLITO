// 用語の一覧の 1 件の描画(語・読み・説明。職種・ミスした回数があれば、それも)。
// 結果の画面(view.js)と、成績ページの復習リスト(stats-page.js)で共通。
// 語録の文字列は、すべて el()(textContent 相当)で入れる。HTML として解釈しない。
import { el } from "../../components/dom.js";

export function reviewItem({ word, misses, jobName }) {
  return el(
    "li",
    { class: "review-item" },
    el(
      "p",
      { class: "review-item__term" },
      el("span", { class: "review-item__japanese", lang: "ja" }, word.japanese),
      el("span", { class: "review-item__reading", lang: "ja" }, `(${word.reading})`),
      jobName ? el("span", { class: "badge" }, jobName) : "",
      misses ? el("span", { class: "badge badge--soon" }, `ミス ${misses}回`) : "",
    ),
    el("p", { class: "review-item__text", lang: "ja" }, word.explanation),
  );
}

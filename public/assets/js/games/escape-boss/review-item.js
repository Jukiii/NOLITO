// 用語の一覧の 1 件の描画(語・読み・説明。職種・ミスした回数があれば、それも)。
// 結果の画面(view.js)・用語確認の結果・成績ページの復習リスト(stats-page.js)で共通。
// 短い説明(explanation)は、いつも出す。関連する語は、説明の下に出す。難語の詳細説明(detail)と学習ポイントは、
// 「くわしく」(開閉できる部品)の中に入れる(ない語には、出さない)。
// 語録の文字列は、すべて el()(textContent 相当)で入れる。HTML として解釈しない。
import { el } from "../../components/dom.js";

const isText = (value) => typeof value === "string" && value.trim() !== "";

/**
 * 語録の項目から、追加で出す内容を取り出す。文字列でないもの・空の文字列は、捨てる(語録が壊れても、落ちない)。
 * 戻り値: { related: 関連する語の一覧, detail: 詳細説明(なければ ""), points: 学習ポイントの一覧 }
 */
export function extraOf(word) {
  const list = (value) => (Array.isArray(value) ? value.filter(isText) : []);
  return {
    related: list(word?.related_terms),
    detail: isText(word?.detail) ? word.detail : "",
    points: list(word?.learning_points),
  };
}

export function reviewItem({ word, misses, jobName }) {
  const { related, detail, points } = extraOf(word);
  const hasMore = detail !== "" || points.length > 0;
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
    related.length > 0
      ? el("p", { class: "review-item__related", lang: "ja" }, `関連する語: ${related.join("、")}`)
      : "",
    hasMore
      ? el(
          "details",
          { class: "review-item__more" },
          el("summary", {}, "くわしく"),
          detail ? el("p", { class: "review-item__detail", lang: "ja" }, detail) : "",
          points.length > 0
            ? el(
                "div",
                { class: "review-item__points" },
                el("p", { class: "review-item__points-title" }, "学習のポイント"),
                el("ul", { lang: "ja" }, ...points.map((point) => el("li", {}, point))),
              )
            : "",
        )
      : "",
  );
}

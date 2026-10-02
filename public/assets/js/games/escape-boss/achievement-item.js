import { el } from "../../components/dom.js";

// 実績の 1 件の描画。結果の画面の「新しい実績」と、プレイヤーのページの一覧で共通。文字は el()(textContent 相当)だけ。
// 隠し実績(definition.hidden)は、解放するまで、名前・説明・称号を明かさない(条件のネタバレを防ぐ)
export const HIDDEN_NAME = "??? (隠し実績)";
export const HIDDEN_TEXT = "まだ見つかっていません。条件を満たすと、内容が明らかになります。";

const formatDate = (ms) => new Date(ms).toLocaleDateString("ja-JP");

export function achievementItem(definition, unlockedAt) {
  const unlocked = unlockedAt !== undefined;
  const masked = Boolean(definition.hidden) && !unlocked;
  const showMeta = unlocked || (Boolean(definition.title) && !masked);
  return el(
    "li",
    { class: `achievement ${unlocked ? "is-unlocked" : "is-locked"}` },
    el(
      "p",
      { class: "achievement__name" },
      masked ? HIDDEN_NAME : definition.name,
      el(
        "span",
        { class: `badge ${unlocked ? "badge--live" : "badge--soon"}` },
        unlocked ? "解放済み" : "未解放",
      ),
    ),
    el("p", { class: "achievement__text" }, masked ? HIDDEN_TEXT : definition.description),
    showMeta
      ? el(
          "p",
          { class: "achievement__meta" },
          [
            !masked && definition.title ? `称号「${definition.title}」` : "",
            unlocked ? formatDate(unlockedAt) : "",
          ]
            .filter(Boolean)
            .join(" ・ "),
        )
      : "",
  );
}

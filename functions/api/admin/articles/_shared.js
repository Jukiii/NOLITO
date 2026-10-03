// index.js・[id].js で共通に使う小さな部品(Issue #195)。_ で始まるファイルは、ルーティングされない。
// 検証は、原稿のビルド(scripts/lib/build.mjs)と同じ規則: 先頭情報は article-fields.mjs、本文は markdown.mjs(安全な変換)。
import { siteOrigin } from "../../../_lib/config.js";
import { validateArticle } from "../../../../scripts/lib/article-fields.mjs";
import { renderMarkdown } from "../../../../scripts/lib/markdown.mjs";

export const MAX_ARTICLE_BYTES = 200_000;
export const MAX_BODY_CHARS = 50_000;

export const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const lines = (error) => error.message.split("\n");

/**
 * 記事1件(先頭情報 + body)を検証して、正規化した値を返す。
 * 戻り値: { article }(問題なし)か { errors: [文...] }。
 * slug は、URL の識別子。本文は、公開と同じ安全な変換に通して、危険なリンク・alt のない画像・見出し1を弾く。
 */
export function validateArticleInput(value, env) {
  if (!isPlainObject(value)) return { errors: ["記事の内容がオブジェクトではありません"] };
  const { slug, body, ...front } = value;
  const errors = [];
  if (front.updated === null || front.updated === "") delete front.updated;

  let meta = null;
  try {
    meta = validateArticle(front, typeof slug === "string" ? slug : "");
  } catch (error) {
    errors.push(...lines(error));
  }

  if (typeof body !== "string" || body.trim() === "") {
    errors.push("body(本文)は必須です");
  } else if (body.length > MAX_BODY_CHARS) {
    errors.push(`body は${MAX_BODY_CHARS}文字までです(現在${body.length}文字)`);
  } else {
    try {
      const origin = siteOrigin(env);
      renderMarkdown(body, { siteHost: origin ? new URL(origin).hostname : "" });
    } catch (error) {
      errors.push(...lines(error));
    }
  }
  if (errors.length > 0) return { errors };
  return { article: { ...meta, body } };
}

/** 監査ログに残す形。本文は(長く、監査ログの上限を超えるため)文字数だけにする。 */
export const auditView = (article) =>
  article === null
    ? null
    : {
        slug: article.slug,
        title: article.title,
        description: article.description,
        date: article.date,
        updated: article.updated,
        tags: article.tags,
        draft: article.draft,
        bodyChars: article.body.length,
      };

// POST /api/admin/article-preview — 記事の本文(Markdown)の、プレビュー(Issue #195 PR 2。管理者だけ)。
// 公開と同じ安全な変換(renderArticleBody)の結果を返すだけで、何も保存しない・監査ログにも残さない。
//   body: { body: "<Markdown>" } → 200 { html } / 400 invalid-article + details
import { requireAdmin } from "../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../_lib/http.js";
import { MAX_ARTICLE_BYTES, isPlainObject, renderArticleBody } from "./articles/_shared.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;

  const body = await readJson(request, { maxBytes: MAX_ARTICLE_BYTES });
  if (!body.ok) return error(400, body.error);
  if (!isPlainObject(body.value)) return error(400, "invalid-article");

  const result = renderArticleBody(body.value.body, env);
  if (result.errors) return error(400, "invalid-article", { details: result.errors });
  return json({ html: result.html });
}

export const onRequest = () => methodNotAllowed(["POST"]);

// GET/PUT/DELETE /api/admin/articles/:id — 1件の取得・更新・削除(Issue #195。管理者だけ。:id は記事のスラッグ)。
//   GET    … 1件({ article }。本文つき。なければ 404)
//   PUT    … 更新。body は { article }(slug は URL と同じであること)
//   DELETE … 削除。取り消せない操作のため、直近のログインを求める(Phase 27 PR 2。recent: true)
// 変更は、監査ログ(admin_audit_log)に記録する(本文は文字数だけ)。
import { deleteArticle, getArticle, updateArticle } from "../../../_lib/articles-db.js";
import { recordAdminChange } from "../../../_lib/admin-audit.js";
import { requireAdmin } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import { MAX_ARTICLE_BYTES, auditView, isPlainObject, validateArticleInput } from "./_shared.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;
  const article = await getArticle(context.env.DB, context.params.id);
  if (!article) return error(404, "article-not-found");
  return json({ article });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const before = await getArticle(env.DB, params.id);
  if (!before) return error(404, "article-not-found");

  const body = await readJson(request, { maxBytes: MAX_ARTICLE_BYTES });
  if (!body.ok) return error(400, body.error);
  if (!isPlainObject(body.value.article)) return error(400, "invalid-article");
  if (body.value.article.slug !== params.id) return error(400, "article-slug-mismatch");

  const result = validateArticleInput(body.value.article, env);
  if (result.errors) return error(400, "invalid-article", { details: result.errors });
  const { article } = result;

  await updateArticle(env.DB, article, now);
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "article",
    resourceId: params.id,
    action: "update",
    before: auditView(before),
    after: auditView(article),
    now,
  });
  return json({ article });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const auth = await requireAdmin(context, { write: true, recent: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const before = await getArticle(env.DB, params.id);
  if (!before) return error(404, "article-not-found");

  await deleteArticle(env.DB, params.id);
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "article",
    resourceId: params.id,
    action: "delete",
    before: auditView(before),
    after: null,
    now,
  });
  return json({ ok: true });
}

export const onRequest = () => methodNotAllowed(["GET", "PUT", "DELETE"]);

// GET/POST /api/admin/articles — 記事の一覧・新規作成(Issue #195。管理者だけ)。
//   GET  … 一覧({ articles: [...] }。本文は含めない。下書きも含む。新しい順)
//   POST … 新規作成。body は { article }(article-fields.mjs・markdown.mjs と同じ規則で検証)
// 変更は、監査ログ(admin_audit_log)に記録する(本文は文字数だけ)。
import { getArticle, insertArticle, listArticles } from "../../../_lib/articles-db.js";
import { recordAdminChange } from "../../../_lib/admin-audit.js";
import { requireAdmin } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import { MAX_ARTICLE_BYTES, auditView, isPlainObject, validateArticleInput } from "./_shared.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;
  return json({ articles: await listArticles(context.env.DB) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const body = await readJson(request, { maxBytes: MAX_ARTICLE_BYTES });
  if (!body.ok) return error(400, body.error);
  if (!isPlainObject(body.value.article)) return error(400, "invalid-article");

  const result = validateArticleInput(body.value.article, env);
  if (result.errors) return error(400, "invalid-article", { details: result.errors });
  const { article } = result;
  if (await getArticle(env.DB, article.slug)) return error(409, "article-slug-exists");

  await insertArticle(env.DB, article, now);
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "article",
    resourceId: article.slug,
    action: "create",
    before: null,
    after: auditView(article),
    now,
  });
  return json({ article }, { status: 201 });
}

export const onRequest = () => methodNotAllowed(["GET", "POST"]);

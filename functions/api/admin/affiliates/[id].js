// GET/PUT/DELETE /api/admin/affiliates/:id — 1件の取得・更新・削除(Phase 29 PR 3。管理者だけ)。
//   GET    … 1件({ link }。なければ 404)
//   PUT    … 更新。body は { link }(id は URL と同じであること。affiliates/schema.js で検証)
//   DELETE … 削除。取り消せない操作のため、直近のログインを求める(Phase 27 PR 2。recent: true)
// 変更は、監査ログ(admin_audit_log)に、変更前後の内容ごと記録する。
import {
  deleteAffiliateLink,
  getAffiliateLink,
  listAffiliateLinks,
  updateAffiliateLinkData,
} from "../../../_lib/affiliates-db.js";
import { recordAdminChange } from "../../../_lib/admin-audit.js";
import { requireAdmin } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import { MAX_AFFILIATE_BYTES, isPlainObject, validateLinks } from "./_shared.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;
  const link = await getAffiliateLink(context.env.DB, context.params.id);
  if (!link) return error(404, "affiliate-not-found");
  return json({ link });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const before = await getAffiliateLink(env.DB, params.id);
  if (!before) return error(404, "affiliate-not-found");

  const body = await readJson(request, { maxBytes: MAX_AFFILIATE_BYTES });
  if (!body.ok) return error(400, body.error);
  const link = body.value.link;
  if (!isPlainObject(link)) return error(400, "invalid-affiliate");
  if (link.id !== params.id) return error(400, "affiliate-id-mismatch");

  const existing = await listAffiliateLinks(env.DB);
  const errors = validateLinks(existing.map((item) => (item.id === params.id ? link : item)));
  if (errors.length > 0) return error(400, "invalid-affiliate", { details: errors });

  await updateAffiliateLinkData(env.DB, { id: params.id, data: link, now });
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "affiliate",
    resourceId: params.id,
    action: "update",
    before,
    after: link,
    now,
  });
  return json({ link });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const auth = await requireAdmin(context, { write: true, recent: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const before = await getAffiliateLink(env.DB, params.id);
  if (!before) return error(404, "affiliate-not-found");

  await deleteAffiliateLink(env.DB, params.id);
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "affiliate",
    resourceId: params.id,
    action: "delete",
    before,
    after: null,
    now,
  });
  return json({ ok: true });
}

export const onRequest = () => methodNotAllowed(["GET", "PUT", "DELETE"]);

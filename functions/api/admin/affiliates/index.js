// GET/POST /api/admin/affiliates — リンクの一覧・新規作成(Phase 29 PR 3。管理者だけ)。
//   GET  … 一覧({ links: [...] }。並び順=sort_order)
//   POST … 新規作成。body は { link }(affiliates/schema.js で検証)
// 変更は、監査ログ(admin_audit_log)に、変更前後の内容ごと記録する。
import {
  insertAffiliateLink,
  listAffiliateLinks,
  nextAffiliateSortOrder,
} from "../../../_lib/affiliates-db.js";
import { recordAdminChange } from "../../../_lib/admin-audit.js";
import { requireAdmin } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import { MAX_AFFILIATE_BYTES, isPlainObject, validateLinks } from "./_shared.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;
  return json({ links: await listAffiliateLinks(context.env.DB) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const body = await readJson(request, { maxBytes: MAX_AFFILIATE_BYTES });
  if (!body.ok) return error(400, body.error);
  const link = body.value.link;
  if (!isPlainObject(link)) return error(400, "invalid-affiliate");

  const existing = await listAffiliateLinks(env.DB);
  if (existing.some((item) => item.id === link.id)) return error(409, "affiliate-id-exists");
  const errors = validateLinks([...existing, link]);
  if (errors.length > 0) return error(400, "invalid-affiliate", { details: errors });

  await insertAffiliateLink(env.DB, {
    id: link.id,
    data: link,
    sortOrder: await nextAffiliateSortOrder(env.DB),
    now,
  });
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "affiliate",
    resourceId: link.id,
    action: "create",
    before: null,
    after: link,
    now,
  });
  return json({ link }, { status: 201 });
}

export const onRequest = () => methodNotAllowed(["GET", "POST"]);

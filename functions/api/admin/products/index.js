// GET/POST /api/admin/products — プロダクトの一覧・新規作成(Phase 26 PR 2b。管理者だけ)。
//   GET  … 一覧({ products: [...] }。公開の一覧と同じ内容。並び順=sort_order)
//   POST … 新規作成。body は { product }(schema.js の validateProduct/validateProducts で検証)
// 変更は、監査ログ(admin_audit_log)に、変更前後の内容ごと記録する。
import { recordAdminChange } from "../../../_lib/admin-audit.js";
import { requireAdmin } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import { listProducts, nextSortOrder, upsertProduct } from "../../../_lib/products-db.js";
import {
  PRODUCT_DATA_VERSION,
  validateProducts,
} from "../../../../public/assets/js/products/schema.js";
import { MAX_PRODUCT_BYTES, loadCategories } from "./_shared.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;
  const products = await listProducts(context.env.DB);
  return json({ products });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const body = await readJson(request, { maxBytes: MAX_PRODUCT_BYTES });
  if (!body.ok) return error(400, body.error);
  const product = body.value.product;
  if (typeof product !== "object" || product === null || Array.isArray(product)) {
    return error(400, "invalid-product");
  }

  const categories = await loadCategories(request, env);
  const existing = await listProducts(env.DB);
  if (existing.some((item) => item.id === product.id)) {
    return error(409, "product-id-exists");
  }
  const errors = validateProducts(
    { version: PRODUCT_DATA_VERSION, products: [...existing, product] },
    categories,
  );
  if (errors.length > 0) return error(400, "invalid-product", { details: errors });

  const sortOrder = await nextSortOrder(env.DB);
  await upsertProduct(env.DB, { id: product.id, data: product, sortOrder, now });
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "product",
    resourceId: product.id,
    action: "create",
    before: null,
    after: product,
    now,
  });
  return json({ product }, { status: 201 });
}

export const onRequest = () => methodNotAllowed(["GET", "POST"]);

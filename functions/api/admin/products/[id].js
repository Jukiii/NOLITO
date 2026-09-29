// GET/PUT/DELETE /api/admin/products/:id — 1件の取得・更新・削除(Phase 26 PR 2b。管理者だけ)。
//   GET    … 1件({ product }。なければ 404)
//   PUT    … 更新。body は { product }(id は URL と同じであること。schema.js で検証)
//   DELETE … 削除
// 変更は、監査ログ(admin_audit_log)に、変更前後の内容ごと記録する。
import { recordAdminChange } from "../../../_lib/admin-audit.js";
import { requireAdmin } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import {
  deleteProduct,
  getProduct,
  listProducts,
  updateProductData,
} from "../../../_lib/products-db.js";
import {
  PRODUCT_DATA_VERSION,
  validateProducts,
} from "../../../../public/assets/js/products/schema.js";
import { MAX_PRODUCT_BYTES, loadCategories } from "./_shared.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;
  const product = await getProduct(context.env.DB, context.params.id);
  if (!product) return error(404, "product-not-found");
  return json({ product });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const before = await getProduct(env.DB, params.id);
  if (!before) return error(404, "product-not-found");

  const body = await readJson(request, { maxBytes: MAX_PRODUCT_BYTES });
  if (!body.ok) return error(400, body.error);
  const product = body.value.product;
  if (typeof product !== "object" || product === null || Array.isArray(product)) {
    return error(400, "invalid-product");
  }
  if (product.id !== params.id) return error(400, "product-id-mismatch");

  const categories = await loadCategories(request, env);
  const existing = await listProducts(env.DB);
  const next = existing.map((item) => (item.id === params.id ? product : item));
  const errors = validateProducts({ version: PRODUCT_DATA_VERSION, products: next }, categories);
  if (errors.length > 0) return error(400, "invalid-product", { details: errors });

  await updateProductData(env.DB, { id: params.id, data: product, now });
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "product",
    resourceId: params.id,
    action: "update",
    before,
    after: product,
    now,
  });
  return json({ product });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const auth = await requireAdmin(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const before = await getProduct(env.DB, params.id);
  if (!before) return error(404, "product-not-found");

  await deleteProduct(env.DB, params.id);
  await recordAdminChange(env.DB, {
    userId: user.id,
    resourceType: "product",
    resourceId: params.id,
    action: "delete",
    before,
    after: null,
    now,
  });
  return json({ ok: true });
}

export const onRequest = () => methodNotAllowed(["GET", "PUT", "DELETE"]);

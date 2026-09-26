// プロダクト(products.json)の D1 での保存(Phase 26 PR 2)。1行 = 1プロダクト(JSON全体を data に持つ)。
// 公開の一覧(functions/api/products.js)は、ここから組み立てる。管理画面のAPI(次のPR)も、ここを使う。
import { PRODUCT_DATA_VERSION } from "../../public/assets/js/products/schema.js";

/** すべてのプロダクト(sort_order の順)。 */
export async function listProducts(db) {
  const { results } = await db.prepare("SELECT data FROM products ORDER BY sort_order ASC").all();
  return results.map((row) => JSON.parse(row.data));
}

/** 1件(なければ null)。 */
export async function getProduct(db, id) {
  const row = await db.prepare("SELECT data FROM products WHERE id = ?").bind(id).first();
  return row ? JSON.parse(row.data) : null;
}

/** 次に使う sort_order(末尾に追加するとき)。 */
export async function nextSortOrder(db) {
  const row = await db.prepare("SELECT MAX(sort_order) AS max FROM products").first();
  return (Number.isInteger(row?.max) ? row.max : -1) + 1;
}

/** 追加・更新(id が既にあれば、内容だけ差し替える。sort_order は変えない)。 */
export async function upsertProduct(db, { id, data, sortOrder, now }) {
  await db
    .prepare(
      `INSERT INTO products (id, sort_order, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(id, sortOrder, JSON.stringify(data), now)
    .run();
}

export async function deleteProduct(db, id) {
  await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
}

/** 公開の一覧の形({ version, products })。 */
export async function assembleProductsJson(db) {
  return { version: PRODUCT_DATA_VERSION, products: await listProducts(db) };
}

// アフィリエイト・広告のリンク情報(affiliates.json)の D1 での保存(Phase 29 PR 3)。
// 1行 = 1リンク(JSON全体を data に持つ)。公開の一覧(functions/api/affiliates.js)と、管理画面のAPIが使う。
import { AFFILIATE_DATA_VERSION } from "../../public/assets/js/affiliates/schema.js";

/** すべてのリンク(sort_order の順)。 */
export async function listAffiliateLinks(db) {
  const { results } = await db
    .prepare("SELECT data FROM affiliate_links ORDER BY sort_order ASC")
    .all();
  return results.map((row) => JSON.parse(row.data));
}

/** 1件(なければ null)。 */
export async function getAffiliateLink(db, id) {
  const row = await db.prepare("SELECT data FROM affiliate_links WHERE id = ?").bind(id).first();
  return row ? JSON.parse(row.data) : null;
}

/** 次に使う sort_order(末尾に追加するとき)。 */
export async function nextAffiliateSortOrder(db) {
  const row = await db.prepare("SELECT MAX(sort_order) AS max FROM affiliate_links").first();
  return (Number.isInteger(row?.max) ? row.max : -1) + 1;
}

export async function insertAffiliateLink(db, { id, data, sortOrder, now }) {
  await db
    .prepare("INSERT INTO affiliate_links (id, sort_order, data, updated_at) VALUES (?, ?, ?, ?)")
    .bind(id, sortOrder, JSON.stringify(data), now)
    .run();
}

/** 既存の1件の内容だけを差し替える(sort_order は変えない)。存在しなければ、何もしない。 */
export async function updateAffiliateLinkData(db, { id, data, now }) {
  await db
    .prepare("UPDATE affiliate_links SET data = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(data), now, id)
    .run();
}

export async function deleteAffiliateLink(db, id) {
  await db.prepare("DELETE FROM affiliate_links WHERE id = ?").bind(id).run();
}

/** 公開の一覧の形({ version, links })。 */
export async function assembleAffiliatesJson(db) {
  return { version: AFFILIATE_DATA_VERSION, links: await listAffiliateLinks(db) };
}

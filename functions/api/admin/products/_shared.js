// index.js・[id].js で共通に使う小さな部品(Phase 26 PR 2b)。
// このフォルダの中だけで使う(_ で始まるファイルは、ルーティングされない。functions/_lib と同じ考え方)。

export const MAX_PRODUCT_BYTES = 50_000;

/** カテゴリ一覧(検証に使う)。ASSETS がない・失敗したときは、空(検証で category エラーになるだけで、落ちない)。 */
export async function loadCategories(request, env) {
  if (!env.ASSETS) return [];
  const response = await env.ASSETS.fetch(new URL("/data/categories.json", request.url));
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data?.categories) ? data.categories : [];
}

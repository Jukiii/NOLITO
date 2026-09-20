// 問い合わせ API の呼び出し(DOM に依存しない。fetch を差し替えられる)。
// 状態を変える呼び出し(POST)には、同じサイトの Origin(ブラウザが付ける)と、独自ヘッダー X-NOLITO-CSRF を付ける。
import { usableProducts } from "../products/schema.js";
import { NETWORK_ERROR, contactErrorMessage } from "./messages.js";

/** フォームが使えるか。取得に失敗したときは、使えない(false)として扱う。 */
export async function fetchContactEnabled(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl("/api/contact", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return false;
    return (await response.json())?.enabled === true;
  } catch {
    return false;
  }
}

/** { ok: true } か、{ ok: false, code, message }。例外は投げない。 */
export async function sendInquiry(payload, fetchImpl = globalThis.fetch) {
  let response;
  try {
    response = await fetchImpl("/api/contact", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-NOLITO-CSRF": "1",
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, code: "network", message: NETWORK_ERROR };
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // JSON でない応答は、失敗として扱う
  }
  if (response.ok && data?.ok === true) return { ok: true };
  const code = typeof data?.error === "string" ? data.error : "unknown";
  return { ok: false, code, message: contactErrorMessage(code) };
}

/** 対象のプロダクトの選択肢(公開の products.json から。準備中のものは、除く)。取れなければ、空。 */
export async function fetchProductOptions(fetchImpl = globalThis.fetch) {
  try {
    const [productData, categoryData] = await Promise.all(
      ["/data/products.json", "/data/categories.json"].map(async (url) => {
        const response = await fetchImpl(url);
        if (!response.ok) throw new Error(url);
        return response.json();
      }),
    );
    return usableProducts(productData, categoryData.categories)
      .products.filter((product) => product.status !== "coming-soon")
      .map((product) => ({ id: product.id, title: product.title, version: product.version }));
  } catch {
    return [];
  }
}

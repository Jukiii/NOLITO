// ヘッダーの「アカウント」のアイコン(Issue #173・決定 docs/decisions/0089-header-account-icon.md)。
// ログイン中かどうかで見た目と読み上げが変わり、どちらも /account/ へ行く。
// ログインの状態は /api/me(fetchMe)で、その場で確かめる。端末(LocalStorage など)には、何も置かない。
import { fetchMe } from "../account/client.js";
import { el } from "./dom.js";

export const ACCOUNT_PATH = "/account/";

// 状態: loading(確認中。場所だけ確保して見せない)/ signed-out / signed-in / unavailable(アカウント機能がない環境。隠す)
export const ACCOUNT_LABELS = Object.freeze({
  "signed-out": "ログイン",
  "signed-in": "アカウント",
});
export const ACCOUNT_ARIA_LABELS = Object.freeze({
  "signed-out": "ログイン(アカウントのページへ)",
  "signed-in": "アカウント(ログイン中)",
});

/** fetchMe の結果 → 表示の状態。 */
export function accountLinkState(me) {
  if (!me || me.enabled !== true) return "unavailable";
  return me.user ? "signed-in" : "signed-out";
}

/** 状態を、リンクに反映する(文字・読み上げ・見た目の印)。 */
export function applyAccountState(link, state) {
  link.dataset.state = state;
  link.hidden = state === "unavailable";
  if (state in ACCOUNT_LABELS) {
    link.setAttribute("aria-label", ACCOUNT_ARIA_LABELS[state]);
    link.querySelector(".site-account__label").textContent = ACCOUNT_LABELS[state];
  }
}

export function createAccountLink() {
  const link = el(
    "a",
    { class: "site-account", href: ACCOUNT_PATH, "data-account-link": "" },
    el("span", { class: "site-account__icon", "aria-hidden": "true" }),
    el("span", { class: "site-account__label" }),
  );
  applyAccountState(link, "loading");
  return link;
}

/** 確認が終わったら、状態を反映する(失敗しても、ヘッダーは壊さない)。 */
export async function initAccountLink(link, { fetchMeImpl = fetchMe } = {}) {
  let state = "unavailable";
  try {
    state = accountLinkState(await fetchMeImpl());
  } catch {
    // 取得に失敗したら、アイコンを出さない
  }
  applyAccountState(link, state);
  return state;
}

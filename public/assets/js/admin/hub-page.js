// 管理画面のトップ(/account/admin/。管理者だけ)。各管理ページへの入り口。
// 実際のアクセス制御は、各管理 API の requireAdmin が行う(ここでの isAdmin の確認は、画面の出し分けだけ)。
import { fetchMe } from "../account/client.js";

const root = document.querySelector("[data-admin-hub]");
if (root) init(root);

async function init(root) {
  const views = [...root.querySelectorAll("[data-view]")];
  const show = (name) => {
    for (const view of views) view.hidden = view.dataset.view !== name;
  };
  const me = await fetchMe();
  if (!me.enabled) return show("unavailable");
  if (!me.user) return show("signed-out");
  if (!me.user.isAdmin) return show("forbidden");
  show("ready");
}

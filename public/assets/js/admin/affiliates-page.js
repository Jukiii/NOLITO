// 広告・アフィリエイトのリンク管理のページ(/account/admin/affiliates/。管理者だけ)。DOM に触れるのは、このファイルだけ。
// 実際のアクセス制御は、サーバー側の requireAdmin が行う(ここでの isAdmin の確認は、画面の出し分けだけ)。
// 表示する文字列は、必ず textContent(el())で入れる(リンクの内容は、管理者が書き換えられる)。
import {
  createAdminAffiliate,
  deleteAdminAffiliate,
  fetchAdminAffiliates,
  fetchMe,
  updateAdminAffiliate,
} from "../account/client.js";
import { el } from "../components/dom.js";

const root = document.querySelector("[data-admin-affiliates]");
if (root) init(root);

function parseLinkJson(text) {
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, error: "JSON はオブジェクト(1件分のリンク)にしてください。" };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, error: "JSON として読み取れませんでした。形を確認してください。" };
  }
}

const withDetails = (result) =>
  result.message + (result.details ? ` (${result.details.join(" / ")})` : "");

async function init(root) {
  const $ = (selector) => document.querySelector(selector);
  const views = [...root.querySelectorAll("[data-view]")];
  const status = $("[data-admin-status]");
  const list = $("[data-admin-affiliates-list]");
  const listEmpty = $("[data-admin-affiliates-empty]");

  const createForm = $("[data-admin-affiliates-create-form]");
  const createJson = $("[data-admin-affiliates-create-json]");
  const createError = $("[data-admin-affiliates-create-error]");

  const editDialog = $("#admin-affiliate-edit-dialog");
  const editForm = $("[data-admin-affiliates-edit-form]");
  const editJson = $("[data-admin-affiliates-edit-json]");
  const editError = $("[data-admin-affiliates-edit-error]");

  const deleteDialog = $("#admin-affiliate-delete-dialog");
  const deleteName = $("[data-admin-affiliates-delete-name]");
  const deleteError = $("[data-admin-affiliates-delete-error]");
  const deleteConfirm = $("[data-admin-affiliates-delete-confirm]");
  const deleteReauth = $("[data-admin-affiliates-delete-reauth]");

  let editingId = null;
  let deletingId = null;
  let links = new Map();

  const show = (name) => {
    for (const view of views) view.hidden = view.dataset.view !== name;
  };
  const say = (text, kind = "ok") => {
    status.textContent = text ? `${kind === "error" ? "エラー: " : ""}${text}` : "";
    status.classList.toggle("account__status--error", kind === "error" && Boolean(text));
  };

  function linkItem(link) {
    const editButton = el("button", { class: "button button--secondary", type: "button" }, "編集");
    editButton.addEventListener("click", () => openEdit(link.id));
    const deleteButton = el(
      "button",
      { class: "button button--secondary", type: "button" },
      "削除",
    );
    deleteButton.addEventListener("click", () => openDelete(link.id));
    return el(
      "li",
      { class: "admin-products__item" },
      el(
        "div",
        {},
        el("p", { class: "admin-products__item-title" }, link.title),
        el(
          "p",
          { class: "admin-products__item-meta" },
          `id: ${link.id} ・ kind: ${link.kind} ・ 枠: ${link.placements.join(", ")}`,
        ),
      ),
      el("div", { class: "admin-products__item-actions" }, editButton, deleteButton),
    );
  }

  async function loadList() {
    const result = await fetchAdminAffiliates();
    if (!result.ok) {
      say(result.message, "error");
      return;
    }
    links = new Map(result.data.links.map((link) => [link.id, link]));
    listEmpty.hidden = links.size > 0;
    list.replaceChildren(...[...links.values()].map(linkItem));
  }

  function openEdit(id) {
    const link = links.get(id);
    if (!link) return;
    editingId = id;
    editError.textContent = "";
    editJson.value = JSON.stringify(link, null, 2);
    editDialog.showModal();
    editJson.focus();
  }

  function openDelete(id) {
    const link = links.get(id);
    if (!link) return;
    deletingId = id;
    deleteError.textContent = "";
    deleteConfirm.hidden = false;
    deleteReauth.hidden = true;
    deleteName.textContent = `${link.title}(${link.id})`;
    deleteDialog.showModal();
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    createError.textContent = "";
    const parsed = parseLinkJson(createJson.value);
    if (!parsed.ok) {
      createError.textContent = parsed.error;
      return;
    }
    const result = await createAdminAffiliate(parsed.value);
    if (!result.ok) {
      createError.textContent = withDetails(result);
      return;
    }
    createJson.value = "";
    await loadList();
    say(`作成しました(${result.data.link.id})。`);
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    editError.textContent = "";
    const parsed = parseLinkJson(editJson.value);
    if (!parsed.ok) {
      editError.textContent = parsed.error;
      return;
    }
    const result = await updateAdminAffiliate(editingId, parsed.value);
    if (!result.ok) {
      editError.textContent = withDetails(result);
      return;
    }
    editDialog.close();
    await loadList();
    say(`保存しました(${result.data.link.id})。`);
  });

  deleteConfirm.addEventListener("click", async () => {
    deleteError.textContent = "";
    const result = await deleteAdminAffiliate(deletingId);
    if (!result.ok) {
      deleteError.textContent = result.message;
      if (result.code === "reauth-required") {
        // 取り消せない操作なので、直近にログインした人だけに許す。もう一度ログインすれば、続けられる
        deleteConfirm.hidden = true;
        deleteReauth.hidden = false;
      }
      return;
    }
    deleteDialog.close();
    await loadList();
    say("削除しました。");
  });

  const me = await fetchMe();
  if (!me.enabled) {
    show("unavailable");
    return;
  }
  if (!me.user) {
    show("signed-out");
    return;
  }
  if (!me.user.isAdmin) {
    show("forbidden");
    return;
  }
  show("ready");
  await loadList();
}

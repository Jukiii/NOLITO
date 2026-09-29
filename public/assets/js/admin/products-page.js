// プロダクト管理のページ(/account/admin/products/。管理者だけ)。DOM に触れるのは、このファイルだけ。
// 実際のアクセス制御は、サーバー側の requireAdmin が行う(ここでの isAdmin の確認は、画面の出し分けだけ)。
// 表示する文字列は、必ず textContent(el())で入れる(プロダクトの内容は、管理者が書き換えられる)。
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProducts,
  fetchMe,
  updateAdminProduct,
} from "../account/client.js";
import { el } from "../components/dom.js";

const root = document.querySelector("[data-admin-products]");
if (root) init(root);

function parseProductJson(text) {
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, error: "JSON はオブジェクト(1件分のプロダクト)にしてください。" };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, error: "JSON として読み取れませんでした。形を確認してください。" };
  }
}

async function init(root) {
  const $ = (selector) => document.querySelector(selector);
  const views = [...root.querySelectorAll("[data-view]")];
  const status = $("[data-admin-status]");
  const list = $("[data-admin-products-list]");
  const listEmpty = $("[data-admin-products-empty]");

  const createForm = $("[data-admin-products-create-form]");
  const createJson = $("[data-admin-products-create-json]");
  const createError = $("[data-admin-products-create-error]");

  const editDialog = $("#admin-product-edit-dialog");
  const editForm = $("[data-admin-products-edit-form]");
  const editJson = $("[data-admin-products-edit-json]");
  const editError = $("[data-admin-products-edit-error]");

  const deleteDialog = $("#admin-product-delete-dialog");
  const deleteName = $("[data-admin-products-delete-name]");
  const deleteError = $("[data-admin-products-delete-error]");
  const deleteConfirm = $("[data-admin-products-delete-confirm]");

  let editingId = null;
  let deletingId = null;
  let products = new Map();

  const show = (name) => {
    for (const view of views) view.hidden = view.dataset.view !== name;
  };
  const say = (text, kind = "ok") => {
    status.textContent = text ? `${kind === "error" ? "エラー: " : ""}${text}` : "";
    status.classList.toggle("account__status--error", kind === "error" && Boolean(text));
  };

  function productItem(product) {
    const editButton = el("button", { class: "button button--secondary", type: "button" }, "編集");
    editButton.addEventListener("click", () => openEdit(product.id));
    const deleteButton = el(
      "button",
      { class: "button button--secondary", type: "button" },
      "削除",
    );
    deleteButton.addEventListener("click", () => openDelete(product.id));
    return el(
      "li",
      { class: "admin-products__item" },
      el(
        "div",
        {},
        el("p", { class: "admin-products__item-title" }, product.title),
        el(
          "p",
          { class: "admin-products__item-meta" },
          `id: ${product.id} ・ status: ${product.status}`,
        ),
      ),
      el("div", { class: "admin-products__item-actions" }, editButton, deleteButton),
    );
  }

  async function loadList() {
    const result = await fetchAdminProducts();
    if (!result.ok) {
      say(result.message, "error");
      return;
    }
    products = new Map(result.data.products.map((product) => [product.id, product]));
    listEmpty.hidden = products.size > 0;
    list.replaceChildren(...[...products.values()].map(productItem));
  }

  function openEdit(id) {
    const product = products.get(id);
    if (!product) return;
    editingId = id;
    editError.textContent = "";
    editJson.value = JSON.stringify(product, null, 2);
    editDialog.showModal();
    editJson.focus();
  }

  function openDelete(id) {
    const product = products.get(id);
    if (!product) return;
    deletingId = id;
    deleteError.textContent = "";
    deleteName.textContent = `${product.title}(${product.id})`;
    deleteDialog.showModal();
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    createError.textContent = "";
    const parsed = parseProductJson(createJson.value);
    if (!parsed.ok) {
      createError.textContent = parsed.error;
      return;
    }
    const result = await createAdminProduct(parsed.value);
    if (!result.ok) {
      createError.textContent =
        result.message + (result.details ? ` (${result.details.join(" / ")})` : "");
      return;
    }
    createJson.value = "";
    await loadList();
    say(`作成しました(${result.data.product.id})。`);
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    editError.textContent = "";
    const parsed = parseProductJson(editJson.value);
    if (!parsed.ok) {
      editError.textContent = parsed.error;
      return;
    }
    const result = await updateAdminProduct(editingId, parsed.value);
    if (!result.ok) {
      editError.textContent =
        result.message + (result.details ? ` (${result.details.join(" / ")})` : "");
      return;
    }
    editDialog.close();
    await loadList();
    say(`保存しました(${result.data.product.id})。`);
  });

  deleteConfirm.addEventListener("click", async () => {
    deleteError.textContent = "";
    const result = await deleteAdminProduct(deletingId);
    if (!result.ok) {
      deleteError.textContent = result.message;
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

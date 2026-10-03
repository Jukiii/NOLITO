// プロダクト管理のページ(/account/admin/products/。管理者だけ)。DOM に触れるのは、このファイルと product-editor.js だけ。
// 実際のアクセス制御は、サーバー側の requireAdmin が行う(ここでの isAdmin の確認は、画面の出し分けだけ)。
// 表示する文字列は、必ず textContent(el())で入れる(プロダクトの内容は、管理者が書き換えられる)。
// 入力欄 ⇔ 保存する形の変換は product-form.js(純粋)。保存の形・API・検証(schema.js)は、入力欄になっても変わらない。
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProducts,
  fetchMe,
  updateAdminProduct,
} from "../account/client.js";
import { el } from "../components/dom.js";
import { createProductEditor } from "./product-editor.js";
import { newProductTemplate } from "./product-template.js";

const root = document.querySelector("[data-admin-products]");
if (root) init(root);

const withDetails = (result) =>
  result.message + (result.details ? ` (${result.details.join(" / ")})` : "");

async function loadCategories() {
  try {
    const response = await fetch("/data/categories.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.categories) ? data.categories : [];
  } catch {
    return [];
  }
}

async function init(root) {
  const $ = (selector) => document.querySelector(selector);
  const views = [...root.querySelectorAll("[data-view]")];
  const status = $("[data-admin-status]");
  const list = $("[data-admin-products-list]");
  const listEmpty = $("[data-admin-products-empty]");

  const form = $("[data-admin-products-form]");
  const formTitle = $("[data-admin-products-form-title]");
  const formError = $("[data-admin-products-error]");
  const resetButton = $("[data-admin-products-reset]");

  const deleteDialog = $("#admin-product-delete-dialog");
  const deleteName = $("[data-admin-products-delete-name]");
  const deleteError = $("[data-admin-products-delete-error]");
  const deleteConfirm = $("[data-admin-products-delete-confirm]");
  const deleteReauth = $("[data-admin-products-delete-reauth]");

  let editor = null;
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

  function startNew() {
    editingId = null;
    formTitle.textContent = "新しいプロダクトを作る";
    editor.load(JSON.parse(newProductTemplate()), { creating: true });
    formError.textContent = "";
    resetButton.hidden = true;
  }

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
    say("");
    editingId = id;
    formTitle.textContent = `プロダクトを編集(${id})`;
    editor.load(product, { creating: false });
    formError.textContent = "";
    resetButton.hidden = false;
    form.scrollIntoView({ block: "start" });
    editor.focusFirst();
  }

  function openDelete(id) {
    const product = products.get(id);
    if (!product) return;
    deletingId = id;
    deleteError.textContent = "";
    deleteConfirm.hidden = false;
    deleteReauth.hidden = true;
    deleteName.textContent = `${product.title}(${product.id})`;
    deleteDialog.showModal();
  }

  $("[data-admin-products-add]").addEventListener("click", () => {
    startNew();
    $("[data-admin-products-new]").scrollIntoView({ block: "start" });
    editor.focusFirst();
  });

  resetButton.addEventListener("click", () => {
    startNew();
    say("");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";
    const product = editor.read();
    const wasEditing = editingId !== null;
    const result = wasEditing
      ? await updateAdminProduct(editingId, product)
      : await createAdminProduct(product);
    if (!result.ok) {
      formError.textContent = withDetails(result);
      return;
    }
    const saved = result.data.product;
    await loadList();
    if (wasEditing) {
      say(`保存しました(${saved.id})。`);
    } else {
      startNew();
      say(`作成しました(${saved.id})。`);
    }
  });

  deleteConfirm.addEventListener("click", async () => {
    deleteError.textContent = "";
    const result = await deleteAdminProduct(deletingId);
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
    if (editingId === deletingId) startNew();
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
  editor = createProductEditor($("[data-admin-products-fields]"), await loadCategories());
  startNew();
  show("ready");
  await loadList();
}

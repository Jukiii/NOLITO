// 記事の管理のページ(/account/admin/articles/。管理者だけ)。DOM に触れるのは、このファイルだけ。
// 実際のアクセス制御は、サーバー側の requireAdmin が行う(ここでの isAdmin の確認は、画面の出し分けだけ)。
// 表示する文字列は、必ず textContent(el())で入れる。本文のプレビューは、preview.js が許可した要素だけで作り直す。
import {
  createAdminArticle,
  deleteAdminArticle,
  fetchAdminArticle,
  fetchAdminArticles,
  fetchMe,
  previewAdminArticle,
  updateAdminArticle,
} from "../account/client.js";
import { el } from "../components/dom.js";
import { parseTags } from "./article-form.js";
import { buildPreview } from "./preview.js";

const root = document.querySelector("[data-admin-articles]");
if (root) init(root);

const withDetails = (result) =>
  result.message + (result.details ? ` (${result.details.join(" / ")})` : "");

const pad = (n) => String(n).padStart(2, "0");
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

async function init(root) {
  const $ = (selector) => document.querySelector(selector);
  const views = [...root.querySelectorAll("[data-view]")];
  const status = $("[data-admin-status]");
  const list = $("[data-admin-articles-list]");
  const listEmpty = $("[data-admin-articles-empty]");

  const form = $("[data-admin-articles-form]");
  const formTitle = $("[data-admin-articles-form-title]");
  const slugInput = $("[data-admin-articles-slug]");
  const titleInput = $("[data-admin-articles-title]");
  const descriptionInput = $("[data-admin-articles-description]");
  const dateInput = $("[data-admin-articles-date]");
  const tagsInput = $("[data-admin-articles-tags]");
  const bodyInput = $("[data-admin-articles-body]");
  const draftRadios = [...form.querySelectorAll('input[name="admin-articles-draft"]')];
  const formError = $("[data-admin-articles-error]");
  const previewButton = $("[data-admin-articles-preview-button]");
  const resetButton = $("[data-admin-articles-reset]");
  const preview = $("[data-admin-articles-preview]");

  const deleteDialog = $("#admin-article-delete-dialog");
  const deleteName = $("[data-admin-articles-delete-name]");
  const deleteError = $("[data-admin-articles-delete-error]");
  const deleteConfirm = $("[data-admin-articles-delete-confirm]");
  const deleteReauth = $("[data-admin-articles-delete-reauth]");

  let editingSlug = null;
  let editingUpdated = null;
  let deletingSlug = null;
  let articles = new Map();

  const show = (name) => {
    for (const view of views) view.hidden = view.dataset.view !== name;
  };
  const say = (text, kind = "ok") => {
    status.textContent = text ? `${kind === "error" ? "エラー: " : ""}${text}` : "";
    status.classList.toggle("account__status--error", kind === "error" && Boolean(text));
  };
  const isDraft = () => draftRadios.find((radio) => radio.checked)?.value !== "published";
  const setDraft = (draft) => {
    for (const radio of draftRadios)
      radio.checked = radio.value === (draft ? "draft" : "published");
  };

  function startNew() {
    editingSlug = null;
    editingUpdated = null;
    formTitle.textContent = "新しい記事を書く";
    slugInput.disabled = false;
    slugInput.value = "";
    titleInput.value = "";
    descriptionInput.value = "";
    dateInput.value = today();
    tagsInput.value = "";
    bodyInput.value = "";
    setDraft(true);
    formError.textContent = "";
    preview.replaceChildren();
    resetButton.hidden = true;
  }

  function articleItem(article) {
    const editButton = el("button", { class: "button button--secondary", type: "button" }, "編集");
    editButton.addEventListener("click", () => openEdit(article.slug));
    const deleteButton = el(
      "button",
      { class: "button button--secondary", type: "button" },
      "削除",
    );
    deleteButton.addEventListener("click", () => openDelete(article.slug));
    const tags = article.tags.length > 0 ? ` ・ タグ: ${article.tags.join("、")}` : "";
    return el(
      "li",
      { class: "admin-products__item" },
      el(
        "div",
        {},
        el("p", { class: "admin-products__item-title" }, article.title),
        el(
          "p",
          { class: "admin-products__item-meta" },
          `${article.draft ? "【下書き】" : "【公開】"} ${article.date} ・ スラッグ: ${article.slug}${tags}`,
        ),
      ),
      el("div", { class: "admin-products__item-actions" }, editButton, deleteButton),
    );
  }

  async function loadList() {
    const result = await fetchAdminArticles();
    if (!result.ok) {
      say(result.message, "error");
      return;
    }
    articles = new Map(result.data.articles.map((article) => [article.slug, article]));
    listEmpty.hidden = articles.size > 0;
    list.replaceChildren(...[...articles.values()].map(articleItem));
  }

  async function openEdit(slug) {
    say("");
    const result = await fetchAdminArticle(slug);
    if (!result.ok) {
      say(result.message, "error");
      return;
    }
    const { article } = result.data;
    editingSlug = article.slug;
    editingUpdated = article.updated ?? null;
    formTitle.textContent = `記事を編集(${article.slug})`;
    slugInput.value = article.slug;
    slugInput.disabled = true;
    titleInput.value = article.title;
    descriptionInput.value = article.description;
    dateInput.value = article.date;
    tagsInput.value = article.tags.join("、");
    bodyInput.value = article.body;
    setDraft(article.draft);
    formError.textContent = "";
    preview.replaceChildren();
    resetButton.hidden = false;
    form.scrollIntoView({ block: "start" });
    titleInput.focus({ preventScroll: true });
  }

  function openDelete(slug) {
    const article = articles.get(slug);
    if (!article) return;
    deletingSlug = slug;
    deleteError.textContent = "";
    deleteConfirm.hidden = false;
    deleteReauth.hidden = true;
    deleteName.textContent = `${article.title}(${article.slug})`;
    deleteDialog.showModal();
  }

  function readForm() {
    const article = {
      slug: editingSlug ?? slugInput.value.trim(),
      title: titleInput.value,
      description: descriptionInput.value,
      date: dateInput.value,
      tags: parseTags(tagsInput.value),
      draft: isDraft(),
      body: bodyInput.value,
    };
    if (editingUpdated) article.updated = editingUpdated;
    return article;
  }

  previewButton.addEventListener("click", async () => {
    formError.textContent = "";
    const result = await previewAdminArticle(bodyInput.value);
    if (!result.ok) {
      preview.replaceChildren();
      formError.textContent = withDetails(result);
      return;
    }
    preview.replaceChildren(buildPreview(result.data.html));
  });

  resetButton.addEventListener("click", () => {
    startNew();
    say("");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";
    const article = readForm();
    const result = editingSlug
      ? await updateAdminArticle(editingSlug, article)
      : await createAdminArticle(article);
    if (!result.ok) {
      formError.textContent = withDetails(result);
      return;
    }
    const saved = result.data.article;
    const wasEditing = editingSlug !== null;
    await loadList();
    if (wasEditing) {
      say(`保存しました(${saved.slug})。`);
    } else {
      startNew();
      say(`作成しました(${saved.slug})。`);
    }
  });

  deleteConfirm.addEventListener("click", async () => {
    deleteError.textContent = "";
    const result = await deleteAdminArticle(deletingSlug);
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
    if (editingSlug === deletingSlug) startNew();
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
  startNew();
  show("ready");
  await loadList();
}

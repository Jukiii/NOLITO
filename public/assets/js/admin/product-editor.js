// プロダクト管理の入力フォームの部品(DOM に触れる)。項目の定義(FIELDS)から、入力欄を作る。
// 値の変換(プロダクト ⇔ 入力値)は product-form.js(純粋)。表示する文字列は、el() だけで入れる。
import { el } from "../components/dom.js";
import {
  PLATFORM_LABELS,
  PLATFORMS,
  PRICE_LABELS,
  productToValues,
  STATUS_LABELS,
  STATUSES,
  STORAGE_LABELS,
  STORAGE_METHODS,
  valuesToProduct,
} from "./product-form.js";

const PRICE_TYPES = Object.keys(PRICE_LABELS);

// 行を増やせる項目(1 行 = 複数の入力欄)
export const ROW_LISTS = Object.freeze([
  {
    key: "screenshots",
    title: "スクリーンショット(6 枚まで)",
    columns: [
      { key: "src", label: "画像の場所(/ 始まり)" },
      { key: "alt", label: "代替テキスト" },
      { key: "width", label: "幅(px)", type: "number" },
      { key: "height", label: "高さ(px)", type: "number" },
    ],
  },
  {
    key: "requirements",
    title: "動作環境(20 行まで)",
    columns: [
      { key: "label", label: "項目" },
      { key: "value", label: "内容" },
    ],
  },
  {
    key: "faq",
    title: "よくある質問(20 件まで)",
    columns: [
      { key: "question", label: "質問" },
      { key: "answer", label: "答え", kind: "textarea" },
    ],
  },
  {
    key: "changelog",
    title: "更新履歴(新しい順。先頭の版は、上の「版」と同じに)",
    columns: [
      { key: "version", label: "版(例: 1.2.0)" },
      { key: "date", label: "日付", type: "date" },
      { key: "changes", label: "変更点(1 行に 1 つ)", kind: "textarea" },
    ],
  },
]);

// 項目の定義。kind: text / textarea / select / checkbox / checks。
// groups の各まとまりが、1 つの fieldset になる。
export const FIELD_GROUPS = Object.freeze([
  {
    title: "基本",
    fields: [
      {
        key: "id",
        label: "ID",
        hint: "英小文字・数字・ハイフンだけ。保存したあとは、変えられません。",
      },
      { key: "category", label: "カテゴリ", kind: "select" },
      { key: "title", label: "名前(60 文字まで)" },
      { key: "description", label: "説明(160 文字まで)", kind: "textarea", rows: 3 },
      {
        key: "tags",
        label: "タグ",
        hint: "読点(、)かカンマ(,)で区切る。10 個まで・1 つ 20 文字まで。",
      },
      { key: "featured", label: "トップページの「おすすめ」に出す", kind: "checkbox" },
    ],
  },
  {
    title: "公開の状態",
    fields: [
      {
        key: "status",
        label: "状態",
        kind: "select",
        options: STATUSES.map((value) => [value, STATUS_LABELS[value] ?? value]),
      },
      { key: "version", label: "版(例: 1.0.0。準備中は空でよい)" },
      { key: "released_at", label: "公開日", type: "date" },
      { key: "updated_at", label: "更新日", type: "date" },
      { key: "url", label: "遊ぶ・使う先の URL(/ 始まりか https://)" },
      { key: "detail_path", label: "詳細ページの場所(例: /games/xxx/about/。なければ空)" },
      { key: "cta", label: "ボタンの文字(20 文字まで。空なら既定)" },
    ],
  },
  {
    title: "画像",
    fields: [
      { key: "imageSrc", label: "一覧の画像の場所(なければ空)" },
      { key: "imageAlt", label: "一覧の画像の代替テキスト" },
    ],
  },
  {
    title: "対応・保存",
    fields: [
      {
        key: "platforms",
        label: "対応するもの",
        kind: "checks",
        options: PLATFORMS.map((value) => [value, PLATFORM_LABELS[value] ?? value]),
      },
      {
        key: "storage",
        label: "データの保存",
        kind: "checks",
        hint: "「保存しない」は、ほかと一緒に選べません。",
        options: STORAGE_METHODS.map((value) => [value, STORAGE_LABELS[value] ?? value]),
      },
    ],
  },
  {
    title: "料金",
    fields: [
      {
        key: "priceType",
        label: "料金の種類",
        kind: "select",
        options: PRICE_TYPES.map((value) => [value, PRICE_LABELS[value]]),
      },
      { key: "priceAmount", label: "金額(有料のときだけ。円。整数)", type: "number" },
      { key: "planFree", label: "無料で使える範囲(1 行に 1 つ)", kind: "textarea", rows: 3 },
      {
        key: "planPaid",
        label: "将来の有料機能の予定(1 行に 1 つ。なければ空)",
        kind: "textarea",
        rows: 3,
      },
    ],
  },
  {
    title: "配布・購入(外部サイトへのリンクだけ)",
    fields: [
      { key: "downloadLabel", label: "ダウンロードのボタンの文字" },
      { key: "downloadUrl", label: "ダウンロードの URL(https://)" },
      { key: "purchaseLabel", label: "購入のボタンの文字(有料のときだけ)" },
      { key: "purchaseUrl", label: "購入の URL(https://)" },
    ],
  },
  {
    title: "詳しい説明",
    fields: [
      {
        key: "details",
        label: "説明の段落(空行で区切る。1 段落 1000 文字まで)",
        kind: "textarea",
        rows: 8,
      },
    ],
  },
]);

let counter = 0;
const nextId = () => `admin-product-field-${++counter}`;

function inputFor(field, id) {
  const common = { class: "account__input", id, "data-field": field.key };
  if (field.kind === "textarea") {
    return el("textarea", { ...common, rows: field.rows ?? 3, spellcheck: "false" });
  }
  if (field.kind === "select") {
    const select = el("select", common);
    for (const [value, label] of field.options ?? []) select.append(el("option", { value }, label));
    return select;
  }
  return el("input", {
    ...common,
    type: field.type ?? "text",
    autocomplete: "off",
    spellcheck: field.type ? null : "false",
  });
}

function fieldBlock(field) {
  const id = nextId();
  if (field.kind === "checkbox") {
    return el(
      "div",
      { class: "account__field" },
      el(
        "label",
        { class: "admin-products__check", for: id },
        el("input", { type: "checkbox", id, "data-field": field.key }),
        ` ${field.label}`,
      ),
    );
  }
  if (field.kind === "checks") {
    const hintId = `${id}-hint`;
    const group = el(
      "fieldset",
      { class: "admin-products__checks", "aria-describedby": field.hint ? hintId : null },
      el("legend", {}, field.label),
    );
    for (const [value, label] of field.options) {
      group.append(
        el(
          "label",
          { class: "admin-products__check" },
          el("input", { type: "checkbox", value, "data-group": field.key }),
          ` ${label}`,
        ),
      );
    }
    if (field.hint) group.append(el("p", { class: "account__hint", id: hintId }, field.hint));
    return group;
  }
  const block = el(
    "div",
    { class: "account__field" },
    el("label", { for: id }, field.label),
    inputFor(field, id),
  );
  if (field.hint) block.append(el("p", { class: "account__hint" }, field.hint));
  return block;
}

function rowFor(list, row = {}) {
  const cells = list.columns.map((column) => {
    const id = nextId();
    const common = { class: "account__input", id, "data-row-field": column.key };
    const input =
      column.kind === "textarea"
        ? el("textarea", { ...common, rows: 3 })
        : el("input", { ...common, type: column.type ?? "text", autocomplete: "off" });
    input.value = row[column.key] ?? "";
    return el("div", { class: "account__field" }, el("label", { for: id }, column.label), input);
  });
  const remove = el(
    "button",
    { class: "button button--secondary", type: "button", "data-row-remove": "" },
    "この行を削除",
  );
  const node = el("li", { class: "admin-products__row" }, ...cells, remove);
  remove.addEventListener("click", () => node.remove());
  return node;
}

/** 入力欄をまとめた部品を作り、mount の中に入れる。categories: [{id, name}]。 */
export function createProductEditor(mount, categories) {
  const root = el("div", { class: "admin-products__fields" });
  for (const group of FIELD_GROUPS) {
    const set = el("fieldset", { class: "admin-products__group" }, el("legend", {}, group.title));
    for (const field of group.fields) set.append(fieldBlock(field));
    root.append(set);
  }
  const lists = new Map();
  for (const list of ROW_LISTS) {
    const items = el("ul", { class: "admin-products__rows", "data-rows": list.key });
    const add = el(
      "button",
      { class: "button button--secondary", type: "button", "data-rows-add": list.key },
      "行を足す",
    );
    add.addEventListener("click", () => items.append(rowFor(list)));
    root.append(
      el("fieldset", { class: "admin-products__group" }, el("legend", {}, list.title), items, add),
    );
    lists.set(list.key, { list, items });
  }
  mount.replaceChildren(root);

  const categorySelect = root.querySelector('[data-field="category"]');
  for (const category of categories) {
    categorySelect.append(el("option", { value: category.id }, category.name ?? category.id));
  }

  const fieldOf = (key) => root.querySelector(`[data-field="${key}"]`);

  function setValues(values) {
    for (const element of root.querySelectorAll("[data-field]")) {
      const value = values[element.dataset.field];
      if (element.type === "checkbox") element.checked = value === true;
      else element.value = value === undefined || value === null ? "" : String(value);
    }
    for (const box of root.querySelectorAll("[data-group]")) {
      box.checked = (values[box.dataset.group] ?? []).includes(box.value);
    }
    for (const { list, items } of lists.values()) {
      items.replaceChildren(...(values[list.key] ?? []).map((row) => rowFor(list, row)));
    }
  }

  function getValues() {
    const values = {};
    for (const element of root.querySelectorAll("[data-field]")) {
      values[element.dataset.field] = element.type === "checkbox" ? element.checked : element.value;
    }
    for (const box of root.querySelectorAll("[data-group]")) {
      values[box.dataset.group] ??= [];
      if (box.checked) values[box.dataset.group].push(box.value);
    }
    for (const [key, { items }] of lists) {
      values[key] = [...items.children].map((item) => {
        const row = {};
        for (const input of item.querySelectorAll("[data-row-field]")) {
          row[input.dataset.rowField] = input.value;
        }
        return row;
      });
    }
    return values;
  }

  return {
    /** 保存済みのプロダクト(または null = 新規)を、入力欄に入れる。 */
    load(product, { creating }) {
      setValues(productToValues(product));
      fieldOf("id").disabled = !creating;
    },
    /** 入力欄から、保存する形のプロダクトを作る。 */
    read: () => valuesToProduct(getValues()),
    focusFirst: () =>
      fieldOf(fieldOf("id").disabled ? "title" : "id").focus({ preventScroll: true }),
  };
}

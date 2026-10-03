// プロダクト管理の入力フォームと、保存する形(products.json の 1 件分)との変換。DOM に触れない純粋な関数。
// 検証は、ここでは行わない(サーバーと同じ schema.js の validateProduct が、保存のときに行う)。
// フォームは、決まった項目だけを扱う。変換は「プロダクト → 入力値 → プロダクト」で元に戻る(tests/admin-product-form.test.js)。

import { PLATFORMS, STATUSES, STORAGE_METHODS } from "../products/schema.js";

export const PLATFORM_LABELS = Object.freeze({
  web: "Web",
  windows: "Windows",
  mac: "Mac",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
});
export const STATUS_LABELS = Object.freeze({
  released: "公開中",
  beta: "ベータ版",
  "coming-soon": "準備中",
});
export const STORAGE_LABELS = Object.freeze({
  none: "保存しない",
  browser: "ブラウザの中",
  file: "ファイル",
});
export const PRICE_LABELS = Object.freeze({ free: "無料", paid: "有料", undecided: "価格未定" });

export { PLATFORMS, STATUSES, STORAGE_METHODS };

const lines = (items) => (items ?? []).join("\n");
const toLines = (text) =>
  String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
const trimmed = (value) => String(value ?? "").trim();
const orNull = (value) => (trimmed(value) === "" ? null : trimmed(value));
// 空欄は、検証で「整数にしてください」と指摘されるよう、そのまま文字で返す
const toNumber = (value) => (trimmed(value) === "" ? "" : Number(trimmed(value)));
const rowIsEmpty = (row) => Object.values(row).every((value) => trimmed(value) === "");

/** タグ・読点などで区切った入力 → 配列(空は除く)。 */
export function parseList(text) {
  return String(text)
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

/** 1 件のプロダクト → フォームの入力値(すべて文字・真偽値・配列・行の配列)。 */
export function productToValues(product) {
  const p = product ?? {};
  return {
    id: p.id ?? "",
    category: p.category ?? "",
    title: p.title ?? "",
    description: p.description ?? "",
    tags: (p.tags ?? []).join("、"),
    featured: p.featured === true,
    status: p.status ?? "coming-soon",
    version: p.version ?? "",
    released_at: p.released_at ?? "",
    updated_at: p.updated_at ?? "",
    url: p.url ?? "",
    detail_path: p.detail_path ?? "",
    cta: p.cta ?? "",
    imageSrc: p.image?.src ?? "",
    imageAlt: p.image?.alt ?? "",
    platforms: [...(p.platforms ?? [])],
    storage: [...(p.storage ?? [])],
    priceType: p.price?.type ?? "free",
    priceAmount: p.price?.amount === undefined || p.price?.amount === null ? "" : p.price.amount,
    planFree: lines(p.plan?.free),
    planPaid: lines(p.plan?.paid),
    downloadLabel: p.download?.label ?? "",
    downloadUrl: p.download?.url ?? "",
    purchaseLabel: p.purchase?.label ?? "",
    purchaseUrl: p.purchase?.url ?? "",
    details: (p.details ?? []).join("\n\n"),
    requirements: (p.requirements ?? []).map((item) => ({
      label: item.label ?? "",
      value: item.value ?? "",
    })),
    faq: (p.faq ?? []).map((item) => ({
      question: item.question ?? "",
      answer: item.answer ?? "",
    })),
    screenshots: (p.screenshots ?? []).map((item) => ({
      src: item.src ?? "",
      alt: item.alt ?? "",
      width: item.width ?? "",
      height: item.height ?? "",
    })),
    changelog: (p.changelog ?? []).map((item) => ({
      version: item.version ?? "",
      date: item.date ?? "",
      changes: lines(item.changes),
    })),
  };
}

/** フォームの入力値 → 1 件のプロダクト(保存する形)。 */
export function valuesToProduct(values) {
  const v = values;
  const paired = (a, b) => {
    const left = orNull(a);
    const right = orNull(b);
    return left === null && right === null ? null : [trimmed(a), trimmed(b)];
  };
  const image = paired(v.imageSrc, v.imageAlt);
  const download = paired(v.downloadLabel, v.downloadUrl);
  const purchase = paired(v.purchaseLabel, v.purchaseUrl);
  const planFree = toLines(v.planFree);
  const planPaid = toLines(v.planPaid);

  const price = { type: v.priceType };
  if (v.priceType === "paid") {
    price.amount = toNumber(v.priceAmount);
    price.currency = "JPY";
  }

  const product = {
    id: trimmed(v.id),
    category: v.category,
    title: trimmed(v.title),
    description: trimmed(v.description),
    tags: parseList(v.tags),
    featured: v.featured === true,
    details: String(v.details)
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph !== ""),
    image: image && { src: image[0], alt: image[1] },
    screenshots: v.screenshots
      .filter((row) => !rowIsEmpty(row))
      .map((row) => ({
        src: trimmed(row.src),
        alt: trimmed(row.alt),
        width: toNumber(row.width),
        height: toNumber(row.height),
      })),
    platforms: [...v.platforms],
    requirements: v.requirements
      .filter((row) => !rowIsEmpty(row))
      .map((row) => ({ label: trimmed(row.label), value: trimmed(row.value) })),
    storage: [...v.storage],
    price,
    plan:
      planFree.length === 0 && planPaid.length === 0 ? null : { free: planFree, paid: planPaid },
    status: v.status,
    url: trimmed(v.url),
    detail_path: orNull(v.detail_path),
    download: download && { label: download[0], url: download[1] },
    purchase: purchase && { label: purchase[0], url: purchase[1] },
    version: orNull(v.version),
    released_at: orNull(v.released_at),
    updated_at: trimmed(v.updated_at),
    faq: v.faq
      .filter((row) => !rowIsEmpty(row))
      .map((row) => ({ question: trimmed(row.question), answer: trimmed(row.answer) })),
    changelog: v.changelog
      .filter((row) => !rowIsEmpty(row))
      .map((row) => ({
        version: trimmed(row.version),
        date: trimmed(row.date),
        changes: toLines(row.changes),
      })),
  };
  // cta は、書いたときだけ(省略できる項目)
  if (orNull(v.cta) !== null) product.cta = trimmed(v.cta);
  return product;
}

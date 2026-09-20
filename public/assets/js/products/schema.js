// プロダクト(ゲーム・ソフト・ツールなど)のデータの形と検証。DOM に依存しない。
// 使う場所: 単体テスト(データが正しいか)と、一覧の描画(不正な項目を外して、他は表示する)。
// 将来、管理画面(Phase 26)などから書かれても安全なように、URL・文字数・値の種類を厳しく確認する。

export const PRODUCT_DATA_VERSION = 2;
export const CATEGORY_DATA_VERSION = 1;

export const STATUSES = ["released", "beta", "coming-soon"];
export const PLATFORMS = ["web", "windows", "mac", "linux", "ios", "android"];
export const PRICE_TYPES = ["free", "paid", "undecided"];

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const MAX_PRICE = 10_000_000;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value, max) =>
  typeof value === "string" && value.trim() !== "" && value.length <= max;
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
// 制御文字・空白・バックスラッシュを含むか(URL には使えない)
const hasUnsafeChar = (value) =>
  [...value].some(
    (char) => char.charCodeAt(0) <= 0x20 || char.charCodeAt(0) === 0x7f || char === "\\",
  );

// 実在する日付(YYYY-MM-DD)か。2026-02-30 のような日付は不可
export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

// サイト内のパス(/ 始まり。// で始まるものは別サイトを指すので不可)か、https の URL だけを許す。
// javascript: や data: など、実行されうるものは通さない。
export function isSafeUrl(value) {
  if (typeof value !== "string" || value === "" || hasUnsafeChar(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  // https:example.com のような、URL の解釈が緩む書き方は通さない
  if (!value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}

// x.y.z 同士の比較(新しい方が正)
export function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function checkPrice(price, add) {
  if (!isObject(price)) return add("price は { type } の形で指定してください");
  if (!PRICE_TYPES.includes(price.type)) return add(`price.type が不正です: ${price.type}`);
  if (price.type === "paid") {
    if (!Number.isInteger(price.amount) || price.amount <= 0 || price.amount > MAX_PRICE) {
      add("有料(paid)の price.amount は、1 以上の整数(円)にしてください");
    }
    if (price.currency !== "JPY") add('price.currency は "JPY" にしてください');
  } else if ((price.amount ?? null) !== null || (price.currency ?? null) !== null) {
    add("無料(free)・価格未定(undecided)では、price.amount と price.currency は不要です");
  }
}

function checkChangelog(changelog, product, add) {
  if (!Array.isArray(changelog)) return add("changelog は配列にしてください(なければ [])");
  let previous = null;
  changelog.forEach((entry, index) => {
    const label = `changelog[${index}]`;
    if (!isObject(entry)) return add(`${label} はオブジェクトにしてください`);
    const okVersion = typeof entry.version === "string" && VERSION_PATTERN.test(entry.version);
    if (!okVersion) add(`${label}.version は x.y.z の形にしてください`);
    const okDate = isValidDate(entry.date);
    if (!okDate) add(`${label}.date は実在する日付(YYYY-MM-DD)にしてください`);
    const okChanges =
      Array.isArray(entry.changes) &&
      entry.changes.length > 0 &&
      entry.changes.every((change) => isText(change, 200));
    if (!okChanges) add(`${label}.changes は、200字以内の文字列の配列(1つ以上)にしてください`);
    if (previous && okVersion && okDate) {
      if (compareVersions(previous.version, entry.version) <= 0) {
        add(`${label}: バージョンは、新しい順(降順)・重複なしで並べてください`);
      }
      if (previous.date < entry.date) add(`${label}: 日付は、新しい順に並べてください`);
    }
    if (okVersion && okDate) previous = entry;
  });
  const [latest] = changelog;
  if (isObject(latest) && product.version !== latest.version) {
    add("changelog の先頭(最新)のバージョンは、product の version と同じにしてください");
  }
}

// 1件のプロダクトを検証して、問題の一覧(なければ空)を返す
export function validateProduct(product, { categoryIds = [] } = {}) {
  const errors = [];
  const add = (message) => errors.push(message);
  if (!isObject(product)) return ["プロダクトはオブジェクトにしてください"];

  if (typeof product.id !== "string" || !ID_PATTERN.test(product.id)) {
    add("id は英小文字・数字・ハイフンだけにしてください");
  }
  if (!categoryIds.includes(product.category)) add(`存在しないカテゴリです: ${product.category}`);
  if (!isText(product.title, 60)) add("title は、1〜60字にしてください");
  if (!isText(product.description, 160)) add("description は、1〜160字にしてください");
  const detailsOk =
    Array.isArray(product.details) && product.details.every((text) => isText(text, 1000));
  if (!detailsOk) add("details は、1000字以内の文字列の配列にしてください(なければ [])");

  if (product.image !== null) {
    if (!isObject(product.image)) {
      add("image は、{ src, alt } か null にしてください");
    } else {
      if (!isSafeUrl(product.image.src)) {
        add("image.src は、/ 始まりのパスか https の URL にしてください");
      }
      if (!isText(product.image.alt, 200)) add("image.alt(代替テキスト)は必須です(200字以内)");
    }
  }

  const platformsOk =
    Array.isArray(product.platforms) &&
    product.platforms.length > 0 &&
    product.platforms.every((platform) => PLATFORMS.includes(platform)) &&
    new Set(product.platforms).size === product.platforms.length;
  if (!platformsOk) add(`platforms は、重複なしで ${PLATFORMS.join(" / ")} から1つ以上`);

  checkPrice(product.price, add);
  if (!STATUSES.includes(product.status)) add(`status が不正です: ${product.status}`);
  if (!isSafeUrl(product.url)) add("url は、/ 始まりのパスか https の URL にしてください");
  if (has(product, "cta") && !isText(product.cta, 20)) add("cta は、1〜20字にしてください");

  if (product.download !== null) {
    if (!isObject(product.download)) {
      add("download は、{ label, url } か null にしてください");
    } else {
      if (!isText(product.download.label, 40)) add("download.label は、1〜40字にしてください");
      if (!isSafeUrl(product.download.url)) {
        add("download.url は、/ 始まりのパスか https の URL にしてください");
      }
    }
    if (product.status === "coming-soon") {
      add("準備中(coming-soon)のものに download は付けられません");
    }
  }

  const upcoming = product.status === "coming-soon";
  if (product.version === null) {
    if (!upcoming) add("version は、準備中(coming-soon)以外では必須です");
  } else if (typeof product.version !== "string" || !VERSION_PATTERN.test(product.version)) {
    add("version は x.y.z の形にしてください");
  }
  if (product.released_at === null) {
    if (!upcoming) add("released_at は、準備中(coming-soon)以外では必須です");
  } else if (!isValidDate(product.released_at)) {
    add("released_at は実在する日付(YYYY-MM-DD)にしてください");
  }
  if (!isValidDate(product.updated_at)) add("updated_at は実在する日付(YYYY-MM-DD)にしてください");
  if (
    isValidDate(product.released_at) &&
    isValidDate(product.updated_at) &&
    product.released_at > product.updated_at
  ) {
    add("released_at は、updated_at より後にできません");
  }
  checkChangelog(product.changelog, product, add);
  return errors;
}

// カテゴリ一覧(categories.json)の検証
export function validateCategories(data) {
  if (
    !isObject(data) ||
    data.version !== CATEGORY_DATA_VERSION ||
    !Array.isArray(data.categories)
  ) {
    return [
      `categories.json は { version: ${CATEGORY_DATA_VERSION}, categories: [...] } の形にしてください`,
    ];
  }
  const errors = [];
  const ids = new Set();
  data.categories.forEach((category, index) => {
    const label = `categories[${index}]`;
    if (!isObject(category)) return errors.push(`${label} はオブジェクトにしてください`);
    if (typeof category.id !== "string" || !ID_PATTERN.test(category.id)) {
      errors.push(`${label}.id は英小文字・数字・ハイフンだけにしてください`);
    } else if (ids.has(category.id)) {
      errors.push(`${label}.id が重複しています: ${category.id}`);
    } else {
      ids.add(category.id);
    }
    if (!isText(category.name, 20)) errors.push(`${label}.name は、1〜20字にしてください`);
    if (!isText(category.description, 100)) {
      errors.push(`${label}.description は、1〜100字にしてください`);
    }
    // path は、そのカテゴリの一覧ページ。ページができるまでは null
    const pathOk =
      category.path === null ||
      (isSafeUrl(category.path) && category.path.startsWith("/") && category.path.endsWith("/"));
    if (!pathOk) errors.push(`${label}.path は、/ で始まり / で終わるパスか null にしてください`);
  });
  return errors;
}

// プロダクト一覧全体(products.json)の検証。問題は「どの項目か」がわかる文字列で返す
export function validateProducts(data, categories) {
  if (!isObject(data) || data.version !== PRODUCT_DATA_VERSION || !Array.isArray(data.products)) {
    return [
      `products.json は { version: ${PRODUCT_DATA_VERSION}, products: [...] } の形にしてください`,
    ];
  }
  const categoryIds = categories.map((category) => category.id);
  const errors = [];
  const ids = new Set();
  data.products.forEach((product, index) => {
    const known = isObject(product) && typeof product.id === "string";
    const name = known ? product.id : `#${index}`;
    for (const message of validateProduct(product, { categoryIds })) {
      errors.push(`${name}: ${message}`);
    }
    if (known) {
      if (ids.has(product.id)) errors.push(`${name}: id が重複しています`);
      ids.add(product.id);
    }
  });
  return errors;
}

// 表示用: 不正な項目・重複した項目だけを外して、残りを返す(1件の間違いでページ全体を壊さない)
export function usableProducts(data, categories) {
  if (!isObject(data) || data.version !== PRODUCT_DATA_VERSION || !Array.isArray(data.products)) {
    return { products: [], skipped: ["(形式が不正です)"] };
  }
  const categoryIds = categories.map((category) => category.id);
  const products = [];
  const skipped = [];
  const seen = new Set();
  for (const product of data.products) {
    const known = isObject(product) && typeof product.id === "string";
    if (validateProduct(product, { categoryIds }).length > 0 || (known && seen.has(product.id))) {
      skipped.push(known ? product.id : "(不明)");
      continue;
    }
    seen.add(product.id);
    products.push(product);
  }
  return { products, skipped };
}

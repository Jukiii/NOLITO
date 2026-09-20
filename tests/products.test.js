import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PRODUCT_STATUS } from "../public/assets/js/components/product-list.js";
import {
  PLATFORM_LABELS,
  formatDate,
  platformLabels,
  priceLabel,
  versionLabel,
} from "../public/assets/js/products/format.js";
import {
  CATEGORY_DATA_VERSION,
  PLATFORMS,
  PRODUCT_DATA_VERSION,
  STATUSES,
  compareVersions,
  isSafeUrl,
  isValidDate,
  usableProducts,
  validateCategories,
  validateProduct,
  validateProducts,
} from "../public/assets/js/products/schema.js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(join(publicDir, path), "utf8"));
const categoryIds = ["game", "software", "tool"];

// 検証を通る、最小の完全なプロダクト。各テストで一部だけ書き換える
const valid = (overrides = {}) => ({
  id: "sample-app",
  category: "software",
  title: "サンプル",
  description: "説明です。",
  details: [],
  image: null,
  platforms: ["windows"],
  price: { type: "free" },
  status: "released",
  url: "/software/sample-app/",
  download: null,
  version: "1.0.0",
  released_at: "2026-01-01",
  updated_at: "2026-02-01",
  changelog: [],
  ...overrides,
});
const errorsOf = (product) => validateProduct(product, { categoryIds });
const has = (errors, word) => errors.some((message) => message.includes(word));

describe("実際のデータ(categories.json・products.json)", () => {
  const categoryData = readJson("data/categories.json");
  const productData = readJson("data/products.json");

  it("カテゴリのデータが、形式どおり", () => {
    assert.equal(categoryData.version, CATEGORY_DATA_VERSION);
    assert.deepEqual(validateCategories(categoryData), []);
    assert.ok(categoryData.categories.length >= 1);
  });

  it("カテゴリの一覧ページ(path)がある場合は、実在するページで、そのカテゴリの一覧を描く", () => {
    for (const { id, path } of categoryData.categories.filter((c) => c.path !== null)) {
      const file = join(publicDir, path.slice(1), "index.html");
      assert.ok(existsSync(file), path);
      assert.ok(readFileSync(file, "utf8").includes(`data-category="${id}"`), path);
    }
  });

  it("プロダクトのデータが、形式どおり(1件も検証に落ちない)", () => {
    assert.equal(productData.version, PRODUCT_DATA_VERSION);
    assert.deepEqual(validateProducts(productData, categoryData.categories), []);
    assert.ok(productData.products.length >= 1);
  });

  it("表示で、外される項目がない", () => {
    const { products, skipped } = usableProducts(productData, categoryData.categories);
    assert.deepEqual(skipped, []);
    assert.equal(products.length, productData.products.length);
  });

  it("サイト内の URL(url・download・画像)は、実在するファイルを指す", () => {
    const exists = (url) =>
      url.startsWith("/") &&
      existsSync(join(publicDir, (url.endsWith("/") ? `${url}index.html` : url).slice(1)));
    for (const product of productData.products) {
      if (product.status !== "coming-soon" && product.url.startsWith("/")) {
        assert.ok(exists(product.url), `${product.id}: ${product.url}`);
      }
      if (product.image) assert.ok(exists(product.image.src), product.image.src);
      if (product.download?.url.startsWith("/")) assert.ok(exists(product.download.url));
    }
  });

  it("状態の文字ラベルが、検証の許す状態すべてにある(色だけに頼らない)", () => {
    assert.deepEqual(Object.keys(PRODUCT_STATUS).sort(), [...STATUSES].sort());
    for (const status of Object.values(PRODUCT_STATUS)) assert.ok(status.label.length > 0);
  });

  it("OS の表示名が、検証の許す OS すべてにある", () => {
    assert.deepEqual(Object.keys(PLATFORM_LABELS).sort(), [...PLATFORMS].sort());
    assert.deepEqual(platformLabels(["web", "mac"]), ["Web", "macOS"]);
  });
});

describe("プロダクトの検証", () => {
  it("最小の完全なプロダクトは通る", () => {
    assert.deepEqual(errorsOf(valid()), []);
  });

  it("必須の項目が欠けると、落ちる", () => {
    for (const key of [
      "id",
      "category",
      "title",
      "description",
      "details",
      "image",
      "platforms",
      "price",
      "status",
      "url",
      "download",
      "version",
      "released_at",
      "updated_at",
      "changelog",
    ]) {
      const product = valid();
      delete product[key];
      assert.ok(errorsOf(product).length > 0, key);
    }
  });

  it("オブジェクトでないものは落ちる", () => {
    for (const value of [null, undefined, "x", 5, [], true]) {
      assert.ok(validateProduct(value, { categoryIds }).length > 0, String(value));
    }
  });

  it("id は、英小文字・数字・ハイフンだけ", () => {
    for (const id of ["", "Sample", "sample_app", "-a", "a-", "a--b", "あ", 5, null]) {
      assert.ok(has(errorsOf(valid({ id })), "id"), String(id));
    }
    for (const id of ["a", "a-b", "app2", "a1-b2-c3"])
      assert.deepEqual(errorsOf(valid({ id })), []);
  });

  it("存在しないカテゴリは落ちる。カテゴリはデータで足せる", () => {
    assert.ok(has(errorsOf(valid({ category: "music" })), "カテゴリ"));
    assert.deepEqual(
      validateProduct(valid({ category: "music" }), { categoryIds: [...categoryIds, "music"] }),
      [],
    );
  });

  it("title・description の文字数の上限と、空", () => {
    assert.ok(has(errorsOf(valid({ title: "" })), "title"));
    assert.ok(has(errorsOf(valid({ title: "   " })), "title"));
    assert.ok(has(errorsOf(valid({ title: "あ".repeat(61) })), "title"));
    assert.deepEqual(errorsOf(valid({ title: "あ".repeat(60) })), []);
    assert.ok(has(errorsOf(valid({ description: "あ".repeat(161) })), "description"));
    assert.ok(has(errorsOf(valid({ details: ["ok", ""] })), "details"));
    assert.ok(has(errorsOf(valid({ details: "文" })), "details"));
    assert.deepEqual(errorsOf(valid({ details: ["段落1", "段落2"] })), []);
  });

  describe("画像", () => {
    it("alt(代替テキスト)は必須", () => {
      const image = { src: "/assets/img/escape-boss/player.svg" };
      assert.ok(has(errorsOf(valid({ image })), "alt"));
      assert.ok(has(errorsOf(valid({ image: { ...image, alt: "" } })), "alt"));
      assert.deepEqual(errorsOf(valid({ image: { ...image, alt: "説明" } })), []);
    });

    it("画像の場所は、/ 始まりのパスか https だけ", () => {
      for (const src of [
        "javascript:alert(1)",
        "http://example.com/a.png",
        "data:image/png;base64,AA",
        "//evil.example/a.png",
        "a.png",
        "",
      ]) {
        assert.ok(has(errorsOf(valid({ image: { src, alt: "a" } })), "image.src"), src);
      }
      assert.deepEqual(
        errorsOf(valid({ image: { src: "https://example.com/a.png", alt: "a" } })),
        [],
      );
    });
  });

  it("platforms は、決まった OS だけ・重複なし・1つ以上", () => {
    for (const platforms of [[], ["beos"], ["web", "web"], "web", null]) {
      assert.ok(has(errorsOf(valid({ platforms })), "platforms"), JSON.stringify(platforms));
    }
    assert.deepEqual(errorsOf(valid({ platforms: ["web", "windows", "mac", "ios"] })), []);
  });

  describe("価格", () => {
    it("無料と価格未定は、金額なし", () => {
      assert.deepEqual(errorsOf(valid({ price: { type: "free" } })), []);
      assert.deepEqual(errorsOf(valid({ price: { type: "undecided" } })), []);
      assert.deepEqual(errorsOf(valid({ price: { type: "free", amount: null } })), []);
      assert.ok(has(errorsOf(valid({ price: { type: "free", amount: 100 } })), "price"));
      assert.ok(has(errorsOf(valid({ price: { type: "undecided", currency: "JPY" } })), "price"));
    });

    it("有料は、1以上の整数の円", () => {
      assert.deepEqual(
        errorsOf(valid({ price: { type: "paid", amount: 1200, currency: "JPY" } })),
        [],
      );
      for (const amount of [0, -1, 1.5, "100", null, undefined, 10_000_001]) {
        assert.ok(
          has(errorsOf(valid({ price: { type: "paid", amount, currency: "JPY" } })), "amount"),
          String(amount),
        );
      }
      assert.ok(
        has(errorsOf(valid({ price: { type: "paid", amount: 100, currency: "USD" } })), "currency"),
      );
    });

    it("種類が不正・形が不正だと落ちる", () => {
      for (const price of [{ type: "donation" }, {}, null, "free", undefined]) {
        assert.ok(has(errorsOf(valid({ price })), "price"), JSON.stringify(price));
      }
    });
  });

  it("status は、決まった3つだけ", () => {
    for (const status of STATUSES) {
      const product =
        status === "coming-soon"
          ? valid({ status, version: null, released_at: null })
          : valid({ status });
      assert.deepEqual(errorsOf(product), [], status);
    }
    assert.ok(has(errorsOf(valid({ status: "draft" })), "status"));
    assert.ok(has(errorsOf(valid({ status: undefined })), "status"));
  });

  describe("URL の安全性", () => {
    it("安全な URL の判定", () => {
      for (const url of [
        "/",
        "/games/",
        "/a/b?x=1#y",
        "https://example.com/a.exe",
        "https://github.com/o/r/releases/latest",
      ]) {
        assert.equal(isSafeUrl(url), true, url);
      }
      for (const url of [
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        " javascript:alert(1)",
        "data:text/html,<script>",
        "vbscript:x",
        "http://example.com/",
        "//evil.example/",
        "/\\evil.example",
        "https://",
        "https:example.com",
        "ftp://example.com/",
        "games/",
        "",
        "/a b",
        "/a\nb",
        "/a\u0000b",
        "https://example.com/ a",
        5,
        null,
        undefined,
      ]) {
        assert.equal(isSafeUrl(url), false, JSON.stringify(url));
      }
    });

    it("url・download.url に、危険な URL は使えない", () => {
      assert.ok(has(errorsOf(valid({ url: "javascript:alert(1)" })), "url"));
      assert.ok(has(errorsOf(valid({ url: "http://example.com/" })), "url"));
      const download = (url) => valid({ download: { label: "DL", url } });
      assert.ok(has(errorsOf(download("javascript:alert(1)")), "download.url"));
      assert.ok(has(errorsOf(download("http://example.com/a.exe")), "download.url"));
      assert.deepEqual(errorsOf(download("https://example.com/a.exe")), []);
      assert.deepEqual(errorsOf(download("/downloads/a.zip")), []);
    });
  });

  describe("ダウンロード", () => {
    it("ラベルが要る。null なら、ダウンロードなし", () => {
      assert.deepEqual(errorsOf(valid({ download: null })), []);
      assert.ok(has(errorsOf(valid({ download: { url: "/a.zip" } })), "download.label"));
      assert.ok(has(errorsOf(valid({ download: "https://example.com/a" })), "download"));
    });

    it("準備中のものには付けられない", () => {
      const product = valid({
        status: "coming-soon",
        version: null,
        released_at: null,
        download: { label: "DL", url: "https://example.com/a.exe" },
      });
      assert.ok(has(errorsOf(product), "download"));
    });
  });

  describe("バージョン・日付", () => {
    it("version は x.y.z の形。準備中だけ null にできる", () => {
      for (const version of ["1", "1.0", "v1.0.0", "1.0.0-beta", "a.b.c", "", 1, undefined]) {
        assert.ok(has(errorsOf(valid({ version })), "version"), String(version));
      }
      assert.ok(has(errorsOf(valid({ version: null })), "version"));
      assert.deepEqual(
        errorsOf(valid({ status: "coming-soon", version: null, released_at: null })),
        [],
      );
    });

    it("日付は、実在する日付だけ", () => {
      for (const date of [
        "2026-02-30",
        "2026-13-01",
        "2026-1-1",
        "2026/01/01",
        "",
        20260101,
        null,
      ]) {
        assert.equal(isValidDate(date), false, String(date));
      }
      for (const date of ["2026-02-28", "2024-02-29", "2026-12-31"])
        assert.equal(isValidDate(date), true, date);
      assert.ok(has(errorsOf(valid({ updated_at: "2026-02-30" })), "updated_at"));
      assert.ok(has(errorsOf(valid({ released_at: "nope" })), "released_at"));
      assert.ok(
        has(
          errorsOf(valid({ released_at: "2026-03-01", updated_at: "2026-02-01" })),
          "released_at",
        ),
      );
    });
  });

  describe("更新履歴", () => {
    const entry = (version, date, changes = ["変更"]) => ({ version, date, changes });

    it("新しい順に並び、先頭が product の version と同じなら通る", () => {
      const changelog = [
        entry("1.1.0", "2026-02-01"),
        entry("1.0.1", "2026-01-15"),
        entry("1.0.0", "2026-01-01"),
      ];
      assert.deepEqual(errorsOf(valid({ version: "1.1.0", changelog })), []);
      assert.deepEqual(errorsOf(valid({ version: "1.1.0", changelog: [] })), []);
    });

    it("古い順・重複・日付の逆転は落ちる", () => {
      const version = "1.1.0";
      const ascending = [entry("1.0.0", "2026-01-01"), entry("1.1.0", "2026-02-01")];
      assert.ok(errorsOf(valid({ version, changelog: ascending })).length > 0);
      const duplicate = [entry("1.1.0", "2026-02-01"), entry("1.1.0", "2026-01-01")];
      assert.ok(has(errorsOf(valid({ version, changelog: duplicate })), "新しい順"));
      const badDates = [entry("1.1.0", "2026-01-01"), entry("1.0.0", "2026-02-01")];
      assert.ok(has(errorsOf(valid({ version, changelog: badDates })), "日付"));
    });

    it("10 以上の桁も、数として比べる(1.10.0 は 1.9.0 より新しい)", () => {
      assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
      assert.ok(compareVersions("2.0.0", "1.99.99") > 0);
      assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
      const changelog = [entry("1.10.0", "2026-02-01"), entry("1.9.0", "2026-01-01")];
      assert.deepEqual(errorsOf(valid({ version: "1.10.0", changelog })), []);
    });

    it("先頭の version が product の version と違うと落ちる", () => {
      const changelog = [entry("1.0.0", "2026-01-01")];
      assert.ok(has(errorsOf(valid({ version: "1.1.0", changelog })), "先頭"));
    });

    it("項目の形が不正だと落ちる", () => {
      const base = { version: "1.0.0" };
      for (const bad of [
        { version: "1.0.0", date: "2026-01-01", changes: [] },
        { version: "1.0.0", date: "2026-01-01", changes: [""] },
        { version: "1.0.0", date: "2026-01-01" },
        { version: "1", date: "2026-01-01", changes: ["x"] },
        { version: "1.0.0", date: "2026-02-30", changes: ["x"] },
        "1.0.0",
        null,
      ]) {
        assert.ok(errorsOf(valid({ ...base, changelog: [bad] })).length > 0, JSON.stringify(bad));
      }
      assert.ok(has(errorsOf(valid({ changelog: "なし" })), "changelog"));
    });
  });

  it("cta は、あれば1〜20字", () => {
    assert.deepEqual(errorsOf(valid({ cta: "遊ぶ" })), []);
    assert.ok(has(errorsOf(valid({ cta: "" })), "cta"));
    assert.ok(has(errorsOf(valid({ cta: "あ".repeat(21) })), "cta"));
  });
});

describe("プロダクト一覧全体の検証", () => {
  const categories = categoryIds.map((id) => ({ id }));

  it("形式(version・products の配列)が違うと落ちる。旧形式(version なし)も落ちる", () => {
    for (const data of [
      null,
      [],
      {},
      { products: [] },
      { version: 1, products: [] },
      { version: 2 },
    ]) {
      assert.ok(validateProducts(data, categories).length > 0, JSON.stringify(data));
    }
    assert.deepEqual(validateProducts({ version: 2, products: [] }, categories), []);
  });

  it("id の重複は落ちる。エラーは、どの項目かがわかる", () => {
    const data = { version: 2, products: [valid(), valid()] };
    assert.ok(has(validateProducts(data, categories), "重複"));
    const broken = {
      version: 2,
      products: [valid({ id: "ok-one" }), valid({ id: "bad-one", status: "x" })],
    };
    const errors = validateProducts(broken, categories);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].startsWith("bad-one:"));
  });
});

describe("表示用の、不正な項目の除外", () => {
  const categories = categoryIds.map((id) => ({ id }));

  it("不正な項目・重複した項目だけを外して、残りは表示できる", () => {
    const data = {
      version: 2,
      products: [
        valid({ id: "good-one" }),
        valid({ id: "bad-url", url: "javascript:alert(1)" }),
        valid({ id: "good-one" }),
        null,
        valid({ id: "good-two" }),
      ],
    };
    const { products, skipped } = usableProducts(data, categories);
    assert.deepEqual(
      products.map((p) => p.id),
      ["good-one", "good-two"],
    );
    assert.deepEqual(skipped, ["bad-url", "good-one", "(不明)"]);
  });

  it("全体の形式が不正なら、何も表示しない(落ちない)", () => {
    for (const data of [null, {}, { version: 1, products: [] }, "x"]) {
      assert.deepEqual(usableProducts(data, categories).products, []);
    }
  });
});

describe("カテゴリの検証", () => {
  const category = (overrides = {}) => ({
    id: "game",
    name: "ゲーム",
    description: "説明",
    path: "/games/",
    ...overrides,
  });
  const data = (...categories) => ({ version: 1, categories });

  it("正しい形は通る。path は null でもよい(ページができるまで)", () => {
    assert.deepEqual(
      validateCategories(data(category(), category({ id: "tool", path: null }))),
      [],
    );
  });

  it("id の重複・不正な id・空の名前・不正な path は落ちる", () => {
    assert.ok(validateCategories(data(category(), category())).length > 0);
    assert.ok(validateCategories(data(category({ id: "Game" }))).length > 0);
    assert.ok(validateCategories(data(category({ name: "" }))).length > 0);
    for (const path of [
      "games/",
      "/games",
      "javascript:alert(1)",
      "//evil.example/",
      5,
      undefined,
    ]) {
      assert.ok(validateCategories(data(category({ path }))).length > 0, String(path));
    }
    for (const bad of [null, {}, { version: 2, categories: [] }, { version: 1 }]) {
      assert.ok(validateCategories(bad).length > 0);
    }
  });
});

describe("表示用の文字列", () => {
  it("価格", () => {
    assert.equal(priceLabel({ type: "free" }), "無料");
    assert.equal(priceLabel({ type: "undecided" }), "価格未定");
    assert.equal(priceLabel({ type: "paid", amount: 980, currency: "JPY" }), "¥980");
    assert.equal(priceLabel({ type: "paid", amount: 1200, currency: "JPY" }), "¥1,200");
    assert.equal(priceLabel({ type: "paid", amount: 1234567, currency: "JPY" }), "¥1,234,567");
  });

  it("バージョンと日付", () => {
    assert.equal(versionLabel("0.3.0"), "v0.3.0");
    assert.equal(formatDate("2026-09-20"), "2026年9月20日");
    assert.equal(formatDate("2026-01-05"), "2026年1月5日");
  });
});

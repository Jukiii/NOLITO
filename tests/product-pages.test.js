import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isSafeUrl } from "../public/assets/js/products/schema.js";
import {
  checkProductPages,
  formatFiles,
  loadProductInputs,
  staleProductPages,
  writeProductPages,
} from "../scripts/lib/product-build.mjs";
import {
  GENERATED_KEYWORD,
  GENERATED_MARKER,
  buildProductPages,
  renderProductPage,
} from "../scripts/lib/product-pages.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = join(root, "public");
const site = { name: "NOLITO", url: "https://nolito.pages.dev", language: "ja" };
const categoryData = {
  version: 1,
  categories: [
    { id: "game", name: "ゲーム", description: "d", path: "/games/" },
    { id: "software", name: "ソフト", description: "d", path: "/software/" },
    { id: "tool", name: "ツール", description: "d", path: null },
  ],
};
const softwareCategory = categoryData.categories[1];
const gameCategory = categoryData.categories[0];

// ソフト(詳細ページが「使う先」)。有料・GitHub Releases・購入リンクつき
const software = (overrides = {}) => ({
  id: "sample-app",
  category: "software",
  title: "サンプルアプリ",
  description: "サンプルの説明です。",
  details: ["最初の段落です。", "次の段落です。"],
  image: { src: "/assets/img/sample.svg", alt: "サンプルのイラスト" },
  screenshots: [
    { src: "/assets/img/shot1.webp", alt: "一覧の画面", width: 1000, height: 700 },
    { src: "/assets/img/shot2.webp", alt: "設定の画面", width: 800, height: 600 },
  ],
  platforms: ["windows", "mac"],
  requirements: [
    { label: "対応OS", value: "Windows 10 以降" },
    { label: "メモリ", value: "4GB 以上" },
  ],
  price: { type: "paid", amount: 1200, currency: "JPY" },
  status: "released",
  url: "/software/sample-app/",
  detail_path: "/software/sample-app/",
  cta: "詳細を見る",
  download: { label: "Windows版を入手", url: "https://github.com/Jukiii/sample/releases/latest" },
  purchase: { label: "購入ページへ", url: "https://shop.example.com/items/1" },
  version: "1.1.0",
  released_at: "2026-01-01",
  updated_at: "2026-02-01",
  faq: [
    {
      question: "動きません",
      answer: "再起動してください。\nそれでも直らないときは、連絡してください。",
    },
    { question: "無料ですか?", answer: "有料です。" },
  ],
  changelog: [
    { version: "1.1.0", date: "2026-02-01", changes: ["機能を追加", "不具合を修正"] },
    { version: "1.0.0", date: "2026-01-01", changes: ["公開"] },
  ],
  ...overrides,
});

// ゲーム(詳細ページとは別に、遊ぶ先がある)
const game = (overrides = {}) =>
  software({
    id: "sample-game",
    category: "game",
    title: "サンプルゲーム",
    url: "/games/sample-game/",
    detail_path: "/games/sample-game/about/",
    price: { type: "free" },
    platforms: ["web"],
    download: null,
    purchase: null,
    cta: "遊ぶ",
    ...overrides,
  });

const render = (product, category = softwareCategory) => renderProductPage(product, category, site);
// from から、その後にある最初の to まで(to は from より後から探す)
const between = (html, from, to) => {
  const start = html.indexOf(from);
  assert.notEqual(start, -1, `${from} が見つかりません`);
  return html.slice(start, html.indexOf(to, start));
};

describe("詳細ページの内容", () => {
  const html = render(software());

  it("題名は h1 が1つだけ。ページの題名・canonical・説明・生成の印がある", () => {
    assert.equal(html.match(/<h1[ >]/g).length, 1);
    assert.ok(html.includes('<h1 class="product__title">サンプルアプリ</h1>'));
    assert.ok(html.includes("<title>サンプルアプリの詳細 | NOLITO</title>"));
    assert.ok(
      html.includes(
        '<link rel="canonical" href="https://nolito.pages.dev/software/sample-app/" />',
      ),
    );
    assert.ok(html.includes('content="サンプルの説明です。"'));
    assert.ok(html.startsWith(`<!doctype html>\n${GENERATED_MARKER}\n`));
    assert.ok(html.includes(GENERATED_KEYWORD));
  });

  it("状態(文字)・対応・価格・バージョン・公開日・更新日を、文字のラベルつきで示す", () => {
    assert.ok(html.includes('<span class="badge badge--live">公開中</span>'));
    const meta = between(html, '<dl class="product__meta">', "</dl>");
    for (const word of [
      "対応",
      "Windows / macOS",
      "価格",
      "¥1,200",
      "バージョン",
      "v1.1.0",
      "公開",
      "更新",
    ]) {
      assert.ok(meta.includes(word), word);
    }
    assert.ok(meta.includes('<time datetime="2026-01-01">2026年1月1日</time>'));
    assert.ok(meta.includes('<time datetime="2026-02-01">2026年2月1日</time>'));
  });

  it("カテゴリへのリンクと、一覧に戻るリンクがある。広告の枠は、非表示のまま1つ", () => {
    assert.ok(html.includes('<a href="/software/">ソフト</a>'));
    assert.ok(html.includes("← ソフトの一覧へ"));
    assert.equal(html.match(/data-ad-slot="page"/g).length, 1);
    assert.match(html, /data-ad-slot="page"[^>]*\bhidden\b/);
  });

  it("記事用ではなく、詳細ページ用の CSS を読み込む", () => {
    assert.ok(html.includes('href="/assets/css/products.css"'));
    assert.ok(!html.includes("articles.css"));
  });

  it("見出しは、h1 → h2(節)→ h3(更新履歴の版)の順で、節は決まった順に並ぶ", () => {
    const headings = [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => [
      Number(m[1]),
      m[2]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    ]);
    assert.deepEqual(
      headings.map(([level, text]) => `${level}:${text}`),
      [
        "1:サンプルアプリ",
        "2:詳しい説明",
        "2:画像",
        "2:動作環境",
        "2:よくある質問",
        "2:更新履歴",
        "3:v1.1.0 2026年2月1日",
        "3:v1.0.0 2026年1月1日",
        "2:サポート",
      ],
    );
  });

  it("各節は、見出しと関連づけられ(aria-labelledby)、アンカーで開ける", () => {
    for (const id of ["about", "screenshots", "requirements", "faq", "changelog", "support"]) {
      assert.ok(
        html.includes(
          `<section class="product__section" id="${id}" aria-labelledby="${id}-title">`,
        ),
        id,
      );
      assert.ok(html.includes(`<h2 id="${id}-title">`), id);
    }
  });

  it("詳しい説明は、段落ごと。画像は、代替テキストと幅・高さつき", () => {
    assert.ok(html.includes("<p>最初の段落です。</p>") && html.includes("<p>次の段落です。</p>"));
    assert.ok(html.includes('alt="一覧の画面" width="1000" height="700" loading="lazy"'));
    assert.ok(html.includes('alt="設定の画面" width="800" height="600" loading="lazy"'));
    assert.ok(
      html.includes(
        '<div class="product__hero"><img src="/assets/img/sample.svg" alt="サンプルのイラスト" />',
      ),
    );
  });

  it("動作環境は、項目名と値の組(dl)", () => {
    const spec = between(html, '<dl class="spec">', "</dl>");
    assert.ok(spec.includes("<dt>対応OS</dt><dd>Windows 10 以降</dd>"));
    assert.ok(spec.includes("<dt>メモリ</dt><dd>4GB 以上</dd>"));
  });

  it("FAQ は <details> で、答えの改行は段落に分かれる", () => {
    assert.equal(html.match(/<details class="faq__item">/g).length, 2);
    assert.ok(html.includes('<summary class="faq__question">動きません</summary>'));
    assert.ok(
      html.includes("<p>再起動してください。</p><p>それでも直らないときは、連絡してください。</p>"),
    );
  });

  it("更新履歴は、新しい順に、版・日付・変更の内容を出す", () => {
    const log = between(html, '<ol class="changelog">', "</ol>");
    assert.ok(log.indexOf("v1.1.0") < log.indexOf("v1.0.0"));
    assert.ok(log.includes("<li>機能を追加</li><li>不具合を修正</li>"));
    assert.ok(log.includes('<time datetime="2026-02-01">2026年2月1日</time>'));
  });

  it("サポートの節は、いつも、サポートのページへのリンクを出す", () => {
    assert.ok(html.includes('<a href="/support/">サポート</a>のページ'));
    const bare = render(
      software({
        details: [],
        screenshots: [],
        requirements: [],
        faq: [],
        changelog: [],
        image: null,
      }),
    );
    assert.ok(bare.includes('id="support"'));
  });

  it("データがない節は、出さない(空の見出しを作らない)", () => {
    const bare = render(
      software({
        details: [],
        screenshots: [],
        requirements: [],
        faq: [],
        changelog: [],
        image: null,
      }),
    );
    for (const id of ["about", "screenshots", "requirements", "faq", "changelog"]) {
      assert.ok(!bare.includes(`id="${id}"`), id);
    }
    assert.ok(!bare.includes("product__hero"));
  });
});

describe("ボタンと、移動先の注意書き", () => {
  it("ソフト(詳細ページ自身が使う先)は、自分へのリンクのボタンを出さない", () => {
    const html = render(software());
    const actions = between(html, '<div class="product__actions">', "</header>");
    assert.ok(!actions.includes('href="/software/sample-app/"'));
    assert.ok(!actions.includes("button--primary"));
  });

  it("GitHub Releases・購入は、外部リンクで rel が付き、移動先の注意書きが出る", () => {
    const html = render(software());
    assert.ok(
      html.includes(
        '<a class="button button--secondary" href="https://github.com/Jukiii/sample/releases/latest" rel="noopener noreferrer">Windows版を入手</a>',
      ),
    );
    assert.ok(
      html.includes(
        '<a class="button button--secondary" href="https://shop.example.com/items/1" rel="noopener noreferrer">購入ページへ</a>',
      ),
    );
    assert.ok(html.includes("配布ページ(GitHub Releases・外部サイト)へ移動します。"));
    assert.ok(html.includes("shop.example.com"));
  });

  it("ゲーム(遊ぶ先が別にある)は、遊ぶボタンを先頭に出す。サイト内のリンクに rel はない", () => {
    const html = render(game(), gameCategory);
    const actions = between(html, '<div class="product__actions">', "</header>");
    assert.ok(
      actions.startsWith(
        '<div class="product__actions"><a class="button button--primary" href="/games/sample-game/">遊ぶ</a>',
      ),
    );
    assert.ok(!actions.includes("rel="));
  });

  it("サイト内のダウンロードには rel も注意書きも付けない", () => {
    const html = render(
      game({ download: { label: "入手", url: "/downloads/a.zip" } }),
      gameCategory,
    );
    assert.ok(
      html.includes('<a class="button button--secondary" href="/downloads/a.zip">入手</a>'),
    );
    assert.ok(!html.includes("product__note"));
  });

  it("準備中は、ボタンも注意書きも出さない", () => {
    const html = render(
      software({
        status: "coming-soon",
        version: null,
        released_at: null,
        download: null,
        purchase: null,
        price: { type: "undecided" },
      }),
    );
    assert.ok(!html.includes("product__actions"));
    assert.ok(!html.includes("product__note"));
    assert.ok(html.includes('<span class="badge badge--soon">準備中</span>'));
    assert.ok(html.includes("価格未定"));
    assert.ok(!html.includes("<dt>バージョン</dt>"));
    assert.ok(!html.includes("<dt>公開</dt>"));
  });
});

describe("HTML の安全性", () => {
  const hostile = software({
    title: '<script>alert("t")</script>',
    description: '"><img src=x onerror=alert(1)>',
    details: ["<b onmouseover=alert(1)>段落</b>"],
    image: { src: "/assets/img/a.svg", alt: '"><script>alert(2)</script>' },
    screenshots: [{ src: "/a.webp", alt: '" onload="alert(3)', width: 10, height: 10 }],
    requirements: [{ label: "<i>項目</i>", value: "<u>値</u>" }],
    faq: [{ question: "<script>q</script>", answer: "<iframe src=x></iframe>" }],
    cta: "<i>遊ぶ</i>",
    changelog: [{ version: "1.1.0", date: "2026-02-01", changes: ["<script>c</script>"] }],
    download: { label: "<b>入手</b>", url: "https://example.com/a.zip?x=1&y=2" },
    purchase: { label: '"><a>', url: "https://shop.example.com/i?a=1&b=2" },
  });
  const html = render(hostile);

  it("値に含まれる HTML は、タグとして出力されない(すべて文字になる)", () => {
    const body = html.slice(html.indexOf("<main"));
    for (const tag of [
      "<script",
      "<img src=x",
      "<b onmouseover",
      "<iframe",
      "<i>",
      "<u>",
      "<b>入手",
    ]) {
      assert.ok(!body.includes(tag), tag);
    }
    assert.ok(body.includes("&lt;script&gt;alert(&quot;t&quot;)&lt;/script&gt;"));
  });

  it("属性の値は、引用符を破れない", () => {
    assert.ok(!html.includes('" onload="alert(3)'));
    assert.ok(html.includes('alt="&quot; onload=&quot;alert(3)"'));
    assert.ok(html.includes("&amp;y=2") && html.includes("&amp;b=2"));
  });

  it("すべてのリンク・画像の場所は、検証を通った安全な URL か、ページ内のリンクだけ", () => {
    const urls = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) =>
      m[1].replaceAll("&amp;", "&"),
    );
    assert.ok(urls.length > 10);
    for (const url of urls) {
      assert.ok(
        url.startsWith("#") ||
          url === "" ||
          isSafeUrl(url) ||
          url === "https://nolito.pages.dev/software/sample-app/",
        url,
      );
    }
  });
});

describe("詳細ページの一括生成", () => {
  const productData = (...products) => ({ version: 3, products });

  it("detail_path があるものだけ、その場所に作る", () => {
    const files = buildProductPages({
      productData: productData(
        software(),
        game({ detail_path: null }),
        game({ id: "g2", detail_path: "/games/g2/about/" }),
      ),
      categoryData,
      site,
    });
    assert.deepEqual([...files.keys()].sort(), [
      "games/g2/about/index.html",
      "software/sample-app/index.html",
    ]);
    assert.ok(files.get("software/sample-app/index.html").includes("サンプルアプリ"));
  });

  it("商品が0件・詳細ページのある商品が0件なら、何も作らない", () => {
    assert.equal(buildProductPages({ productData: productData(), categoryData, site }).size, 0);
    const noDetail = productData(game({ detail_path: null }));
    assert.equal(buildProductPages({ productData: noDetail, categoryData, site }).size, 0);
  });

  it("データに問題があれば、まとめて失敗する(黙って捨てない)", () => {
    const bad = productData(
      software({ id: "a", url: "javascript:alert(1)" }),
      software({ id: "b", faq: "なし" }),
    );
    assert.throws(
      () => buildProductPages({ productData: bad, categoryData, site }),
      (error) => error.message.includes("a: url") && error.message.includes("b: faq"),
    );
    assert.throws(() => buildProductPages({ productData: { products: [] }, categoryData, site }));
  });

  it("同じ場所を2つのプロダクトが使うデータは、失敗する", () => {
    const dup = productData(software({ id: "a" }), software({ id: "b", url: "/software/b/" }));
    assert.throws(() => buildProductPages({ productData: dup, categoryData, site }), /重複/);
  });
});

describe("書き出しと検査", () => {
  const withTempDir = (run) => {
    const dir = mkdtempSync(join(tmpdir(), "nolito-products-"));
    try {
      run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const put = (dir, path, content) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const files = () =>
    buildProductPages({ productData: { version: 3, products: [software()] }, categoryData, site });

  it("書き出すと、検査で問題がない", () => {
    withTempDir((dir) => {
      writeProductPages(dir, files());
      assert.ok(existsSync(join(dir, "software/sample-app/index.html")));
      assert.deepEqual(checkProductPages(dir, files()), []);
    });
  });

  it("生成物が無い・内容が違うと、検査で見つかる", () => {
    withTempDir((dir) => {
      assert.ok(
        checkProductPages(dir, files()).some((line) => line.includes("生成されていません")),
      );
      writeProductPages(dir, files());
      const target = join(dir, "software/sample-app/index.html");
      writeFileSync(target, `${readFileSync(target, "utf8")}<!-- 手で足した -->`);
      assert.ok(checkProductPages(dir, files()).some((line) => line.includes("内容が違います")));
    });
  });

  it("商品を消した・場所を変えた後に残った古い生成物を、見つけて、書き出しで消す", () => {
    withTempDir((dir) => {
      writeProductPages(dir, files());
      const moved = buildProductPages({
        productData: {
          version: 3,
          products: [software({ url: "/software/moved/", detail_path: "/software/moved/" })],
        },
        categoryData,
        site,
      });
      assert.deepEqual(staleProductPages(dir, moved), ["software/sample-app/index.html"]);
      assert.ok(
        checkProductPages(dir, moved).some((line) =>
          line.includes("対応するプロダクトがありません"),
        ),
      );
      writeProductPages(dir, moved);
      assert.ok(!existsSync(join(dir, "software/sample-app/index.html")));
      assert.deepEqual(checkProductPages(dir, moved), []);
    });
  });

  it("印のない手書きのページは、古い生成物とはみなさず、消さない", () => {
    withTempDir((dir) => {
      put(dir, "software/index.html", "<!doctype html><p>手書き</p>");
      writeProductPages(dir, files());
      assert.ok(existsSync(join(dir, "software/index.html")));
      assert.deepEqual(staleProductPages(dir, files()), []);
    });
  });

  it("生成する場所に手書きのページがあると、上書きせずに失敗する(検査でも見つかる)", () => {
    withTempDir((dir) => {
      put(dir, "software/sample-app/index.html", "<!doctype html><p>手書き</p>");
      assert.throws(
        () => writeProductPages(dir, files()),
        /手書きのページがあるため、上書きしません/,
      );
      assert.equal(
        readFileSync(join(dir, "software/sample-app/index.html"), "utf8"),
        "<!doctype html><p>手書き</p>",
      );
      assert.ok(checkProductPages(dir, files()).some((line) => line.includes("手書きのページ")));
    });
  });
});

describe("実際のデータの生成物", () => {
  const inputs = loadProductInputs(publicDir);

  it("コミットされた詳細ページが、products.json から作られるものと一致している(最新)", async () => {
    const formatted = await formatFiles(buildProductPages(inputs), root);
    assert.deepEqual(
      checkProductPages(publicDir, formatted),
      [],
      "npm run build:products を実行してください",
    );
    assert.ok(formatted.size >= 1);
  });

  it("整形は、何度かけても同じ結果になる(生成が安定している)", async () => {
    const once = await formatFiles(buildProductPages(inputs), root);
    const twice = await formatFiles(once, root);
    assert.deepEqual([...twice], [...once]);
  });

  it("詳細ページのあるプロダクトは、カードから詳細ページへ行ける(サイト内の url と別なら「詳細」)", () => {
    for (const product of inputs.productData.products.filter((p) => p.detail_path)) {
      assert.ok(existsSync(join(publicDir, product.detail_path.slice(1), "index.html")));
    }
  });
});

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildOutputs,
  checkOutputs,
  loadSite,
  loadSources,
  writeOutputs,
} from "../scripts/lib/build.mjs";
import { isValidDate, splitFrontmatter, validateArticle } from "../scripts/lib/frontmatter.mjs";
import { escapeHtml, formatDateJa } from "../scripts/lib/html.mjs";
import { classifyUrl, renderMarkdown } from "../scripts/lib/markdown.mjs";

const site = { name: "NOLITO", url: "https://example.test", language: "ja" };

const article = (front = {}, body = "## 見出し\n\n本文です。\n") => {
  const data = {
    title: "題名",
    description: "記事の説明です。十文字以上あります。",
    date: "2026-09-20",
    ...front,
  };
  const yaml = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  return `---\n${yaml}\n---\n${body}`;
};

describe("HTML の部品", () => {
  it("特殊文字をエスケープする", () => {
    assert.equal(
      escapeHtml(`<a href="x" onclick='y'>&</a>`),
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
    assert.equal(escapeHtml(123), "123");
  });

  it("日付を日本語にする", () => {
    assert.equal(formatDateJa("2026-09-05"), "2026年9月5日");
  });
});

describe("先頭情報の読み取り", () => {
  it("YAML と本文に分ける。日付は文字列のまま", () => {
    const { data, body } = splitFrontmatter(article({ tags: ["ゲーム"] }, "## A\n"));
    assert.equal(data.date, "2026-09-20");
    assert.deepEqual(data.tags, ["ゲーム"]);
    assert.equal(body, "## A\n");
  });

  it("Windows の改行・BOM があっても読める", () => {
    const text = `\uFEFF${article().replace(/\n/g, "\r\n")}`;
    assert.equal(splitFrontmatter(text).data.title, "題名");
  });

  it("先頭情報がない・壊れている・形式が違うとエラー", () => {
    assert.throws(() => splitFrontmatter("# 本文だけ"), /先頭に ---/);
    assert.throws(() => splitFrontmatter("---\ntitle: [\n---\n本文"), /読み取れません/);
    assert.throws(() => splitFrontmatter("---\n- a\n- b\n---\n本文"), /項目名と値の組/);
  });

  it("実在しない日付は不正", () => {
    assert.equal(isValidDate("2026-09-20"), true);
    for (const bad of ["2026-02-30", "2026-13-01", "2026-9-1", "20260920", "", 5, null]) {
      assert.equal(isValidDate(bad), false, String(bad));
    }
  });
});

describe("記事の情報の検証", () => {
  const ok = { title: "題名", description: "十文字以上の説明文です。", date: "2026-09-20" };

  it("正しい情報は正規化して返す", () => {
    const result = validateArticle({ ...ok, tags: [" ゲーム "], updated: "2026-09-21" }, "my-post");
    assert.deepEqual(result, {
      slug: "my-post",
      title: "題名",
      description: "十文字以上の説明文です。",
      date: "2026-09-20",
      updated: "2026-09-21",
      tags: ["ゲーム"],
      draft: false,
    });
  });

  it("必須項目がないと、問題をまとめて報告する", () => {
    assert.throws(
      () => validateArticle({}, "post"),
      (error) => {
        assert.match(error.message, /title/);
        assert.match(error.message, /description/);
        assert.match(error.message, /date/);
        return true;
      },
    );
  });

  it("スラッグは英小文字・数字・ハイフンだけ", () => {
    for (const slug of ["Post", "my_post", "日本語", "-a", "a--b", "a b"]) {
      assert.throws(() => validateArticle(ok, slug), /スラッグ/, slug);
    }
    assert.doesNotThrow(() => validateArticle(ok, "post-2026"));
  });

  it("説明の長さ・日付の前後・タグの形式を検証する", () => {
    assert.throws(() => validateArticle({ ...ok, description: "短い" }, "p"), /description/);
    assert.throws(
      () => validateArticle({ ...ok, description: "あ".repeat(161) }, "p"),
      /description/,
    );
    assert.throws(
      () => validateArticle({ ...ok, updated: "2026-09-01" }, "p"),
      /updated は date より前/,
    );
    assert.throws(() => validateArticle({ ...ok, tags: "ゲーム" }, "p"), /tags/);
    assert.throws(() => validateArticle({ ...ok, tags: ["a", "a"] }, "p"), /重複/);
    assert.throws(
      () => validateArticle({ ...ok, tags: ["1", "2", "3", "4", "5", "6"] }, "p"),
      /5個まで/,
    );
    assert.throws(() => validateArticle({ ...ok, draft: "yes" }, "p"), /draft/);
  });

  it("draft: true を読み取る", () => {
    assert.equal(validateArticle({ ...ok, draft: true }, "p").draft, true);
  });
});

describe("リンク・画像の URL の分類", () => {
  const cases = [
    ["#top", "anchor"],
    ["/articles/", "internal"],
    ["./a", "internal"],
    ["../a", "internal"],
    ["page", "internal"],
    ["https://example.test/x", "internal"],
    ["https://other.example/x", "external"],
    ["http://other.example/x", "external"],
    ["mailto:a@example.com", "mail"],
    ["javascript:alert(1)", "unsafe"],
    ["JavaScript:alert(1)", "unsafe"],
    [" javascript:alert(1)", "unsafe"],
    ["java\nscript:alert(1)", "unsafe"],
    ["java\tscript:alert(1)", "unsafe"],
    ["data:text/html,<script>alert(1)</script>", "unsafe"],
    ["vbscript:msgbox(1)", "unsafe"],
    ["file:///etc/passwd", "unsafe"],
    ["//evil.example/x", "unsafe"],
    ["", "unsafe"],
  ];
  for (const [href, expected] of cases) {
    it(`${JSON.stringify(href)} は ${expected}`, () => {
      assert.equal(classifyUrl(href, "example.test"), expected);
    });
  }
});

describe("Markdown の変換(安全性)", () => {
  const render = (markdown) => renderMarkdown(markdown, { siteHost: "example.test" });

  it("見出し・段落・リスト・表・コードを変換する", () => {
    const html = render(
      "## 見出し\n\n段落 **太字**\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```\n",
    );
    assert.match(html, /<h2>見出し<\/h2>/);
    assert.match(html, /<strong>太字<\/strong>/);
    assert.match(html, /<li>a<\/li>/);
    assert.match(html, /<table>/);
    assert.match(html, /<pre><code>code/);
  });

  it("生の HTML(script・onerror・iframe)は、実行できない文字になる", () => {
    const html = render(
      '## 見出し\n\n<script>alert(1)</script>\n\n文中の<img src=x onerror=alert(1)>と<b>強調</b>\n\n<iframe src="https://evil.example"></iframe>\n',
    );
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /<img[^>]+onerror/i);
    assert.doesNotMatch(html, /<iframe/i);
    assert.doesNotMatch(html, /<b>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  });

  it("コードブロックの中の HTML はエスケープされ、実行されない", () => {
    const html = render("```html\n<script>alert(1)</script>\n```\n\n`<b>x</b>`\n");
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /<code>&lt;b&gt;x&lt;\/b&gt;<\/code>/);
  });

  it("危険なリンクはビルドを失敗させる(黙って捨てない)", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "//evil.example",
    ]) {
      assert.throws(() => render(`[押す](${href})`), /使えないリンク/, href);
    }
  });

  it("外部リンクには rel を付け、サイト内・自サイトには付けない", () => {
    const html = render(
      "[外](https://other.example/) [内](/articles/) [自](https://example.test/x) [メール](mailto:a@example.com)",
    );
    assert.match(html, /<a href="https:\/\/other\.example\/" rel="noopener noreferrer">外<\/a>/);
    assert.match(html, /<a href="\/articles\/">内<\/a>/);
    assert.match(html, /<a href="https:\/\/example\.test\/x">自<\/a>/);
    assert.match(html, /<a href="mailto:a@example\.com">メール<\/a>/);
  });

  it("リンクの属性値は、引用符を含んでもエスケープされる", () => {
    const html = render('[x](/a "タイトル\\" onmouseover=\\"alert(1)")');
    assert.doesNotMatch(html, /onmouseover=(?!&quot;)/);
    assert.ok(!/ onmouseover=/.test(html.replace(/&quot;/g, "")) || html.includes("&quot;"));
  });

  it("画像には代替テキストが必須", () => {
    assert.throws(() => render("![](/a.png)"), /代替テキスト/);
    assert.throws(() => render("![ ](/a.png)"), /代替テキスト/);
    const html = render('![猫の写真](/assets/img/cat.png "タイトル")');
    assert.match(
      html,
      /<img src="\/assets\/img\/cat\.png" alt="猫の写真" title="タイトル" loading="lazy" decoding="async">/,
    );
  });

  it("画像の場所は、サイト内か https だけ", () => {
    assert.doesNotThrow(() => render("![a](https://cdn.example/x.png)"));
    for (const src of [
      "http://cdn.example/x.png",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "//cdn.example/x.png",
    ]) {
      assert.throws(() => render(`![a](${src})`), /使えない画像/, src);
    }
  });

  it("alt の中の引用符・HTML はエスケープされる", () => {
    const html = render('![a"><script>alert(1)</script>](/x.png)');
    assert.doesNotMatch(html, /<script/i);
  });

  it("本文の見出し1(#)は使えない", () => {
    assert.throws(() => render("# 大見出し\n"), /見出し1/);
    assert.doesNotThrow(() => render("## OK\n### OK\n"));
  });
});

describe("記事のビルド", () => {
  it("記事のページ・一覧・索引を作る", () => {
    const { files, articles } = buildOutputs(
      [{ slug: "first", text: article({ title: "最初 & <記事>", tags: ["ゲーム"] }) }],
      site,
    );
    assert.deepEqual([...files.keys()].sort(), [
      "articles/first/index.html",
      "articles/index.html",
      "data/articles.json",
    ]);
    assert.equal(articles.length, 1);
    assert.deepEqual(JSON.parse(files.get("data/articles.json")), {
      articles: [
        {
          slug: "first",
          title: "最初 & <記事>",
          description: "記事の説明です。十文字以上あります。",
          date: "2026-09-20",
          updated: null,
          tags: ["ゲーム"],
          url: "/articles/first/",
        },
      ],
    });
  });

  it("記事ページ: 題名はエスケープされ、h1 は1つ、正規URL・OGP・日付・タグがある", () => {
    const { files } = buildOutputs(
      [
        {
          slug: "first",
          text: article({ title: 'a "b" <c>', tags: ["タグ<1>"], updated: "2026-09-25" }),
        },
      ],
      site,
    );
    const html = files.get("articles/first/index.html");
    assert.match(html, /<html lang="ja">/);
    assert.match(html, /<title>a &quot;b&quot; &lt;c&gt; \| NOLITO<\/title>/);
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/example\.test\/articles\/first\/" \/>/,
    );
    assert.match(html, /<meta property="og:type" content="article" \/>/);
    assert.match(
      html,
      /<meta property="og:url" content="https:\/\/example\.test\/articles\/first\/" \/>/,
    );
    assert.match(html, /<time datetime="2026-09-20">2026年9月20日<\/time>/);
    assert.match(html, /更新 <time datetime="2026-09-25">2026年9月25日<\/time>/);
    assert.match(html, /<li class="tag">タグ&lt;1&gt;<\/li>/);
    assert.equal((html.match(/<h1/g) ?? []).length, 1);
    assert.match(html, /<h2>見出し<\/h2>/);
    assert.match(html, /data-ad-slot="article"[^>]*hidden/);
    // テーマの、ちらつき防止スクリプト(すべてのページ共通・固定の内容。Phase 21 PR1)を除いた
    // 残りに、type="module" 以外の script がないこと(記事の内容からの注入を防ぐ)
    const withoutThemeScript = html.replace(
      /<script>[\s\S]*?nolito:theme:v1[\s\S]*?<\/script>/,
      "",
    );
    assert.doesNotMatch(withoutThemeScript, /<script(?![^>]*type="module")/);
  });

  it("更新日が公開日と同じなら、更新の表示を出さない", () => {
    const { files } = buildOutputs([{ slug: "a", text: article({ updated: "2026-09-20" }) }], site);
    assert.doesNotMatch(files.get("articles/a/index.html"), /更新/);
  });

  it("一覧は新しい順(同じ日付ならスラッグ順)", () => {
    const { articles, files } = buildOutputs(
      [
        { slug: "old", text: article({ date: "2026-01-01" }) },
        { slug: "b-new", text: article({ date: "2026-09-20" }) },
        { slug: "a-new", text: article({ date: "2026-09-20" }) },
        { slug: "mid", text: article({ date: "2026-05-05" }) },
      ],
      site,
    );
    assert.deepEqual(
      articles.map((a) => a.slug),
      ["a-new", "b-new", "mid", "old"],
    );
    const index = files.get("articles/index.html");
    assert.ok(index.indexOf("/articles/a-new/") < index.indexOf("/articles/old/"));
  });

  it("下書きは公開しない(本文が書きかけでも、ビルドは止まらない)", () => {
    const { files, articles } = buildOutputs(
      [
        { slug: "published", text: article() },
        { slug: "wip", text: article({ draft: true }, "# 書きかけ\n\n[壊れた](javascript:x)\n") },
      ],
      site,
    );
    assert.equal(articles.length, 1);
    assert.equal(files.has("articles/wip/index.html"), false);
    assert.doesNotMatch(files.get("articles/index.html"), /wip/);
  });

  it("記事がなくても、一覧ページと索引を作る", () => {
    const { files } = buildOutputs([], site);
    assert.match(files.get("articles/index.html"), /まだ記事がありません/);
    assert.deepEqual(JSON.parse(files.get("data/articles.json")), { articles: [] });
  });

  it("問題のある原稿は、すべてをまとめて報告する", () => {
    assert.throws(
      () =>
        buildOutputs(
          [
            { slug: "no-title", text: article({ title: "" }) },
            { slug: "bad-link", text: article({}, "## a\n\n[x](javascript:1)\n") },
            { slug: "fine", text: article() },
          ],
          site,
        ),
      (error) => {
        assert.match(error.message, /content\/articles\/no-title\.md/);
        assert.match(error.message, /title/);
        assert.match(error.message, /content\/articles\/bad-link\.md/);
        assert.match(error.message, /使えないリンク/);
        assert.doesNotMatch(error.message, /fine\.md/);
        return true;
      },
    );
  });

  it("同じ入力から、いつも同じ出力になる(日時などを含まない)", () => {
    const sources = [{ slug: "a", text: article({ tags: ["x"] }) }];
    const first = buildOutputs(sources, site).files;
    const second = buildOutputs(sources, site).files;
    assert.deepEqual([...first], [...second]);
  });
});

describe("書き出しと検査", () => {
  function workspace() {
    const dir = mkdtempSync(join(tmpdir(), "nolito-articles-"));
    mkdirSync(join(dir, "public", "data"), { recursive: true });
    return dir;
  }

  it("書き出した後は、検査が通る", () => {
    const dir = workspace();
    try {
      const { files } = buildOutputs([{ slug: "a", text: article() }], site);
      writeOutputs(join(dir, "public"), files);
      assert.deepEqual(checkOutputs(join(dir, "public"), files), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("生成されていない・内容が違う・対応する記事がないものを検出する", () => {
    const dir = workspace();
    try {
      const publicDir = join(dir, "public");
      const { files } = buildOutputs([{ slug: "a", text: article() }], site);
      assert.match(checkOutputs(publicDir, files).join("\n"), /生成されていません/);

      writeOutputs(publicDir, files);
      writeFileSync(join(publicDir, "articles", "a", "index.html"), "手で書き換えた");
      assert.match(
        checkOutputs(publicDir, files).join("\n"),
        /articles\/a\/index\.html: 原稿と内容が違います/,
      );

      writeOutputs(publicDir, files);
      const fewer = buildOutputs([], site).files;
      assert.match(
        checkOutputs(publicDir, fewer).join("\n"),
        /articles\/a\/index\.html: 対応する記事がありません/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("書き出しで、記事でなくなったページを消す", () => {
    const dir = workspace();
    try {
      const publicDir = join(dir, "public");
      writeOutputs(
        publicDir,
        buildOutputs(
          [
            { slug: "a", text: article() },
            { slug: "b", text: article() },
          ],
          site,
        ).files,
      );
      writeOutputs(publicDir, buildOutputs([{ slug: "a", text: article() }], site).files);
      assert.equal(loadSources(join(dir, "none")).length, 0);
      assert.throws(() => readFileSync(join(publicDir, "articles", "b", "index.html")));
      assert.ok(
        readFileSync(join(publicDir, "articles", "a", "index.html"), "utf8").includes("題名"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("公開している記事(このリポジトリの実際のデータ)", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const publicDir = join(root, "public");

  it("原稿の検証を通り、生成物(コミットされたもの)が最新である", () => {
    const { files } = buildOutputs(
      loadSources(join(root, "content", "articles")),
      loadSite(publicDir),
    );
    assert.deepEqual(
      checkOutputs(publicDir, files),
      [],
      "npm run build:articles を実行してください",
    );
  });
});

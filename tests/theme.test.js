// ライト・ダーク・システムテーマ(Phase 21 PR1)のテスト。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_THEME,
  THEME_KEY,
  THEMES,
  applyTheme,
  isTheme,
  loadTheme,
  saveTheme,
} from "../public/assets/js/components/theme.js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

function htmlFiles(dir = publicDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

// 色の明るさ(WCAG)と、比。tests/backgrounds.test.js と同じ計算式
const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// tokens.css から、色トークンの表([名前, 値])を取り出す。{ start, end } は、検索する範囲の目印の文字列
function tokensBetween(css, start, end) {
  const from = css.indexOf(start);
  const to = css.indexOf(end, from);
  const block = css.slice(from, to === -1 ? undefined : to);
  return Object.fromEntries(
    [...block.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-fA-F]{3,6})/g)].map((m) => [m[1], m[2]]),
  );
}

const tokensCss = read("public/assets/css/tokens.css");
const light = tokensBetween(tokensCss, ":root {", "\n}");
// ダークが上書きしない項目(例: アクセント)は、:root(ライト)の値のまま引き継がれる(実際のCSSと同じ)
const dark = { ...light, ...tokensBetween(tokensCss, ':root[data-theme="dark"]', "\n}") };

describe("theme.js(保存・読み込み・反映)", () => {
  it("THEME_KEY・THEMES・DEFAULT_THEME", () => {
    assert.equal(THEME_KEY, "nolito:theme:v1");
    assert.deepEqual(THEMES, ["light", "dark", "system"]);
    assert.equal(DEFAULT_THEME, "system");
  });

  it("isTheme: 3つの値だけ true", () => {
    assert.equal(isTheme("light"), true);
    assert.equal(isTheme("dark"), true);
    assert.equal(isTheme("system"), true);
    for (const bad of ["Light", "", null, undefined, 1, "auto"]) assert.equal(isTheme(bad), false);
  });

  // 偽の localStorage(node:test には DOM がないため)
  function fakeStorage(initial = {}) {
    const data = { ...initial };
    return {
      getItem: (key) => (key in data ? data[key] : null),
      setItem: (key, value) => {
        data[key] = String(value);
      },
      data,
    };
  }

  it("loadTheme: 保存されていれば、その値。なければ・不正なら、既定(system)", () => {
    assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: "dark" })), "dark");
    assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: "light" })), "light");
    assert.equal(loadTheme(fakeStorage({})), "system");
    assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: "bright" })), "system");
    assert.equal(loadTheme(null), "system");
  });

  it("saveTheme: 正しい値だけ保存し、true を返す。不正な値は保存せず false", () => {
    const storage = fakeStorage();
    assert.equal(saveTheme("dark", storage), true);
    assert.equal(storage.data[THEME_KEY], "dark");
    assert.equal(saveTheme("neon", storage), false);
    assert.equal(saveTheme("dark", null), false); // 保存先がなくても、落ちない
  });

  it("saveTheme: 保存に失敗しても(例外)、落ちない(false を返す)", () => {
    const throwing = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    assert.equal(saveTheme("dark", throwing), false);
  });

  it("applyTheme: root の data-theme に反映する。不正な値は既定(system)", () => {
    const fakeRoot = { dataset: {} };
    applyTheme("dark", fakeRoot);
    assert.equal(fakeRoot.dataset.theme, "dark");
    applyTheme("neon", fakeRoot);
    assert.equal(fakeRoot.dataset.theme, "system");
  });
});

describe("配色(コントラスト比。WCAG AA)", () => {
  it("ライト・ダーク、どちらも、色トークンをすべて拾えている(取りこぼしがない)", () => {
    const names = [
      "color-bg",
      "color-surface",
      "color-text",
      "color-text-muted",
      "color-primary",
      "color-primary-strong",
      "color-on-primary",
      "color-accent",
      "color-on-accent",
      "color-soft",
      "color-border",
      "color-focus",
    ];
    for (const name of names) {
      assert.ok(light[name], `light: ${name}`);
      assert.ok(dark[name], `dark: ${name}`);
    }
  });

  for (const [name, tokens] of [
    ["ライト", light],
    ["ダーク", dark],
  ]) {
    it(`${name}: 本文の文字は、背景・面のどちらでも 4.5:1 以上`, () => {
      assert.ok(contrast(tokens["color-text"], tokens["color-bg"]) >= 4.5, name);
      assert.ok(contrast(tokens["color-text"], tokens["color-surface"]) >= 4.5, name);
    });

    it(`${name}: 薄い文字(text-muted)は、背景・面のどちらでも 4.5:1 以上`, () => {
      assert.ok(contrast(tokens["color-text-muted"], tokens["color-bg"]) >= 4.5, name);
      assert.ok(contrast(tokens["color-text-muted"], tokens["color-surface"]) >= 4.5, name);
    });

    it(`${name}: プライマリボタンの文字(on-primary)は、通常・ホバー(strong)のどちらでも 4.5:1 以上`, () => {
      assert.ok(contrast(tokens["color-on-primary"], tokens["color-primary"]) >= 4.5, name);
      assert.ok(contrast(tokens["color-on-primary"], tokens["color-primary-strong"]) >= 4.5, name);
    });

    it(`${name}: アクセントの文字(on-accent)は、4.5:1 以上`, () => {
      assert.ok(contrast(tokens["color-on-accent"], tokens["color-accent"]) >= 4.5, name);
    });

    it(`${name}: 「準備中」などのバッジ(soft の上の text)は、4.5:1 以上`, () => {
      assert.ok(contrast(tokens["color-text"], tokens["color-soft"]) >= 4.5, name);
    });

    it(`${name}: リンク色(primary)自体も、背景に対して 4.5:1 以上(文字として使うため)`, () => {
      assert.ok(contrast(tokens["color-primary"], tokens["color-bg"]) >= 4.5, name);
    });

    it(`${name}: 枠線・フォーカスの輪(border・focus)は、背景に対して 3:1 以上(UI部品の最低基準)`, () => {
      assert.ok(contrast(tokens["color-border"], tokens["color-bg"]) >= 3, name);
      assert.ok(contrast(tokens["color-focus"], tokens["color-bg"]) >= 3, name);
    });
  }

  it("アクセント色は、ライト・ダークで共通(どちらの背景でもはっきり見えるため)", () => {
    assert.equal(light["color-accent"], dark["color-accent"]);
    assert.equal(light["color-on-accent"], dark["color-on-accent"]);
  });
});

describe("すべてのページに、ちらつき防止(FOUC)のスクリプトがある", () => {
  const files = htmlFiles().filter((path) => !path.endsWith("404.html") || true);

  it("18ページすべてに、同じ内容のスクリプトがある(CSSより前・head内)", () => {
    assert.ok(files.length >= 18, files.length);
    for (const file of files) {
      const html = readFileSync(file, "utf8");
      assert.match(html, /localStorage\.getItem\("nolito:theme:v1"\)/, file);
      // <head> の中、スタイルシートより前にある(ちらつきを防ぐため)
      const headEnd = html.indexOf("</head>");
      const scriptAt = html.indexOf("nolito:theme:v1");
      const firstStylesheet = html.indexOf('rel="stylesheet"');
      assert.ok(scriptAt > 0 && scriptAt < headEnd, `${file}: head の中にある`);
      assert.ok(scriptAt < firstStylesheet, `${file}: スタイルシートより前にある`);
    }
  });

  it("生成物(記事・詳細ページ)にも、同じテンプレートから入る", () => {
    for (const file of [
      "public/articles/index.html",
      "public/articles/escape-boss-guide/index.html",
      "public/games/escape-boss/about/index.html",
      "public/tools/kii-michi/about/index.html",
    ]) {
      assert.match(read(file), /nolito:theme:v1/, file);
    }
  });
});

describe("ページの静的な性質", () => {
  const footerJs = read("public/assets/js/components/footer.js");
  const themeJs = read("public/assets/js/components/theme.js");
  const mainJs = read("public/assets/js/main.js");
  const componentsCss = read("public/assets/css/components.css");

  it("フッターに、テーマの select がある(main.js から初期化される)", () => {
    assert.match(footerJs, /data-theme-select/);
    assert.match(mainJs, /data-theme-select/);
    assert.match(mainJs, /initTheme\(/);
  });

  it("テーマの選択肢は、theme.js の THEMES と同じ3つ", () => {
    for (const value of ["system", "light", "dark"]) {
      assert.match(footerJs, new RegExp(`value:\\s*"${value}"`));
    }
  });

  it("HTML として解釈する書き方をしない。文字は el() で入れる", () => {
    for (const [name, text] of [
      ["footer.js", footerJs],
      ["theme.js", themeJs],
    ]) {
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(text), name);
    }
  });

  it("外部へ通信しない。ブラウザの保存領域は localStorage だけ(想定どおり)", () => {
    assert.ok(!/https?:\/\//.test(themeJs));
    assert.match(themeJs, /localStorage/);
  });

  it("モーダルの背景幕は、直書きの色でなく、トークン(--color-backdrop)を使う", () => {
    assert.doesNotMatch(componentsCss, /rgb\(27 32 51/);
    assert.match(componentsCss, /--color-backdrop/);
  });

  it("tokens.css の色は、rgb() の背景幕を除いて、すべて #rrggbb か #rgb", () => {
    const colorLines = tokensCss
      .split("\n")
      .filter((line) => /^\s*--color-[a-z-]+:/.test(line) && !line.includes("backdrop"));
    for (const line of colorLines) {
      assert.match(line, /#[0-9a-fA-F]{3,6}/, line);
    }
  });
});

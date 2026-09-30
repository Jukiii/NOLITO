// デザイン見本ページ(/theme-preview/)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PREVIEW_THEME,
  PREVIEW_KEY,
  PREVIEW_THEMES,
  applyPreviewTheme,
  isPreviewTheme,
  loadStoredPreviewTheme,
  resolvePreviewTheme,
  savePreviewTheme,
} from "../public/assets/js/theme-preview/themes.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

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

const css = read("public/assets/css/theme-preview.css");
const tokensCss = read("public/assets/css/tokens.css");
const html = read("public/theme-preview/index.html");
const main = read("public/assets/js/theme-preview/main.js");

function colorsIn(block) {
  return Object.fromEntries(
    [...block.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => [m[1], m[2]]),
  );
}
function blockOf(text, start) {
  const from = text.indexOf(start);
  assert.ok(from >= 0, start);
  return text.slice(from, text.indexOf("\n}", from));
}
const palettes = Object.fromEntries(
  PREVIEW_THEMES.map((theme) => [
    theme.id,
    colorsIn(
      blockOf(
        css,
        `[data-preview-theme="${theme.id}"],
:root[data-preview-theme="${theme.id}"]`,
      ),
    ),
  ]),
);
const NAMES = [
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

describe("themes.js(見本ページの選択)", () => {
  it("6つの案。id は決まった順で、既定は「今のまま」", () => {
    assert.deepEqual(
      PREVIEW_THEMES.map((theme) => theme.id),
      ["current", "dark", "white", "cute", "cool", "metal"],
    );
    assert.equal(DEFAULT_PREVIEW_THEME, "current");
    for (const theme of PREVIEW_THEMES) assert.ok(theme.name && theme.note);
  });

  it("サイトのテーマのキー(nolito:theme:v1)とは別のキーで、サイトの設定を書き換えない", () => {
    assert.equal(PREVIEW_KEY, "nolito:theme-preview:v1");
    assert.ok(!main.includes("nolito:theme:v1"));
    assert.ok(!main.includes("saveTheme"));
  });

  it("isPreviewTheme / resolvePreviewTheme: URL → 保存 → 既定。不正な値は無視", () => {
    assert.equal(isPreviewTheme("cute"), true);
    for (const bad of ["Cute", "", null, undefined, 1, "light"]) {
      assert.equal(isPreviewTheme(bad), false);
    }
    assert.equal(resolvePreviewTheme({ query: "cool", stored: "cute" }), "cool");
    assert.equal(resolvePreviewTheme({ query: "bad", stored: "cute" }), "cute");
    assert.equal(resolvePreviewTheme({ query: null, stored: "bad" }), "current");
    assert.equal(resolvePreviewTheme(), "current");
  });

  it("save / load: 保存できなくても落ちない。不正な値は保存しない", () => {
    const data = {};
    const storage = {
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => {
        data[key] = value;
      },
    };
    assert.equal(savePreviewTheme("metal", storage), true);
    assert.equal(loadStoredPreviewTheme(storage), "metal");
    assert.equal(savePreviewTheme("neon", storage), false);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.equal(savePreviewTheme("cute", throwing), false);
    assert.equal(loadStoredPreviewTheme(throwing), null);
    assert.equal(loadStoredPreviewTheme(null), null);
  });

  it("applyPreviewTheme: data-preview-theme に反映。不正な値は既定", () => {
    const fakeRoot = { dataset: {} };
    applyPreviewTheme("cool", fakeRoot);
    assert.equal(fakeRoot.dataset.previewTheme, "cool");
    applyPreviewTheme("neon", fakeRoot);
    assert.equal(fakeRoot.dataset.previewTheme, "current");
  });
});

describe("配色(WCAG AA)", () => {
  it("6つとも、必要な色トークンがそろっている", () => {
    for (const [id, tokens] of Object.entries(palettes)) {
      for (const name of NAMES) assert.ok(tokens[name], `${id}: ${name}`);
    }
  });

  it("採用した4案は、tokens.css の本番のテーマと同じ値(今のまま=デフォルト・ホワイト・クール=ダーク・可愛い=プリティ)", () => {
    const light = colorsIn(blockOf(tokensCss, ":root {"));
    const adopted = {
      current: light,
      white: { ...light, ...colorsIn(blockOf(tokensCss, ':root[data-theme="white"]')) },
      cool: { ...light, ...colorsIn(blockOf(tokensCss, ':root[data-theme="dark"]')) },
      cute: { ...light, ...colorsIn(blockOf(tokensCss, ':root[data-theme="pretty"]')) },
    };
    for (const [id, tokens] of Object.entries(adopted)) {
      for (const name of NAMES) assert.equal(palettes[id][name], tokens[name], `${id}: ${name}`);
    }
  });

  for (const theme of PREVIEW_THEMES) {
    it(`${theme.name}: 文字 4.5:1・UI 部品 3:1 以上`, () => {
      const t = palettes[theme.id];
      const ratio = (a, b) => contrast(t[a], t[b]);
      for (const bg of ["color-bg", "color-surface"]) {
        assert.ok(ratio("color-text", bg) >= 4.5, `text/${bg}`);
        assert.ok(ratio("color-text-muted", bg) >= 4.5, `muted/${bg}`);
      }
      assert.ok(ratio("color-on-primary", "color-primary") >= 4.5, "on-primary");
      assert.ok(ratio("color-on-primary", "color-primary-strong") >= 4.5, "on-primary/strong");
      assert.ok(ratio("color-on-accent", "color-accent") >= 4.5, "on-accent");
      assert.ok(ratio("color-text", "color-soft") >= 4.5, "soft");
      assert.ok(ratio("color-primary", "color-bg") >= 4.5, "primary/bg");
      assert.ok(ratio("color-primary", "color-surface") >= 4.5, "primary/surface");
      assert.ok(ratio("color-border", "color-bg") >= 3, "border");
      assert.ok(ratio("color-focus", "color-bg") >= 3, "focus");
    });
  }

  it("メタリック: ボタンのグラデーションのどの位置でも、文字は 4.5:1 以上", () => {
    const t = palettes.metal;
    for (const stop of ["color-metal-hi", "color-metal-mid", "color-metal-lo"]) {
      assert.ok(contrast(t["color-on-primary"], t[stop]) >= 4.5, stop);
      assert.ok(contrast(t["color-on-accent"], t[stop]) >= 4.5, stop);
    }
    assert.ok(contrast(t["color-text"], t["color-metal-deep"]) >= 4.5, "deep");
    assert.ok(contrast(t["color-text-muted"], t["color-metal-deep"]) >= 4.5, "deep/muted");
  });

  it("形のトークンは、6つとも宣言している(影は宣言した場所で解決されるため)", () => {
    for (const theme of PREVIEW_THEMES) {
      const block = blockOf(
        css,
        `[data-preview-theme="${theme.id}"],
:root[data-preview-theme="${theme.id}"]`,
      );
      for (const name of ["--border-width", "--radius-md", "--radius-pill", "--shadow-pop"]) {
        assert.ok(block.includes(`${name}:`), `${theme.id}: ${name}`);
      }
    }
  });

  it("使っている var(--…) は、tokens.css か、このファイルで定義されている", () => {
    const defined = new Set(
      [...(tokensCss + css).matchAll(/(--[a-z0-9-]+):/g)].map((match) => match[1]),
    );
    for (const match of css.matchAll(/var\((--[a-z0-9-]+)\s*\)/g)) {
      assert.ok(defined.has(match[1]), match[1]);
    }
  });
});

describe("ページ(/theme-preview/)", () => {
  it("noindex・ちらつき防止のスクリプト・共通の CSS の順・見本用の CSS と JS", () => {
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /localStorage\.getItem\("nolito:theme:v1"\)/);
    assert.match(html, /localStorage\.getItem\("nolito:font-size:v1"\)/);
    assert.match(html, /localStorage\.getItem\("nolito:motion:v1"\)/);
    const order = ["tokens", "base", "layout", "components", "theme-preview"].map((name) =>
      html.indexOf(`/assets/css/${name}.css`),
    );
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])));
    assert.ok(html.includes("/assets/js/theme-preview/main.js"));
    assert.ok(html.indexOf("nolito:theme:v1") < html.indexOf('rel="stylesheet"'));
  });

  it("6つの選択肢と、6つの比較の枠。id は themes.js と CSS にそろっている", () => {
    for (const theme of PREVIEW_THEMES) {
      assert.ok(html.includes(`value="${theme.id}"`), theme.id);
      assert.ok(html.includes(`class="tp-sample" data-preview-theme="${theme.id}"`), theme.id);
      assert.ok(html.includes(`data-preview-pick="${theme.id}"`), theme.id);
      assert.ok(css.includes(`[data-preview-theme="${theme.id}"]`), theme.id);
    }
    assert.equal(html.match(/data-preview-radio/g).length, 6);
  });

  it("main.js が探す目印が、HTML にある", () => {
    for (const attr of ["data-preview-radio", "data-preview-status", "data-preview-pick"]) {
      assert.ok(main.includes(attr), attr);
      assert.ok(html.includes(attr), attr);
    }
  });

  it("選んだ名前の表示は textContent(HTML として解釈しない)", () => {
    assert.ok(main.includes("status.textContent"));
    assert.ok(!main.includes("innerHTML"));
  });
});

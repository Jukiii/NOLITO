// サイト内文字サイズ(Phase 21 PR2)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_KEY,
  FONT_SIZES,
  applyFontSize,
  isFontSize,
  loadFontSize,
  saveFontSize,
} from "../public/assets/js/components/font-size.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

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

describe("font-size.js(保存・読み込み・反映)", () => {
  it("FONT_SIZE_KEY・FONT_SIZES・DEFAULT_FONT_SIZE", () => {
    assert.equal(FONT_SIZE_KEY, "nolito:font-size:v1");
    assert.deepEqual(FONT_SIZES, ["standard", "large", "xlarge"]);
    assert.equal(DEFAULT_FONT_SIZE, "standard");
  });

  it("isFontSize: 3つの値だけ true", () => {
    assert.equal(isFontSize("standard"), true);
    assert.equal(isFontSize("large"), true);
    assert.equal(isFontSize("xlarge"), true);
    for (const bad of ["Large", "", null, undefined, 1, "huge"]) {
      assert.equal(isFontSize(bad), false);
    }
  });

  it("loadFontSize: 保存されていれば、その値。なければ・不正なら、既定(標準)", () => {
    assert.equal(loadFontSize(fakeStorage({ [FONT_SIZE_KEY]: "large" })), "large");
    assert.equal(loadFontSize(fakeStorage({ [FONT_SIZE_KEY]: "xlarge" })), "xlarge");
    assert.equal(loadFontSize(fakeStorage({})), "standard");
    assert.equal(loadFontSize(fakeStorage({ [FONT_SIZE_KEY]: "huge" })), "standard");
    assert.equal(loadFontSize(null), "standard");
  });

  it("saveFontSize: 正しい値だけ保存し、true を返す。不正な値は保存せず false", () => {
    const storage = fakeStorage();
    assert.equal(saveFontSize("large", storage), true);
    assert.equal(storage.data[FONT_SIZE_KEY], "large");
    assert.equal(saveFontSize("huge", storage), false);
    assert.equal(saveFontSize("large", null), false); // 保存先がなくても、落ちない
  });

  it("saveFontSize: 保存に失敗しても(例外)、落ちない(false を返す)", () => {
    const throwing = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    assert.equal(saveFontSize("large", throwing), false);
  });

  it("applyFontSize: root の data-font-size に反映する。標準は属性を外す。不正な値は既定(標準)扱い", () => {
    const fakeRoot = { dataset: { fontSize: "large" } };
    applyFontSize("xlarge", fakeRoot);
    assert.equal(fakeRoot.dataset.fontSize, "xlarge");
    applyFontSize("standard", fakeRoot);
    assert.equal("fontSize" in fakeRoot.dataset, false);
    applyFontSize("large", fakeRoot);
    applyFontSize("huge", fakeRoot); // 不正な値も、既定(属性なし)として扱う
    assert.equal("fontSize" in fakeRoot.dataset, false);
  });
});

describe("ページの静的な性質", () => {
  const fontSizeJs = read("public/assets/js/components/font-size.js");
  const footerJs = read("public/assets/js/components/footer.js");
  const mainJs = read("public/assets/js/main.js");
  const tokensCss = read("public/assets/css/tokens.css");

  it("フッターに、文字サイズの select がある(main.js から初期化される)", () => {
    assert.match(footerJs, /data-font-size-select/);
    assert.match(mainJs, /data-font-size-select/);
    assert.match(mainJs, /initFontSize\(/);
  });

  it("選択肢は、font-size.js の FONT_SIZES と同じ3つ", () => {
    for (const value of ["standard", "large", "xlarge"]) {
      assert.match(footerJs, new RegExp(`value:\\s*"${value}"`));
    }
  });

  it("tokens.css は、rem(--font-size-*)を変えず、ルートの font-size だけを変える(サイト全体が連動)", () => {
    assert.match(tokensCss, /:root\[data-font-size="large"\]\s*\{\s*font-size:\s*118\.75%/);
    assert.match(tokensCss, /:root\[data-font-size="xlarge"\]\s*\{\s*font-size:\s*137\.5%/);
    // --font-size-* トークン自体は rem のまま(個別の拡大トークンを増やしていない)
    for (const match of tokensCss.matchAll(/--font-size-[a-z0-9-]+:\s*([^;]+);/g)) {
      assert.match(match[1], /rem$/, match[0]);
    }
  });

  it("HTML として解釈する書き方をしない(innerHTML等を使わない)。外部へ通信しない", () => {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(fontSizeJs));
    assert.ok(!/https?:\/\//.test(fontSizeJs));
    assert.match(fontSizeJs, /localStorage/);
  });
});

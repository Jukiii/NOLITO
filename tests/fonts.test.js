// 自前の字体(Issue #166 PR 4)のテスト: 同じサイトから配信し、外部へ通信せず、ライセンスを同梱している。
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const css = read("public/assets/css/game.css");
const tokens = read("public/assets/css/tokens.css");

describe("自前の字体", () => {
  it("@font-face は、同じサイトの woff2 だけを指す(外部の URL・Google Fonts を使わない)", () => {
    const block = /@font-face\s*\{[^}]*\}/.exec(css);
    assert.ok(block, "@font-face がありません");
    const urls = [...block[0].matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.deepEqual(urls, ["/assets/fonts/nolito-display.woff2"]);
    assert.match(block[0], /font-display:\s*swap/);
    assert.ok(!/https?:|\/\/|@import/i.test(css.replace(/\/\*[\s\S]*?\*\//g, "")));
  });

  it("字体のファイルは、小さく(20KB 以内)、woff2 で、ライセンス(OFL)が同梱されている", () => {
    const path = `${root}public/assets/fonts/nolito-display.woff2`;
    assert.ok(statSync(path).size <= 20 * 1024);
    assert.equal(readFileSync(path).subarray(0, 4).toString("latin1"), "wOF2");
    assert.match(
      read("public/assets/fonts/OFL-Orbitron.txt"),
      /SIL OPEN FONT LICENSE Version 1\.1/i,
    );
  });

  it("--font-display は、字体が読めないときの代わり(等幅)を持つ。使う場所は、数字・英字の飾りだけ", () => {
    assert.match(tokens, /--font-display:\s*"NOLITO Display",[^;]*monospace;/);
    const used = [...css.matchAll(/font-family:\s*var\(--font-display\)/g)].length;
    assert.ok(used >= 1 && used <= 4, `${used} 箇所`);
  });
});

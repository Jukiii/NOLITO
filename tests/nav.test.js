// ヘッダーメニューの拡張(サブメニュー。Phase 20 PR 1。下部固定バーは Issue #154 で廃止)のテスト。
// header.js・nav.js は DOM を組み立てる部品なので、データの形と、
// ソースの静的な性質(安全なつくり・アクセシビリティ属性の対応)を検査する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { mainNav } from "../public/assets/js/config/nav.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");
const header = read("public/assets/js/components/header.js");
const nav = read("public/assets/js/components/nav.js");

describe("mainNav の children(サブメニュー)の形", () => {
  it("あれば、{ label, href } の配列(空でない)。href は / で始まる", () => {
    for (const item of mainNav) {
      if (item.children === undefined) continue;
      assert.ok(Array.isArray(item.children) && item.children.length > 0, item.label);
      for (const child of item.children) {
        assert.equal(typeof child.label, "string");
        assert.ok(child.label.length > 0, `${item.label}: label が空です`);
        assert.match(child.href, /^\//, `${item.label}: ${child.href}`);
      }
    }
  });

  it("children と available: false は、同じ項目に同時に付かない(準備中に、サブメニューは出さない)", () => {
    for (const item of mainNav) {
      if (item.available === false) assert.equal(item.children, undefined, item.label);
    }
  });
});

describe("header.js: サブメニューの、アクセシビリティの対応", () => {
  it("開閉のボタンに、aria-expanded・aria-haspopup・aria-controls を付けている", () => {
    for (const attr of ["aria-expanded", "aria-haspopup", "aria-controls"]) {
      assert.ok(header.includes(attr), attr);
    }
  });

  it("サブメニューの id は、対応する aria-controls の値と、同じ形で作られる", () => {
    assert.match(header, /submenuId\s*=\s*`site-nav-submenu-\$\{index\}`/);
    assert.match(header, /"aria-controls":\s*submenuId/);
    assert.match(header, /id:\s*submenuId/);
  });

  it("現在地は、親(子のどれかが現在地なら)にも、子それぞれにも示す", () => {
    assert.match(header, /"aria-current":\s*current/);
    assert.match(header, /"aria-current":\s*childCurrent/);
  });

  it("HTML として解釈する書き方をしない(innerHTML・insertAdjacentHTML・document.write・eval)。文字は el() で入れる", () => {
    for (const [name, text] of [
      ["header.js", header],
      ["nav.js", nav],
    ]) {
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(text), name);
    }
  });
});

describe("nav.js: 開閉の性質", () => {
  it("Esc で、開いているサブメニュー(PC)→ハンバーガーのパネル、の順に閉じる", () => {
    assert.match(nav, /event\.key !== "Escape"/);
    assert.match(nav, /desktop\.matches/);
  });

  it("PC(48rem以上)だけ、外側のクリックでサブメニューを閉じる。モバイルは閉じさせない", () => {
    assert.match(nav, /document\.addEventListener\("click"/);
    assert.match(nav, /if \(!desktop\.matches\) return;/);
  });

  it("画面幅がPCとモバイルを行き来しても、壊れない(resize時に、状態を作り直す)", () => {
    assert.match(nav, /desktop\.addEventListener\("change"/);
  });
});

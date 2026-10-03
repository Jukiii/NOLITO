// ヘッダーの「アカウント」のアイコン(account-link.js。Issue #173)のテスト。
// 状態の判断(純粋)と、ソース・CSS の静的な性質を検査する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ACCOUNT_ARIA_LABELS,
  ACCOUNT_LABELS,
  ACCOUNT_PATH,
  accountLinkState,
  initAccountLink,
} from "../public/assets/js/components/account-link.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");
const source = read("public/assets/js/components/account-link.js");
const header = read("public/assets/js/components/header.js");
const css = read("public/assets/css/layout.css");

describe("accountLinkState", () => {
  it("機能が有効で、ログイン中なら signed-in、未ログインなら signed-out", () => {
    assert.equal(accountLinkState({ enabled: true, user: { id: "u" } }), "signed-in");
    assert.equal(accountLinkState({ enabled: true, user: null }), "signed-out");
  });

  it("機能が無効・結果がない・壊れているときは、unavailable(アイコンを出さない)", () => {
    assert.equal(accountLinkState({ enabled: false, user: null }), "unavailable");
    assert.equal(accountLinkState({ enabled: "true", user: {} }), "unavailable");
    assert.equal(accountLinkState(null), "unavailable");
    assert.equal(accountLinkState(undefined), "unavailable");
  });
});

describe("initAccountLink", () => {
  const fakeLink = () => {
    const label = { textContent: "" };
    const attrs = {};
    return {
      dataset: {},
      hidden: false,
      attrs,
      label,
      setAttribute: (name, value) => (attrs[name] = value),
      querySelector: () => label,
    };
  };

  it("ログイン中・未ログインで、文字と読み上げが変わる(色だけに頼らない)", async () => {
    const out = fakeLink();
    assert.equal(
      await initAccountLink(out, { fetchMeImpl: async () => ({ enabled: true, user: null }) }),
      "signed-out",
    );
    assert.equal(out.label.textContent, ACCOUNT_LABELS["signed-out"]);
    assert.equal(out.attrs["aria-label"], ACCOUNT_ARIA_LABELS["signed-out"]);
    assert.equal(out.hidden, false);

    const inn = fakeLink();
    await initAccountLink(inn, { fetchMeImpl: async () => ({ enabled: true, user: { id: "u" } }) });
    assert.equal(inn.dataset.state, "signed-in");
    assert.equal(inn.label.textContent, ACCOUNT_LABELS["signed-in"]);
    assert.notEqual(inn.attrs["aria-label"], out.attrs["aria-label"]);
  });

  it("機能が無効・取得で例外が出ても、隠すだけで落ちない", async () => {
    const off = fakeLink();
    assert.equal(
      await initAccountLink(off, { fetchMeImpl: async () => ({ enabled: false, user: null }) }),
      "unavailable",
    );
    assert.equal(off.hidden, true);

    const broken = fakeLink();
    const state = await initAccountLink(broken, {
      fetchMeImpl: async () => {
        throw new Error("x");
      },
    });
    assert.equal(state, "unavailable");
    assert.equal(broken.hidden, true);
  });
});

describe("ヘッダーへの組み込み・見た目", () => {
  it("リンク先は /account/、ヘッダーが組み立てて、状態を確かめる", () => {
    assert.equal(ACCOUNT_PATH, "/account/");
    assert.match(header, /createAccountLink\(\)/);
    assert.match(header, /initAccountLink\(account\)/);
  });

  it("ログインの状態を、端末に保存しない・HTML として解釈しない", () => {
    assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(source));
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(source));
  });

  it("タップできる大きさ(--tap-size)・確認中は見せない・ログイン中は塗りつぶす・色の直書きなし", () => {
    const start = css.indexOf(".site-account {");
    const end = css.indexOf("@media (width >= 48rem)");
    assert.ok(start > 0 && end > start);
    const block = css.slice(start, end);
    assert.match(block, /min-width:\s*var\(--tap-size\);/);
    assert.match(block, /min-height:\s*var\(--tap-size\);/);
    assert.match(block, /\.site-account\[hidden\]\s*\{\s*display:\s*none;/);
    assert.match(block, /\[data-state="loading"\]\s*\{\s*visibility:\s*hidden;/);
    assert.match(
      block,
      /\[data-state="signed-in"\] \.site-account__icon\s*\{[^}]*background:\s*var\(--color-primary\)/,
    );
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(block));
  });
});

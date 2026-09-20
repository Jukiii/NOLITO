// アカウントのページ(/account/)のテスト: メッセージ・API クライアント・ページの静的な性質。
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { CONFIRM_WORD } from "../functions/api/account.js";
import {
  call,
  deleteAccount,
  fetchLicenses,
  fetchMe,
  fetchProductNames,
  logout,
  redeemLicense,
  saveNickname,
} from "../public/assets/js/account/client.js";
import {
  API_ERRORS,
  LOGIN_ERRORS,
  NETWORK_ERROR,
  UNKNOWN_ERROR,
  apiErrorMessage,
  loginErrorMessage,
} from "../public/assets/js/account/messages.js";
import { footerLinks, mainNav } from "../public/assets/js/config/nav.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".js") ? [path] : [];
  });
}
const serverSource = sourceFiles(fileURLToPath(new URL("../functions", import.meta.url)))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** 呼び出しを記録する fetch。 */
function recorder(response) {
  const calls = [];
  const fetchImpl = async (path, init) => {
    calls.push({ path, init });
    if (response instanceof Error) throw response;
    return typeof response === "function" ? response() : response;
  };
  return { calls, options: { fetchImpl } };
}

describe("メッセージ", () => {
  it("サーバーが返す、すべてのエラーの種類に、利用者向けの文がある", () => {
    const codes = new Set();
    for (const match of serverSource.matchAll(/error\(\s*\d+,\s*"([a-z-]+)"/g)) codes.add(match[1]);
    for (const match of serverSource.matchAll(/error:\s*"([a-z-]+)"/g)) codes.add(match[1]);
    assert.ok(codes.size >= 10, `エラーの種類を、ソースから拾えていない(${codes.size})`);
    for (const code of codes)
      assert.ok(Object.hasOwn(API_ERRORS, code), `API_ERRORS に ${code} がない`);
  });

  it("ログインの失敗(/account/?error=)の、すべての種類に、文がある", () => {
    const codes = new Set();
    for (const match of serverSource.matchAll(/\?error=([a-z-]+)/g)) codes.add(match[1]);
    for (const match of serverSource.matchAll(/fail\(\s*"([a-z-]+)"/g)) codes.add(match[1]);
    assert.ok(codes.has("failed") && codes.has("not-invited") && codes.has("unavailable"));
    for (const code of codes)
      assert.ok(Object.hasOwn(LOGIN_ERRORS, code), `LOGIN_ERRORS に ${code} がない`);
  });

  it("知らない種類は、汎用の文(URL の値は、そのまま表示しない)", () => {
    assert.equal(loginErrorMessage("<img src=x onerror=alert(1)>"), null);
    assert.equal(loginErrorMessage("constructor"), null);
    assert.equal(loginErrorMessage(null), null);
    assert.equal(apiErrorMessage("nope"), UNKNOWN_ERROR);
    assert.equal(apiErrorMessage("constructor"), UNKNOWN_ERROR);
    assert.equal(apiErrorMessage(undefined), UNKNOWN_ERROR);
  });

  it("文には、内部の理由(トークン・SQL など)を含めない", () => {
    for (const text of [...Object.values(API_ERRORS), ...Object.values(LOGIN_ERRORS)]) {
      assert.ok(!/id-token|state-|jwks|sqlite|token/i.test(text), text);
    }
  });
});

describe("API クライアント", () => {
  it("GET は、CSRF のヘッダーを付けず、同じサイトの Cookie だけを送る", async () => {
    const { calls, options } = recorder(jsonResponse({ enabled: true, user: null }));
    await call("/api/me", options);
    const { init } = calls[0];
    assert.equal(init.method, "GET");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers["X-NOLITO-CSRF"], undefined);
    assert.equal(init.body, undefined);
  });

  it("状態を変える呼び出しは、X-NOLITO-CSRF: 1 と JSON を付ける", async () => {
    const { calls, options } = recorder(jsonResponse({ user: {} }));
    await saveNickname("たろう", options);
    await logout(options);
    await deleteAccount(options);
    const [profile, out, del] = calls;
    assert.deepEqual([profile.path, profile.init.method], ["/api/profile", "POST"]);
    assert.deepEqual(JSON.parse(profile.init.body), { nickname: "たろう" });
    assert.equal(profile.init.headers["Content-Type"], "application/json");
    assert.deepEqual([out.path, out.init.method], ["/api/logout", "POST"]);
    assert.deepEqual([del.path, del.init.method], ["/api/account", "DELETE"]);
    assert.deepEqual(JSON.parse(del.init.body), { confirm: CONFIRM_WORD });
    for (const { init } of calls) assert.equal(init.headers["X-NOLITO-CSRF"], "1");
  });

  it("失敗は、例外にせず、{ ok: false, message } で返す", async () => {
    const failing = recorder(jsonResponse({ error: "nickname-too-long" }, 400));
    assert.deepEqual(await saveNickname("x", failing.options), {
      ok: false,
      code: "nickname-too-long",
      message: API_ERRORS["nickname-too-long"],
      status: 400,
    });
    const offline = recorder(new TypeError("Failed to fetch"));
    const result = await call("/api/me", offline.options);
    assert.deepEqual([result.ok, result.code, result.message], [false, "network", NETWORK_ERROR]);
  });

  it("JSON でない応答(HTML など)も、失敗として扱う", async () => {
    const html = recorder(() => new Response("<!doctype html>", { status: 200 }));
    const result = await call("/api/me", html.options);
    assert.equal(result.ok, false);
    assert.equal(result.message, UNKNOWN_ERROR);
    const notFound = recorder(() => new Response("Not found", { status: 404 }));
    assert.equal((await call("/api/me", notFound.options)).ok, false);
  });

  it("fetchMe: 機能がない・失敗のときは、enabled: false(ページを壊さない)", async () => {
    assert.deepEqual(await fetchMe(recorder(jsonResponse({ enabled: false })).options), {
      enabled: false,
      user: null,
    });
    assert.deepEqual(await fetchMe(recorder(new Error("offline")).options), {
      enabled: false,
      user: null,
    });
    assert.deepEqual(await fetchMe(recorder(jsonResponse({}, 500)).options), {
      enabled: false,
      user: null,
    });
    assert.deepEqual(await fetchMe(recorder(jsonResponse({ nope: 1 })).options), {
      enabled: false,
      user: null,
    });
    assert.deepEqual(await fetchMe(recorder(jsonResponse({ enabled: true, user: null })).options), {
      enabled: true,
      user: null,
    });
    const user = { nickname: "a", email: "a@b.c", createdAt: 1 };
    assert.deepEqual(await fetchMe(recorder(jsonResponse({ enabled: true, user })).options), {
      enabled: true,
      user,
    });
  });
});

describe("ライセンスの API クライアント", () => {
  it("一覧は GET(CSRF ヘッダーなし)、登録は POST で、キーを JSON の本文に入れる", async () => {
    const listing = recorder(jsonResponse({ licenses: [] }));
    await fetchLicenses(listing.options);
    assert.deepEqual(
      [listing.calls[0].path, listing.calls[0].init.method],
      ["/api/licenses", "GET"],
    );
    assert.equal(listing.calls[0].init.headers["X-NOLITO-CSRF"], undefined);

    const posting = recorder(jsonResponse({ license: {}, already: false }));
    await redeemLicense("NLTO-AAAAA-AAAAA-AAAAA-AAAAA", posting.options);
    const { path, init } = posting.calls[0];
    assert.deepEqual([path, init.method], ["/api/licenses/redeem", "POST"]);
    assert.equal(init.headers["X-NOLITO-CSRF"], "1");
    assert.deepEqual(JSON.parse(init.body), { key: "NLTO-AAAAA-AAAAA-AAAAA-AAAAA" });
  });

  it("登録の失敗は、利用者向けの文で返す(内部の理由を出さない)", async () => {
    const invalid = recorder(jsonResponse({ error: "license-invalid" }, 400));
    const result = await redeemLicense("x", invalid.options);
    assert.equal(result.ok, false);
    assert.equal(result.message, API_ERRORS["license-invalid"]);
    assert.ok(result.message.includes("使えません"));
    const format = await redeemLicense(
      "x",
      recorder(jsonResponse({ error: "license-format" }, 400)).options,
    );
    assert.equal(format.message, API_ERRORS["license-format"]);
  });

  it("商品名: products.json の id → title。取れなければ、空の Map(ID のまま表示する)", async () => {
    const data = {
      products: [
        { id: "kii-michi", title: "キーみち" },
        { id: "escape-boss", title: "上司から逃げろ" },
      ],
    };
    const names = await fetchProductNames(async () => jsonResponse(data));
    assert.equal(names.get("kii-michi"), "キーみち");
    assert.equal(names.size, 2);
    assert.equal(
      (
        await fetchProductNames(async () => {
          throw new Error("offline");
        })
      ).size,
      0,
    );
    assert.equal((await fetchProductNames(async () => new Response("<html>"))).size, 0);
    assert.equal((await fetchProductNames(async () => jsonResponse({}))).size, 0);
  });

  it("実際の products.json の id は、すべて、商品名を引ける", async () => {
    const real = JSON.parse(read("public/data/products.json"));
    const names = await fetchProductNames(async () => jsonResponse(real));
    for (const product of real.products) assert.ok(names.get(product.id), product.id);
  });
});

describe("ページの静的な性質", () => {
  const html = read("public/account/index.html");
  const js = read("public/assets/js/account/main.js");
  const css = read("public/assets/css/account.css");

  it("検索に載せない(noindex)", () => {
    assert.match(html, /<meta name="robots" content="noindex" \/>/);
  });

  it("広告の枠を置かない・外部のスクリプトを読み込まない", () => {
    assert.ok(!html.includes("data-ad-slot"));
    assert.ok(!/<script[^>]+src="https?:/.test(html));
  });

  it("フッター・ナビには、まだリンクを出さない(一般公開のときに足す)", () => {
    for (const link of [...footerLinks, ...mainNav]) assert.notEqual(link.href, "/account/");
  });

  it("ログインは、リンク(ページ遷移)で行う。Google のスクリプトは使わない", () => {
    assert.match(html, /href="\/auth\/google\/login"/);
    assert.ok(!/accounts\.google\.com|gsi\/client/.test(html + js));
  });

  it("HTML として解釈する書き方をしない(innerHTML・insertAdjacentHTML・document.write・eval)", () => {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(js));
    assert.match(js, /textContent/);
  });

  it("画面の状態(data-view)は、HTML と main.js の両方にそろっている", () => {
    const views = [...html.matchAll(/data-view="([a-z-]+)"/g)].map((match) => match[1]);
    assert.deepEqual(views.sort(), [
      "deleted",
      "loading",
      "signed-in",
      "signed-out",
      "unavailable",
    ]);
    for (const view of views.filter((name) => name !== "loading")) {
      assert.ok(js.includes(`"${view}"`), view);
    }
  });

  it("ライセンスの節: 入力・一覧・空の案内が、HTML と main.js の両方にそろっている", () => {
    for (const hook of ["data-license-form", "data-license-list", "data-license-empty"]) {
      assert.ok(html.includes(hook), `HTML: ${hook}`);
      assert.ok(js.includes(hook), `main.js: ${hook}`);
    }
    // キーの入力欄: 自動補完・自動大文字化・スペルチェックで、キーが他へ漏れない・崩れない
    const input = html.slice(
      html.indexOf('id="license-key"') - 200,
      html.indexOf('id="license-key"') + 400,
    );
    assert.match(input, /autocomplete="off"/);
    assert.match(input, /spellcheck="false"/);
    assert.match(input, /required/);
  });

  it("ライセンスの状態は、色だけでなく、文字(有効・無効)でも示す", () => {
    assert.match(js, /無効/);
    assert.match(js, /有効/);
    assert.match(read("public/assets/css/account.css"), /account-license--revoked[^}]*dashed/);
  });

  it("画面に出すのは、末尾 4 文字のヒントだけ(キーの全体は、サーバーも持たない)", () => {
    assert.match(js, /NLTO-…-\$\{license\.hint\}/);
  });

  it("CSS は、色をトークンで指定する(ダークテーマに対応できるように)", () => {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css));
  });

  it("ブラウザの保存領域(LocalStorage など)に、アカウントの情報を置かない", () => {
    const all = [js, read("public/assets/js/account/client.js")].join("\n");
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(all));
  });
});

// 問い合わせフォームの画面側のテスト(Phase 10 PR 3): 規則・メッセージ・API クライアント・ページの静的な性質・ポリシー v2。
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as server from "../functions/_lib/contact.js";
import {
  fetchContactEnabled,
  fetchProductOptions,
  sendInquiry,
} from "../public/assets/js/contact/client.js";
import {
  CONTACT_ERRORS,
  NETWORK_ERROR,
  UNKNOWN_ERROR,
  contactErrorMessage,
} from "../public/assets/js/contact/messages.js";
import * as rules from "../public/assets/js/contact/rules.js";
import { analyticsConfig } from "../public/assets/js/config/analytics.js";
import { footerLinks } from "../public/assets/js/config/nav.js";

const root = fileURLToPath(new URL("../", import.meta.url));
// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const text = (path) =>
  read(path)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function recorder(response) {
  const calls = [];
  const fetchImpl = async (path, init) => {
    calls.push({ path, init });
    if (response instanceof Error) throw response;
    return typeof response === "function" ? response(path) : response;
  };
  return { calls, fetchImpl };
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".js") ? [path] : [];
  });
}

describe("規則(サーバーと同じ値)", () => {
  it("種類・文字数の上限は、サーバーと一致している", () => {
    assert.deepEqual(
      rules.CATEGORIES.map((item) => item.value),
      server.CATEGORIES,
    );
    assert.equal(rules.MESSAGE_MIN, server.MESSAGE_MIN);
    assert.equal(rules.MESSAGE_MAX, server.MESSAGE_MAX);
    assert.equal(rules.EMAIL_MAX, server.EMAIL_MAX);
  });

  it("画面の検査を通るものは、サーバーの検査も通る(逆も)。同じ入力に、同じ判断", () => {
    const cases = [
      { message: "あ".repeat(9), email: "" },
      { message: "あ".repeat(10), email: "" },
      { message: "あ".repeat(2000), email: "" },
      { message: "あ".repeat(2001), email: "" },
      { message: "😀".repeat(2000), email: "" },
      { message: "😀".repeat(2001), email: "" },
      { message: `${"あ".repeat(10)}${String.fromCodePoint(0x1b)}`, email: "" },
      { message: `${"あ".repeat(10)}${String.fromCodePoint(0x202e)}`, email: "" },
      { message: "あ".repeat(10), email: "a@example.com" },
      { message: "あ".repeat(10), email: "abc" },
      { message: "あ".repeat(10), email: "a b@example.com" },
      { message: "   ", email: "" },
      { message: "あ".repeat(10), email: `${"a".repeat(250)}@b.cd` },
    ];
    for (const { message, email } of cases) {
      const input = {
        category: "bug",
        product: "",
        message,
        email,
        includeEnv: false,
        elapsed: 20000,
      };
      const client = rules.validateForm({ category: "bug", message, email });
      const result = server.validateInquiry(input);
      const serverError = result.ok ? undefined : result.error;
      const clientError = client.message ?? client.email;
      assert.equal(
        clientError,
        serverError,
        JSON.stringify({ message: message.slice(0, 12), email }),
      );
    }
  });

  it("種類が違うと、画面でも断る", () => {
    assert.equal(
      rules.validateForm({ category: "", message: "あ".repeat(10), email: "" }).category,
      "contact-category",
    );
    assert.equal(
      rules.validateForm({ category: "spam", message: "あ".repeat(10), email: "" }).category,
      "contact-category",
    );
    assert.deepEqual(
      rules.validateForm({ category: "bug", message: "あ".repeat(10), email: "" }),
      {},
    );
  });

  it("文字数は、コードポイントで数える(前後の空白・CRLF をそろえたあと)", () => {
    assert.equal(rules.countChars("  あいう  "), 3);
    assert.equal(rules.countChars("😀😀"), 2);
    assert.equal(rules.countChars("a\r\nb"), 3);
    assert.equal(rules.countChars(""), 0);
  });

  it("環境の情報は、サーバーが受け付ける形のものだけを集める", () => {
    assert.deepEqual(
      rules.collectEnv({ width: 375, height: 800, language: "ja-JP", version: "0.3.0" }),
      {
        viewport: "375x800",
        language: "ja-JP",
        version: "0.3.0",
      },
    );
    assert.deepEqual(rules.collectEnv({ width: 0, height: 0, language: "x", version: "v1" }), {});
    assert.deepEqual(
      rules.collectEnv({ width: 375, height: 800, language: undefined, version: undefined }),
      {
        viewport: "375x800",
      },
    );
    // 集めたものは、サーバーの検査を通る
    const env = rules.collectEnv({ width: 1280, height: 900, language: "en-US", version: "1.2.3" });
    const result = server.validateInquiry({
      category: "bug",
      message: "あ".repeat(10),
      includeEnv: true,
      env,
      website: "",
      elapsed: 5000,
    });
    assert.equal(result.ok, true);
  });

  it("添付する内容の説明に、送るものが、すべて書かれている(ブラウザの種類を含む)", () => {
    const summary = rules.envSummary({ viewport: "375x800", language: "ja", version: "0.3.0" });
    for (const word of ["画面の大きさ: 375×800", "言語: ja", "バージョン: v0.3.0", "User-Agent"]) {
      assert.ok(summary.includes(word), word);
    }
  });

  it("送信する内容: 罠の欄は空のまま。添付しないときは、環境を送らない。本文は、改行をそろえる", () => {
    const payload = rules.buildPayload({
      category: "bug",
      product: "kii-michi",
      message: " 一行目\r\n二行目 ",
      email: " a@example.com ",
      includeEnv: false,
      env: { viewport: "375x800" },
      website: "",
      elapsed: 5000,
    });
    assert.deepEqual(payload, {
      category: "bug",
      product: "kii-michi",
      message: "一行目\n二行目",
      email: "a@example.com",
      includeEnv: false,
      env: {},
      website: "",
      elapsed: 5000,
    });
  });
});

describe("メッセージ", () => {
  it("サーバーが返す、問い合わせの、すべてのエラーの種類に、利用者向けの文がある", () => {
    const source = ["functions/api/contact.js", "functions/_lib/contact.js"]
      .map((path) => read(path))
      .join("\n");
    const codes = new Set();
    for (const match of source.matchAll(/error\(\s*\d+,\s*"([a-z-]+)"/g)) codes.add(match[1]);
    for (const match of source.matchAll(/error:\s*"([a-z-]+)"/g)) codes.add(match[1]);
    assert.ok(codes.has("contact-unavailable") && codes.has("contact-message-short"));
    for (const code of codes)
      assert.ok(Object.hasOwn(CONTACT_ERRORS, code), `CONTACT_ERRORS に ${code} がない`);
  });

  it("共通の部品(CSRF・JSON の読み取り・回数制限・例外)が返す種類にも、文がある", () => {
    for (const code of [
      "bad-origin",
      "csrf-header-required",
      "unsupported-media-type",
      "invalid-json",
      "too-large",
      "rate-limited",
      "server-error",
      "method-not-allowed",
    ]) {
      assert.ok(Object.hasOwn(CONTACT_ERRORS, code), code);
    }
  });

  it("画面で検査する、すべてのエラーの種類にも、文がある", () => {
    const errors = new Set([
      ...Object.values(rules.validateForm({ category: "", message: "", email: "x" })),
      ...Object.values(
        rules.validateForm({ category: "bug", message: "あ".repeat(3000), email: "" }),
      ),
      ...Object.values(
        rules.validateForm({
          category: "bug",
          message: `${"あ".repeat(10)}${String.fromCodePoint(0)}`,
          email: "",
        }),
      ),
    ]);
    assert.ok(errors.size >= 4);
    for (const code of errors) assert.ok(Object.hasOwn(CONTACT_ERRORS, code), code);
  });

  it("知らない種類は、汎用の文(内部の理由を出さない)", () => {
    assert.equal(contactErrorMessage("nope"), UNKNOWN_ERROR);
    assert.equal(contactErrorMessage("constructor"), UNKNOWN_ERROR);
    assert.equal(contactErrorMessage(undefined), UNKNOWN_ERROR);
    for (const message of Object.values(CONTACT_ERRORS))
      assert.ok(!/sqlite|d1|token|stack/i.test(message), message);
  });
});

describe("API クライアント", () => {
  it("フォームが使えるか: enabled: true のときだけ true。失敗・不正な応答・503 は false", async () => {
    assert.equal(
      await fetchContactEnabled(recorder(jsonResponse({ enabled: true })).fetchImpl),
      true,
    );
    assert.equal(
      await fetchContactEnabled(recorder(jsonResponse({ enabled: false })).fetchImpl),
      false,
    );
    assert.equal(
      await fetchContactEnabled(recorder(jsonResponse({ enabled: "true" })).fetchImpl),
      false,
    );
    assert.equal(await fetchContactEnabled(recorder(jsonResponse({}, 503)).fetchImpl), false);
    assert.equal(await fetchContactEnabled(recorder(new Error("offline")).fetchImpl), false);
    assert.equal(
      await fetchContactEnabled(recorder(() => new Response("<html>")).fetchImpl),
      false,
    );
  });

  it("送信: POST で、X-NOLITO-CSRF と JSON を付ける。成功は { ok: true }", async () => {
    const { calls, fetchImpl } = recorder(jsonResponse({ ok: true }));
    const result = await sendInquiry({ category: "bug", message: "x" }, fetchImpl);
    assert.deepEqual(result, { ok: true });
    const { path, init } = calls[0];
    assert.deepEqual([path, init.method], ["/api/contact", "POST"]);
    assert.equal(init.headers["X-NOLITO-CSRF"], "1");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.credentials, "same-origin");
    assert.deepEqual(JSON.parse(init.body), { category: "bug", message: "x" });
  });

  it("送信の失敗は、例外にせず、利用者向けの文で返す(ネットワーク・JSON でない応答も)", async () => {
    const limited = await sendInquiry(
      {},
      recorder(jsonResponse({ error: "rate-limited" }, 429)).fetchImpl,
    );
    assert.deepEqual(
      [limited.ok, limited.code, limited.message],
      [false, "rate-limited", CONTACT_ERRORS["rate-limited"]],
    );
    const invalid = await sendInquiry(
      {},
      recorder(jsonResponse({ error: "contact-message-short" }, 400)).fetchImpl,
    );
    assert.equal(invalid.message, CONTACT_ERRORS["contact-message-short"]);
    const offline = await sendInquiry({}, recorder(new TypeError("Failed")).fetchImpl);
    assert.deepEqual(
      [offline.ok, offline.code, offline.message],
      [false, "network", NETWORK_ERROR],
    );
    const html = await sendInquiry(
      {},
      recorder(() => new Response("<html>", { status: 200 })).fetchImpl,
    );
    assert.equal(html.ok, false);
    assert.equal(html.message, UNKNOWN_ERROR);
    // 200 でも、ok: true でなければ、成功にしない
    assert.equal((await sendInquiry({}, recorder(jsonResponse({})).fetchImpl)).ok, false);
  });

  it("対象のプロダクトの選択肢: 準備中を除き、id・題名・バージョンを返す。取れなければ空", async () => {
    const real = (path) => jsonResponse(JSON.parse(read(`public${path}`)));
    const options = await fetchProductOptions(recorder(real).fetchImpl);
    assert.deepEqual(options.map((item) => item.id).sort(), ["escape-boss", "kii-michi"]);
    for (const item of options) {
      assert.ok(item.title.length > 0);
      assert.match(item.version, /^\d+\.\d+\.\d+$/);
    }
    assert.deepEqual(await fetchProductOptions(recorder(new Error("offline")).fetchImpl), []);
    assert.deepEqual(await fetchProductOptions(recorder(jsonResponse({}, 500)).fetchImpl), []);
  });
});

describe("ページの静的な性質(/support/)", () => {
  const html = read("public/support/index.html");
  const main = read("public/assets/js/contact/main.js");
  const css = read("public/assets/css/contact.css");

  it("すべての入力に、ラベルがある(for と id が対応)", () => {
    for (const id of [
      "contact-category",
      "contact-product",
      "contact-message",
      "contact-email",
      "contact-env",
    ]) {
      assert.match(html, new RegExp(`id="${id}"`), id);
      assert.match(html, new RegExp(`<label[^>]*for="${id}"`), `${id} のラベル`);
    }
  });

  it("必須の項目が、ラベルで分かる。メールアドレスは、任意と書いてある", () => {
    for (const label of ["種類(必須)", "内容(必須)", "返信用のメールアドレス(任意)"]) {
      assert.ok(html.includes(label), label);
    }
    assert.match(html, /type="email"[^>]*autocomplete="email"/);
  });

  it("罠の欄: 画面の外・読み上げない・キーボードで届かない・自動入力しない", () => {
    assert.match(html, /<div class="contact__trap" aria-hidden="true">/);
    assert.match(html, /name="website" tabindex="-1" autocomplete="off"/);
    assert.match(css, /\.contact__trap\s*{[^}]*left: -10000px/);
    assert.ok(
      !/\.contact__trap\s*{[^}]*display:\s*none/.test(css),
      "display: none にしない(ボットが、避ける)",
    );
  });

  it("送る前に、取り扱いを見せる: プライバシーポリシーへのリンク・保存期間・個人情報を書かない注意", () => {
    assert.match(html, /<a\s+href="\/privacy\/"[^>]*>プライバシーポリシー<\/a\s*>/);
    assert.match(html, /6か月を目安に削除/);
    assert.match(html, /個人情報は、書かないでください/);
  });

  it("JavaScript なしでも、その旨が出る。準備中の案内がある。エラー・状態は読み上げられる", () => {
    assert.match(html, /<noscript>[\s\S]*お問い合わせフォームの表示には、JavaScript が必要です/);
    assert.match(html, /data-contact-unavailable[\s\S]*準備中/);
    assert.match(html, /role="status"[^>]*data-contact-status/);
  });

  it("環境の添付は、既定でオフ(チェックなし)。添付する内容を、送る前に見せる", () => {
    assert.ok(!/id="contact-env"[^>]*\bchecked\b/.test(html));
    assert.match(main, /添付する内容/);
    assert.match(main, /envSummary/);
  });

  it("HTML として解釈する書き方をしない。ブラウザに、内容を保存しない。外部へ通信しない", () => {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(main));
    assert.match(main, /from "\.\.\/components\/dom\.js"/);
    const all = ["main", "client", "rules", "messages"]
      .map((n) => read(`public/assets/js/contact/${n}.js`))
      .join("\n");
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(all));
    assert.ok(!/https?:\/\//.test(all.replace(/\/\/.*$/gm, "")));
  });

  it("ソースに、見えない制御文字・双方向制御文字を、直接書いていない", () => {
    const files = [
      "public/assets/js/contact/main.js",
      "public/assets/js/contact/rules.js",
      "public/assets/js/contact/client.js",
      "public/assets/js/contact/messages.js",
      "functions/_lib/contact.js",
      "functions/api/contact.js",
      "scripts/lib/inquiries.mjs",
      "scripts/inquiries.mjs",
      "tests/contact-api.test.js",
    ];
    for (const file of files) {
      const source = read(file);
      for (let i = 0; i < source.length; i += 1) {
        const code = source.charCodeAt(i);
        const control =
          (code < 0x20 && code !== 0x0a && code !== 0x09) || (code >= 0x7f && code <= 0x9f);
        const bidi = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
        assert.ok(!control && !bidi, `${file}: 位置 ${i} に U+${code.toString(16)}`);
      }
    }
  });

  it("CSS は、色をトークンで指定する。入力は 16px 以上(iOS の自動ズームを防ぐ)", () => {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css));
    assert.match(css, /font-size: var\(--font-size-base\)/);
  });

  it("サポートページ以外(ホーム・ゲーム)に、フォームのスクリプトを読み込まない", () => {
    for (const page of [
      "index.html",
      "games/index.html",
      "about/index.html",
      "privacy/index.html",
    ]) {
      assert.ok(!read(`public/${page}`).includes("contact/main.js"), page);
    }
  });

  it("広告の枠を、フォームの近くに置かない(個人情報を入力する画面)", () => {
    assert.ok(!html.includes("data-ad-slot"));
  });
});

describe("プライバシーポリシー v2 と、案内の文言", () => {
  const privacy = text("public/privacy/index.html");

  it("版 2。設定の版・ページの版・同意の版が、そろっている", () => {
    assert.equal(analyticsConfig.policyVersion, 2);
    assert.match(read("public/privacy/index.html"), /data-policy-version="2"/);
    assert.match(privacy, /版 2 ・ 制定日/);
  });

  it("問い合わせ・アカウント・バックアップ・第三者(Cloudflare・Google)の取り扱いが書かれている", () => {
    for (const word of [
      "お問い合わせフォーム",
      "返信用のメールアドレス",
      "対応が終わってから、6か月を目安に削除",
      "Cloudflare D1",
      "IP アドレスそのものは、保存しません",
      "アカウント",
      "ライセンスキーそのものは保存せず",
      "いつでも、アカウントを削除",
      "バックアップ",
      "最長6か月",
      "開示・訂正・削除",
      "Cloudflare, Inc.",
      "Google LLC",
      "版 2(2026年9月20日)",
      "版 1(2026年9月20日)",
    ]) {
      assert.ok(privacy.includes(word), word);
    }
  });

  it("「個人情報を取得しません」「準備中」という、古い記述が残っていない", () => {
    assert.ok(!privacy.includes("取得しません。お問い合わせの窓口を設けるとき"));
    for (const page of ["privacy", "about", "support"]) {
      const body = text(`public/${page}/index.html`).replace(
        "お問い合わせフォームは、まだ使えません(準備中です)。",
        "",
      );
      assert.ok(!/お問い合わせ先は、準備中/.test(body), page);
    }
  });

  it("運営者・お問い合わせの窓口が、サポートのフォームを指している", () => {
    for (const page of ["privacy", "about"]) {
      assert.match(read(`public/${page}/index.html`), /href="\/support\/#contact"/, page);
    }
    assert.match(read("public/support/index.html"), /id="contact"/);
  });

  it("画面(フォーム・アカウント)に書いた約束が、ポリシーと同じ(保存期間・取得する情報)", () => {
    assert.match(read("public/support/index.html"), /対応が終わってから、6か月を目安に削除/);
    assert.match(privacy, /対応が終わってから、6か月を目安に削除/);
    assert.match(text("public/account/index.html"), /キーそのものは保存しません/);
  });

  it("ポリシーの版を上げたので、以前の同意(版 1)は無効になる", async () => {
    const { readConsent, writeConsent, CONSENT_KEY } =
      await import("../public/assets/js/components/consent-core.js");
    const map = new Map();
    const storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    };
    writeConsent(storage, "granted", 1);
    assert.equal(readConsent(storage, 1), "granted");
    assert.equal(
      readConsent(storage, analyticsConfig.policyVersion),
      null,
      "版 2 では、もう一度、確認する",
    );
    assert.ok(CONSENT_KEY);
  });

  it("フッターのリンクは、これまでどおり(更新履歴・サポート・ポリシー・利用規約)", () => {
    assert.deepEqual(
      footerLinks.map((link) => link.href),
      ["/about/", "/updates/", "/support/", "/privacy/", "/terms/"],
    );
  });
});

describe("サーバー側のソース", () => {
  it("問い合わせの本文・メールアドレスを、ログ(console)に出さない", () => {
    const files = sourceFiles(fileURLToPath(new URL("../functions", import.meta.url))).filter(
      (file) => /contact/.test(file),
    );
    assert.ok(files.length >= 2);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.ok(!/console\.(log|info|warn|error)/.test(source), file);
    }
  });

  it("メールを送らない(外部への通信がない)", () => {
    const source = read("functions/api/contact.js") + read("functions/_lib/contact.js");
    assert.ok(!/fetch\(|https?:\/\/|sendEmail|smtp/i.test(source.replace(/\/\/.*$/gm, "")));
  });
});

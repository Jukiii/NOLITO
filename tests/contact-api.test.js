// 問い合わせフォームの API と検証のテスト(Phase 10 PR 3)。本物と同じ SQL(node:sqlite の D1 互換)を使う。
import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { onRequestGet, onRequestPost, onRequest } from "../functions/api/contact.js";
import { onRequest as apiGuard } from "../functions/api/_middleware.js";
import { contactStatus } from "../functions/_lib/config.js";
import {
  CATEGORIES,
  MESSAGE_MAX,
  MESSAGE_MIN,
  MIN_ELAPSED_MS,
  validateInquiry,
} from "../functions/_lib/contact.js";
import { ORIGIN, get, makeEnv, write } from "./helpers/auth.js";
import { createDb } from "./helpers/d1.js";

const rows = async (env, sql, ...params) =>
  (
    await env.DB.prepare(sql)
      .bind(...params)
      .all()
  ).results;

const valid = (overrides = {}) => ({
  category: "bug",
  product: "kii-michi",
  message: "練習モードで、Ctrl+W を押すとタブが閉じてしまいました。",
  email: "",
  includeEnv: false,
  env: {},
  website: "",
  elapsed: 20_000,
  ...overrides,
});

let env;
beforeEach(() => {
  env = makeEnv({ CONTACT_ENABLED: "true" });
});

// 呼び出しごとに、違う送信元(IP)にする(1 つの送信元の回数制限に、当たらないように)。回数制限の検査は、明示する
let callCount = 0;
const send = (body, options = {}, targetEnv = env) => {
  callCount += 1;
  const ip = `10.0.${callCount >> 8}.${callCount & 255}`;
  return onRequestPost({
    request: write("POST", "/api/contact", {
      body,
      ...options,
      headers: { "CF-Connecting-IP": ip, ...options.headers },
    }),
    env: targetEnv,
  });
};

describe("設定", () => {
  it("DB・SESSION_SECRET・SITE_ORIGIN がそろい、CONTACT_ENABLED=true のときだけ、有効", () => {
    assert.deepEqual(contactStatus(env), { configured: true, enabled: true });
    assert.deepEqual(contactStatus(makeEnv()), { configured: true, enabled: false });
    assert.deepEqual(contactStatus(makeEnv({ CONTACT_ENABLED: "false" })), {
      configured: true,
      enabled: false,
    });
    for (const key of ["DB", "SESSION_SECRET", "SITE_ORIGIN"]) {
      assert.equal(contactStatus({ ...env, [key]: undefined }).enabled, false, key);
    }
    assert.equal(contactStatus({ ...env, SESSION_SECRET: "short" }).enabled, false);
    // Google の設定は、要らない(アカウントの設定とは、独立)
    assert.equal(
      contactStatus({ ...env, GOOGLE_CLIENT_ID: undefined, AUTH_ENABLED: undefined }).enabled,
      true,
    );
  });

  it("GET: 有効かどうかだけを返す。無効・設定なしでも、壊れない", async () => {
    assert.deepEqual(await (await onRequestGet({ env })).json(), { enabled: true });
    assert.deepEqual(await (await onRequestGet({ env: makeEnv() })).json(), { enabled: false });
    const empty = await onRequestGet({ env: {} });
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { enabled: false });
    assert.equal(empty.headers.get("Cache-Control"), "no-store");
  });

  it("無効のときは、POST は 503(保存しない)", async () => {
    for (const disabled of [makeEnv(), { DB: undefined }]) {
      const response = await send(valid(), {}, disabled);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "contact-unavailable" });
    }
    assert.deepEqual(await rows(env, "SELECT * FROM inquiries"), []);
  });

  it("GET・POST 以外は 405(許すメソッドを知らせる)", () => {
    const response = onRequest();
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET, POST");
  });
});

describe("送信", () => {
  it("正しい問い合わせを保存し、{ ok: true } だけを返す(内容を、返さない)", async () => {
    const response = await send(valid());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    const [row] = await rows(env, "SELECT * FROM inquiries");
    assert.equal(row.category, "bug");
    assert.equal(row.product_id, "kii-michi");
    assert.equal(row.message, valid().message);
    assert.equal(row.email, "");
    assert.equal(row.env_info, "");
    assert.equal(row.status, "new");
    assert.equal(row.resolved_at, null);
    assert.ok(row.created_at > 1_700_000_000);
    assert.match(row.id, /^[A-Za-z0-9_-]{22}$/);
  });

  it("返信用のメールアドレス(任意)を、前後の空白を削って保存する", async () => {
    await send(valid({ email: "  taro@example.com " }));
    assert.equal((await rows(env, "SELECT email FROM inquiries"))[0].email, "taro@example.com");
  });

  it("本文の改行(CRLF も)は、\\n にそろえて保存する。前後の空白は削る", async () => {
    await send(valid({ message: "  一行目です。\r\n二行目です。\r三行目です。  " }));
    assert.equal(
      (await rows(env, "SELECT message FROM inquiries"))[0].message,
      "一行目です。\n二行目です。\n三行目です。",
    );
  });

  it("HTML・SQL の断片は、ただの文字として保存する(実行されない・DB は無事)", async () => {
    const message =
      "<script>alert(1)</script> '); DROP TABLE users; -- ですが、これは、ただの文章です。";
    assert.equal((await send(valid({ message }))).status, 200);
    assert.equal((await rows(env, "SELECT message FROM inquiries"))[0].message, message);
    assert.deepEqual(await rows(env, "SELECT COUNT(*) AS n FROM users"), [{ n: 0 }]);
  });

  it("クライアントが status・id・created_at などを送っても、無視する(常に new)", async () => {
    await send({ ...valid(), status: "done", id: "evil", created_at: 1, resolved_at: 5 });
    const [row] = await rows(env, "SELECT * FROM inquiries");
    assert.equal(row.status, "new");
    assert.notEqual(row.id, "evil");
    assert.notEqual(row.created_at, 1);
    assert.equal(row.resolved_at, null);
  });

  it("環境の添付: 選んだときだけ、画面の大きさ・言語・バージョンと、User-Agent を保存する", async () => {
    await send(
      valid({
        includeEnv: true,
        env: { viewport: "375x800", language: "ja-JP", version: "0.3.0" },
      }),
      { headers: { "User-Agent": "TestBrowser/1.0" } },
    );
    await send(valid({ includeEnv: false, env: { viewport: "1x1" } }), {
      headers: { "User-Agent": "Secret/9" },
    });
    const [attached, notAttached] = await rows(
      env,
      "SELECT env_info FROM inquiries ORDER BY created_at, rowid",
    );
    assert.equal(
      attached.env_info,
      "viewport=375x800; language=ja-JP; version=0.3.0; ua=TestBrowser/1.0",
    );
    assert.equal(notAttached.env_info, "", "添付しないときは、User-Agent も保存しない");
  });

  it("IP アドレスは、DB のどこにも、そのまま残らない(回数の制限は、ハッシュ)", async () => {
    await send(valid(), { headers: { "CF-Connecting-IP": "203.0.113.55" } });
    const dump = JSON.stringify([
      await rows(env, "SELECT * FROM inquiries"),
      await rows(env, "SELECT * FROM rate_limits"),
      await rows(env, "SELECT * FROM audit_log"),
    ]);
    assert.ok(!dump.includes("203.0.113.55"));
  });

  it("監査ログには、種類だけを残す(本文・メールアドレスは、入れない)", async () => {
    await send(valid({ email: "taro@example.com", message: "秘密の内容を、ここに書きました。" }));
    const log = await rows(env, "SELECT event, detail, user_id FROM audit_log");
    assert.deepEqual(log, [{ event: "inquiry-received", detail: "bug", user_id: null }]);
  });

  it("ログインしていなくても送れる(アカウントには、結びつけない)", async () => {
    assert.equal((await send(valid())).status, 200);
    const columns = (await rows(env, "PRAGMA table_info(inquiries)")).map((c) => c.name);
    assert.ok(!columns.includes("user_id"));
  });
});

describe("ボット対策", () => {
  it("罠の欄(website)が埋まっていたら、保存せず、成功したように見せる", async () => {
    const response = await send(valid({ website: "http://spam.example/" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(await rows(env, "SELECT * FROM inquiries"), []);
    assert.deepEqual(await rows(env, "SELECT * FROM audit_log"), []);
  });

  it("速すぎる送信(3 秒未満)・elapsed がない・数でない値は、保存しない(成功に見せる)", async () => {
    for (const elapsed of [0, 1, MIN_ELAPSED_MS - 1, -5, "20000", null, undefined, NaN, Infinity]) {
      const response = await send(valid({ elapsed }));
      assert.equal(response.status, 200, String(elapsed));
      assert.deepEqual(await response.json(), { ok: true });
    }
    assert.deepEqual(await rows(env, "SELECT * FROM inquiries"), []);
    assert.equal((await send(valid({ elapsed: MIN_ELAPSED_MS }))).status, 200);
    assert.equal((await rows(env, "SELECT * FROM inquiries")).length, 1);
  });

  it("1 つの送信元は、1 時間に 3 件まで。4 件目は 429(ボットも、数える)", async () => {
    const ip = { headers: { "CF-Connecting-IP": "198.51.100.7" } };
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await send(valid(), ip)).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    assert.equal((await rows(env, "SELECT * FROM inquiries")).length, 3);
    const limited = await send(valid(), ip);
    assert.equal((await limited.json()).error, "rate-limited");
    // 別の送信元は、影響を受けない
    assert.equal(
      (await send(valid(), { headers: { "CF-Connecting-IP": "198.51.100.8" } })).status,
      200,
    );
  });

  it("全体でも、1 日 100 件まで(洪水で、無料枠を使い切らない)", async () => {
    let last;
    for (let i = 0; i < 101; i += 1) {
      last = await send(valid({ website: "bot" }), {
        headers: { "CF-Connecting-IP": `192.0.2.${i}` },
      });
    }
    assert.equal(last.status, 429);
    assert.deepEqual(await rows(env, "SELECT * FROM inquiries"), []);
    const log = await rows(env, "SELECT event, detail FROM audit_log WHERE event = 'rate-limited'");
    assert.deepEqual(log, [{ event: "rate-limited", detail: "contact-all" }]);
  });
});

describe("守り", () => {
  it("CSRF: Origin が違う・ない・独自ヘッダーがないと、403(保存しない)", async () => {
    for (const [options, code] of [
      [{ headers: { Origin: "https://evil.test" } }, "bad-origin"],
      [{ headers: { Origin: null } }, "bad-origin"],
      [{ headers: { "X-NOLITO-CSRF": null } }, "csrf-header-required"],
    ]) {
      const response = await send(valid(), options);
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error, code);
    }
    assert.deepEqual(await rows(env, "SELECT * FROM inquiries"), []);
  });

  it("JSON 以外は 415・壊れた JSON は 400・大きすぎる本文は 413(保存しない)", async () => {
    const plain = await send("message=x", {
      json: false,
      headers: { "Content-Type": "text/plain" },
    });
    assert.equal(plain.status, 415);
    assert.equal((await send("{")).status, 400);
    assert.equal((await send(JSON.stringify(valid({ message: "あ".repeat(6000) })))).status, 413);
    // 宣言された大きさが大きければ、本文を読む前に断る
    const declared = await send(valid(), { headers: { "Content-Length": "999999" } });
    assert.equal(declared.status, 413);
    assert.equal((await send([1, 2])).status, 400);
    assert.deepEqual(await rows(env, "SELECT * FROM inquiries"), []);
  });

  it("上限の本文(2000 文字の日本語)は、受け付ける(4KB の既定の上限には、収まらない)", async () => {
    const message = "あ".repeat(MESSAGE_MAX);
    assert.ok(new TextEncoder().encode(JSON.stringify(valid({ message }))).length > 4096);
    assert.equal((await send(valid({ message }))).status, 200);
    assert.equal(
      Array.from((await rows(env, "SELECT message FROM inquiries"))[0].message).length,
      MESSAGE_MAX,
    );
  });

  it("応答は no-store・nosniff", async () => {
    const response = await send(valid());
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  });

  it("D1 の障害など、想定外の例外は、ミドルウェアが JSON の 500 にする(内容を、返さない)", async () => {
    mock.method(console, "error", () => {});
    try {
      const db = createDb();
      db.prepare = () => {
        throw new Error("D1 is down: secret-detail");
      };
      const broken = makeEnv({ DB: db, CONTACT_ENABLED: "true" });
      const response = await apiGuard({
        next: () => send(valid(), {}, broken),
      });
      assert.equal(response.status, 500);
      const text = await response.text();
      assert.deepEqual(JSON.parse(text), { error: "server-error" });
      assert.ok(!text.includes("secret-detail"));
    } finally {
      console.error.mock.restore();
    }
  });

  it("送信に失敗したとき、メールアドレス・本文が、ログに出ない", async () => {
    const logged = [];
    mock.method(console, "error", (...args) => logged.push(args.join(" ")));
    try {
      const db = createDb();
      const real = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (sql.includes("INSERT INTO inquiries")) throw new Error("insert failed");
        return real(sql);
      };
      const broken = makeEnv({ DB: db, CONTACT_ENABLED: "true" });
      await apiGuard({
        next: () =>
          send(
            valid({ email: "taro@example.com", message: "とても個人的な内容を書きました。" }),
            {},
            broken,
          ),
      });
      assert.ok(!logged.join("\n").includes("taro@example.com"));
      assert.ok(!logged.join("\n").includes("個人的"));
    } finally {
      console.error.mock.restore();
    }
  });
});

describe("入力の検証(validateInquiry)", () => {
  const check = (overrides, options) => validateInquiry(valid(overrides), options);

  it("種類は、決まった 4 つだけ", () => {
    assert.deepEqual(CATEGORIES, ["bug", "request", "question", "other"]);
    for (const category of CATEGORIES) assert.equal(check({ category }).ok, true, category);
    for (const category of ["", "BUG", "spam", undefined, null, 1, ["bug"]]) {
      assert.equal(check({ category }).error, "contact-category", String(category));
    }
  });

  it("対象のプロダクトは、空か、小文字・数字・ハイフンの ID だけ", () => {
    for (const product of ["", "kii-michi", "escape-boss", "a", undefined]) {
      assert.equal(check({ product }).ok, true, String(product));
    }
    for (const product of ["KII", "a b", "-x", "x'; --", "<b>", "a".repeat(41), 1, null, {}]) {
      assert.equal(check({ product }).error, "contact-invalid", String(product));
    }
  });

  it("本文は 10〜2000 文字(コードポイントで数える。前後の空白は数えない)", () => {
    assert.equal(check({ message: "あ".repeat(MESSAGE_MIN) }).ok, true);
    assert.equal(check({ message: "あ".repeat(MESSAGE_MIN - 1) }).error, "contact-message-short");
    assert.equal(
      check({ message: `   ${"あ".repeat(MESSAGE_MIN - 1)}   ` }).error,
      "contact-message-short",
    );
    assert.equal(check({ message: "あ".repeat(MESSAGE_MAX) }).ok, true);
    assert.equal(check({ message: "あ".repeat(MESSAGE_MAX + 1) }).error, "contact-message-long");
    assert.equal(check({ message: "😀".repeat(MESSAGE_MAX) }).ok, true, "絵文字は 1 文字");
    assert.equal(check({ message: "😀".repeat(MESSAGE_MAX + 1) }).error, "contact-message-long");
    for (const message of [undefined, null, 123, {}, []]) {
      assert.equal(check({ message }).error, "contact-message-invalid", String(message));
    }
  });

  it("本文に、制御文字・双方向制御文字・不正なサロゲートがあれば、断る。改行・タブは、通す", () => {
    // 制御文字は、文字コードから作る(見えない文字を、ソースに直接書かない)
    for (const code of [0x00, 0x1b, 0x7f, 0x85, 0x202e, 0x2066]) {
      const bad = String.fromCodePoint(code);
      assert.equal(
        check({ message: `十分に長い本文です。${bad}あとの文` }).error,
        "contact-message-invalid",
        JSON.stringify(bad),
      );
    }
    assert.equal(check({ message: "十分に長い本文です。\n次の行\tタブ" }).ok, true);
    assert.equal(check({ message: "十分に長い本文です。\ud800" }).error, "contact-message-invalid");
  });

  it("メールアドレスは、任意。書くなら、形が正しいもの(長さ 254 まで・制御文字なし)", () => {
    for (const email of ["", undefined, "a@example.com", " a@example.com "]) {
      assert.equal(check({ email }).ok, true, String(email));
    }
    for (const email of [
      "abc",
      "a@",
      "@b.c",
      "a b@c.d",
      `${"a".repeat(250)}@b.cd`,
      "a@b.c\nBcc: x@y.z",
      123,
      {},
    ]) {
      assert.equal(check({ email }).error, "contact-email", JSON.stringify(email));
    }
  });

  it("includeEnv は、真偽値だけ。環境の値は、決まった形だけ", () => {
    for (const includeEnv of [undefined, "true", 1, null]) {
      assert.equal(check({ includeEnv }).error, "contact-invalid", String(includeEnv));
    }
    const env = (value) => check({ includeEnv: true, env: value });
    assert.equal(env({ viewport: "375x800", language: "ja", version: "0.3.0" }).ok, true);
    assert.equal(env(undefined).ok, true);
    for (const bad of [
      { viewport: "wide" },
      { viewport: "375x800x2" },
      { language: "ja_JP; DROP" },
      { version: "v1" },
      { version: "1.2" },
      { viewport: 375 },
      "text",
      [],
    ]) {
      assert.equal(env(bad).error, "contact-invalid", JSON.stringify(bad));
    }
  });

  it("User-Agent は、添付を選んだときだけ。制御文字を除き、300 文字までに切る", () => {
    const withUa = check({ includeEnv: true }, { userAgent: `Agent\u001b[31m/${"x".repeat(400)}` });
    const ua = withUa.value.envInfo.replace(/^ua=/, "");
    assert.ok(!ua.includes("\u001b"));
    assert.equal(ua.length, 300);
    assert.equal(check({ includeEnv: false }, { userAgent: "Agent/1" }).value.envInfo, "");
  });

  it("オブジェクトでない入力は、断る", () => {
    for (const input of [null, undefined, "x", 1, []]) {
      assert.equal(validateInquiry(input).error, "contact-invalid", String(input));
    }
  });

  it("ORIGIN の定数は、SITE_ORIGIN と同じ", () => {
    assert.equal(env.SITE_ORIGIN, ORIGIN);
    assert.ok(get("/api/contact"));
  });
});

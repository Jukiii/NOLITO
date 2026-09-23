// ライセンスの発行スクリプト(運営者用)のテスト。出力の SQL を、実際の DB に流して、登録できることまで確認する。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { hashKey, normalizeKey, redeemLicense } from "../functions/_lib/licenses.js";
import {
  MAX_COUNT,
  MAX_NOTE_LENGTH,
  issueLicenses,
  sqlString,
  validateIssueOptions,
} from "../scripts/lib/license-issue.mjs";
import { createDb } from "./helpers/d1.js";

const productIds = ["escape-boss", "kii-michi"];
const script = fileURLToPath(new URL("../scripts/issue-license.mjs", import.meta.url));
const NOW = 1_800_000_000;

const rows = async (db, sql) => (await db.prepare(sql).all()).results;

describe("発行", () => {
  it("指定した数のキーと、同じ数の INSERT を作る。1 行に 1 文で、コメントを含まない", async () => {
    const { keys, sql } = await issueLicenses({
      productId: "kii-michi",
      count: 3,
      now: NOW,
      productIds,
    });
    assert.equal(keys.length, 3);
    assert.equal(new Set(keys).size, 3);
    assert.equal(sql.length, 3);
    for (const line of sql) {
      assert.ok(line.startsWith("INSERT INTO licenses ("));
      assert.ok(line.endsWith(";"));
      assert.ok(!line.includes("\n"));
      assert.ok(!line.includes("--"), "コンソールで 1 行になっても、後ろがコメントにならない");
    }
  });

  it("SQL には、キーそのものを含めない(ハッシュと、末尾 4 文字だけ)", async () => {
    const { keys, sql } = await issueLicenses({
      productId: "kii-michi",
      count: 2,
      now: NOW,
      productIds,
    });
    const text = sql.join("\n");
    for (const key of keys) {
      assert.ok(!text.includes(key));
      assert.ok(!text.includes(normalizeKey(key)));
    }
  });

  it("出力の SQL を DB に流すと、発行したキーが、そのまま登録できる", async () => {
    const db = createDb();
    const { keys, sql } = await issueLicenses({
      productId: "escape-boss",
      count: 3,
      note: "テスターへ",
      now: NOW,
      productIds,
    });
    for (const line of sql) await db.prepare(line).run();

    const stored = await rows(db, "SELECT * FROM licenses");
    assert.equal(stored.length, 3);
    assert.ok(stored.every((row) => row.product_id === "escape-boss" && row.note === "テスターへ"));
    assert.ok(stored.every((row) => row.user_id === null && row.revoked_at === null));
    assert.ok(stored.every((row) => row.issued_at === NOW));

    await db
      .prepare(
        "INSERT INTO users (id, google_sub, email, nickname, created_at, last_login_at) VALUES ('u1', 's1', 'a@example.com', 'x', 1, 1)",
      )
      .run();
    for (const key of keys) {
      const result = await redeemLicense(db, {
        userId: "u1",
        keyHash: await hashKey(normalizeKey(key)),
        now: NOW + 1,
      });
      assert.equal(result.ok, true, key);
      assert.equal(result.license.productId, "escape-boss");
    }
  });

  it("メモの単一引用符・SQL の断片は、ただの文字として保存される(インジェクションしない)", async () => {
    const db = createDb();
    const note = "it's'); DROP TABLE users; SELECT ('";
    const { sql } = await issueLicenses({ productId: "kii-michi", note, now: NOW, productIds });
    for (const line of sql) await db.prepare(line).run();
    assert.equal((await rows(db, "SELECT note FROM licenses"))[0].note, note);
    // users テーブルは、無事
    assert.deepEqual(await rows(db, "SELECT COUNT(*) AS n FROM users"), [{ n: 0 }]);
  });

  it("sqlString は、単一引用符を 2 つにする", () => {
    assert.equal(sqlString("a'b"), "'a''b'");
    assert.equal(sqlString("''"), "''''''");
  });

  it("sqlString は、出力の文字列に「--」を残さない(id・ハッシュは base64url でハイフンを含みうる)", () => {
    for (const value of ["a--b", "a---b", "a----b", "--start", "end--", "a-b-c--d--e", "a-b"]) {
      assert.ok(!sqlString(value).includes("--"), value);
    }
  });

  it("「--」を含む値でも、SQL として評価すると、元の値のまま戻る(連結(||)で分けても、値は変わらない)", async () => {
    const db = createDb();
    for (const value of ["a--b", "a---b", "----", "a-b--c-d", "id-with--dashes--like-a-token"]) {
      const row = await db.prepare(`SELECT ${sqlString(value)} AS v`).first();
      assert.equal(row.v, value, value);
    }
  });
});

describe("入力の検査", () => {
  const ok = { productId: "kii-michi", count: 1, note: "" };

  it("正しい入力は通る", () => {
    assert.doesNotThrow(() => validateIssueOptions(ok, productIds));
    assert.doesNotThrow(() => validateIssueOptions({ ...ok, count: MAX_COUNT }, productIds));
    assert.doesNotThrow(() =>
      validateIssueOptions({ ...ok, note: "あ".repeat(MAX_NOTE_LENGTH) }, productIds),
    );
  });

  it("products.json にない商品 ID は、断る(誤って、存在しない商品のキーを作らない)", () => {
    for (const productId of ["nope", "", undefined, "KII-MICHI", "kii-michi ", "kii-michi'; --"]) {
      assert.throws(
        () => validateIssueOptions({ ...ok, productId }, productIds),
        /商品 ID/,
        String(productId),
      );
    }
  });

  it("数は、1〜50 の整数だけ", () => {
    for (const count of [0, -1, MAX_COUNT + 1, 1.5, NaN, undefined, "3"]) {
      assert.throws(
        () => validateIssueOptions({ ...ok, count }, productIds),
        /1〜50/,
        String(count),
      );
    }
  });

  it("メモは 100 文字まで。改行などの制御文字は使えない", () => {
    assert.throws(
      () => validateIssueOptions({ ...ok, note: "あ".repeat(MAX_NOTE_LENGTH + 1) }, productIds),
      /文字まで/,
    );
    for (const note of ["a\nb", "a\rb", "a\u0000b", "a\u007fb", "a\tb"]) {
      assert.throws(
        () => validateIssueOptions({ ...ok, note }, productIds),
        /制御文字/,
        JSON.stringify(note),
      );
    }
  });
});

describe("コマンド(node scripts/issue-license.mjs)", () => {
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

  it("キーと SQL を表示して、正常終了する", () => {
    const result = run("kii-michi", "--count", "2", "--note", "テスト");
    assert.equal(result.status, 0, result.stderr);
    const keys = result.stdout.match(/NLTO-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}/g);
    assert.equal(keys.length, 2);
    assert.equal((result.stdout.match(/^INSERT INTO licenses/gm) ?? []).length, 2);
    // 出力の SQL に、キーは含まれない
    const sqlPart = result.stdout
      .split("\n")
      .filter((line) => line.startsWith("INSERT"))
      .join("\n");
    for (const key of keys) assert.ok(!sqlPart.includes(key));
  });

  it("商品 ID がない・不正・知らないオプションは、エラーで終了する", () => {
    for (const args of [
      [],
      ["nope"],
      ["kii-michi", "--count", "0"],
      ["kii-michi", "--bogus"],
      ["kii-michi", "extra"],
    ]) {
      const result = run(...args);
      assert.equal(result.status, 1, args.join(" "));
      assert.match(result.stderr, /エラー/);
      assert.ok(!/INSERT/.test(result.stdout));
    }
  });

  it("キーをファイルに保存する処理を、持たない(画面に出すだけ)", () => {
    const source = [
      readFileSync(script, "utf8"),
      readFileSync(
        fileURLToPath(new URL("../scripts/lib/license-issue.mjs", import.meta.url)),
        "utf8",
      ),
    ].join("\n");
    assert.ok(!/writeFile|appendFile|createWriteStream/.test(source));
    assert.ok(!/fetch\(|https?:\/\//.test(source.replace(/\/\/.*$/gm, "")), "外部へ送らない");
  });
});

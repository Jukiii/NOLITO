// 管理画面の監査ログの基盤(Phase 26 PR 1)のテスト。変更前後(before/after)を記録できる、
// 既存の audit.js(ログイン等の短い出来事)とは別のテーブル。
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { pruneAdminAudit, recordAdminChange } from "../functions/_lib/admin-audit.js";
import { upsertUser } from "../functions/_lib/users.js";
import { createDb } from "./helpers/d1.js";

// admin_audit_log.user_id は、users(id) を参照する(外部キー)。実在する利用者を、1人作っておく
async function testUser(db) {
  const { user } = await upsertUser(db, { sub: "sub-1", email: "admin@example.com", now: 1 });
  return user.id;
}

describe("recordAdminChange", () => {
  it("before/after を JSON にして、行を書き込む", async () => {
    const db = createDb();
    const userId = await testUser(db);
    await recordAdminChange(db, {
      userId,
      resourceType: "vocabulary",
      resourceId: "engineer-001",
      action: "update",
      before: { explanation: "前" },
      after: { explanation: "後" },
      now: 1000,
    });
    const row = await db.prepare("SELECT * FROM admin_audit_log").first();
    assert.equal(row.at, 1000);
    assert.equal(row.user_id, userId);
    assert.equal(row.resource_type, "vocabulary");
    assert.equal(row.resource_id, "engineer-001");
    assert.equal(row.action, "update");
    assert.deepEqual(JSON.parse(row.before_json), { explanation: "前" });
    assert.deepEqual(JSON.parse(row.after_json), { explanation: "後" });
  });

  it("before・after が null でもよい(新規作成・削除など)。resourceId も省略できる", async () => {
    const db = createDb();
    const userId = await testUser(db);
    await recordAdminChange(db, {
      userId,
      resourceType: "product",
      action: "create",
      before: null,
      after: { name: "新規" },
      now: 1000,
    });
    const row = await db.prepare("SELECT * FROM admin_audit_log").first();
    assert.equal(row.resource_id, null);
    assert.equal(row.before_json, null);
    assert.deepEqual(JSON.parse(row.after_json), { name: "新規" });
  });

  it("大きすぎる内容は、切り詰める(1件20000文字まで)", async () => {
    const db = createDb();
    const userId = await testUser(db);
    await recordAdminChange(db, {
      userId,
      resourceType: "article",
      action: "update",
      before: null,
      after: { body: "あ".repeat(30_000) },
      now: 1000,
    });
    const row = await db.prepare("SELECT * FROM admin_audit_log").first();
    assert.equal(row.after_json.length, 20_000);
  });

  it("JSON にできない値(循環参照)でも、落ちずに null を書く", async () => {
    const db = createDb();
    const userId = await testUser(db);
    const circular = {};
    circular.self = circular;
    await recordAdminChange(db, {
      userId,
      resourceType: "article",
      action: "update",
      before: circular,
      after: null,
      now: 1000,
    });
    const row = await db.prepare("SELECT * FROM admin_audit_log").first();
    assert.equal(row.before_json, null);
  });

  it("アカウントの削除後(user_id が消えた)でも、行は残る(既存の audit_log と同じ考え方)", async () => {
    const db = createDb();
    const userId = await testUser(db);
    await recordAdminChange(db, { userId, resourceType: "t", action: "a", now: 1000 });
    await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    const row = await db.prepare("SELECT * FROM admin_audit_log").first();
    assert.equal(row.user_id, null); // ON DELETE SET NULL
  });

  describe("書き込み・削除に失敗しても、落ちない", () => {
    beforeEach(() => mock.method(console, "error", () => {}));
    afterEach(() => mock.restoreAll());

    const brokenDb = () => ({
      prepare: () => ({
        bind: () => ({ run: () => Promise.reject(new Error("boom")) }),
      }),
    });

    it("recordAdminChange: DB が壊れていても、例外を投げない", async () => {
      await assert.doesNotReject(
        recordAdminChange(brokenDb(), { userId: "u", resourceType: "t", action: "a", now: 1 }),
      );
    });

    it("pruneAdminAudit: DB が壊れていても、例外を投げない", async () => {
      await assert.doesNotReject(pruneAdminAudit(brokenDb(), 1000));
    });
  });
});

describe("pruneAdminAudit", () => {
  it("180日より古い行だけを消す(既存の audit_log と同じ保存期間)", async () => {
    const db = createDb();
    const userId = await testUser(db);
    const day = 24 * 60 * 60;
    const now = 1_000_000;
    await recordAdminChange(db, {
      userId,
      resourceType: "t",
      action: "a",
      now: now - 181 * day,
    });
    await recordAdminChange(db, {
      userId,
      resourceType: "t",
      action: "a",
      now: now - 179 * day,
    });
    await pruneAdminAudit(db, now);
    const { results } = await db.prepare("SELECT at FROM admin_audit_log").all();
    assert.equal(results.length, 1);
    assert.equal(results[0].at, now - 179 * day);
  });
});

// 依存の脆弱性チェックの判定(scripts/lib/audit-allow.mjs)のテスト。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_ADVISORIES,
  collectAdvisories,
  evaluateAudit,
} from "../scripts/lib/audit-allow.mjs";

const advisory = (id, severity = "high") => ({
  source: 1,
  name: "pkg",
  title: "title",
  url: `https://github.com/advisories/${id}`,
  severity,
});
const report = (...vias) => ({
  vulnerabilities: {
    pkg: { via: vias },
    parent: { via: ["pkg"] },
  },
});
const allowed = [{ id: "GHSA-aaaa-bbbb-cccc", until: "2026-11-03", reason: "テスト" }];
const day = (text) => new Date(`${text}T12:00:00Z`);

describe("collectAdvisories", () => {
  it("勧告のオブジェクトだけを数え、文字列(広がった印)・moderate は数えない", () => {
    const found = collectAdvisories(
      report(advisory("GHSA-aaaa-bbbb-cccc"), advisory("GHSA-dddd-eeee-ffff", "moderate")),
    );
    assert.deepEqual(
      found.map((item) => item.id),
      ["GHSA-aaaa-bbbb-cccc"],
    );
  });

  it("同じ勧告は 1 件にまとめる", () => {
    const duplicated = {
      vulnerabilities: {
        a: { via: [advisory("GHSA-aaaa-bbbb-cccc")] },
        b: { via: [advisory("GHSA-aaaa-bbbb-cccc")] },
      },
    };
    assert.equal(collectAdvisories(duplicated).length, 1);
  });

  it("空・壊れた結果でも落ちない", () => {
    assert.deepEqual(collectAdvisories({}), []);
    assert.deepEqual(collectAdvisories(null), []);
  });
});

describe("evaluateAudit", () => {
  it("除外の一覧にある勧告は、期限まで通る", () => {
    const result = evaluateAudit(
      report(advisory("GHSA-aaaa-bbbb-cccc")),
      allowed,
      day("2026-11-03"),
    );
    assert.equal(result.ok, true);
    assert.equal(result.ignored.length, 1);
  });

  it("期限を過ぎたら、止まる", () => {
    const result = evaluateAudit(
      report(advisory("GHSA-aaaa-bbbb-cccc")),
      allowed,
      day("2026-11-04"),
    );
    assert.equal(result.ok, false);
    assert.equal(result.expired.length, 1);
  });

  it("一覧にない別の high は、止まる", () => {
    const result = evaluateAudit(
      report(advisory("GHSA-aaaa-bbbb-cccc"), advisory("GHSA-dddd-eeee-ffff", "critical")),
      allowed,
      day("2026-10-03"),
    );
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.blocking.map((item) => item.id),
      ["GHSA-dddd-eeee-ffff"],
    );
  });

  it("勧告がなければ通る", () => {
    assert.equal(evaluateAudit({ vulnerabilities: {} }, allowed, day("2026-10-03")).ok, true);
  });
});

describe("実際の除外の一覧", () => {
  it("理由と期限(日付の形)を、必ず持つ", () => {
    for (const entry of ALLOWED_ADVISORIES) {
      assert.match(entry.id, /^GHSA-/);
      assert.match(entry.until, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(entry.reason.length > 0);
    }
  });
});

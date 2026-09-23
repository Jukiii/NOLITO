// 役職の特殊ルール(Phase 17 PR 1)のテスト: rules.js(純粋な計算)・roles.json のルール・画面のつなぎ。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_DRAIN_MULTIPLIER,
  RULE_LIMITS,
  RULE_TYPES,
  closingMultiplier,
  describeRule,
  describeRules,
  drainMultiplier,
  isShockActive,
  normalizeRule,
  rulesOf,
  shockDuration,
  surgePhase,
} from "../public/assets/js/games/escape-boss/rules.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));

const SURGE = { type: "surge", every: 15, duration: 3, warn: 1, multiplier: 1.5 };
const SHOCK = { type: "shock", duration: 2, multiplier: 1.5 };
const CLOSING = { type: "closing", from: 0.5, max: 1.3 };

describe("normalizeRule", () => {
  it("3 種類(surge・shock・closing)。正しいルールは、そのまま通る", () => {
    assert.deepEqual([...RULE_TYPES], ["surge", "shock", "closing"]);
    assert.deepEqual(normalizeRule(SURGE), SURGE);
    assert.deepEqual(normalizeRule(SHOCK), SHOCK);
    assert.deepEqual(normalizeRule(CLOSING), CLOSING);
  });

  it("ダッシュの予告(warn)は、省略すると 1 秒", () => {
    assert.equal(normalizeRule({ type: "surge", every: 15, duration: 3, multiplier: 1.5 }).warn, 1);
  });

  it("知らない種類・オブジェクトでないもの・配列・null は、無効(null)", () => {
    for (const bad of [
      null,
      undefined,
      "surge",
      5,
      [],
      [SURGE],
      {},
      { type: "boom", multiplier: 2 },
      { type: "__proto__" },
      { type: "constructor" },
      { type: "toString" },
    ]) {
      assert.equal(normalizeRule(bad), null, JSON.stringify(bad));
    }
  });

  it("項目が足りない・範囲外・数でない値は、無効(範囲の端は、通る)", () => {
    for (const [type, limits] of Object.entries(RULE_LIMITS)) {
      const base = { surge: SURGE, shock: SHOCK, closing: CLOSING }[type];
      for (const [key, [min, max]] of Object.entries(limits)) {
        if (type === "surge" && key === "warn") continue; // 省略できる項目は、別に確かめる
        assert.equal(normalizeRule({ ...base, [key]: undefined }), null, `${type}.${key} なし`);
        for (const bad of [
          min - 0.001,
          max + 0.001,
          Number.NaN,
          Infinity,
          -Infinity,
          "1.5",
          null,
          [],
        ]) {
          assert.equal(normalizeRule({ ...base, [key]: bad }), null, `${type}.${key}=${bad}`);
        }
      }
    }
    assert.ok(normalizeRule({ ...SHOCK, duration: 0.5, multiplier: 3 }));
    assert.ok(normalizeRule({ ...SHOCK, duration: 10, multiplier: 1.1 }));
    assert.ok(normalizeRule({ ...CLOSING, from: 0.1, max: 2.5 }));
    assert.equal(normalizeRule({ ...SURGE, warn: 4 }), null, "予告は、3 秒まで");
    assert.ok(normalizeRule({ ...SURGE, warn: 0 }), "予告なし(0 秒)は、許す");
  });

  it("ダッシュは、予告と本番が、1 周期の中に収まる(収まらなければ、無効)", () => {
    assert.ok(normalizeRule({ ...SURGE, every: 8, duration: 4, warn: 3 }));
    assert.equal(normalizeRule({ ...SURGE, every: 8, duration: 5, warn: 3 }), null);
    assert.equal(normalizeRule({ ...SURGE, every: 8, duration: 8, warn: 0 }), null);
  });

  it("知らない項目は捨てる。入力は書き換えない", () => {
    const input = { ...SHOCK, evil: "<script>", __proto__: { polluted: true } };
    const before = JSON.stringify(input);
    const out = normalizeRule(input);
    assert.deepEqual(out, SHOCK);
    assert.equal(JSON.stringify(input), before);
    assert.equal(out.polluted, undefined);
  });
});

describe("rulesOf", () => {
  it("ルールがない・配列でない・stage がない場合は、空", () => {
    for (const stage of [
      undefined,
      null,
      {},
      { rules: null },
      { rules: "surge" },
      { rules: {} },
      { rules: [] },
      5,
    ]) {
      assert.deepEqual(rulesOf(stage), [], JSON.stringify(stage));
    }
  });

  it("無効なものは除く。同じ種類は、最初の 1 つだけ", () => {
    const stage = { rules: [SURGE, { type: "boom" }, { ...SURGE, multiplier: 2 }, null, SHOCK] };
    assert.deepEqual(rulesOf(stage), [SURGE, SHOCK]);
  });

  it("結果は、凍結される。同じ stage には、同じ結果を返す(覚える)", () => {
    const stage = { rules: [SURGE, CLOSING] };
    const first = rulesOf(stage);
    assert.ok(Object.isFrozen(first) && Object.isFrozen(first[0]));
    assert.equal(rulesOf(stage), first);
    assert.throws(() => {
      "use strict";
      first.push({});
    }, TypeError);
  });
});

describe("surgePhase(ダッシュの段階)", () => {
  // every 15・duration 3・warn 1 → 予告は 11〜12 秒、ダッシュは 12〜15 秒(周期のくり返し)
  it("ふだん → 予告(1 秒前)→ ダッシュ中(3 秒)→ ふだん。周期のくり返し。境目は、始まる側", () => {
    const at = (t) => surgePhase(SURGE, t);
    assert.equal(at(0), "idle");
    assert.equal(at(10.999), "idle");
    assert.equal(at(11), "warn");
    assert.equal(at(11.999), "warn");
    assert.equal(at(12), "active");
    assert.equal(at(14.999), "active");
    assert.equal(at(15), "idle");
    assert.equal(at(26), "warn");
    assert.equal(at(27), "active");
    assert.equal(at(15 * 40 + 13), "active");
  });

  it("予告なし(warn 0)では、ダッシュ中だけ", () => {
    const rule = { ...SURGE, warn: 0 };
    assert.equal(surgePhase(rule, 11.5), "idle");
    assert.equal(surgePhase(rule, 12), "active");
  });

  it("ダッシュでないルール・不正な時刻(負・NaN・無限)は、ふだん", () => {
    assert.equal(surgePhase(SHOCK, 13), "idle");
    assert.equal(surgePhase(null, 13), "idle");
    for (const t of [-1, Number.NaN, Infinity, "13", undefined])
      assert.equal(surgePhase(SURGE, t), "idle");
  });
});

describe("ミスで加速・追い詰め", () => {
  it("isShockActive: 終わる時刻より前だけ", () => {
    assert.equal(isShockActive(5, 7), true);
    assert.equal(isShockActive(6.999, 7), true);
    assert.equal(isShockActive(7, 7), false);
    assert.equal(isShockActive(5, 0), false);
    assert.equal(isShockActive(Number.NaN, 7), false);
    assert.equal(isShockActive(5, Number.NaN), false);
  });

  it("closingMultiplier: from 以上は 1。0 で max。その間は、直線で増える。範囲外・数でないものは、丸める・1", () => {
    assert.equal(closingMultiplier(CLOSING, 1), 1);
    assert.equal(closingMultiplier(CLOSING, 0.5), 1);
    assert.equal(closingMultiplier(CLOSING, 0), 1.3);
    assert.ok(Math.abs(closingMultiplier(CLOSING, 0.25) - 1.15) < 1e-12);
    assert.equal(closingMultiplier(CLOSING, -3), 1.3);
    assert.equal(closingMultiplier(CLOSING, 9), 1);
    assert.equal(closingMultiplier(CLOSING, Number.NaN), 1);
    assert.equal(closingMultiplier(SHOCK, 0), 1);
    // 距離が減るほど、倍率は、下がらない
    let previous = 0;
    for (let ratio = 1; ratio >= 0; ratio -= 0.05) {
      const m = closingMultiplier(CLOSING, ratio);
      assert.ok(m >= previous - 1e-12);
      previous = m;
    }
  });

  it("shockDuration: ルールがあればその長さ、なければ 0", () => {
    assert.equal(shockDuration(rulesOf({ rules: [SHOCK] })), 2);
    assert.equal(shockDuration(rulesOf({ rules: [SURGE] })), 0);
    assert.equal(shockDuration([]), 0);
  });
});

describe("drainMultiplier(かけ合わせ)", () => {
  const rules = rulesOf({ rules: [SURGE, SHOCK, CLOSING] });
  const state = (over = {}) => ({ elapsed: 0, distance: 100, shockUntil: 0, ...over });

  it("何も働いていなければ 1。ルールがなくても 1", () => {
    assert.equal(drainMultiplier(rules, state(), 100), 1);
    assert.equal(drainMultiplier([], state(), 100), 1);
  });

  it("働いているルールの倍率を、かける(ダッシュ 1.5 × ミスで加速 1.5 × 追い詰め)", () => {
    assert.equal(drainMultiplier(rules, state({ elapsed: 13 }), 100), 1.5);
    assert.equal(drainMultiplier(rules, state({ elapsed: 1, shockUntil: 3 }), 100), 1.5);
    assert.equal(drainMultiplier(rules, state({ elapsed: 13, shockUntil: 14 }), 100), 2.25);
    const all = drainMultiplier(rules, state({ elapsed: 13, shockUntil: 14, distance: 0 }), 100);
    assert.ok(Math.abs(all - 1.5 * 1.5 * 1.3) < 1e-12);
  });

  it("予告の間は、まだ加速しない", () => {
    assert.equal(drainMultiplier(rules, state({ elapsed: 11.5 }), 100), 1);
  });

  it("重なっても、3 倍まで", () => {
    const strong = rulesOf({
      rules: [
        { ...SURGE, multiplier: 3 },
        { ...SHOCK, multiplier: 3 },
      ],
    });
    assert.equal(MAX_DRAIN_MULTIPLIER, 3);
    assert.equal(drainMultiplier(strong, state({ elapsed: 13, shockUntil: 14 }), 100), 3);
  });

  it("最大距離が 0・不正でも、落ちない(追い詰めは、無視)", () => {
    const only = rulesOf({ rules: [CLOSING] });
    assert.equal(drainMultiplier(only, state({ distance: 0 }), 0), 1);
    assert.equal(drainMultiplier(only, state({ distance: Number.NaN }), 100), 1);
  });
});

describe("説明の文(利用者向け)", () => {
  it("数値は、データから作る。1 文で、「。」で終わる", () => {
    assert.equal(
      describeRule(SURGE),
      "15秒ごとに、3秒間の「ダッシュ」で、追ってくる人が1.5倍の速さになります(始まる前に、予告が出ます)。",
    );
    assert.equal(describeRule(SHOCK), "ミスをすると、2秒間、追ってくる人が1.5倍の速さになります。");
    assert.equal(
      describeRule(CLOSING),
      "逃走距離が50%を切ると、少なくなるほど追ってくる人が速くなります(距離 0 で1.3倍)。",
    );
  });

  it("数値を変えると、説明も変わる(後から修正できる)", () => {
    assert.match(describeRule({ ...SURGE, every: 20, multiplier: 1.25 }), /^20秒ごとに.*1\.25倍/);
    assert.match(describeRule({ ...CLOSING, from: 0.4 }), /40%を切ると/);
  });

  it("知らないルールは、空の文。describeRules は、有効なルールだけ", () => {
    assert.equal(describeRule({ type: "boom" }), "");
    assert.equal(describeRule(null), "");
    assert.deepEqual(describeRules({ rules: [SURGE, { type: "boom" }] }), [describeRule(SURGE)]);
    assert.deepEqual(describeRules({}), []);
  });
});

describe("roles.json のルールと、語の重み", () => {
  const byId = Object.fromEntries(roles.map((role) => [role.id, role]));

  it("すべての役職に rules(配列)がある。どのルールも、有効で、知らない項目がない(そのまま normalizeRule を通る)", () => {
    for (const role of roles) {
      assert.ok(Array.isArray(role.stage.rules), role.id);
      for (const rule of role.stage.rules) {
        assert.ok(normalizeRule(rule), `${role.id}: ${JSON.stringify(rule)}`);
        assert.deepEqual(
          Object.keys(rule).sort(),
          Object.keys(normalizeRule(rule)).sort(),
          role.id,
        );
      }
      assert.equal(
        rulesOf(role.stage).length,
        role.stage.rules.length,
        `${role.id}: 種類の重複・無効`,
      );
    }
  });

  it("役職ごとのルール: 先輩 = なし / 係長 = ダッシュ / 部長 = ミスで加速 / 社長 = 追い詰め / 会長 = 3 つとも", () => {
    const types = (id) => byId[id].stage.rules.map((rule) => rule.type);
    assert.deepEqual(types("senpai"), []);
    assert.deepEqual(types("kakaricho"), ["surge"]);
    assert.deepEqual(types("buchou"), ["shock"]);
    assert.deepEqual(types("shachou"), ["closing"]);
    assert.deepEqual(types("kaicho"), ["surge", "shock", "closing"]);
  });

  it("会長のルールは、それぞれ、前の役職より、弱め(全部入りなので)", () => {
    const rule = (id, type) => byId[id].stage.rules.find((r) => r.type === type);
    assert.ok(rule("kaicho", "surge").multiplier <= rule("kakaricho", "surge").multiplier);
    assert.ok(rule("kaicho", "shock").multiplier <= rule("buchou", "shock").multiplier);
    assert.ok(rule("kaicho", "closing").max <= rule("shachou", "closing").max);
  });

  it("説明の文が、ルールのある役職には出る。先輩は、空", () => {
    assert.deepEqual(describeRules(byId.senpai.stage), []);
    assert.equal(describeRules(byId.kaicho.stage).length, 3);
    for (const id of ["kakaricho", "buchou", "shachou"]) {
      assert.equal(describeRules(byId[id].stage).length, 1);
    }
  });

  it("word_weights: 難易度 1〜3 の重みが、すべての役職にあり、範囲内(0.1〜10)。先輩は短い語、会長は長い語が出やすい", () => {
    for (const role of roles) {
      const table = role.stage.word_weights;
      assert.deepEqual(Object.keys(table).sort(), ["1", "2", "3"], role.id);
      for (const value of Object.values(table)) assert.ok(value >= 0.1 && value <= 10, role.id);
    }
    const ratio = (id) => byId[id].stage.word_weights["3"] / byId[id].stage.word_weights["1"];
    // 長い語(3)÷ 短い語(1)の出やすさの比が、役職が進むほど、大きい
    const order = ["senpai", "kakaricho", "buchou", "shachou", "kaicho"];
    for (let i = 1; i < order.length; i++)
      assert.ok(ratio(order[i]) > ratio(order[i - 1]), order[i]);
    assert.ok(ratio("senpai") < 1 && ratio("kaicho") > 1);
  });
});

describe("rules.js は、DOM・保存・時計・乱数に触れない", () => {
  it("document・window・storage・Date・performance・Math.random を、使わない", () => {
    const source = read("public/assets/js/games/escape-boss/rules.js");
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|Date|performance|fetch)\b/.test(source),
    );
    assert.ok(!/Math\.random/.test(source));
  });
});

describe("画面・main.js のつなぎ", () => {
  const html = read("public/games/escape-boss/index.html");
  const view = read("public/assets/js/games/escape-boss/view.js");
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("役職の選択の下に、特殊ルールの説明の欄がある(読み上げ対応・最初は隠れている)。用語確認では、役職の選択ごと隠れる", () => {
    const fieldset = html.slice(
      html.indexOf("data-role-fieldset"),
      html.indexOf("data-explanation-option"),
    );
    assert.match(
      fieldset,
      /<div class="game-setup__rules" aria-live="polite" data-role-rules hidden>/,
    );
    assert.ok(
      fieldset.includes("data-role-rules-name") && fieldset.includes("data-role-rules-list"),
    );
  });

  it("view.js: 役職を選ぶたびに、説明を更新する。文字は el()(textContent)だけ。ルールがなければ、その旨", () => {
    assert.match(view, /import \{[^}]*describeRules[^}]*\} from "\.\/rules\.js";/);
    assert.match(
      view,
      /\$\("\[data-role-list\]"\)\.addEventListener\("change", \(\) => \{\s*updateRoleRules\(\);/,
    );
    assert.match(view, /特殊ルールはありません/);
    assert.ok(!/innerHTML/.test(view));
    for (const mark of ["data-role-rules", "data-role-rules-name", "data-role-rules-list"]) {
      assert.ok(view.includes(`[${mark}]`), mark);
    }
  });

  it("main.js: 出題の重みは、苦手な語の重みと、役職の語の重みを、かけ合わせる", () => {
    assert.match(main, /import \{ mergeWeights, roleWordWeights \} from "\.\/word-weights\.js";/);
    assert.match(
      main,
      /mergeWeights\(\s*weakWeights\(store\.load\(\)\.data\.results, vocabulary\.items, \{ level: settings\.weakBoost \}\),\s*roleWordWeights\(vocabulary\.items, stage\),\s*\)/,
    );
  });

  it("エンジンは、rules.js を使う(engine.js が、DOM・時計に触れないまま)", () => {
    const engine = read("public/assets/js/games/escape-boss/engine.js");
    assert.match(engine, /from "\.\/rules\.js";/);
    assert.ok(!/\b(document|window|performance|Date|Math\.random)\b/.test(engine));
  });
});

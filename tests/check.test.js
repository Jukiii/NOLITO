// 用語確認モードの進行・ミスした語・ゲームの設定のテスト(Phase 12 PR 1)。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CHECK_WORD_COUNT,
  checkHit,
  checkMiss,
  checkNext,
  createCheckState,
  missedWords,
  pickCheckWords,
  summarizeCheck,
} from "../public/assets/js/games/escape-boss/check.js";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from "../public/assets/js/games/escape-boss/settings.js";
import { STORAGE_KEY } from "../public/assets/js/games/escape-boss/storage.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const words = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `w-${i + 1}`,
    japanese: `語${i + 1}`,
    roles: ["senpai"],
  }));

// 決まった並びで、シャッフルできるように、疑似乱数を作る
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe("出題", () => {
  it("既定は 10 語を、重複なしで選ぶ。元の配列は、変えない", () => {
    const items = words(16);
    const before = JSON.stringify(items);
    const picked = pickCheckWords(items);
    assert.equal(picked.length, CHECK_WORD_COUNT);
    assert.equal(new Set(picked.map((word) => word.id)).size, CHECK_WORD_COUNT);
    assert.equal(JSON.stringify(items), before);
  });

  it("語が足りないときは、あるだけ(繰り返さない)。空はエラー", () => {
    assert.equal(pickCheckWords(words(4)).length, 4);
    assert.equal(pickCheckWords(words(16), 3).length, 3);
    for (const bad of [[], undefined, null]) assert.throws(() => pickCheckWords(bad), /確認する語/);
  });

  it("役職に関係なく、職種の全語から選ぶ(役職の対象でない語も出る)", () => {
    const items = words(16).map((word, i) => ({ ...word, roles: i < 8 ? ["kaicho"] : ["senpai"] }));
    const ids = new Set();
    for (let seed = 1; seed < 30; seed += 1) {
      for (const word of pickCheckWords(items, 10, seeded(seed))) ids.add(word.roles[0]);
    }
    assert.deepEqual([...ids].sort(), ["kaicho", "senpai"]);
  });

  it("毎回、同じ並びにならない", () => {
    const orders = new Set();
    for (let seed = 1; seed < 20; seed += 1) {
      orders.add(
        pickCheckWords(words(16), 10, seeded(seed))
          .map((word) => word.id)
          .join(),
      );
    }
    assert.ok(orders.size > 10);
  });

  it("実際の語録: 全職種で、10 語を選べる", () => {
    const dir = `${root}public/data/vocabulary/`;
    for (const file of readdirSync(dir)) {
      const { items } = JSON.parse(readFileSync(`${dir}${file}`, "utf8"));
      assert.equal(pickCheckWords(items).length, CHECK_WORD_COUNT, file);
    }
  });
});

describe("進行", () => {
  it("最初の状態", () => {
    assert.deepEqual(createCheckState(10), {
      status: "playing",
      total: 10,
      index: 0,
      hits: 0,
      miss: 0,
      wordMisses: {},
    });
  });

  it("正しい打鍵・ミスを数える。ミスに罰はなく(終了しない)、語ごとに数える", () => {
    let state = createCheckState(3);
    state = checkHit(checkHit(state));
    for (let i = 0; i < 50; i += 1) state = checkMiss(state, "w-1");
    state = checkMiss(state, "w-2");
    assert.equal(state.hits, 2);
    assert.equal(state.miss, 51);
    assert.deepEqual(state.wordMisses, { "w-1": 50, "w-2": 1 });
    assert.equal(state.status, "playing", "何回ミスしても、終わらない");
  });

  it("1 語ずつ進み、最後の語を打ち終えると done になる", () => {
    let state = createCheckState(3);
    state = checkNext(state);
    assert.deepEqual([state.index, state.status], [1, "playing"]);
    state = checkNext(checkNext(state));
    assert.deepEqual([state.index, state.status], [3, "done"]);
  });

  it("終わった後は、何をしても変わらない", () => {
    const done = checkNext(createCheckState(1));
    assert.equal(done.status, "done");
    assert.equal(checkHit(done), done);
    assert.equal(checkMiss(done, "w-1"), done);
    assert.equal(checkNext(done), done);
  });

  it("状態は不変(元の状態を書き換えない)", () => {
    const state = createCheckState(3);
    const before = JSON.stringify(state);
    checkMiss(state, "w-1");
    checkHit(state);
    checkNext(state);
    assert.equal(JSON.stringify(state), before);
  });
});

describe("ミスした語", () => {
  const list = words(5);

  it("ミスの多い順。同じ数なら、出た順。ミスのない語は、入らない", () => {
    const result = missedWords(list, { "w-4": 2, "w-2": 2, "w-5": 5 });
    assert.deepEqual(
      result.map((entry) => [entry.word.id, entry.misses]),
      [
        ["w-5", 5],
        ["w-2", 2],
        ["w-4", 2],
      ],
    );
  });

  it("出題していない語の id・0 や不正な値は、無視する。空でも落ちない", () => {
    assert.deepEqual(missedWords(list, { "other-1": 9, "w-1": 0 }), []);
    assert.deepEqual(missedWords(list, {}), []);
    assert.deepEqual(missedWords(list, undefined), []);
    assert.deepEqual(missedWords([], { "w-1": 1 }), []);
  });

  it("同じ語が 2 回出題されていても、1 件にまとめる(ミスの数は、語ごと)", () => {
    const twice = [...words(2), words(2)[0]];
    const result = missedWords(twice, { "w-1": 3 });
    assert.deepEqual(
      result.map((entry) => [entry.word.id, entry.misses]),
      [["w-1", 3]],
    );
  });

  it("語の情報(日本語・読み・説明)を、そのまま返す", () => {
    const [entry] = missedWords([{ id: "w-1", japanese: "バグ", explanation: "不具合。" }], {
      "w-1": 1,
    });
    assert.deepEqual(entry.word, { id: "w-1", japanese: "バグ", explanation: "不具合。" });
  });
});

describe("用語確認の結果", () => {
  it("語数・打鍵・ミス・正確率・ミスした語", () => {
    let state = createCheckState(2);
    for (let i = 0; i < 8; i += 1) state = checkHit(state);
    state = checkMiss(checkMiss(state, "w-2"), "w-2");
    state = checkNext(checkNext(state));
    const summary = summarizeCheck(state, words(2));
    assert.equal(summary.total, 2);
    assert.equal(summary.hits, 8);
    assert.equal(summary.miss, 2);
    assert.equal(summary.accuracy, 0.8);
    assert.deepEqual(
      summary.missed.map((entry) => [entry.word.id, entry.misses]),
      [["w-2", 2]],
    );
  });

  it("1 回も打っていなければ、正確率は 0(0 で割らない)", () => {
    assert.equal(summarizeCheck(createCheckState(1), words(1)).accuracy, 0);
  });
});

describe("ゲームの設定", () => {
  const fakeBackend = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      map,
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
    };
  };

  it("既定: 説明は、オフ。苦手な語の出やすさは、ふつう", () => {
    assert.deepEqual(DEFAULT_SETTINGS, {
      showExplanation: false,
      simpleGraphics: false,
      weakBoost: "normal",
      inputStyle: "standard",
      soundMode: "off",
      volume: 50,
      lineLevel: "normal",
      skipStaging: false,
    });
    assert.deepEqual(loadSettings(fakeBackend()), {
      showExplanation: false,
      simpleGraphics: false,
      weakBoost: "normal",
      inputStyle: "standard",
      soundMode: "off",
      volume: 50,
      lineLevel: "normal",
      skipStaging: false,
    });
  });

  it("保存して、読める。記録のキーとは、別のキー", () => {
    const backend = fakeBackend();
    assert.equal(saveSettings(backend, { showExplanation: true }), true);
    assert.deepEqual(loadSettings(backend), {
      showExplanation: true,
      simpleGraphics: false,
      weakBoost: "normal",
      inputStyle: "standard",
      soundMode: "off",
      volume: 50,
      lineLevel: "normal",
      skipStaging: false,
    });
    assert.notEqual(SETTINGS_KEY, STORAGE_KEY);
    assert.deepEqual([...backend.map.keys()], [SETTINGS_KEY]);
  });

  it("壊れた値・知らない値・型違いは、既定に戻す(true だけが、オン)", () => {
    for (const raw of [
      "",
      "{",
      "null",
      "[]",
      '"x"',
      "5",
      '{"showExplanation":"true"}',
      '{"showExplanation":1}',
      "{}",
    ]) {
      assert.deepEqual(
        loadSettings(fakeBackend({ [SETTINGS_KEY]: raw })),
        {
          showExplanation: false,
          simpleGraphics: false,
          weakBoost: "normal",
          inputStyle: "standard",
          soundMode: "off",
          volume: 50,
          lineLevel: "normal",
          skipStaging: false,
        },
        raw,
      );
    }
    assert.deepEqual(normalizeSettings({ showExplanation: true, evil: "<script>" }), {
      showExplanation: true,
      simpleGraphics: false,
      weakBoost: "normal",
      inputStyle: "standard",
      soundMode: "off",
      volume: 50,
      lineLevel: "normal",
      skipStaging: false,
    });
  });

  it("保存できない環境(backend なし・読み書きで例外)でも、落ちない", () => {
    assert.deepEqual(loadSettings(null), {
      showExplanation: false,
      simpleGraphics: false,
      weakBoost: "normal",
      inputStyle: "standard",
      soundMode: "off",
      volume: 50,
      lineLevel: "normal",
      skipStaging: false,
    });
    assert.equal(saveSettings(null, { showExplanation: true }), false);
    const throwing = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    assert.deepEqual(loadSettings(throwing), {
      showExplanation: false,
      simpleGraphics: false,
      weakBoost: "normal",
      inputStyle: "standard",
      soundMode: "off",
      volume: 50,
      lineLevel: "normal",
      skipStaging: false,
    });
    assert.equal(saveSettings(throwing, { showExplanation: true }), false);
  });

  it("苦手な語の出やすさ: off・normal・high だけ。ほかは、既定(ふつう)に戻す。説明の設定と、独立", () => {
    for (const level of ["off", "normal", "high"]) {
      const backend = fakeBackend();
      assert.equal(
        saveSettings(backend, {
          showExplanation: true,
          weakBoost: level,
          inputStyle: "standard",
          soundMode: "off",
          volume: 50,
          lineLevel: "normal",
          skipStaging: false,
        }),
        true,
      );
      assert.deepEqual(loadSettings(backend), {
        showExplanation: true,
        simpleGraphics: false,
        weakBoost: level,
        inputStyle: "standard",
        soundMode: "off",
        volume: 50,
        lineLevel: "normal",
        skipStaging: false,
      });
    }
    for (const bad of ["", "OFF", "low", "__proto__", "constructor", 1, null, true, [], {}]) {
      assert.equal(normalizeSettings({ weakBoost: bad }).weakBoost, "normal", String(bad));
    }
    // 以前に保存された設定(weakBoost がない)は、説明の設定を保ったまま、既定を補う
    assert.deepEqual(loadSettings(fakeBackend({ [SETTINGS_KEY]: '{"showExplanation":true}' })), {
      showExplanation: true,
      simpleGraphics: false,
      weakBoost: "normal",
      inputStyle: "standard",
      soundMode: "off",
      volume: 50,
      lineLevel: "normal",
      skipStaging: false,
    });
  });

  it("ローマ字の書き方: standard・kunrei・strict だけ。ほかは、既定(標準)に戻す。ほかの設定と、独立", () => {
    for (const name of ["standard", "kunrei", "strict"]) {
      const backend = fakeBackend();
      assert.equal(
        saveSettings(backend, { showExplanation: true, weakBoost: "high", inputStyle: name }),
        true,
      );
      assert.deepEqual(loadSettings(backend), {
        showExplanation: true,
        simpleGraphics: false,
        weakBoost: "high",
        inputStyle: name,
        soundMode: "off",
        volume: 50,
        lineLevel: "normal",
        skipStaging: false,
      });
    }
    for (const bad of [
      "",
      "STRICT",
      "hepburn",
      "__proto__",
      "constructor",
      1,
      null,
      true,
      [],
      {},
    ]) {
      assert.equal(normalizeSettings({ inputStyle: bad }).inputStyle, "standard", String(bad));
    }
    // 以前に保存された設定(inputStyle がない)は、ほかの設定を保ったまま、既定を補う
    assert.deepEqual(
      loadSettings(fakeBackend({ [SETTINGS_KEY]: '{"showExplanation":true,"weakBoost":"off"}' })),
      {
        showExplanation: true,
        simpleGraphics: false,
        weakBoost: "off",
        inputStyle: "standard",
        soundMode: "off",
        volume: 50,
        lineLevel: "normal",
        skipStaging: false,
      },
    );
  });

  it("記録(nolito:escape-boss:v1)には、触れない", () => {
    const backend = fakeBackend({ [STORAGE_KEY]: '{"version":2}' });
    saveSettings(backend, { showExplanation: true });
    assert.equal(backend.getItem(STORAGE_KEY), '{"version":2}');
  });
});

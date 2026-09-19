import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyData,
  createStore,
  DEFAULT_NICKNAME,
  MAX_RANKING,
  MAX_RESULTS,
  normalizeData,
  sanitizeNickname,
  STORAGE_KEY,
} from "../public/assets/js/games/escape-boss/storage.js";

// localStorage の代わり。失敗のさせ方を指定できる。
function fakeBackend({ failGet = false, failSet = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem(key) {
      if (failGet) throw new Error("denied");
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (failSet) throw new Error("quota");
      map.set(key, String(value));
    },
  };
}

const result = (overrides = {}) => ({
  playedAt: 1000,
  jobId: "engineer",
  roleId: "senpai",
  status: "cleared",
  score: 1800,
  correct: 8,
  miss: 1,
  hits: 60,
  elapsed: 30,
  distance: 70,
  accuracy: 0.98,
  cps: 2,
  vocabularyVersion: "0.1.0",
  ...overrides,
});

describe("ニックネーム", () => {
  it("制御文字を除き、前後の空白を除き、12文字までにする", () => {
    assert.equal(sanitizeNickname("  たろう  "), "たろう");
    assert.equal(sanitizeNickname("a\nb\u0000c\u007f"), "abc");
    assert.equal(sanitizeNickname("あ".repeat(30)), "あ".repeat(12));
    assert.equal(Array.from(sanitizeNickname("😀".repeat(20))).length, 12);
  });

  it("空・空白だけ・文字列でない場合は既定名", () => {
    for (const value of ["", "   ", "\n\t", null, undefined]) {
      assert.equal(sanitizeNickname(value), DEFAULT_NICKNAME);
    }
  });

  it("HTML はそのまま文字として残る(表示側で textContent を使う)", () => {
    assert.equal(sanitizeNickname("<b>x</b>"), "<b>x</b>");
  });
});

describe("保存データの読み込み", () => {
  it("何も保存されていなければ空の状態", () => {
    const store = createStore(fakeBackend());
    const { data, status } = store.load();
    assert.equal(status, "empty");
    assert.deepEqual(data, createEmptyData());
  });

  it("保存して読み込める", () => {
    const backend = fakeBackend();
    const store = createStore(backend);
    const data = createEmptyData();
    data.profile.nickname = "たろう";
    data.results = [result()];
    assert.equal(store.save(data), true);
    const loaded = createStore(backend).load();
    assert.equal(loaded.status, "ok");
    assert.deepEqual(loaded.data, data);
  });

  it("壊れた JSON は空の状態で始め、元の文字列を退避する", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, "{not json");
    const { data, status } = createStore(backend).load();
    assert.equal(status, "corrupt");
    assert.deepEqual(data, createEmptyData());
    assert.equal(backend.map.get(`${STORAGE_KEY}:corrupt`), "{not json");
  });

  it("バージョンが違う・形式が違うデータは壊れたものとして扱う", () => {
    for (const raw of [{ version: 999 }, null, [], "x", 5]) {
      assert.equal(normalizeData(raw), null);
    }
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify({ version: 2, profile: {} }));
    assert.equal(createStore(backend).load().status, "corrupt");
  });

  it("一部の項目だけがおかしい場合は、その項目だけを捨てる", () => {
    const raw = {
      version: 1,
      profile: { nickname: "x".repeat(50), titleId: 5 },
      results: [result(), { bad: true }, result({ score: "多い" }), result({ status: "?" })],
      rankings: {
        senpai: [
          { score: 100, playedAt: 1, jobId: "a", roleId: "senpai", nickname: "\n", title: 3 },
          { score: NaN, playedAt: 1, jobId: "a", roleId: "senpai" },
          "garbage",
        ],
        kakaricho: "not a list",
      },
      achievements: { good: 5, bad: "yesterday", worse: NaN },
      progress: {
        totalClears: -3,
        totalWords: "many",
        clears: { senpai: 2.7, x: -1 },
        clearedJobs: { engineer: true, y: "yes" },
      },
    };
    const data = normalizeData(raw);
    assert.equal(data.profile.nickname.length, 12);
    assert.equal(data.profile.titleId, "newbie");
    assert.equal(data.results.length, 1);
    assert.equal(data.rankings.senpai.length, 1);
    assert.equal(data.rankings.senpai[0].nickname, DEFAULT_NICKNAME);
    assert.equal(data.rankings.senpai[0].title, "");
    assert.equal(data.rankings.kakaricho, undefined);
    assert.deepEqual(data.achievements, { good: 5 });
    assert.equal(data.progress.totalClears, 0);
    assert.equal(data.progress.totalWords, 0);
    assert.deepEqual(data.progress.clears, { senpai: 2, x: 0 });
    assert.deepEqual(data.progress.clearedJobs, { engineer: true, y: false });
  });

  it("件数の上限を超えた分は捨てる", () => {
    const raw = {
      ...createEmptyData(),
      results: Array.from({ length: MAX_RESULTS + 50 }, (_, i) => result({ playedAt: i })),
      rankings: {
        senpai: Array.from({ length: 30 }, (_, i) => ({
          score: i,
          playedAt: i,
          jobId: "a",
          roleId: "senpai",
          nickname: "n",
          title: "",
        })),
      },
    };
    const data = normalizeData(raw);
    assert.equal(data.results.length, MAX_RESULTS);
    assert.equal(data.rankings.senpai.length, MAX_RANKING);
    assert.equal(data.rankings.senpai[0].score, 29);
  });
});

describe("保存できない環境", () => {
  it("LocalStorage が使えなくても、ページを開いている間は記録を保持する", () => {
    const store = createStore(null);
    assert.equal(store.load().status, "unavailable");
    const data = createEmptyData();
    data.profile.nickname = "たろう";
    assert.equal(store.save(data), false);
    assert.equal(store.load().data.profile.nickname, "たろう");
    assert.equal(store.status, "unavailable");
  });

  it("書き込みに失敗しても(容量超過など)落ちず、メモリには残る", () => {
    const store = createStore(fakeBackend({ failSet: true }));
    const data = createEmptyData();
    data.profile.nickname = "たろう";
    assert.equal(store.save(data), false);
    assert.equal(store.load().data.profile.nickname, "たろう");
  });

  it("読み込みに失敗しても(アクセス拒否など)落ちない", () => {
    const store = createStore(fakeBackend({ failGet: true }));
    const { data, status } = store.load();
    assert.equal(status, "unavailable");
    assert.deepEqual(data, createEmptyData());
  });
});

describe("update", () => {
  it("毎回読み直してから書き込む(他のタブの記録を上書きしにくい)", () => {
    const backend = fakeBackend();
    const tabA = createStore(backend);
    const tabB = createStore(backend);
    tabA.update((data) => ({ data: { ...data, results: [result({ playedAt: 1 })] } }));
    tabB.update((data) => ({
      data: { ...data, results: [result({ playedAt: 2 }), ...data.results] },
    }));
    const { data } = createStore(backend).load();
    assert.deepEqual(
      data.results.map((r) => r.playedAt),
      [2, 1],
    );
  });

  it("関数の戻り値のうち data 以外を、保存結果と一緒に返す", () => {
    const store = createStore(fakeBackend());
    const out = store.update((data) => ({ data, rank: 3 }));
    assert.equal(out.rank, 3);
    assert.equal(out.saved, true);
    assert.equal(createStore(null).update((data) => ({ data })).saved, false);
  });
});

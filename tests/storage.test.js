import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyData,
  createStore,
  DATA_VERSION,
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
  keys: {},
  confusions: {},
  wordMisses: {},
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
    backend.map.set(STORAGE_KEY, JSON.stringify({ version: 3, profile: {} }));
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

// Phase 3 が保存していた形式(バージョン 1)。キーごとの集計を持たない。
const v1Data = () => ({
  version: 1,
  profile: { nickname: "たろう", titleId: "clear-senpai" },
  results: [
    {
      playedAt: 2000,
      jobId: "sales",
      roleId: "kakaricho",
      status: "gameover",
      score: 700,
      correct: 3,
      miss: 9,
      hits: 40,
      elapsed: 21.5,
      distance: 0,
      accuracy: 0.81,
      cps: 1.9,
      vocabularyVersion: "0.1.0",
    },
    {
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
    },
  ],
  rankings: {
    senpai: [
      {
        score: 1800,
        playedAt: 1000,
        jobId: "engineer",
        roleId: "senpai",
        nickname: "たろう",
        title: "先輩超え",
      },
    ],
  },
  achievements: { "clear-senpai": 1000, perfect: 1000 },
  progress: {
    totalClears: 1,
    totalWords: 11,
    clears: { senpai: 1 },
    clearedJobs: { engineer: true },
  },
});

describe("バージョン 1 からの移行", () => {
  it("記録・ランキング・実績・プロフィール・進行状況がそのまま引き継がれる", () => {
    const backend = fakeBackend();
    const v1 = v1Data();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1));
    const { data, status } = createStore(backend).load();
    assert.equal(status, "ok");
    assert.equal(data.version, DATA_VERSION);
    assert.deepEqual(data.profile, v1.profile);
    assert.deepEqual(data.rankings, v1.rankings);
    assert.deepEqual(data.achievements, v1.achievements);
    assert.deepEqual(data.progress, v1.progress);
    assert.equal(data.results.length, 2);
    assert.deepEqual(
      data.results.map((r) => [r.playedAt, r.score, r.accuracy, r.cps]),
      [
        [2000, 700, 0.81, 1.9],
        [1000, 1800, 0.98, 2],
      ],
    );
  });

  it("移行した結果には、キーごとの集計が空で加わる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1Data()));
    const { data } = createStore(backend).load();
    for (const result of data.results) {
      assert.deepEqual(result.keys, {});
      assert.deepEqual(result.confusions, {});
      assert.deepEqual(result.wordMisses, {});
    }
  });

  it("移行前の元データを、一度だけ別のキーに退避する", () => {
    const backend = fakeBackend();
    const original = JSON.stringify(v1Data());
    backend.map.set(STORAGE_KEY, original);
    const store = createStore(backend);
    store.load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v1`), original);

    // 保存(バージョン 2 になる)した後に読み込んでも、退避は上書きされない
    store.update((data) => ({
      data: { ...data, profile: { ...data.profile, nickname: "変更後" } },
    }));
    assert.equal(JSON.parse(backend.map.get(STORAGE_KEY)).version, DATA_VERSION);
    createStore(backend).load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v1`), original);
  });

  it("保存するとバージョン 2 になり、その後は退避を作らない", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1Data()));
    const store = createStore(backend);
    store.update((data) => ({ data }));
    backend.map.delete(`${STORAGE_KEY}:backup-v1`);
    const loaded = createStore(backend).load();
    assert.equal(loaded.status, "ok");
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v1`), false);
    assert.equal(loaded.data.results.length, 2);
  });

  it("移行の後に新しいプレイを記録しても、以前の記録が残る", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1Data()));
    const store = createStore(backend);
    store.update((data) => ({
      data: {
        ...data,
        results: [result({ playedAt: 3000, keys: { a: { hits: 5, misses: 1 } } }), ...data.results],
      },
    }));
    const { data } = createStore(backend).load();
    assert.equal(data.results.length, 3);
    assert.deepEqual(data.results[0].keys, { a: { hits: 5, misses: 1 } });
    assert.equal(data.results[2].playedAt, 1000);
    assert.equal(data.rankings.senpai.length, 1);
  });

  it("退避に失敗しても、移行は続けられる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1Data()));
    const failing = {
      getItem: (key) => backend.getItem(key),
      setItem: () => {
        throw new Error("quota");
      },
    };
    const { data, status } = createStore(failing).load();
    assert.equal(status, "ok");
    assert.equal(data.results.length, 2);
  });
});

describe("キーごとの集計の検証(バージョン 2)", () => {
  const load = (raw) => normalizeData({ ...createEmptyData(), results: [result(raw)] }).results[0];

  it("正しい集計は、そのまま読み込める", () => {
    const loaded = load({
      keys: { a: { hits: 5, misses: 2 }, "-": { hits: 1, misses: 0 } },
      confusions: { "i>o": 3 },
      wordMisses: { "engineer-001": 2, "food-service-004": 1 },
    });
    assert.deepEqual(loaded.keys, { a: { hits: 5, misses: 2 }, "-": { hits: 1, misses: 0 } });
    assert.deepEqual(loaded.confusions, { "i>o": 3 });
    assert.deepEqual(loaded.wordMisses, { "engineer-001": 2, "food-service-004": 1 });
  });

  it("キー名が a-z・0-9・- の1文字でないものは捨てる(HTML・大文字・2文字など)", () => {
    const loaded = load({
      keys: {
        a: { hits: 1, misses: 0 },
        A: { hits: 1, misses: 0 },
        ab: { hits: 1, misses: 0 },
        "<b>": { hits: 1, misses: 0 },
        __proto__: { hits: 9, misses: 9 },
        "!": { hits: 1, misses: 0 },
      },
    });
    assert.deepEqual(Object.keys(loaded.keys), ["a"]);
  });

  it("打ち間違いの組・語の id も、形式に合わないものは捨てる", () => {
    const loaded = load({
      confusions: { "a>b": 1, "a>": 2, ">b": 3, "A>b": 4, "a>bc": 5, "<x>": 6 },
      wordMisses: { "engineer-001": 1, "<script>": 2, "": 3, "UPPER-1": 4, "a b": 5 },
    });
    assert.deepEqual(loaded.confusions, { "a>b": 1 });
    assert.deepEqual(loaded.wordMisses, { "engineer-001": 1 });
  });

  it("回数は 0 以上の整数に整え、0 や不正な値は捨てる", () => {
    const loaded = load({
      keys: { a: { hits: -5, misses: 2.9 }, b: { hits: "x", misses: NaN }, c: "bad", d: null },
      confusions: { "a>b": 0, "a>c": -1, "a>d": "3", "a>e": 2.7 },
    });
    assert.deepEqual(loaded.keys, {
      a: { hits: 0, misses: 2 },
      b: { hits: 0, misses: 0 },
    });
    assert.deepEqual(loaded.confusions, { "a>e": 2 });
  });

  it("配列や文字列など、形式が違うものは空として扱う", () => {
    for (const bad of [[], "x", 5, null, true]) {
      const loaded = load({ keys: bad, confusions: bad, wordMisses: bad });
      assert.deepEqual([loaded.keys, loaded.confusions, loaded.wordMisses], [{}, {}, {}]);
    }
  });

  it("件数の上限を超える分は捨てる(回数の多いものを残す)", () => {
    const confusions = {};
    const letters = "abcdefghijklmnopqrstuvwxyz";
    for (const from of letters) for (const to of letters) confusions[`${from}>${to}`] = 1;
    confusions["z>y"] = 50;
    const keys = {};
    for (const ch of `${letters}0123456789-`) keys[ch] = { hits: 1, misses: 0 };
    const wordMisses = {};
    for (let i = 0; i < 100; i++) wordMisses[`w-${i}`] = i + 1;

    const loaded = load({ confusions, keys, wordMisses });
    assert.equal(Object.keys(loaded.confusions).length, 100);
    assert.equal(loaded.confusions["z>y"], 50);
    assert.equal(Object.keys(loaded.keys).length, 37); // a-z(26)・0-9(10)・-(1)
    assert.equal(Object.keys(loaded.wordMisses).length, 60);
    assert.ok(loaded.wordMisses["w-99"] === 100 && !("w-0" in loaded.wordMisses));
  });

  it("保存して読み込んでも、集計が変わらない", () => {
    const backend = fakeBackend();
    const store = createStore(backend);
    const data = createEmptyData();
    data.results = [
      result({
        keys: { s: { hits: 4, misses: 1 } },
        confusions: { "s>d": 1 },
        wordMisses: { "sales-001": 1 },
      }),
    ];
    store.save(data);
    assert.deepEqual(createStore(backend).load().data, data);
  });
});

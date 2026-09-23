import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestKey,
  clearKey,
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
  streak: 5,
  wordsByDifficulty: { 1: 2, 2: 3, 3: 3 },
  difficulty: "normal",
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
    backend.map.set(STORAGE_KEY, JSON.stringify({ version: 999, profile: {} }));
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
    assert.equal(data.rankings[clearKey("senpai", "normal")].length, 1);
    assert.equal(data.rankings[clearKey("senpai", "normal")][0].nickname, DEFAULT_NICKNAME);
    assert.equal(data.rankings[clearKey("senpai", "normal")][0].title, "");
    assert.equal(data.rankings[clearKey("kakaricho", "normal")], undefined);
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
        [clearKey("senpai", "normal")]: Array.from({ length: 30 }, (_, i) => ({
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
    assert.equal(data.rankings[clearKey("senpai", "normal")].length, MAX_RANKING);
    assert.equal(data.rankings[clearKey("senpai", "normal")][0].score, 29);
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
  it("記録・ランキング・実績・プロフィールがそのまま引き継がれる。版は、いまの版になる", () => {
    const backend = fakeBackend();
    const v1 = v1Data();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1));
    const { data, status } = createStore(backend).load();
    assert.equal(status, "ok");
    assert.equal(data.version, DATA_VERSION);
    assert.deepEqual(data.profile, v1.profile);
    assert.deepEqual(data.rankings, { [clearKey("senpai", "normal")]: v1.rankings.senpai });
    assert.deepEqual(data.achievements, v1.achievements);
    assert.equal(data.progress.totalClears, v1.progress.totalClears);
    assert.equal(data.progress.totalWords, v1.progress.totalWords);
    assert.deepEqual(data.progress.clears, v1.progress.clears);
    assert.deepEqual(data.progress.clearedJobs, v1.progress.clearedJobs);
    assert.equal(data.results.length, 2);
    assert.deepEqual(
      data.results.map((r) => [r.playedAt, r.score, r.accuracy, r.cps]),
      [
        [2000, 700, 0.81, 1.9],
        [1000, 1800, 0.98, 2],
      ],
    );
  });

  it("移行した結果には、キーごとの集計が空・難易度は「ふつう」で加わる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1Data()));
    const { data } = createStore(backend).load();
    for (const result of data.results) {
      assert.deepEqual(result.keys, {});
      assert.deepEqual(result.confusions, {});
      assert.deepEqual(result.wordMisses, {});
      assert.equal(result.difficulty, "normal");
    }
  });

  it("移行前の元データを、一度だけ別のキーに退避する", () => {
    const backend = fakeBackend();
    const original = JSON.stringify(v1Data());
    backend.map.set(STORAGE_KEY, original);
    const store = createStore(backend);
    store.load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v1`), original);

    // 保存(いまの版になる)した後に読み込んでも、退避は上書きされない
    store.update((data) => ({
      data: { ...data, profile: { ...data.profile, nickname: "変更後" } },
    }));
    assert.equal(JSON.parse(backend.map.get(STORAGE_KEY)).version, DATA_VERSION);
    createStore(backend).load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v1`), original);
  });

  it("保存すると、いまの版になり、その後は退避を作らない", () => {
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
    assert.equal(data.rankings[clearKey("senpai", "normal")].length, 1);
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

  it("経験値・職種ごとの合計・難易度ごとのクリア数・自己ベストが、これまでの記録から作られる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1Data()));
    const { data } = createStore(backend).load();
    // exp = 正解語数(11)*10 + クリア数(1)*100 + 実績(2)*50 = 110 + 100 + 100 = 310
    assert.equal(data.progress.exp, 310);
    assert.deepEqual(data.progress.jobs.engineer, {
      plays: 1,
      clears: 1,
      words: 8,
      hits: 60,
      miss: 1,
    });
    assert.deepEqual(data.progress.jobs.sales, {
      plays: 1,
      clears: 0,
      words: 3,
      hits: 40,
      miss: 9,
    });
    assert.deepEqual(data.progress.difficultyClears, { [clearKey("senpai", "normal")]: 1 });
    assert.deepEqual(data.progress.bests[bestKey("engineer", "senpai", "normal")], {
      score: 1800,
      playedAt: 1000,
    });
    assert.equal(data.progress.bests[bestKey("sales", "kakaricho", "normal")], undefined);
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

// ---- バージョン 3(Phase 13 PR 3): 連続ノーミス・難易度ごとの語数 ----
const v2Data = () => ({
  version: 2,
  profile: { nickname: "はなこ", titleId: "newbie" },
  results: [
    {
      playedAt: 3000,
      jobId: "sales",
      roleId: "kakaricho",
      status: "cleared",
      score: 2400,
      correct: 14,
      miss: 3,
      hits: 150,
      elapsed: 61,
      distance: 12.5,
      accuracy: 0.98,
      cps: 2.4,
      vocabularyVersion: "0.3.0",
      keys: { s: { hits: 4, misses: 1 } },
      confusions: { "s>d": 1 },
      wordMisses: { "sales-001": 2 },
    },
    {
      playedAt: 2000,
      jobId: "engineer",
      roleId: "senpai",
      status: "gameover",
      score: 300,
      correct: 4,
      miss: 9,
      hits: 40,
      elapsed: 20,
      distance: 0,
      accuracy: 0.8,
      cps: 2,
      vocabularyVersion: "0.3.0",
      keys: {},
      confusions: {},
      wordMisses: {},
    },
  ],
  rankings: {
    kakaricho: [
      {
        score: 2400,
        playedAt: 3000,
        jobId: "sales",
        roleId: "kakaricho",
        nickname: "はなこ",
        title: "",
      },
    ],
  },
  achievements: { "first-clear": 3000 },
  progress: {
    totalClears: 1,
    totalWords: 18,
    clears: { kakaricho: 1 },
    clearedJobs: { sales: true },
  },
});

const normalizedResult = (overrides) =>
  normalizeData({ ...createEmptyData(), results: [result(overrides)] }).results[0];

describe("バージョン 3 の項目(連続ノーミス・難易度ごとの語数)", () => {
  it("いまの版は 5。空のデータも、5", () => {
    assert.equal(DATA_VERSION, 5);
    assert.equal(createEmptyData().version, 5);
  });

  it("連続ノーミスと難易度ごとの語数が、保存して読み込んでも、変わらない", () => {
    const backend = fakeBackend();
    const data = createEmptyData();
    data.results = [
      result({ streak: 7, wordsByDifficulty: { 1: 4, 3: 10 }, correct: 14 }),
      result({ streak: 0, wordsByDifficulty: {}, correct: 0, playedAt: 900 }),
    ];
    createStore(backend).save(data);
    assert.deepEqual(createStore(backend).load().data, data);
  });

  it("連続は、0 以上の整数だけ。正解した語数を超えない。不正な値は、null(記録なし)", () => {
    const streak = (value, correct = 8) => normalizedResult({ streak: value, correct }).streak;
    assert.equal(streak(0), 0);
    assert.equal(streak(5), 5);
    assert.equal(streak(5.9), 5);
    assert.equal(streak(99), 8);
    assert.equal(streak(3, 3), 3);
    for (const bad of [-1, NaN, Infinity, "5", null, undefined, {}, [], true]) {
      assert.equal(streak(bad), null, String(bad));
    }
  });

  it("難易度ごとの語数: 1〜5 のキーの、正の整数だけを残す。ほかは、捨てる", () => {
    const counts = (value) => normalizedResult({ wordsByDifficulty: value }).wordsByDifficulty;
    assert.deepEqual(counts({ 1: 2, 2: 3, 3: 4, 4: 1, 5: 1 }), { 1: 2, 2: 3, 3: 4, 4: 1, 5: 1 });
    assert.deepEqual(counts({ 0: 5, 6: 5, x: 5, "1 ": 5, "": 5, "01": 5 }), {});
    assert.deepEqual(counts(JSON.parse('{"__proto__": 5, "constructor": 5}')), {});
    assert.deepEqual(counts({ 1: 0, 2: -3, 3: NaN, 4: "x", 5: null }), {});
    assert.deepEqual(counts({ 1: 2.9, 2: "3" }), { 1: 2 });
    assert.deepEqual(counts({ 1: 1e9 }), { 1: 1000 });
    assert.deepEqual(counts({}), {});
  });

  it("難易度ごとの語数が、オブジェクトでなければ、null(記録なし)", () => {
    const counts = (value) => normalizedResult({ wordsByDifficulty: value }).wordsByDifficulty;
    for (const bad of [undefined, null, "1", 5, [], [1, 2], true]) {
      assert.equal(counts(bad), null, String(bad));
    }
  });

  it("いまの版より新しいものは、読まず、元の文字列を :corrupt に退避する(上書きしない)", () => {
    const backend = fakeBackend();
    const future = JSON.stringify({ version: DATA_VERSION + 1, results: [] });
    backend.map.set(STORAGE_KEY, future);
    const loaded = createStore(backend).load();
    assert.equal(loaded.status, "corrupt");
    assert.equal(backend.map.get(`${STORAGE_KEY}:corrupt`), future);
  });
});

describe("バージョン 2 からの移行", () => {
  it("記録・ランキング・実績・プロフィール・キーごとの集計が、そのまま引き継がれる", () => {
    const backend = fakeBackend();
    const v2 = v2Data();
    backend.map.set(STORAGE_KEY, JSON.stringify(v2));
    const { data, status } = createStore(backend).load();
    assert.equal(status, "ok");
    assert.equal(data.version, DATA_VERSION);
    assert.deepEqual(data.profile, v2.profile);
    assert.deepEqual(data.rankings, { [clearKey("kakaricho", "normal")]: v2.rankings.kakaricho });
    assert.deepEqual(data.achievements, v2.achievements);
    assert.equal(data.progress.totalClears, v2.progress.totalClears);
    assert.equal(data.progress.totalWords, v2.progress.totalWords);
    assert.equal(data.results.length, 2);
    for (const [index, original] of v2.results.entries()) {
      const migrated = data.results[index];
      for (const key of Object.keys(original)) assert.deepEqual(migrated[key], original[key], key);
      assert.equal(migrated.difficulty, "normal");
    }
  });

  it("移行した結果の、連続・難易度ごとの語数は、null(記録なし)。0 や空ではない", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v2Data()));
    const { data } = createStore(backend).load();
    for (const item of data.results) {
      assert.equal(item.streak, null);
      assert.equal(item.wordsByDifficulty, null);
    }
  });

  it("移行前の元データを、一度だけ別のキー(:backup-v2)に退避する。上書きしない", () => {
    const backend = fakeBackend();
    const original = JSON.stringify(v2Data());
    backend.map.set(STORAGE_KEY, original);
    const store = createStore(backend);
    store.load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v2`), original);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v1`), false);

    // 保存(いまの版になる)した後に読み込んでも、退避は上書きされない
    store.update((data) => ({
      data: { ...data, profile: { ...data.profile, nickname: "変更後" } },
    }));
    assert.equal(JSON.parse(backend.map.get(STORAGE_KEY)).version, DATA_VERSION);
    createStore(backend).load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v2`), original);
  });

  it("読み込んだだけでは、保存されているデータを書き換えない", () => {
    const backend = fakeBackend();
    const original = JSON.stringify(v2Data());
    backend.map.set(STORAGE_KEY, original);
    createStore(backend).load();
    assert.equal(backend.map.get(STORAGE_KEY), original);
  });

  it("移行の後に新しいプレイを記録しても、以前の記録が残る(新しい記録だけが、連続・難易度を持つ)", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v2Data()));
    const store = createStore(backend);
    store.update((data) => ({
      data: { ...data, results: [result({ playedAt: 9000 }), ...data.results] },
    }));
    const loaded = createStore(backend).load().data;
    assert.equal(loaded.version, DATA_VERSION);
    assert.deepEqual(
      loaded.results.map((item) => [item.playedAt, item.streak === null]),
      [
        [9000, false],
        [3000, true],
        [2000, true],
      ],
    );
  });

  it("退避に失敗しても、移行は続けられる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v2Data()));
    const failing = {
      getItem: (key) => backend.getItem(key),
      setItem(key) {
        if (key.endsWith("backup-v2")) throw new Error("quota");
      },
    };
    const { data, status } = createStore(failing).load();
    assert.equal(status, "ok");
    assert.equal(data.results.length, 2);
  });
});

describe("バージョン 1 から、いきなり、いまの版", () => {
  it("バージョン 1 の結果も、連続・難易度ごとの語数は null。退避は backup-v1 だけ", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v1Data()));
    const { data } = createStore(backend).load();
    assert.equal(data.version, DATA_VERSION);
    for (const item of data.results) {
      assert.equal(item.streak, null);
      assert.equal(item.wordsByDifficulty, null);
    }
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v1`), true);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v2`), false);
  });
});

// ---- バージョン 4(Phase 18): 難易度・経験値・職種ごとの合計・難易度ごとのクリア数・自己ベスト ----
const v3Data = () => ({
  version: 3,
  profile: { nickname: "じろう", titleId: "clear-senpai" },
  results: [
    {
      playedAt: 5000,
      jobId: "office",
      roleId: "buchou",
      status: "cleared",
      score: 3200,
      correct: 15,
      miss: 2,
      hits: 180,
      elapsed: 68,
      distance: 20,
      accuracy: 0.99,
      cps: 2.8,
      vocabularyVersion: "0.4.0",
      keys: {},
      confusions: {},
      wordMisses: {},
      streak: 10,
      wordsByDifficulty: { 1: 5, 2: 6, 3: 4 },
    },
    {
      playedAt: 4000,
      jobId: "engineer",
      roleId: "senpai",
      status: "cleared",
      score: 1800,
      correct: 14,
      miss: 0,
      hits: 90,
      elapsed: 55,
      distance: 40,
      accuracy: 1,
      cps: 2.1,
      vocabularyVersion: "0.4.0",
      keys: {},
      confusions: {},
      wordMisses: {},
      streak: 14,
      wordsByDifficulty: { 1: 8, 2: 6 },
    },
  ],
  rankings: {
    buchou: [
      {
        score: 3200,
        playedAt: 5000,
        jobId: "office",
        roleId: "buchou",
        nickname: "じろう",
        title: "",
      },
    ],
  },
  achievements: { "clear-senpai": 4000, "clear-buchou": 5000 },
  progress: {
    totalClears: 2,
    totalWords: 29,
    clears: { senpai: 1, buchou: 1 },
    clearedJobs: { engineer: true, office: true },
  },
});

describe("バージョン 3 からの移行", () => {
  it("記録・ランキング・実績・プロフィール・進行状況が、そのまま引き継がれる。難易度は「ふつう」", () => {
    const backend = fakeBackend();
    const v3 = v3Data();
    backend.map.set(STORAGE_KEY, JSON.stringify(v3));
    const { data, status } = createStore(backend).load();
    assert.equal(status, "ok");
    assert.equal(data.version, DATA_VERSION);
    assert.deepEqual(data.profile, v3.profile);
    assert.deepEqual(data.rankings, { [clearKey("buchou", "normal")]: v3.rankings.buchou });
    assert.deepEqual(data.achievements, v3.achievements);
    assert.equal(data.progress.totalClears, v3.progress.totalClears);
    assert.equal(data.progress.totalWords, v3.progress.totalWords);
    assert.deepEqual(data.progress.clears, v3.progress.clears);
    assert.deepEqual(data.progress.clearedJobs, v3.progress.clearedJobs);
    assert.equal(data.results.length, 2);
    for (const [index, original] of v3.results.entries()) {
      const migrated = data.results[index];
      for (const key of Object.keys(original)) assert.deepEqual(migrated[key], original[key], key);
      assert.equal(migrated.difficulty, "normal");
    }
  });

  it("経験値・職種ごとの合計・難易度ごとのクリア数・自己ベストが、これまでの記録から作られる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v3Data()));
    const { data } = createStore(backend).load();
    // exp = 正解語数(29)*10 + クリア数(2)*100 + 実績(2)*50 = 290 + 200 + 100 = 590
    assert.equal(data.progress.exp, 590);
    assert.deepEqual(data.progress.jobs.office, {
      plays: 1,
      clears: 1,
      words: 15,
      hits: 180,
      miss: 2,
    });
    assert.deepEqual(data.progress.jobs.engineer, {
      plays: 1,
      clears: 1,
      words: 14,
      hits: 90,
      miss: 0,
    });
    assert.deepEqual(data.progress.difficultyClears, {
      [clearKey("senpai", "normal")]: 1,
      [clearKey("buchou", "normal")]: 1,
    });
    assert.deepEqual(data.progress.bests[bestKey("office", "buchou", "normal")], {
      score: 3200,
      playedAt: 5000,
    });
    assert.deepEqual(data.progress.bests[bestKey("engineer", "senpai", "normal")], {
      score: 1800,
      playedAt: 4000,
    });
  });

  it("移行前の元データを、一度だけ別のキー(:backup-v3)に退避する。上書きしない", () => {
    const backend = fakeBackend();
    const original = JSON.stringify(v3Data());
    backend.map.set(STORAGE_KEY, original);
    const store = createStore(backend);
    store.load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v3`), original);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v2`), false);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v1`), false);

    store.update((data) => ({
      data: { ...data, profile: { ...data.profile, nickname: "変更後" } },
    }));
    assert.equal(JSON.parse(backend.map.get(STORAGE_KEY)).version, DATA_VERSION);
    createStore(backend).load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v3`), original);
  });

  it("読み込んだだけでは、保存されているデータを書き換えない", () => {
    const backend = fakeBackend();
    const original = JSON.stringify(v3Data());
    backend.map.set(STORAGE_KEY, original);
    createStore(backend).load();
    assert.equal(backend.map.get(STORAGE_KEY), original);
  });

  it("いまの版のデータは、退避を作らない", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify({ ...createEmptyData(), results: [result()] }));
    createStore(backend).load();
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v3`), false);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v2`), false);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v1`), false);
  });

  it("移行の後に新しいプレイを記録しても、以前の記録が残る", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v3Data()));
    const store = createStore(backend);
    store.update((data) => ({
      data: { ...data, results: [result({ playedAt: 9000 }), ...data.results] },
    }));
    const loaded = createStore(backend).load().data;
    assert.equal(loaded.version, DATA_VERSION);
    assert.equal(loaded.results.length, 3);
    assert.equal(loaded.results[2].playedAt, 4000);
  });

  it("退避に失敗しても、移行は続けられる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v3Data()));
    const failing = {
      getItem: (key) => backend.getItem(key),
      setItem(key) {
        if (key.endsWith("backup-v3")) throw new Error("quota");
      },
    };
    const { data, status } = createStore(failing).load();
    assert.equal(status, "ok");
    assert.equal(data.results.length, 2);
  });
});

// ---- バージョン 5(Phase 18 PR 2): ランキングの鍵を、役職 ID だけから「役職:難易度」に変える ----
const v4Data = () => ({
  version: 4,
  profile: { nickname: "ごろう", titleId: "clear-buchou" },
  results: [
    {
      playedAt: 6000,
      jobId: "office",
      roleId: "shachou",
      status: "cleared",
      score: 4000,
      correct: 18,
      miss: 1,
      hits: 200,
      elapsed: 70,
      distance: 30,
      accuracy: 0.99,
      cps: 2.9,
      vocabularyVersion: "0.5.0",
      keys: {},
      confusions: {},
      wordMisses: {},
      streak: 18,
      wordsByDifficulty: { 1: 6, 2: 6, 3: 6 },
      difficulty: "normal",
    },
  ],
  rankings: {
    shachou: [
      {
        score: 4000,
        playedAt: 6000,
        jobId: "office",
        roleId: "shachou",
        nickname: "ごろう",
        title: "",
      },
    ],
  },
  achievements: { "clear-shachou": 6000 },
  progress: {
    totalClears: 3,
    totalWords: 47,
    clears: { senpai: 1, buchou: 1, shachou: 1 },
    clearedJobs: { engineer: true, office: true },
    exp: 900,
    jobs: { office: { plays: 2, clears: 2, words: 33, hits: 380, miss: 3 } },
    difficultyClears: { [clearKey("senpai", "normal")]: 1, [clearKey("buchou", "normal")]: 1 },
    bests: { [bestKey("office", "buchou", "normal")]: { score: 3200, playedAt: 5000 } },
  },
});

describe("バージョン 4 からの移行(ランキングの鍵を、役職:難易度に直す)", () => {
  it("役職名だけのランキングは「役職:normal」の鍵になる。ほかの項目(経験値など)は、そのまま", () => {
    const backend = fakeBackend();
    const v4 = v4Data();
    backend.map.set(STORAGE_KEY, JSON.stringify(v4));
    const { data, status } = createStore(backend).load();
    assert.equal(status, "ok");
    assert.equal(data.version, DATA_VERSION);
    assert.deepEqual(data.profile, v4.profile);
    assert.deepEqual(data.rankings, { [clearKey("shachou", "normal")]: v4.rankings.shachou });
    assert.deepEqual(data.achievements, v4.achievements);
    assert.equal(data.progress.exp, v4.progress.exp);
    assert.deepEqual(data.progress.jobs, v4.progress.jobs);
    assert.deepEqual(data.progress.difficultyClears, v4.progress.difficultyClears);
    assert.deepEqual(data.progress.bests, v4.progress.bests);
    assert.equal(data.results.length, 1);
  });

  it("移行前の元データを、一度だけ別のキー(:backup-v4)に退避する。上書きしない", () => {
    const backend = fakeBackend();
    const original = JSON.stringify(v4Data());
    backend.map.set(STORAGE_KEY, original);
    const store = createStore(backend);
    store.load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v4`), original);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v3`), false);
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v1`), false);

    // 保存(いまの版になる)した後に読み込んでも、退避は上書きされない
    store.update((data) => ({
      data: { ...data, profile: { ...data.profile, nickname: "変更後" } },
    }));
    assert.equal(JSON.parse(backend.map.get(STORAGE_KEY)).version, DATA_VERSION);
    createStore(backend).load();
    assert.equal(backend.map.get(`${STORAGE_KEY}:backup-v4`), original);
  });

  it("いまの版のデータは、退避(:backup-v4)を作らない", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify({ ...createEmptyData(), results: [result()] }));
    createStore(backend).load();
    assert.equal(backend.map.has(`${STORAGE_KEY}:backup-v4`), false);
  });

  it("退避に失敗しても、移行は続けられる", () => {
    const backend = fakeBackend();
    backend.map.set(STORAGE_KEY, JSON.stringify(v4Data()));
    const failing = {
      getItem: (key) => backend.getItem(key),
      setItem(key) {
        if (key.endsWith("backup-v4")) throw new Error("quota");
      },
    };
    const { data, status } = createStore(failing).load();
    assert.equal(status, "ok");
    assert.equal(data.results.length, 1);
  });
});

describe("バージョン 4 の項目(難易度・経験値・職種ごとの合計・難易度ごとのクリア数・自己ベスト)", () => {
  it("結果の難易度: 決まった値だけ。ほかは既定(ふつう)", () => {
    const difficulty = (value) => normalizedResult({ difficulty: value }).difficulty;
    for (const value of ["easy", "normal", "hard"]) assert.equal(difficulty(value), value);
    for (const bad of ["EASY", "", "extreme", "__proto__", 5, null, undefined, [], {}]) {
      assert.equal(difficulty(bad), "normal", String(bad));
    }
  });

  it("保存して読み込んでも、進行状況の新しい項目が変わらない", () => {
    const backend = fakeBackend();
    const data = createEmptyData();
    data.progress.exp = 1234;
    data.progress.jobs = { engineer: { plays: 3, clears: 1, words: 40, hits: 300, miss: 10 } };
    data.progress.difficultyClears = { [clearKey("senpai", "hard")]: 2 };
    data.progress.bests = {
      [bestKey("engineer", "senpai", "hard")]: { score: 5000, playedAt: 1000 },
    };
    createStore(backend).save(data);
    assert.deepEqual(createStore(backend).load().data, data);
  });

  it("職種ごとの合計: 職種 ID が不正・数でない値は捨てる。数は 0 以上の整数に整える", () => {
    const jobs = (value) =>
      normalizeData({
        ...createEmptyData(),
        progress: { ...createEmptyData().progress, jobs: value },
      }).progress.jobs;
    assert.deepEqual(
      jobs({ engineer: { plays: 3.9, clears: -1, words: "x", hits: NaN, miss: 2 } }),
      {
        engineer: { plays: 3, clears: 0, words: 0, hits: 0, miss: 2 },
      },
    );
    assert.deepEqual(jobs({ "<script>": { plays: 1 }, __proto__: { plays: 1 } }), {});
    for (const bad of [null, "x", 5, [], true]) assert.deepEqual(jobs(bad), {});
  });

  it("難易度ごとのクリア数: 名前(役職:難易度)の形が違う、難易度が不正なものは捨てる", () => {
    const clears = (value) =>
      normalizeData({
        ...createEmptyData(),
        progress: { ...createEmptyData().progress, difficultyClears: value },
      }).progress.difficultyClears;
    assert.deepEqual(
      clears({ "senpai:normal": 3, "senpai:extreme": 2, senpai: 1, "a:b:c": 1, "senpai:hard": 0 }),
      { "senpai:normal": 3 },
    );
  });

  it("自己ベスト: 名前(職種:役職:難易度)の形が違う、score・playedAt が不正なものは捨てる", () => {
    const bests = (value) =>
      normalizeData({
        ...createEmptyData(),
        progress: { ...createEmptyData().progress, bests: value },
      }).progress.bests;
    const key = bestKey("engineer", "senpai", "normal");
    assert.deepEqual(bests({ [key]: { score: 100, playedAt: 5000 } }), {
      [key]: { score: 100, playedAt: 5000 },
    });
    assert.deepEqual(bests({ [key]: { score: -1, playedAt: 5000 } }), {});
    assert.deepEqual(bests({ [key]: { score: 100, playedAt: "x" } }), {});
    assert.deepEqual(bests({ "engineer:senpai": { score: 100, playedAt: 1 } }), {});
    assert.deepEqual(bests({ "engineer:senpai:extreme": { score: 100, playedAt: 1 } }), {});
  });

  it("clearKey・bestKey は、役職・難易度、職種・役職・難易度を、決まった形の名前にする", () => {
    assert.equal(clearKey("senpai", "hard"), "senpai:hard");
    assert.equal(bestKey("engineer", "senpai", "normal"), "engineer:senpai:normal");
  });
});

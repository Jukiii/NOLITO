import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAnalytics,
  expireAnalyticsCookies,
} from "../public/assets/js/components/analytics.js";
import {
  CONSENT_KEY,
  initialAction,
  isAnalyticsAvailable,
  readConsent,
  writeConsent,
} from "../public/assets/js/components/consent-core.js";

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
};

const config = { measurementId: "G-ABC12345", hosts: ["nolito.pages.dev"], policyVersion: 1 };

describe("計測できる状態か", () => {
  it("測定 ID が正しい形で、いまのホストが対象のときだけ", () => {
    assert.equal(isAnalyticsAvailable(config, "nolito.pages.dev"), true);
  });

  it("測定 ID が空・不正な形なら、計測しない(既定の状態)", () => {
    for (const measurementId of [
      "",
      "G-",
      "g-abc12345",
      "UA-12345-1",
      "G-abc",
      "G-AB CD",
      undefined,
    ]) {
      assert.equal(
        isAnalyticsAvailable({ ...config, measurementId }, "nolito.pages.dev"),
        false,
        String(measurementId),
      );
    }
  });

  it("対象外のホスト(プレビュー・ローカル・別ドメイン)では計測しない", () => {
    for (const host of [
      "localhost",
      "phase-05.nolito.pages.dev",
      "nolito.pages.dev.evil.example",
      "example.com",
      "",
    ]) {
      assert.equal(isAnalyticsAvailable(config, host), false, host);
    }
    assert.equal(isAnalyticsAvailable({ ...config, hosts: [] }, "nolito.pages.dev"), false);
  });
});

describe("同意の保存", () => {
  it("保存した同意を読める", () => {
    const storage = fakeStorage();
    assert.equal(writeConsent(storage, "granted", 1, 1000), true);
    assert.equal(readConsent(storage, 1), "granted");
    assert.deepEqual(JSON.parse(storage.map.get(CONSENT_KEY)), {
      analytics: "granted",
      policyVersion: 1,
      at: 1000,
    });
    writeConsent(storage, "denied", 1);
    assert.equal(readConsent(storage, 1), "denied");
  });

  it("未回答・壊れている・不正な値・ポリシーの版が古い場合は、未回答(null)", () => {
    assert.equal(readConsent(fakeStorage(), 1), null);
    for (const raw of [
      "{broken",
      "null",
      "5",
      '"granted"',
      '{"analytics":"yes","policyVersion":1}',
      '{"analytics":"granted"}',
      '{"analytics":"granted","policyVersion":0}',
    ]) {
      assert.equal(readConsent(fakeStorage({ [CONSENT_KEY]: raw }), 1), null, raw);
    }
  });

  it("ポリシーの版が上がったら、以前の同意は無効(もう一度確認する)", () => {
    const storage = fakeStorage();
    writeConsent(storage, "granted", 1);
    assert.equal(readConsent(storage, 1), "granted");
    assert.equal(readConsent(storage, 2), null);
  });

  it("保存できない環境でも落ちない", () => {
    const failing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    assert.equal(readConsent(failing, 1), null);
    assert.equal(writeConsent(failing, "granted", 1), false);
    assert.equal(readConsent(null, 1), null);
    assert.equal(writeConsent(fakeStorage(), "maybe", 1), false);
  });
});

describe("ページを開いたときの動作", () => {
  it("計測できない状態では、同意の有無にかかわらず何もしない(バナーも出さない)", () => {
    for (const consent of [null, "granted", "denied"]) {
      assert.equal(initialAction({ available: false, consent }), "none");
    }
  });

  it("同意済みなら計測を始め、拒否済みなら何もせず、未回答なら尋ねる", () => {
    assert.equal(initialAction({ available: true, consent: "granted" }), "enable");
    assert.equal(initialAction({ available: true, consent: "denied" }), "none");
    assert.equal(initialAction({ available: true, consent: null }), "ask");
  });
});

// document / window の代わり
function fakeEnvironment(cookie = "") {
  const written = [];
  let current = cookie;
  const appended = [];
  const doc = {
    head: { append: (node) => appended.push(node) },
    createElement: (tag) => ({ tag }),
    get cookie() {
      return current;
    },
    set cookie(value) {
      written.push(value);
    },
  };
  return { doc, win: {}, written, appended, setCookie: (value) => (current = value) };
}

describe("Google アナリティクスの読み込み", () => {
  it("同意するまで(enable を呼ぶまで)、スクリプトも dataLayer も作らない", () => {
    const { doc, win, appended } = fakeEnvironment();
    const analytics = createAnalytics({ measurementId: "G-ABC12345", doc, win });
    assert.equal(analytics.loaded, false);
    assert.equal(appended.length, 0);
    assert.equal(win.dataLayer, undefined);
    assert.equal(win.gtag, undefined);
  });

  it("enable で、gtag のスクリプトを1つ読み込み、ページビュー(config)を設定する", () => {
    const { doc, win, appended } = fakeEnvironment();
    const analytics = createAnalytics({ measurementId: "G-ABC12345", doc, win });
    analytics.enable();
    assert.equal(analytics.loaded, true);
    assert.equal(appended.length, 1);
    assert.equal(appended[0].tag, "script");
    assert.equal(appended[0].async, true);
    assert.equal(appended[0].src, "https://www.googletagmanager.com/gtag/js?id=G-ABC12345");
    const [first, second] = win.dataLayer.map((entry) => Array.from(entry));
    assert.equal(first[0], "js");
    assert.ok(first[1] instanceof Date);
    assert.deepEqual(second, ["config", "G-ABC12345"]);
    assert.equal(win["ga-disable-G-ABC12345"], false);
  });

  it("dataLayer には、引数のリストではなく arguments が入る(Google の標準の書き方)", () => {
    const { doc, win } = fakeEnvironment();
    createAnalytics({ measurementId: "G-ABC12345", doc, win }).enable();
    assert.equal(Object.prototype.toString.call(win.dataLayer[0]), "[object Arguments]");
  });

  it("何度 enable しても、スクリプトは1回だけ", () => {
    const { doc, win, appended } = fakeEnvironment();
    const analytics = createAnalytics({ measurementId: "G-ABC12345", doc, win });
    analytics.enable();
    analytics.enable();
    analytics.enable();
    assert.equal(appended.length, 1);
    assert.equal(win.dataLayer.length, 2);
  });

  it("disable で、Google が定める無効化の印を付け、_ga の Cookie を消す", () => {
    const { doc, win, written } = fakeEnvironment(
      "_ga=GA1.1.1; _ga_ABC12345=GS1; session=keep; _gid=x",
    );
    const analytics = createAnalytics({ measurementId: "G-ABC12345", doc, win });
    analytics.enable();
    analytics.disable();
    assert.equal(win["ga-disable-G-ABC12345"], true);
    assert.deepEqual(written, ["_ga=; Max-Age=0; path=/", "_ga_ABC12345=; Max-Age=0; path=/"]);
  });

  it("撤回した後にもう一度同意すると、無効化の印が外れる(スクリプトは再読み込みしない)", () => {
    const { doc, win, appended } = fakeEnvironment();
    const analytics = createAnalytics({ measurementId: "G-ABC12345", doc, win });
    analytics.enable();
    analytics.disable();
    analytics.enable();
    assert.equal(win["ga-disable-G-ABC12345"], false);
    assert.equal(appended.length, 1);
  });

  it("同意しないまま disable しても(初回の拒否)、スクリプトは読み込まない", () => {
    const { doc, win, appended } = fakeEnvironment();
    const analytics = createAnalytics({ measurementId: "G-ABC12345", doc, win });
    analytics.disable();
    assert.equal(appended.length, 0);
    assert.equal(analytics.loaded, false);
    assert.equal(win["ga-disable-G-ABC12345"], true);
  });

  it("測定 ID は、URL に安全な形で入る", () => {
    const { doc, win, appended } = fakeEnvironment();
    createAnalytics({ measurementId: "G-A&B=1", doc, win }).enable();
    assert.equal(appended[0].src, "https://www.googletagmanager.com/gtag/js?id=G-A%26B%3D1");
  });
});

describe("Cookie の削除", () => {
  it("_ga で始まる Cookie の名前だけを対象にする", () => {
    const { doc, written } = fakeEnvironment("a=1; _ga=2;_ga_X=3 ; other_ga=4; _gat=5");
    assert.deepEqual(expireAnalyticsCookies(doc), ["_ga", "_ga_X", "_gat"]);
    assert.equal(written.length, 3);
    assert.ok(written.every((entry) => entry.includes("Max-Age=0")));
  });

  it("ホスト名がわかれば、ドメイン属性つきの Cookie も消せるよう、3通りの指定で消す", () => {
    const { doc, written } = fakeEnvironment("_ga=1");
    doc.location = { hostname: "nolito.pages.dev" };
    expireAnalyticsCookies(doc);
    assert.deepEqual(written, [
      "_ga=; Max-Age=0; path=/",
      "_ga=; Max-Age=0; path=/; domain=nolito.pages.dev",
      "_ga=; Max-Age=0; path=/; domain=.nolito.pages.dev",
    ]);
  });

  it("Cookie がなければ何もしない", () => {
    const { doc, written } = fakeEnvironment("");
    assert.deepEqual(expireAnalyticsCookies(doc), []);
    assert.equal(written.length, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMatcher } from "../public/assets/js/games/escape-boss/romaji.js";

// 文字列を1文字ずつ入力し、最後の結果を返す。途中で miss があれば "miss" を返す。
function typeAll(matcher, text) {
  let result = "ok";
  for (const char of text) {
    result = matcher.input(char);
    if (result === "miss") return "miss";
  }
  return result;
}

const accepts = (reading, text) => typeAll(createMatcher(reading), text) === "done";
const rejects = (reading, text) => typeAll(createMatcher(reading), text) !== "done";

describe("基本の入力", () => {
  it("標準の表記で打ち終わる", () => {
    const matcher = createMatcher("ばぐ");
    assert.equal(matcher.input("b"), "ok");
    assert.equal(matcher.input("a"), "ok");
    assert.equal(matcher.input("g"), "ok");
    assert.equal(matcher.input("u"), "done");
    assert.equal(matcher.done, true);
  });

  it("不一致は miss で、状態は変わらない", () => {
    const matcher = createMatcher("ばぐ");
    matcher.input("b");
    assert.equal(matcher.input("x"), "miss");
    assert.equal(matcher.typed, "b");
    assert.equal(matcher.remaining, "agu");
    assert.equal(typeAll(matcher, "agu"), "done");
  });

  it("大文字も受け付ける", () => {
    assert.ok(accepts("ばぐ", "BAGU"));
  });

  it("打ち終わった後の入力は done のまま", () => {
    const matcher = createMatcher("あ");
    matcher.input("a");
    assert.equal(matcher.input("a"), "done");
  });

  it("カタカナの読みも受け付ける", () => {
    assert.ok(accepts("バグ", "bagu"));
  });

  it("空の読みや未対応の文字はエラー", () => {
    assert.throws(() => createMatcher(""));
    assert.throws(() => createMatcher("abc"));
  });
});

describe("複数の表記", () => {
  it("し・ち・つ・ふ・じ", () => {
    assert.ok(accepts("し", "shi") && accepts("し", "si"));
    assert.ok(accepts("ち", "chi") && accepts("ち", "ti"));
    assert.ok(accepts("つ", "tsu") && accepts("つ", "tu"));
    assert.ok(accepts("ふ", "fu") && accepts("ふ", "hu"));
    assert.ok(accepts("じ", "ji") && accepts("じ", "zi"));
  });

  it("拗音", () => {
    assert.ok(accepts("しゃ", "sha") && accepts("しゃ", "sya"));
    assert.ok(accepts("しょ", "sho") && accepts("しょ", "syo"));
    assert.ok(accepts("じゅ", "ju") && accepts("じゅ", "zyu") && accepts("じゅ", "jyu"));
    assert.ok(accepts("ちゅ", "chu") && accepts("ちゅ", "tyu") && accepts("ちゅ", "cyu"));
    assert.ok(accepts("きゃ", "kya"));
    assert.ok(accepts("びゅ", "byu"));
    assert.ok(accepts("りょ", "ryo"));
  });

  it("外来音", () => {
    assert.ok(accepts("ふぁ", "fa"));
    assert.ok(accepts("りふぁくたりんぐ", "rifakutaringu"));
    assert.ok(accepts("てぃ", "thi"));
  });

  it("長音は - で入力する", () => {
    assert.ok(accepts("さーばー", "sa-ba-"));
    assert.ok(rejects("さーばー", "saaba"));
  });

  it("同じ単位の別表記を混ぜても、確定した表記に従う", () => {
    assert.equal(typeAll(createMatcher("し"), "sh"), "ok");
    assert.equal(typeAll(createMatcher("し"), "shi"), "done");
    assert.equal(typeAll(createMatcher("し"), "sh" + "i"), "done");
    assert.equal(typeAll(createMatcher("し"), "sa"), "miss");
  });
});

describe("ん", () => {
  it("子音の前は n でも nn でもよい", () => {
    assert.ok(accepts("かんじ", "kanji"));
    assert.ok(accepts("かんじ", "kannji"));
    assert.ok(accepts("かんじ", "kaxnji"));
    assert.ok(accepts("しんき", "shinki"));
    assert.ok(accepts("りんぎ", "ringi"));
  });

  it("な行の前は n でも nn でもよい(n + na = nna)", () => {
    assert.ok(accepts("こんな", "konna"));
    assert.ok(accepts("こんな", "konnna"));
    assert.ok(rejects("こんな", "kona"));
    assert.ok(accepts("こんにちは", "konnichiha"));
    assert.ok(rejects("こんにちは", "konichiha"));
  });

  it("母音・や行の前は nn が必須", () => {
    assert.ok(accepts("ていあん", "teiann"));
    assert.ok(accepts("たんい", "tanni"));
    assert.ok(rejects("たんい", "tani"));
    assert.ok(accepts("ほんや", "honnya"));
  });

  it("語末は nn が必須(n だけでは終わらない)", () => {
    assert.ok(accepts("ほうもん", "houmonn"));
    assert.equal(typeAll(createMatcher("ほうもん"), "houmon"), "ok");
  });

  it("nn を打つ途中で n の後に次の文字を打っても進める", () => {
    const matcher = createMatcher("かんか");
    assert.equal(typeAll(matcher, "kan"), "ok");
    assert.equal(typeAll(matcher, "ka"), "done");
  });
});

describe("っ", () => {
  it("次の子音を重ねる", () => {
    assert.ok(accepts("こみっと", "komitto"));
    assert.ok(accepts("でばっぐ", "debaggu"));
    assert.ok(accepts("せっきゃく", "sekkyaku"));
    assert.ok(accepts("しゅっせきぼ", "shussekibo"));
  });

  it("ち系は cch / tch / tt どれでもよい", () => {
    assert.ok(accepts("しゅっちょう", "shucchou"));
    assert.ok(accepts("しゅっちょう", "shutchou"));
    assert.ok(accepts("しゅっちょう", "shuttyou"));
  });

  it("しゃ系", () => {
    assert.ok(accepts("いらっしゃいませ", "irasshaimase"));
    assert.ok(accepts("いらっしゃいませ", "irassyaimase"));
  });

  it("xtu / ltu でも入力できる", () => {
    assert.ok(accepts("こみっと", "komixtuto"));
    assert.ok(accepts("こみっと", "komiltuto"));
  });

  it("重ねずに次の文字を打つと miss", () => {
    assert.ok(rejects("こみっと", "komito"));
  });

  it("語末の っ は xtu", () => {
    assert.ok(accepts("あっ", "axtu"));
  });
});

describe("表示用の残り入力", () => {
  it("開始時は標準表記の全体", () => {
    assert.equal(createMatcher("しょうだん").remaining, "shoudann");
    assert.equal(createMatcher("しょうだん").canonical, "shoudann");
    assert.equal(createMatcher("しょうだん").canonicalLength, 8);
  });

  it("入力に応じて typed と remaining が変わる", () => {
    const matcher = createMatcher("しょうだん");
    typeAll(matcher, "sho");
    assert.equal(matcher.typed, "sho");
    assert.equal(matcher.remaining, "udann");
  });

  it("別表記を選んだ場合は、その表記の残りを表示する", () => {
    const matcher = createMatcher("しょう");
    typeAll(matcher, "sy");
    assert.equal(matcher.remaining, "ou");
  });

  it("ん の n を打った直後の残り", () => {
    const matcher = createMatcher("かんじ");
    typeAll(matcher, "kan");
    assert.equal(matcher.remaining, "ji");
  });

  it("打ち終わったら空", () => {
    const matcher = createMatcher("あ");
    matcher.input("a");
    assert.equal(matcher.remaining, "");
  });
});

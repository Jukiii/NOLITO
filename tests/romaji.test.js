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

// ---- Phase 13 PR 2: 表示する書き方(style)・表示どおりだけ(strict)・小さい文字を分けて打つ書き方 ----
const typeIn = (reading, text, options) => typeAll(createMatcher(reading, options), text);
const kunrei = { style: "kunrei" };
const strict = { strict: true };
const kunreiStrict = { style: "kunrei", strict: true };
const shown = (reading, options) => createMatcher(reading, options).remaining;

describe("読みの空白", () => {
  it("読みの中の空白は、無視する", () => {
    assert.equal(shown("ば ぐ"), "bagu");
    assert.ok(accepts("ば ぐ", "bagu"));
  });
});

describe("訓令式で表示(style: kunrei)", () => {
  it("し・ち・つ・ふ・じを、si・ti・tu・hu・zi で表示する(標準は、shi・chi・tsu・fu・ji)", () => {
    for (const [reading, hepburn, kun] of [
      ["し", "shi", "si"],
      ["ち", "chi", "ti"],
      ["つ", "tsu", "tu"],
      ["ふ", "fu", "hu"],
      ["じ", "ji", "zi"],
    ]) {
      assert.equal(shown(reading), hepburn, reading);
      assert.equal(shown(reading, kunrei), kun, reading);
    }
  });

  it("拗音・外来音の一部を、訓令式で表示する", () => {
    for (const [reading, hepburn, kun] of [
      ["しゃ", "sha", "sya"],
      ["しゅ", "shu", "syu"],
      ["しょ", "sho", "syo"],
      ["ちゃ", "cha", "tya"],
      ["ちゅ", "chu", "tyu"],
      ["じゃ", "ja", "zya"],
      ["じょ", "jo", "zyo"],
      ["しぇ", "she", "sye"],
      ["じぇ", "je", "zye"],
      ["ちぇ", "che", "tye"],
    ]) {
      assert.equal(shown(reading), hepburn, reading);
      assert.equal(shown(reading, kunrei), kun, reading);
    }
  });

  it("違いのない文字は、そのまま(きゃ・ふぁ・ん・長音)", () => {
    assert.equal(shown("きゃ", kunrei), "kya");
    assert.equal(shown("ふぁ", kunrei), "fa");
    assert.equal(shown("さーばー", kunrei), "sa-ba-");
    assert.equal(shown("かんき", kunrei), "kanki");
    assert.equal(shown("かんい", kunrei), "kanni");
  });

  it("っ の重ねも、訓令式の表記に従う(sshi → ssi、cchi → tti)", () => {
    assert.equal(shown("はっし"), "hasshi");
    assert.equal(shown("はっし", kunrei), "hassi");
    assert.equal(shown("はっちゅう"), "hacchuu");
    assert.equal(shown("はっちゅう", kunrei), "hattyuu");
  });

  it("訓令式で表示していても、ヘボン式・ほかの書き方でも入力できる", () => {
    assert.equal(typeIn("し", "shi", kunrei), "done");
    assert.equal(typeIn("し", "si", kunrei), "done");
    assert.equal(typeIn("じゅ", "ju", kunrei), "done");
    assert.equal(typeIn("じゅ", "zyu", kunrei), "done");
    assert.equal(typeIn("ちゅうもん", "chuumonn", kunrei), "done");
    assert.equal(typeIn("ちゅうもん", "tyuumonn", kunrei), "done");
  });

  it("標準でも、訓令式の書き方で入力できる(表示が、ヘボン式なだけ)", () => {
    assert.equal(typeIn("しゃしん", "syasinn"), "done");
    assert.equal(typeIn("つくえ", "tukue"), "done");
  });

  it("知らない style は、標準(ヘボン式)として扱う", () => {
    for (const style of ["", "KUNREI", "nippon", undefined, null, 1]) {
      assert.equal(shown("し", { style }), "shi", String(style));
    }
  });
});

describe("表示どおりだけ(strict)", () => {
  it("表示された書き方だけを受け付ける。ほかの書き方は、そのキーで miss", () => {
    assert.equal(typeIn("し", "shi", strict), "done");
    assert.equal(typeIn("し", "si", strict), "miss");
    assert.equal(typeIn("ち", "ti", strict), "miss");
    assert.equal(typeIn("つ", "tu", strict), "miss");
    assert.equal(typeIn("ふ", "hu", strict), "miss");
    assert.equal(typeIn("じゅ", "zyu", strict), "miss");
    assert.equal(typeIn("しゃ", "sya", strict), "miss");
  });

  it("っ は、子音を重ねる書き方だけ。xtu・ltu は、miss", () => {
    assert.equal(typeIn("はっぱ", "happa", strict), "done");
    assert.equal(typeIn("はっぱ", "haxtupa", strict), "miss");
    assert.equal(typeIn("はっぱ", "haltupa", strict), "miss");
  });

  it("ん は、表示どおり(母音・語末の前は nn、子音の前は n)。xn は miss", () => {
    assert.equal(shown("かんじ", strict), "kanji");
    assert.equal(typeIn("かんじ", "kanji", strict), "done");
    assert.equal(typeIn("かんじ", "kannji", strict), "miss");
    assert.equal(typeIn("かんじ", "kaxnji", strict), "miss");
    assert.equal(typeIn("ほん", "honn", strict), "done");
    assert.equal(typeIn("ほん", "hon", strict), "ok");
  });

  it("小さい文字を分けて打つ書き方は、miss(kixya・sixya・fuxa)", () => {
    assert.equal(typeIn("きゃ", "kya", strict), "done");
    assert.equal(typeIn("きゃ", "kixya", strict), "miss");
    assert.equal(typeIn("しゃ", "shixya", strict), "miss");
    assert.equal(typeIn("ふぁ", "fuxa", strict), "miss");
  });

  it("表示は、strict でない場合と同じ(表示の書き方は、変わらない)", () => {
    for (const reading of ["しゃしん", "はっちゅう", "こんにちは", "ぷるりくえすと"]) {
      assert.equal(shown(reading, strict), shown(reading), reading);
    }
  });

  it("訓令式で、表示どおりだけ: si は done、shi は miss", () => {
    assert.equal(shown("しゃ", kunreiStrict), "sya");
    assert.equal(typeIn("しゃ", "sya", kunreiStrict), "done");
    assert.equal(typeIn("しゃ", "sha", kunreiStrict), "miss");
    assert.equal(typeIn("し", "si", kunreiStrict), "done");
    assert.equal(typeIn("し", "shi", kunreiStrict), "miss");
  });

  it("strict でも、標準の表記で、最後まで打てる", () => {
    for (const reading of ["ばぐ", "でーたべーす", "しゅっちょう", "にっぽん", "ふぁいる"]) {
      const options = strict;
      const text = createMatcher(reading, options).remaining;
      assert.equal(typeIn(reading, text, options), "done", reading);
    }
  });
});

describe("小さい文字を分けて打つ書き方(標準・訓令式)", () => {
  it("きゃ = kixya・kilya、しゃ = sixya・shixya、ふぁ = fuxa、てぃ = texi でも入力できる", () => {
    assert.ok(accepts("きゃ", "kixya") && accepts("きゃ", "kilya"));
    assert.ok(accepts("しゃ", "sixya") && accepts("しゃ", "shixya") && accepts("しゃ", "shilya"));
    assert.ok(accepts("ちゅ", "chixyu") && accepts("ちゅ", "tixyu"));
    assert.ok(accepts("ふぁ", "fuxa") && accepts("ふぁ", "hula"));
    assert.ok(accepts("てぃ", "texi") && accepts("てぃ", "teli"));
    assert.ok(accepts("りょ", "rixyo") && accepts("りょ", "rilyo"));
  });

  it("語の中でも入力できる。ふつうの書き方と、混ぜてもよい", () => {
    assert.ok(accepts("しゃしん", "shixyashinn"));
    assert.ok(accepts("じゅぎょう", "jixyugixyou"));
    assert.ok(accepts("じゅぎょう", "jugixyou"));
    assert.ok(accepts("りふぁくたりんぐ", "rifuxakutaringu"));
  });

  it("画面に表示する書き方は、変わらない(先頭は、これまでの標準の書き方)", () => {
    assert.equal(shown("きゃ"), "kya");
    assert.equal(shown("しゃ"), "sha");
    assert.equal(shown("ふぁ"), "fa");
    assert.equal(shown("てぃ"), "thi");
  });

  it("途中まで打った書き方の残りを、正しく表示する", () => {
    const matcher = createMatcher("きゃ");
    assert.equal(matcher.input("k"), "ok");
    assert.equal(matcher.remaining, "ya");
    assert.equal(matcher.input("i"), "ok");
    assert.equal(matcher.remaining, "xya");
    assert.equal(matcher.input("x"), "ok");
    assert.equal(matcher.input("y"), "ok");
    assert.equal(matcher.input("a"), "done");
  });

  it("分けて打つ書き方の途中で、まちがえたら miss(状態は変わらない)", () => {
    const matcher = createMatcher("きゃ");
    matcher.input("k");
    matcher.input("i");
    assert.equal(matcher.input("y"), "miss");
    assert.equal(matcher.remaining, "xya");
    assert.equal(matcher.typed, "ki");
  });

  it("小さい文字を含まない語は、影響を受けない(き + や は、きゃ とは別)", () => {
    assert.ok(accepts("きや", "kiya"));
    assert.ok(rejects("きや", "kya"));
  });

  it("っ の直後でも入力できる(っ + きゃ)", () => {
    assert.ok(accepts("ばっきゃく", "bakkyaku"));
    assert.ok(accepts("ばっきゃく", "bakkixyaku"));
  });
});

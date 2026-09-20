// ゲームのページ(index.html)と、それを操作する view.js・main.js の対応のテスト(Phase 12 PR 1)。
// JavaScript が探す目印(data 属性)が、HTML にあること。HTML から目印を消して、画面が壊れるのを防ぐ。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

const html = read("public/games/escape-boss/index.html");
const view = read("public/assets/js/games/escape-boss/view.js");
const main = read("public/assets/js/games/escape-boss/main.js");
const css = read("public/assets/css/game.css");

// JavaScript の文字列の中の、[data-...] の目印(テンプレートの ${...} を含むものは、対象外)
const hooks = (source) => {
  const names = new Set();
  for (const quoted of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'/g)) {
    const literal = quoted[1] ?? quoted[2];
    if (literal.includes("${")) continue;
    for (const hook of literal.matchAll(/\[(data-[a-z-]+)(?:="([^"]*)")?\]/g)) {
      names.add(hook[2] === undefined ? hook[1] : `${hook[1]}="${hook[2]}"`);
    }
  }
  return names;
};

describe("view.js・main.js が探す目印が、HTML にある", () => {
  for (const [name, source, minimum] of [
    ["view.js", view, 11],
    ["main.js", main, 1],
  ]) {
    it(name, () => {
      const found = hooks(source);
      assert.ok(found.size >= minimum, `${name}: 目印を、拾えていません(${found.size})`);
      for (const hook of found) {
        const [attribute, value] = hook.split("=");
        assert.ok(html.includes(attribute), `${name}: HTML に ${attribute} がありません`);
        if (value !== undefined)
          assert.ok(html.includes(hook), `${name}: HTML に ${hook} がありません`);
      }
    });
  }

  it("用語確認・説明・ミスした語の目印が、そろっている", () => {
    for (const hook of [
      "data-mode-list",
      "data-role-fieldset",
      "data-explanation-option",
      "data-show-explanation",
      'data-view="check-result"',
      "data-check-title",
      "data-check-message",
      "data-check-missed-list",
      "data-check-words-list",
      "data-check-retry",
      "data-check-back",
      "data-check-note",
      "data-word-explanation",
      "data-result-missed-list",
      'data-stat-label="correct"',
    ]) {
      assert.ok(html.includes(hook), hook);
    }
  });
});

describe("ページの作り", () => {
  it("画面(data-view)は、ダッシュボード・プレイ・結果・用語確認の結果の 4 つ", () => {
    const views = [...html.matchAll(/data-view="([a-z-]+)"/g)].map((match) => match[1]);
    assert.deepEqual(views.sort(), ["check-result", "dashboard", "play", "result"]);
  });

  it("追いかけ専用の部品(場面・ゲージ・追ってくる人)に、印(data-chase-only)がある", () => {
    const marked = html.match(/data-chase-only/g) ?? [];
    assert.equal(marked.length, 3);
    assert.match(html, /<div class="scene"[^>]*data-chase-only>/);
    assert.match(html, /<div class="gauge-block" data-chase-only>/);
  });

  it("説明の設定は、チェックボックスで、ラベルと結びついている。既定は、チェックなし", () => {
    assert.match(html, /<input type="checkbox" id="show-explanation" data-show-explanation \/>/);
    assert.match(html, /<label for="show-explanation">/);
    assert.ok(!/id="show-explanation"[^>]*\bchecked\b/.test(html));
  });

  it("結果の見出しは、フォーカスできる(tabindex=-1)。読み上げの領域が、ある", () => {
    assert.match(html, /id="check-result-title" tabindex="-1" data-check-title/);
    assert.match(html, /role="status" aria-live="polite" data-announce/);
  });

  it("用語確認の結果に、保存されない旨と、広告の枠がない(学習の画面に、広告を置かない)", () => {
    const section = html.slice(
      html.indexOf('data-view="check-result"'),
      html.indexOf("data-announce"),
    );
    assert.ok(section.includes("保存されません"));
    assert.ok(!section.includes("data-ad-slot"));
  });

  it("プレイ中の画面(play)には、広告の枠がない", () => {
    const play = html.slice(html.indexOf('data-view="play"'), html.indexOf('data-view="result"'));
    assert.ok(!play.includes("data-ad-slot"));
  });
});

describe("表示は textContent だけ", () => {
  it("HTML として解釈する書き方をしない(語録の内容は、そのまま文字として出す)", () => {
    for (const source of [view, main]) {
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(source));
    }
  });

  it("説明・語の表示は、setText か el()(textContent 相当)を通す", () => {
    assert.match(view, /setText\("\[data-word-explanation\]", word\.explanation \?\? ""\)/);
    // 一覧の 1 件の描画は、共通の部品(review-item.js)。説明は el() で入れる
    const item = read("public/assets/js/games/escape-boss/review-item.js");
    assert.match(
      item,
      /el\("p", \{ class: "review-item__text", lang: "ja" \}, word\.explanation\)/,
    );
  });
});

describe("CSS", () => {
  it("色を、トークンで指定する(ダークテーマに対応できるように)", () => {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css.replace(/\/\*[\s\S]*?\*\//g, "")));
  });

  it("hidden 属性を、クラスの display より優先する(用語確認で隠す部品)", () => {
    assert.match(css, /\[data-chase-only\]\[hidden\][\s\S]*display: none/);
  });
});

describe("保存(記録は変えない)", () => {
  it("記録の版・キーは、そのまま(2・nolito:escape-boss:v1)。設定は、別のキー", () => {
    const storage = read("public/assets/js/games/escape-boss/storage.js");
    assert.match(storage, /export const DATA_VERSION = 2;/);
    assert.match(storage, /export const STORAGE_KEY = "nolito:escape-boss:v1";/);
    const settings = read("public/assets/js/games/escape-boss/settings.js");
    assert.match(settings, /"nolito:escape-boss:settings:v1"/);
  });

  it("用語確認の進行(check.js)は、記録の保存(store)を、呼ばない", () => {
    const check = read("public/assets/js/games/escape-boss/check.js");
    assert.ok(!/store|localStorage|recordResult|storage\.js/.test(check.replace(/\/\/.*$/gm, "")));
    // main.js の用語確認の部分(beginCheck 〜 beginGame の前)にも、記録を保存する呼び出しがない
    const checkPart = main.slice(
      main.indexOf("async function beginCheck"),
      main.indexOf("async function beginGame"),
    );
    assert.ok(checkPart.includes("finishCheck"), "用語確認の部分を、切り出せていません");
    // 記録を読む(store.load)のは、復習リストのため。書き込む呼び出しは、ない
    assert.ok(!/store\.(update|save)|recordResult|saveSettings/.test(checkPart));
  });
});

describe("復習リスト(成績ページ)", () => {
  const stats = read("public/games/escape-boss/stats/index.html");
  const statsPage = read("public/assets/js/games/escape-boss/stats-page.js");
  const review = read("public/assets/js/games/escape-boss/review.js");

  it("stats-page.js が探す目印が、成績ページの HTML にある", () => {
    const found = hooks(statsPage);
    assert.ok(found.size >= 10, `目印を、拾えていません(${found.size})`);
    for (const hook of found) {
      const [attribute, value] = hook.split("=");
      assert.ok(stats.includes(attribute), `成績ページの HTML に ${attribute} がありません`);
      if (value !== undefined) assert.ok(stats.includes(hook), hook);
    }
  });

  it("復習リストの節: 見出し・説明・一覧・用語確認のボタン(リンク)がある", () => {
    for (const hook of [
      "data-review-note",
      "data-review-list",
      "data-review-action",
      "data-review-start",
    ]) {
      assert.ok(stats.includes(hook), hook);
    }
    assert.match(stats, /<h2 id="review-title">復習リスト<\/h2>/);
    assert.match(stats, /aria-labelledby="review-title"/);
  });

  it("ボタンは、ゲームのページに ?review=1 で移る。ゲームの main.js が、それを受ける", () => {
    assert.match(stats, /href="\/games\/escape-boss\/\?review=1"/);
    assert.match(main, /params\.get\("review"\) === "1"/);
    // アドレスから消す(再読み込みで、もう一度始まらないように)
    assert.match(main, /history\.replaceState\(null, "", location\.pathname\)/);
  });

  it("復習リストの節は、期間・役職の絞り込みの外にある(絞り込みの影響を受けない)", () => {
    const section = stats.indexOf("data-review");
    const scoped = stats.indexOf("data-scoped");
    assert.ok(section > 0 && scoped > section);
    assert.ok(stats.indexOf("data-filter-range") > section, "絞り込みより前に置く");
  });

  it("復習リストの作成(review.js)は、記録の保存・DOM に触れない", () => {
    assert.ok(
      !/localStorage|document|window|store\b|storage\.js|fetch\(/.test(
        review.replace(/\/\/.*$/gm, ""),
      ),
    );
  });

  it("結果の画面と成績ページは、同じ部品(review-item.js)で、語を描く。表示は el() だけ", () => {
    assert.match(view, /import \{ reviewItem \} from "\.\/review-item\.js"/);
    assert.match(statsPage, /import \{ reviewItem \} from "\.\/review-item\.js"/);
    const item = read("public/assets/js/games/escape-boss/review-item.js");
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(item));
    assert.match(item, /word\.explanation/);
  });

  it("復習リストで始めた用語確認は、記録を保存しない(beginReview〜startCheckSession)", () => {
    const part = main.slice(
      main.indexOf("async function beginReview"),
      main.indexOf("// 用語確認では、語が変わるたびに"),
    );
    assert.ok(part.includes("startCheckSession"), "切り出せていません");
    assert.ok(!/store\.(update|save)|recordResult|saveSettings/.test(part));
  });

  it("ダッシュボードのリンクに、復習リストがある", () => {
    assert.match(html, /成績・成長グラフ・苦手文字・復習リストを見る/);
  });
});

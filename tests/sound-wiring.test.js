// 音(Phase 16 PR 3)の、画面(HTML・view.js)と main.js のつなぎのテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const main = read("public/assets/js/games/escape-boss/main.js");
const view = read("public/assets/js/games/escape-boss/view.js");
const html = read("public/games/escape-boss/index.html");
const css = read("public/assets/css/game.css");

// main.js の、ある関数の本体(次の「function」までの、おおよその範囲)
const body = (name) => {
  const start = main.search(new RegExp(`(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} が、ありません`);
  const next = main.slice(start + 10).search(/\n(async )?function /);
  return main.slice(start, next < 0 ? undefined : start + 10 + next);
};

describe("設定の画面(HTML)", () => {
  it("音の選択(なし・効果音だけ・効果音 + BGM)。ラベルと補足に、関連づいている", () => {
    assert.match(html, /<label for="sound-mode">音<\/label>/);
    assert.match(
      html,
      /id="sound-mode"[\s\S]*?aria-describedby="sound-hint"[\s\S]*?data-sound-mode/,
    );
    const select = html.slice(
      html.indexOf('id="sound-mode"'),
      html.indexOf("</select>", html.indexOf('id="sound-mode"')),
    );
    assert.deepEqual(
      [...select.matchAll(/<option value="(\w+)">([^<]+)<\/option>/g)].map((m) => [m[1], m[2]]),
      [
        ["off", "なし"],
        ["se", "効果音だけ"],
        ["all", "効果音 + BGM"],
      ],
    );
  });

  it("音量は、0〜100・5 きざみのスライダー。ラベルがある(1 つのラベルに、1 つの部品)", () => {
    assert.match(html, /<label for="sound-volume">音量<\/label>/);
    assert.match(html, /<output for="sound-volume" data-sound-volume-value>50<\/output>/);
    const slider = html.slice(
      html.indexOf('id="sound-volume"') - 60,
      html.indexOf("data-sound-volume\n") + 30,
    );
    assert.match(slider, /type="range"/);
    assert.match(slider, /min="0"/);
    assert.match(slider, /max="100"/);
    assert.match(slider, /step="5"/);
    assert.match(slider, /value="50"/);
  });

  it("「音を試す」ボタンがある。補足に、初期設定が「なし」・通信しない・音量への注意がある", () => {
    assert.match(html, /<button[^>]*type="button"[^>]*data-sound-test>\s*音を試す\s*<\/button>/);
    const hint = html.slice(
      html.indexOf('id="sound-hint"'),
      html.indexOf("</p>", html.indexOf('id="sound-hint"')),
    );
    assert.match(hint, /初期設定は「なし」/);
    assert.match(hint, /通信しません/);
    assert.match(hint, /音量に気をつけて/);
  });

  it("用語確認でも、音の設定は隠さない(applyMode が、音の設定を隠さない)", () => {
    const apply = view.slice(view.indexOf("function applyMode"), view.indexOf("function option"));
    assert.ok(!/sound/.test(apply));
  });
});

describe("プレイ中の「音」ボタン", () => {
  it("ステータス欄に、切り替えボタン(aria-pressed)がある。「やめる」より前", () => {
    const side = html.slice(
      html.indexOf('<aside class="game-play__side"'),
      html.indexOf("</aside>"),
    );
    assert.match(side, /aria-pressed="false"[\s\S]*?data-sound-toggle/);
    assert.match(side, /音: <span data-sound-state>なし<\/span>/);
    assert.ok(side.indexOf("data-sound-toggle") < side.indexOf("data-quit"));
  });

  it("押したあと、入力欄にフォーカスを戻す(続けて打てる)", () => {
    assert.match(
      view,
      /\$\("\[data-sound-toggle\]"\)\.addEventListener\("click", \(\) => \{\s*onSoundToggle\(\);\s*input\.focus\(\);/,
    );
  });

  it("view.setSoundSettings が、選択・音量・表示・aria-pressed を反映する。文字は textContent だけ", () => {
    const set = view.slice(view.indexOf("setSoundSettings("), view.indexOf("setNickname("));
    assert.match(set, /\$\("\[data-sound-mode\]"\)\.value = soundMode;/);
    assert.match(set, /\$\("\[data-sound-volume\]"\)\.value = String\(volume\);/);
    assert.match(set, /setAttribute\("aria-pressed", String\(on\)\)/);
    assert.match(set, /on \? "あり" : "なし"/);
    assert.ok(!/innerHTML/.test(view));
  });

  it("スライダーは、動かしている間は音量と表示だけ、離したときに保存する(input と change)", () => {
    assert.match(
      view,
      /\[data-sound-volume\]"\)\.addEventListener\("input"[\s\S]*?onSoundVolumeInput\(Number/,
    );
    assert.match(
      view,
      /\[data-sound-volume\]"\)\.addEventListener\("change"[\s\S]*?onSoundVolumeChange\(Number/,
    );
  });

  it("view.js が探す data- の目印は、HTML にある", () => {
    for (const mark of [
      "data-sound-mode",
      "data-sound-volume",
      "data-sound-volume-value",
      "data-sound-test",
      "data-sound-toggle",
      "data-sound-state",
    ]) {
      assert.ok(view.includes(`[${mark}]`), `view.js: ${mark}`);
      assert.ok(html.includes(mark), `HTML: ${mark}`);
    }
  });

  it("CSS: スライダーは、チェックボックス用の大きさの指定に負けない。色はトークン", () => {
    assert.match(css, /\.game-setup__option \.game-setup__range \{[^}]*width: 100%/);
    assert.match(css, /accent-color: var\(--color-primary\)/);
    assert.ok(
      css.indexOf(".game-setup__option .game-setup__range") <
        css.indexOf(".game-setup__option input {"),
    );
  });
});

describe("main.js のつなぎ(音)", () => {
  it("音は、audio.js の createSound だけで鳴らす。設定の保存は、settings.js だけ", () => {
    assert.match(main, /import \{ createSound \} from "\.\/audio\.js";/);
    assert.match(main, /const sound = createSound\(\);/);
    assert.ok(!/new AudioContext|webkitAudioContext|new Audio\(/.test(main));
    const change = body("changeSound");
    assert.match(change, /saveSettings\(backend, settings\)/);
    // 設定を反映してから、音の準備をする(「なし」から切り替えた直後にも、準備が作られる)
    assert.ok(change.indexOf("applySound();") < change.indexOf("sound.unlock();"));
  });

  it("開始のクリアの中で、音の準備をする(ブラウザは、操作のあとにしか、音を許さない)", () => {
    assert.match(main, /onStart: \(\{ mode, jobId, roleId \}\) => \{\s*sound\.unlock\(\);/);
  });

  it("起動時に、保存された設定を反映する(applySound)", () => {
    assert.match(main, /view\.setInputStyleSetting\(settings\.inputStyle\);\s*applySound\(\);/);
    assert.match(
      main,
      /sound\.configure\(\{ mode: settings\.soundMode, volume: settings\.volume \}\)/,
    );
  });

  it("「音」ボタンは、toggledMode で、なし ↔ 前の設定に切り替える。押す前の設定を覚える", () => {
    assert.match(main, /import \{ toggledMode \} from "\.\/sound\.js";/);
    assert.match(
      main,
      /if \(settings\.soundMode !== "off"\) soundRestore = settings\.soundMode;\s*changeSound\(\{ soundMode: toggledMode\(settings\.soundMode, soundRestore\) \}\)/,
    );
  });

  it("スライダーを動かしている間は、保存しない(離したときだけ保存)", () => {
    const input = main.slice(
      main.indexOf("onSoundVolumeInput"),
      main.indexOf("onSoundVolumeChange"),
    );
    assert.ok(!/saveSettings/.test(input));
    assert.match(main, /onSoundVolumeChange: \(value\) => changeSound\(\{ volume: value \}\)/);
  });

  it("「音を試す」: 設定が「なし」なら、その旨を読み上げる。鳴らせなかったときも、知らせる", () => {
    assert.match(main, /if \(!sound\.play\("correct"\)\) \{/);
    assert.match(main, /音の設定が「なし」です/);
    assert.match(main, /音を出せませんでした/);
  });

  it("連続タイピング: スタートの合図で開始の音と BGM(0.6 秒あとから)。BGM は、遊んでいる間だけ", () => {
    const start = body("startPlaying");
    assert.match(start, /sound\.play\("start"\);/);
    assert.match(start, /sound\.startBgm\(\{ delaySec: 0\.6 \}\);/);
    for (const name of ["finish", "quit", "beginGame", "startCheckSession"]) {
      assert.match(body(name), /sound\.stopBgm\(\);/, `${name} で BGM を止める`);
    }
  });

  it("連続タイピング: ミス・1 語ごと・危ない・クリア・ゲームオーバーで、効果音", () => {
    const handle = body("handleChar");
    assert.match(handle, /view\.pulseScene\("miss"\);\s*sound\.play\("miss"\);/);
    assert.match(
      handle,
      /if \(session\.state\.status !== "playing"\) return;\s*sound\.play\("correct"\);/,
    );
    assert.match(body("update"), /say\("near"\);\s*sound\.play\("near"\);/);
    // クリアかゲームオーバーかは kind(clear / over)に決め、セリフ・音・役職別の見せ方に、同じ値を使う
    const outro = body("beginOutro");
    assert.match(outro, /const kind = session\.state\.status === "cleared" \? "clear" : "over";/);
    assert.match(outro, /sound\.play\(kind\);/);
  });

  it("終わりの演出の前に、BGM を止める(finish の先頭)。クリアの音は、演出と同時に鳴る", () => {
    const finish = body("finish");
    assert.ok(finish.indexOf("sound.stopBgm()") < finish.indexOf("store.update("));
  });

  it("用語確認: ミス・1 語ごと・最後(クリアの音)で、効果音。BGM はない", () => {
    const check = body("handleCheckChar");
    assert.match(check, /sound\.play\("miss"\);/);
    assert.match(check, /sound\.play\(session\.state\.status === "done" \? "clear" : "correct"\);/);
    assert.ok(!/startBgm/.test(check));
    assert.ok(!/startBgm/.test(body("startCheckSession")));
  });

  it("タブが見えない間は、音も止める(visibilitychange で setHidden)", () => {
    assert.match(
      main,
      /document\.addEventListener\("visibilitychange", \(\) => sound\.setHidden\(document\.hidden\)\);/,
    );
  });
});

describe("音は、端末の中だけで作る(外部の音・通信は、なし)", () => {
  it("HTML・JS に、音のファイル(mp3・wav など)・audio 要素・外部のスクリプトの参照がない", () => {
    for (const source of [html, main, view]) {
      assert.ok(!/<audio\b|<source\b/i.test(source));
      assert.ok(!/\.(mp3|wav|ogg|m4a|aac|flac)\b/i.test(source));
    }
  });

  it("音の設定は、ゲームの設定のキー(記録とは別)に保存される", () => {
    const storage = read("public/assets/js/games/escape-boss/storage.js");
    assert.match(storage, /DATA_VERSION = \d+/);
    const settings = read("public/assets/js/games/escape-boss/settings.js");
    assert.match(settings, /nolito:escape-boss:settings:v1/);
  });
});

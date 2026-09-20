import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChord } from "../public/assets/js/tools/kii-michi/keys.js";
import {
  addApp,
  addOperation,
  addRoute,
  addStep,
  initialData,
  removeOperation,
  setOs,
} from "../public/assets/js/tools/kii-michi/model.js";
import {
  METHODS,
  classifyKeys,
  currentStep,
  markSelfCheck,
  pressChord,
  reveal,
  selfAnswer,
  skip,
  startSession,
  summarize,
} from "../public/assets/js/tools/kii-michi/practice.js";

const chord = (text) => parseChord(text).chord;
const ok = (result) => {
  assert.equal(result.ok, true, result.message);
  return result;
};

// ブラウザ(Ctrl+L・Ctrl+T)・エディタ(Ctrl+K Ctrl+C・Ctrl+S・Esc・Tab)のルート。手順は 6 つ
function sample() {
  let n = 0;
  const id = (prefix) => `${prefix}${++n}`;
  let data = initialData();
  data = ok(addApp(data, "ブラウザ", id)).data;
  data = ok(addApp(data, "エディタ", id)).data;
  const op = (appId, name, keysText, note = "") => {
    const r = ok(addOperation(data, { appId, name, keysText, note }, id));
    data = r.data;
    return r.id;
  };
  const address = op("a1", "アドレスバー", "Ctrl+L", "検索の言葉も入力");
  const newTab = op("a1", "新しいタブ", "Ctrl+T");
  const comment = op("a2", "コメント", "Ctrl+K Ctrl+C");
  const save = op("a2", "保存", "Ctrl+S");
  const esc = op("a2", "閉じる", "Esc");
  const tab = op("a2", "次の項目", "Tab");
  const route = ok(addRoute(data, { name: "調べもの", note: "" }, id));
  data = route.data;
  for (const step of [address, newTab, comment, save, esc, tab])
    data = ok(addStep(data, route.id, step)).data;
  return { data, routeId: route.id };
}
const start = (options = {}) => {
  const { data, routeId } = sample();
  return ok(startSession(data, routeId, options)).session;
};
const press = (session, text) => pressChord(session, chord(text));

describe("手順の答え方の分類", () => {
  it("ふつうのキーは、押して判定する", () => {
    for (const text of [
      "Ctrl+L",
      "Ctrl+S",
      "Esc",
      "F5",
      "Ctrl+Shift+P",
      "Ctrl+,",
      "A",
      "Ctrl+K Ctrl+C",
    ]) {
      const keys = text.split(" ").map(chord);
      assert.deepEqual(
        classifyKeys(keys, "windows", "press"),
        { mode: "press", selfReason: null },
        text,
      );
    }
  });

  it("ブラウザ・OS が先に処理するキーを含む手順は、自己確認(reserved)。順に押す列の途中にあっても", () => {
    for (const text of [
      "Ctrl+T",
      "Ctrl+W",
      "Ctrl+N",
      "Alt+F4",
      "Alt+Tab",
      "Win+D",
      "Ctrl+1",
      "Ctrl+K Ctrl+W",
    ]) {
      const keys = text.split(" ").map(chord);
      assert.deepEqual(
        classifyKeys(keys, "windows", "press"),
        { mode: "self", selfReason: "reserved" },
        text,
      );
    }
  });

  it("Ctrl・Alt・Win なしの Tab・Shift+Tab は、自己確認(tab)。移動に使うため、判定しない", () => {
    for (const text of ["Tab", "Shift+Tab"]) {
      assert.deepEqual(
        classifyKeys([chord(text)], "windows", "press"),
        { mode: "self", selfReason: "tab" },
        text,
      );
    }
    assert.deepEqual(
      classifyKeys([chord("Ctrl+K"), chord("Tab")], "windows", "press").selfReason,
      "tab",
    );
  });

  it("OS で、先に処理されるキーが違う(Mac の Command+Q・Windows の Ctrl+W)", () => {
    assert.equal(classifyKeys([chord("Command+Q")], "mac", "press").selfReason, "reserved");
    assert.equal(classifyKeys([chord("Ctrl+W")], "mac", "press").mode, "press");
    assert.equal(classifyKeys([chord("Command+C")], "mac", "press").mode, "press");
  });

  it("練習の方法が自己確認なら、すべて自己確認(method)", () => {
    assert.deepEqual(classifyKeys([chord("Ctrl+L")], "windows", "self"), {
      mode: "self",
      selfReason: "method",
    });
  });
});

describe("練習の開始", () => {
  it("ルートの手順を写して、最初の手順から始める。キーは、OS の表記になる", () => {
    const { data, routeId } = sample();
    const { session } = ok(startSession(data, routeId));
    assert.equal(session.status, "running");
    assert.equal(session.routeName, "調べもの");
    assert.equal(session.index, 0);
    assert.deepEqual(
      session.steps.map((s) => s.name),
      ["アドレスバー", "新しいタブ", "コメント", "保存", "閉じる", "次の項目"],
    );
    assert.deepEqual(
      session.steps.map((s) => s.mode),
      ["press", "self", "press", "press", "press", "self"],
    );
    assert.deepEqual(
      session.steps.map((s) => s.selfReason),
      [null, "reserved", null, null, null, "tab"],
    );
    assert.equal(session.steps[2].keysText, "Ctrl+K → Ctrl+C");
    assert.equal(session.steps[0].appName, "ブラウザ");
    assert.equal(session.steps[0].note, "検索の言葉も入力");
    const mac = ok(startSession(ok(setOs(data, "mac")).data, routeId, { os: "mac" })).session;
    assert.equal(mac.steps[2].keysText, "Control+K → Control+C");
  });

  it("答えは、最初は隠す。「キーを最初から表示」なら、押して判定する手順だけ、最初から出る", () => {
    assert.equal(start().revealed, false);
    const shown = start({ showKeys: true });
    assert.equal(shown.revealed, true);
    assert.equal(shown.steps[0].hinted, false, "最初から表示は、ヒントを使ったことにならない");
    // 自己確認の手順は、最初から表示しない(答えを隠したままにする)
    const selfFirst = ok(
      startSession(
        ...(() => {
          const { data, routeId } = sample();
          return [data, routeId, { showKeys: true, method: "self" }];
        })(),
      ),
    ).session;
    assert.equal(selfFirst.revealed, false);
  });

  it("失敗: 存在しないルート・手順のないルート・不正な方法", () => {
    const { data, routeId } = sample();
    assert.equal(startSession(data, "nope").error, "route-not-found");
    const empty = ok(addRoute(data, { name: "空", note: "" })).data;
    assert.equal(startSession(empty, empty.routes[1].id).error, "route-empty");
    assert.equal(startSession(data, routeId, { method: "shuffle" }).error, "method-invalid");
    for (const result of [startSession(data, "nope"), startSession(empty, empty.routes[1].id)]) {
      assert.ok(result.message.length > 0);
    }
    assert.deepEqual(METHODS, ["press", "self"]);
  });

  it("練習は、開始時の写しで進む。あとで、操作を消しても、練習は変わらない", () => {
    const { data, routeId } = sample();
    const { session } = ok(startSession(data, routeId));
    const after = ok(removeOperation(data, data.operations[0].id)).data;
    assert.equal(after.routes[0].steps.length, 5);
    assert.equal(session.steps.length, 6);
    assert.equal(session.steps[0].name, "アドレスバー");
  });
});

describe("キーを押した判定", () => {
  it("合っていれば、次の手順へ進む。元の session は変わらない", () => {
    const session = start();
    const before = JSON.stringify(session);
    const { session: next, outcome } = press(session, "Ctrl+L");
    assert.equal(outcome, "step-done");
    assert.equal(next.index, 1);
    assert.equal(next.steps[0].result, "ok");
    assert.equal(next.steps[0].misses, 0);
    assert.equal(next.last.type, "step-done");
    assert.equal(JSON.stringify(session), before);
  });

  it("違えば、間違いを数える(手順は進まない)。何度でも、やり直せる", () => {
    let session = start();
    for (const wrong of ["Ctrl+K", "Ctrl+Shift+L", "L", "Alt+L"]) {
      const result = press(session, wrong);
      assert.equal(result.outcome, "miss", wrong);
      assert.equal(result.session.index, 0);
      session = result.session;
    }
    assert.equal(session.steps[0].misses, 4);
    assert.equal(session.last.type, "miss");
    assert.deepEqual(session.last.pressed, chord("Alt+L"));
    const done = press(session, "Ctrl+L");
    assert.equal(done.outcome, "step-done");
    assert.equal(done.session.steps[0].misses, 4);
  });

  it("修飾キーが多くても少なくても、違う(Shift の有無なども区別する)", () => {
    const session = start();
    for (const wrong of ["Ctrl+Shift+L", "L", "Ctrl+Alt+L"])
      assert.equal(press(session, wrong).outcome, "miss", wrong);
  });

  it("順に押す列: 途中まで合えば partial。最後まで合えば、手順が終わる", () => {
    let session = press(start(), "Ctrl+L").session;
    session = skip(session); // 新しいタブ(自己確認)を飛ばす
    assert.equal(currentStep(session).name, "コメント");
    const first = press(session, "Ctrl+K");
    assert.equal(first.outcome, "partial");
    assert.equal(first.session.progress, 1);
    assert.equal(first.session.index, 2);
    const second = press(first.session, "Ctrl+C");
    assert.equal(second.outcome, "step-done");
    assert.equal(second.session.index, 3);
    assert.equal(second.session.progress, 0);
  });

  it("順に押す途中で違うキーなら、間違いを数えて、最初からやり直す", () => {
    let session = skip(press(start(), "Ctrl+L").session);
    session = press(session, "Ctrl+K").session;
    const miss = press(session, "Ctrl+X");
    assert.equal(miss.outcome, "miss");
    assert.equal(miss.session.progress, 0);
    assert.equal(miss.session.steps[2].misses, 1);
  });

  it("途中で、最初のキーをもう一度押したら、そこから数え直す(2つ目とは違うため、間違いにはなる)", () => {
    let session = skip(press(start(), "Ctrl+L").session);
    session = press(session, "Ctrl+K").session;
    const again = press(session, "Ctrl+K");
    assert.equal(again.outcome, "miss");
    assert.equal(again.session.progress, 1);
    assert.equal(press(again.session, "Ctrl+C").outcome, "step-done");
  });

  it("最後の手順が合うと、finished になる。以後は、判定しない(ignored)", () => {
    let session = start({ method: "press" });
    session = press(session, "Ctrl+L").session;
    session = skip(session);
    session = press(press(session, "Ctrl+K").session, "Ctrl+C").session;
    session = press(session, "Ctrl+S").session;
    session = press(session, "Esc").session;
    assert.equal(currentStep(session).name, "次の項目");
    const last = selfAnswer(session, true);
    assert.equal(last.status, "finished");
    assert.equal(currentStep(last), null);
    assert.equal(pressChord(last, chord("Ctrl+L")).outcome, "ignored");
    assert.equal(pressChord(last, chord("Ctrl+L")).session, last);
  });

  it("最後の手順が「キーを押して」合ったときの outcome は finished", () => {
    const { data, routeId } = sample();
    const one = ok(addRoute(data, { name: "1手順", note: "" })).data;
    const routeId2 = one.routes[1].id;
    const withStep = ok(addStep(one, routeId2, one.operations[3].id)).data;
    const { session } = ok(startSession(withStep, routeId2));
    const result = press(session, "Ctrl+S");
    assert.equal(result.outcome, "finished");
    assert.equal(result.session.status, "finished");
    assert.equal(routeId.length > 0, true);
  });

  it("自己確認の手順では、キーを押しても、判定しない(ignored)", () => {
    const session = press(start(), "Ctrl+L").session;
    assert.equal(currentStep(session).mode, "self");
    const result = press(session, "Ctrl+T");
    assert.equal(result.outcome, "ignored");
    assert.equal(result.session, session);
    assert.equal(currentStep(session).misses, 0);
  });
});

describe("ヒント・スキップ・自己確認", () => {
  it("ヒント: 答えを表示して、ヒントを使ったと数える。2回押しても、変わらない", () => {
    const session = start();
    const hinted = reveal(session);
    assert.equal(hinted.revealed, true);
    assert.equal(hinted.steps[0].hinted, true);
    assert.equal(reveal(hinted), hinted);
    assert.equal(session.revealed, false);
    const next = press(hinted, "Ctrl+L").session;
    assert.equal(next.revealed, false, "次の手順では、また隠す");
    assert.equal(next.steps[0].hinted, true);
  });

  it("スキップ: 結果は skipped。次へ進む", () => {
    const skipped = skip(start());
    assert.equal(skipped.steps[0].result, "skipped");
    assert.equal(skipped.index, 1);
    assert.equal(skipped.last.type, "skipped");
    assert.equal(skipped.steps[0].misses, 0);
  });

  it("スキップを続けると、練習が終わる。終わったあとは、何も変わらない", () => {
    let session = start();
    for (let i = 0; i < 6; i += 1) session = skip(session);
    assert.equal(session.status, "finished");
    assert.equal(skip(session), session);
    assert.equal(reveal(session), session);
    assert.equal(markSelfCheck(session), session);
    assert.equal(selfAnswer(session, true), session);
  });

  it("自己確認: 答えを見ずに「できた」は clean。見てから「できた」は、答えを見たと数える", () => {
    let session = press(start(), "Ctrl+L").session;
    const direct = selfAnswer(session, true);
    assert.equal(direct.steps[1].result, "self-ok");
    assert.equal(direct.steps[1].hinted, false);
    const seen = selfAnswer(reveal(session), true);
    assert.equal(seen.steps[1].result, "self-ok");
    assert.equal(seen.steps[1].hinted, true);
    assert.equal(selfAnswer(session, false).steps[1].result, "self-ng");
  });

  it("自己確認の答えを見ることは、自己確認の手順では、ヒントとして数えない(答えを見たことは、答えるときに記録する)", () => {
    const session = press(start(), "Ctrl+L").session;
    const revealed = reveal(session);
    assert.equal(revealed.revealed, true);
    assert.equal(revealed.steps[1].hinted, false);
  });

  it("キーを押して判定する手順に、自己確認の答え方はできない(何も変わらない)", () => {
    const session = start();
    assert.equal(selfAnswer(session, true), session);
  });

  it("「押しても反応しない」: その手順だけ、自己確認(marked)になる。押した進み具合は戻る", () => {
    let session = skip(press(start(), "Ctrl+L").session);
    session = press(session, "Ctrl+K").session;
    assert.equal(session.progress, 1);
    const marked = markSelfCheck(session);
    assert.equal(marked.steps[2].mode, "self");
    assert.equal(marked.steps[2].selfReason, "marked");
    assert.equal(marked.progress, 0);
    assert.equal(marked.revealed, false);
    assert.equal(marked.steps[3].mode, "press", "ほかの手順は、変わらない");
    assert.equal(press(marked, "Ctrl+C").outcome, "ignored");
    assert.equal(markSelfCheck(marked), marked, "すでに自己確認なら、何も変わらない");
  });

  it("ヒントを使ってから、自己確認にしても、ヒントの記録は残る", () => {
    const session = start();
    const marked = markSelfCheck(reveal(session));
    assert.equal(marked.steps[0].hinted, true);
    assert.equal(marked.revealed, false);
  });

  it("練習の方法が自己確認なら、すべての手順が自己確認(押しても判定しない)", () => {
    const session = start({ method: "self" });
    assert.ok(session.steps.every((step) => step.mode === "self" && step.selfReason === "method"));
    assert.equal(press(session, "Ctrl+L").outcome, "ignored");
  });
});

describe("結果の集計", () => {
  it("できた・自己確認・スキップ・間違い・ヒント・clean を数える", () => {
    let session = start();
    session = press(session, "Ctrl+X").session; // 間違い1(アドレスバー)
    session = press(session, "Ctrl+L").session; // ok(間違いあり)
    session = selfAnswer(session, true); // 新しいタブ: self-ok(clean)
    session = press(reveal(session), "Ctrl+K").session; // コメント(ヒントあり)
    session = press(session, "Ctrl+C").session; // ok(ヒントあり)
    session = press(session, "Ctrl+S").session; // ok(clean)
    session = skip(session); // 閉じる: skipped
    session = selfAnswer(reveal(session), false); // 次の項目: self-ng(答えを見た)
    assert.equal(session.status, "finished");
    const result = summarize(session);
    assert.deepEqual(
      {
        total: result.total,
        ok: result.ok,
        selfOk: result.selfOk,
        selfNg: result.selfNg,
        skipped: result.skipped,
        misses: result.misses,
        hints: result.hints,
        clean: result.clean,
      },
      { total: 6, ok: 3, selfOk: 1, selfNg: 1, skipped: 1, misses: 1, hints: 2, clean: 2 },
    );
    assert.deepEqual(
      result.steps.map((s) => s.result),
      ["ok", "self-ok", "ok", "ok", "skipped", "self-ng"],
    );
    assert.deepEqual(
      result.steps.map((s) => s.misses),
      [1, 0, 0, 0, 0, 0],
    );
    assert.equal(result.steps[1].selfReason, "reserved");
    assert.equal(result.steps[2].keysText, "Ctrl+K → Ctrl+C");
  });

  it("途中でも集計できる(まだ結果のない手順は、result が null)", () => {
    const result = summarize(press(start(), "Ctrl+L").session);
    assert.equal(result.ok, 1);
    assert.equal(result.steps[1].result, null);
  });
});

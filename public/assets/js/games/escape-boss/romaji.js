// ひらがな(カタカナも可)の「読み」から、ローマ字入力の受理判定を行う。DOM に依存しない純粋なロジック。
// 複数の表記(し=si/shi、ん=n/nn、っ=子音の重ね、拗音=sha/sya など)を自動で許容する。

// "かな=表記1,表記2" の形式。表記の先頭が標準の(画面に表示する)表記。
const BASIC_ROWS = `
あ=a い=i う=u え=e お=o
か=ka き=ki く=ku け=ke こ=ko
さ=sa し=shi,si す=su せ=se そ=so
た=ta ち=chi,ti つ=tsu,tu て=te と=to
な=na に=ni ぬ=nu ね=ne の=no
は=ha ひ=hi ふ=fu,hu へ=he ほ=ho
ま=ma み=mi む=mu め=me も=mo
や=ya ゆ=yu よ=yo
ら=ra り=ri る=ru れ=re ろ=ro
わ=wa を=wo
が=ga ぎ=gi ぐ=gu げ=ge ご=go
ざ=za じ=ji,zi ず=zu ぜ=ze ぞ=zo
だ=da ぢ=di づ=du で=de ど=do
ば=ba び=bi ぶ=bu べ=be ぼ=bo
ぱ=pa ぴ=pi ぷ=pu ぺ=pe ぽ=po
ゔ=vu
ぁ=xa,la ぃ=xi,li ぅ=xu,lu ぇ=xe,le ぉ=xo,lo
ゃ=xya,lya ゅ=xyu,lyu ょ=xyo,lyo ゎ=xwa,lwa
ー=-
`;

// 拗音(きゃ、しゅ など)。「かな」+ ゃゅょ で、子音部分 + 母音になる。
const YOON_ROWS = `
き=ky ぎ=gy し=sh,sy じ=j,zy,jy ち=ch,ty,cy ぢ=dy
に=ny ひ=hy び=by ぴ=py み=my り=ry
`;
const SMALL_Y = { ゃ: "a", ゅ: "u", ょ: "o" };

// 外来音など、2文字で1つの入力になるもの
const COMBO_ROWS = `
しぇ=she,sye じぇ=je,zye,jye ちぇ=che,tye,cye
ふぁ=fa ふぃ=fi ふぇ=fe ふぉ=fo
てぃ=thi でぃ=dhi うぃ=wi うぇ=we
`;

function parseRows(rows) {
  const table = new Map();
  for (const entry of rows.split(/\s+/).filter(Boolean)) {
    const [kana, alts] = entry.split("=");
    table.set(kana, alts.split(","));
  }
  return table;
}

const BASIC = parseRows(BASIC_ROWS);
const YOON = parseRows(YOON_ROWS);
const COMBO = parseRows(COMBO_ROWS);

const toHiragana = (text) =>
  text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 読みを「かな単位」に分ける。っ・ん は後段で前後の文字を見て解決する。
function tokenize(reading) {
  const chars = [...toHiragana(reading).replace(/\s+/g, "")];
  const tokens = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const pair = ch + (chars[i + 1] ?? "");
    if (ch === "っ") {
      tokens.push({ type: "sokuon" });
    } else if (ch === "ん") {
      tokens.push({ type: "n" });
    } else if (COMBO.has(pair)) {
      tokens.push({ type: "kana", alts: COMBO.get(pair) });
      i++;
    } else if (YOON.has(ch) && chars[i + 1] in SMALL_Y) {
      const vowel = SMALL_Y[chars[i + 1]];
      tokens.push({ type: "kana", alts: YOON.get(ch).map((consonant) => consonant + vowel) });
      i++;
    } else if (BASIC.has(ch)) {
      tokens.push({ type: "kana", alts: BASIC.get(ch) });
    } else {
      throw new Error(`ローマ字に変換できない文字です: "${ch}" (読み: ${reading})`);
    }
  }
  return tokens;
}

// ん: 次が母音・や行のときは "nn" が必須(n だけだと次の文字と混ざるため)。語末も "nn" とする。
// な行の前は "n" でよい(n + ni = nni。こんにちは = konnichiha)。
function nAlternatives(next) {
  if (!next) return ["nn", "xn"];
  const mustDouble = next.alts.some((alt) => "aiueoy".includes(alt[0]));
  return mustDouble ? ["nn", "xn"] : ["n", "nn", "xn"];
}

// っ: 次の文字の子音を重ねる(kka)。ち系は tcha も可。x/l 付きの表記も許容する。
function sokuonAlternatives(nextAlts) {
  const alts = [];
  for (const alt of nextAlts) {
    if (/[bcdfghjklmpqrstvwyz]/.test(alt[0])) alts.push(alt[0] + alt);
    if (alt.startsWith("ch")) alts.push("t" + alt);
  }
  for (const alt of nextAlts) alts.push("xtu" + alt, "ltu" + alt, "xtsu" + alt);
  return [...new Set(alts)];
}

// 後ろから解決する(っ・ん は「次の単位」に依存するため)
function resolve(tokens) {
  const reversed = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    const next = reversed[reversed.length - 1];
    if (token.type === "kana") {
      reversed.push({ alts: token.alts, kana: true });
    } else if (token.type === "n") {
      reversed.push({ alts: nAlternatives(next) });
    } else if (next?.kana) {
      reversed.pop();
      reversed.push({ alts: sokuonAlternatives(next.alts), kana: true });
    } else {
      reversed.push({ alts: ["xtu", "ltu", "xtsu"] });
    }
  }
  return reversed.reverse();
}

/**
 * 読みからマッチャーを作る。
 * input(char) は "ok"(途中まで正しい) / "miss"(不一致。状態は変わらない) / "done"(打ち終わり) を返す。
 */
export function createMatcher(reading) {
  const units = resolve(tokenize(reading));
  if (units.length === 0) throw new Error("読みが空です");

  const canonical = units.map((unit) => unit.alts[0]).join("");
  // 状態は「何番目の単位で、その単位を何文字まで打ったか」の集合(複数の表記が同時に生きているため)
  let states = [{ unit: 0, typed: "" }];
  let typed = "";
  let done = false;

  return {
    canonical,
    canonicalLength: canonical.length,
    get typed() {
      return typed;
    },
    get done() {
      return done;
    },
    // 画面に出す「残りの入力」。生きている表記のうち先頭のものを使う
    get remaining() {
      const state = states[0];
      if (done || !state) return "";
      const alt = units[state.unit].alts.find((a) => a.startsWith(state.typed));
      const rest = units.slice(state.unit + 1).map((unit) => unit.alts[0]);
      return alt.slice(state.typed.length) + rest.join("");
    },
    input(rawChar) {
      if (done) return "done";
      const char = rawChar.toLowerCase();
      const next = [];
      const seen = new Set();
      const add = (unit, typedInUnit) => {
        const key = `${unit}:${typedInUnit}`;
        if (seen.has(key)) return;
        seen.add(key);
        next.push({ unit, typed: typedInUnit });
      };

      for (const state of states) {
        const candidate = state.typed + char;
        const matches = units[state.unit].alts.filter((alt) => alt.startsWith(candidate));
        if (matches.length === 0) continue;
        // まだ続きがある表記があれば、その単位に留まる
        if (matches.some((alt) => alt.length > candidate.length)) add(state.unit, candidate);
        // ちょうど打ち終わった表記があれば、次の単位へ進む
        if (matches.includes(candidate)) add(state.unit + 1, "");
      }

      if (next.length === 0) return "miss";
      states = next;
      typed += char;
      done = states.some((state) => state.unit === units.length);
      return done ? "done" : "ok";
    },
  };
}

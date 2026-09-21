// 語録の原稿の検証と、正規化。ファイルの読み書きも、画面もない純粋な処理。
// 開発者・AI が書いた Markdown を、公開の前に検証する。将来の管理画面も、同じ検証を使う(Phase 26)。
// 問題は、見つけたものを、すべて集めて返す(1 つ目で止めない)。
import { createMatcher } from "../../public/assets/js/games/escape-boss/romaji.js";

// 項目の名前。公開の JSON に入るものと、原稿だけのもの(review・draft・note)。
// detail(難語の詳細説明)は、あるときだけ公開の JSON に入る(ない語には、項目を作らない)
export const PUBLISHED_KEYS = [
  "id",
  "japanese",
  "reading",
  "romaji",
  "category",
  "difficulty",
  "roles",
  "explanation",
  "detail",
  "related_terms",
  "learning_points",
  "weak_detection",
];
const MANUSCRIPT_KEYS = ["review", "draft", "note"];
const REQUIRED_KEYS = [
  "id",
  "japanese",
  "reading",
  "category",
  "difficulty",
  "roles",
  "explanation",
];
const META_KEYS = ["job_id", "job_name", "version", "updated_at", "items"];

/** 人間の確認の状況。pending = まだ、confirmed = 済み。 */
export const REVIEW_STATES = ["pending", "confirmed"];

export const LIMITS = {
  japanese: 30,
  reading: 40,
  category: 20,
  explanation: 80,
  detail: 300,
  romajiCandidates: 8,
  romajiLength: 60,
  relatedTerms: 10,
  learningPoints: 5,
  learningPointLength: 60,
  note: 200,
};
export const DIFFICULTY_RANGE = [1, 5];

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const READING_PATTERN = /^[ぁ-ゖー]+$/;
const ROMAJI_PATTERN = /^[a-z-]+$/;
// 制御文字・書式文字(向きを変える文字・幅のない文字など)は、どの文字列にも入れない
const HIDDEN = /\p{Cc}|\p{Cf}|\p{Zl}|\p{Zp}/u;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string";
const length = (text) => Array.from(text).length;

export function isValidDate(text) {
  if (!isText(text) || !DATE_PATTERN.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** 読みから作る、ローマ字の候補: 標準の表記と、訓令式で表示する表記(違うときだけ)。 */
export function generateRomaji(reading) {
  const standard = createMatcher(reading).canonical;
  const kunrei = createMatcher(reading, { style: "kunrei" }).canonical;
  return kunrei === standard ? [standard] : [standard, kunrei];
}

// 打ち込んだとき、ちょうど最後の 1 打で、入力し終わるか(途中で間違えない・余分な文字が続かない)
function typesFully(reading, romaji) {
  const matcher = createMatcher(reading);
  for (const char of romaji) {
    if (matcher.done) return false;
    if (matcher.input(char) === "miss") return false;
  }
  return matcher.done;
}

/**
 * 1 つの職種の原稿(YAML を読み取ったオブジェクト)を検証して、正規化する。
 * context: { jobs: [{ id, name }], roleIds: Set|Array }
 * 戻り値: { errors: [文字列], data }。data は、正規化した語録(errors があるときは、信用しない)。
 *   data.items の項目は、公開の項目に、review(既定 pending)・draft(既定 false)・note(なければ省略)を加えた形。
 */
export function validateVocabulary(raw, context) {
  const errors = [];
  const roleIds = new Set(context.roleIds);
  const problem = (where, message) => errors.push(`${where}: ${message}`);

  if (!isObject(raw)) return { errors: ["語録は、項目名と値の組で書いてください"], data: null };

  // ---- 職種の情報 ----
  for (const key of Object.keys(raw)) {
    if (!META_KEYS.includes(key)) problem("職種", `未知の項目 "${key}" があります`);
  }
  for (const key of META_KEYS) if (!(key in raw)) problem("職種", `${key} は必須です`);
  const job = isText(raw.job_id)
    ? context.jobs.find((entry) => entry.id === raw.job_id)
    : undefined;
  if (!isText(raw.job_id) || !ID_PATTERN.test(raw.job_id)) {
    problem("職種", "job_id は、英小文字・数字・ハイフンの文字列にしてください");
  } else if (!job) {
    problem("職種", `job_id "${raw.job_id}" は、jobs.json にありません`);
  }
  if (!isText(raw.job_name) || raw.job_name.trim() === "") {
    problem("職種", "job_name は、空でない文字列にしてください");
  } else if (job && job.name !== raw.job_name) {
    problem("職種", `job_name "${raw.job_name}" が、jobs.json の名前 "${job.name}" と違います`);
  }
  if (!isText(raw.version) || !VERSION_PATTERN.test(raw.version)) {
    problem("職種", "version は、1.2.3 の形の文字列にしてください");
  }
  if (!isValidDate(raw.updated_at)) {
    problem("職種", "updated_at は、実在する日付(YYYY-MM-DD)の文字列にしてください");
  }
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    problem("職種", "items は、語の一覧(1 語以上)にしてください");
    return { errors, data: null };
  }

  // ---- 語 ----
  const jobId = isText(raw.job_id) ? raw.job_id : "";
  const items = [];
  const seen = { id: new Map(), japanese: new Map(), reading: new Map() };

  raw.items.forEach((item, index) => {
    const label = isObject(item) && isText(item.id) ? `${item.id}` : `items[${index}]`;
    const where = isObject(item) && isText(item.japanese) ? `${label}(${item.japanese})` : label;
    if (!isObject(item)) return problem(label, "語は、項目名と値の組で書いてください");

    for (const key of Object.keys(item)) {
      if (![...PUBLISHED_KEYS, ...MANUSCRIPT_KEYS].includes(key))
        problem(where, `未知の項目 "${key}" があります`);
    }
    for (const key of REQUIRED_KEYS) if (!(key in item)) problem(where, `${key} は必須です`);

    // 文字列の項目(空・長さ・見えない文字)
    const text = (key, max) => {
      const value = item[key];
      if (!(key in item)) return undefined;
      if (!isText(value))
        return void problem(
          where,
          `${key} は、文字列にしてください(数字だけの語は、"" で囲みます)`,
        );
      if (value.trim() === "" || value !== value.trim()) {
        return void problem(where, `${key} は、空でなく、前後に空白のない文字列にしてください`);
      }
      if (HIDDEN.test(value))
        return void problem(where, `${key} に、制御文字・見えない文字が入っています`);
      if (max && length(value) > max)
        return void problem(where, `${key} は ${max} 文字までです(${length(value)} 文字)`);
      return value;
    };

    // id
    const id = text("id", 40);
    if (id !== undefined) {
      if (!ID_PATTERN.test(id) || !new RegExp(`^${jobId}-\\d{3}$`).test(id)) {
        problem(where, `id は ${jobId}-001 の形(職種の id + - + 3 桁の数字)にしてください`);
      }
      if (seen.id.has(id)) problem(where, `id が重複しています(${seen.id.get(id)} 番目の語と同じ)`);
      seen.id.set(id, index + 1);
    }

    // 日本語・読み
    const japanese = text("japanese", LIMITS.japanese);
    if (japanese !== undefined) {
      if (/\s/.test(japanese)) problem(where, "japanese に、空白を入れないでください");
      if (seen.japanese.has(japanese))
        problem(
          where,
          `日本語の表記が重複しています(${seen.japanese.get(japanese)} 番目の語と同じ)`,
        );
      seen.japanese.set(japanese, index + 1);
    }
    const reading = text("reading", LIMITS.reading);
    let readable = false;
    if (reading !== undefined) {
      if (!READING_PATTERN.test(reading)) {
        problem(where, "reading は、ひらがなと長音(ー)だけにしてください");
      } else {
        try {
          createMatcher(reading);
          readable = true;
        } catch {
          problem(where, "reading を、ローマ字入力に直せません");
        }
      }
      if (seen.reading.has(reading))
        problem(where, `読みが重複しています(${seen.reading.get(reading)} 番目の語と同じ)`);
      seen.reading.set(reading, index + 1);
    }

    // ローマ字(省略すると、読みから作る)
    let romaji = null;
    if ("romaji" in item) {
      const list = item.romaji;
      if (!Array.isArray(list) || list.length === 0 || list.length > LIMITS.romajiCandidates) {
        problem(
          where,
          `romaji は、候補の一覧(1〜${LIMITS.romajiCandidates} 個)にしてください。書かなければ、読みから作ります`,
        );
      } else if (
        !list.every(
          (candidate) =>
            isText(candidate) &&
            ROMAJI_PATTERN.test(candidate) &&
            candidate.length <= LIMITS.romajiLength,
        )
      ) {
        problem(where, "romaji の候補は、英小文字と - だけの文字列にしてください");
      } else if (new Set(list).size !== list.length) {
        problem(where, "romaji の候補が重複しています");
      } else {
        romaji = list;
        if (readable) {
          const canonical = createMatcher(reading).canonical;
          if (list[0] !== canonical)
            problem(
              where,
              `romaji の先頭(画面に表示する書き方)は、${canonical} にしてください(${list[0]})`,
            );
          for (const candidate of list) {
            if (!typesFully(reading, candidate))
              problem(
                where,
                `romaji "${candidate}" は、読み "${reading}" の書き方として、入力できません`,
              );
          }
        }
      }
    } else if (readable) {
      romaji = generateRomaji(reading);
    }

    const category = text("category", LIMITS.category);

    // 難易度
    if ("difficulty" in item) {
      const value = item.difficulty;
      if (!Number.isInteger(value) || value < DIFFICULTY_RANGE[0] || value > DIFFICULTY_RANGE[1]) {
        problem(
          where,
          `difficulty は、${DIFFICULTY_RANGE[0]}〜${DIFFICULTY_RANGE[1]} の整数にしてください`,
        );
      }
    }

    // 役職
    if ("roles" in item) {
      const roles = item.roles;
      if (!Array.isArray(roles) || roles.length === 0) {
        problem(where, "roles は、役職 id の一覧(1 つ以上)にしてください");
      } else {
        for (const role of roles)
          if (!isText(role) || !roleIds.has(role))
            problem(where, `roles に、知らない役職 "${String(role)}" があります`);
        if (new Set(roles).size !== roles.length)
          problem(where, "roles に、同じ役職が重複しています");
      }
    }

    // 説明(短文)
    const explanation = text("explanation", LIMITS.explanation);
    if (explanation !== undefined) {
      if (!explanation.endsWith("。"))
        problem(where, "explanation は、「。」で終わる短文にしてください");
      if (explanation.includes("\n")) problem(where, "explanation は、1 行にしてください");
    }

    // 詳細説明(難語のための、少し長い説明。省略できる。ある語だけ、項目を持つ)
    let detail;
    if ("detail" in item) {
      detail = text("detail", LIMITS.detail);
      if (detail !== undefined && !detail.endsWith("。")) {
        problem(where, "detail は、「。」で終わる文章にしてください");
      }
    }

    // 関連用語・学習ポイント(省略すると、空)
    const strings = (key, { max, itemMax }) => {
      if (!(key in item)) return [];
      const list = item[key];
      if (!Array.isArray(list) || list.length > max) {
        problem(where, `${key} は、文字列の一覧(${max} 個まで)にしてください`);
        return [];
      }
      for (const entry of list) {
        if (
          !isText(entry) ||
          entry.trim() === "" ||
          HIDDEN.test(entry) ||
          (itemMax && length(entry) > itemMax)
        ) {
          problem(
            where,
            `${key} の中身は、空でない文字列${itemMax ? `(${itemMax} 文字まで)` : ""}にしてください`,
          );
          return [];
        }
      }
      if (new Set(list).size !== list.length) problem(where, `${key} が重複しています`);
      return list;
    };
    const related = strings("related_terms", {
      max: LIMITS.relatedTerms,
      itemMax: LIMITS.japanese,
    });
    const learning = strings("learning_points", {
      max: LIMITS.learningPoints,
      itemMax: LIMITS.learningPointLength,
    });

    // 苦手判定(省略すると、有効)
    let weak = { enabled: true };
    if ("weak_detection" in item) {
      const value = item.weak_detection;
      if (
        !isObject(value) ||
        typeof value.enabled !== "boolean" ||
        Object.keys(value).length !== 1
      ) {
        problem(where, "weak_detection は、enabled: true か false の 1 項目だけにしてください");
      } else {
        weak = { enabled: value.enabled };
      }
    }

    // 原稿だけの項目
    let review = "pending";
    if ("review" in item) {
      if (!REVIEW_STATES.includes(item.review))
        problem(where, `review は ${REVIEW_STATES.join(" か ")} にしてください`);
      else review = item.review;
    }
    let draft = false;
    if ("draft" in item) {
      if (typeof item.draft !== "boolean") problem(where, "draft は、true か false にしてください");
      else draft = item.draft;
    }
    let note;
    if ("note" in item) {
      const value = text("note", LIMITS.note);
      if (value !== undefined) note = value;
    }

    items.push({
      id: item.id,
      japanese: item.japanese,
      reading: item.reading,
      romaji,
      category,
      difficulty: item.difficulty,
      roles: item.roles,
      explanation,
      ...(detail === undefined ? {} : { detail }),
      related_terms: related,
      learning_points: learning,
      weak_detection: weak,
      review,
      draft,
      ...(note === undefined ? {} : { note }),
    });
  });

  // 関連用語は、同じ職種の、ほかの語(日本語)を指す。公開する語は、公開する語だけを指せる(下書きへの参照で、公開の語録が壊れない)
  const byJapanese = new Map(items.map((entry) => [entry.japanese, entry]));
  for (const entry of items) {
    for (const term of entry.related_terms ?? []) {
      const target = byJapanese.get(term);
      const where = `${entry.id}(${entry.japanese})`;
      if (!target) problem(where, `関連用語「${term}」が、同じ職種にありません`);
      else if (target === entry) problem(where, `関連用語「${term}」が、自分自身です`);
      else if (target.draft && !entry.draft)
        problem(where, `関連用語「${term}」は下書きです(公開する語は、公開する語だけを指せます)`);
    }
  }

  const data = {
    job_id: raw.job_id,
    job_name: raw.job_name,
    version: raw.version,
    updated_at: raw.updated_at,
    items,
  };
  return { errors, data };
}

/**
 * すべての職種を通した検査(id・日本語の重複)。files: [{ name, data }](validateVocabulary の data)。
 * 戻り値: [文字列]
 */
export function validateAcross(files) {
  const errors = [];
  const ids = new Map();
  const words = new Map();
  const jobs = new Map();
  for (const { name, data } of files) {
    if (!data) continue;
    if (jobs.has(data.job_id))
      errors.push(`${name}: job_id "${data.job_id}" が、${jobs.get(data.job_id)} と重複しています`);
    jobs.set(data.job_id, name);
    for (const item of data.items) {
      if (ids.has(item.id))
        errors.push(
          `${name}: ${item.id}(${item.japanese}): id が、${ids.get(item.id)} と重複しています`,
        );
      ids.set(item.id, name);
      if (words.has(item.japanese) && words.get(item.japanese) !== name) {
        errors.push(
          `${name}: ${item.id}(${item.japanese}): 日本語の表記が、${words.get(item.japanese)} と重複しています`,
        );
      }
      if (!words.has(item.japanese)) words.set(item.japanese, name);
    }
  }
  return errors;
}

/** 公開の JSON の形(原稿だけの項目・下書きを除く)。 */
export function toPublished(data) {
  return {
    job_id: data.job_id,
    job_name: data.job_name,
    version: data.version,
    updated_at: data.updated_at,
    items: data.items
      .filter((item) => !item.draft)
      .map((item) =>
        Object.fromEntries(
          PUBLISHED_KEYS.filter((key) => key !== "detail" || item.detail !== undefined).map(
            (key) => [key, item[key]],
          ),
        ),
      ),
  };
}

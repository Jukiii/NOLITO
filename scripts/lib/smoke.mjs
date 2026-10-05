// 公開したサイトの簡易チェック(Phase 28)。fetch は引数で受ける(ネットワーク・時計に、直接触れない)。
// 中身は読むだけで、何も送らない・書き換えない。利用者の情報は、扱わない。

const JSON_TYPE = "application/json";
const HTML_TYPE = "text/html";

const hasKey = (data, key) => data !== null && typeof data === "object" && key in data;

export const SLOW_MS = 3000;

// path・status・type(Content-Type に含まれる文字)・header(名前 → 含まれる文字)・
// excludes(本文に含まれてはいけない文字)・json(本文の JSON を検査する関数。true なら合格)
export const SMOKE_CHECKS = Object.freeze([
  {
    path: "/",
    type: HTML_TYPE,
    excludes: ["googletagmanager.com"],
    header: { "x-content-type-options": "nosniff", "x-frame-options": "DENY" },
  },
  { path: "/games/escape-boss/", type: HTML_TYPE, excludes: ["googletagmanager.com"] },
  { path: "/tools/kii-michi/", type: HTML_TYPE },
  { path: "/articles/", type: HTML_TYPE },
  { path: "/updates/", type: HTML_TYPE },
  { path: "/support/", type: HTML_TYPE },
  { path: "/privacy/", type: HTML_TYPE },
  { path: "/terms/", type: HTML_TYPE },
  { path: "/ads-policy/", type: HTML_TYPE },
  { path: "/data/roles.json", type: JSON_TYPE },
  { path: "/api/me", type: JSON_TYPE, json: (data) => hasKey(data, "enabled") },
  {
    path: "/api/products",
    type: JSON_TYPE,
    json: (data) => hasKey(data, "products") && Array.isArray(data.products),
  },
  {
    path: "/api/affiliates",
    type: JSON_TYPE,
    json: (data) => hasKey(data, "links") && Array.isArray(data.links),
  },
  { path: "/favicon.svg", header: { "cache-control": "max-age=86400" } },
  // 存在しないページが、404 で返ること(すべてが 200 になる設定ミスの検出)
  { path: "/__smoke-not-found__/", status: 404 },
]);

export function normalizeBase(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("URL の形が違います。例: https://nolito-jukiii.com");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("https:// の URL を指定してください(手元の確認は localhost だけ)。");
  }
  return url.origin;
}

async function runOne(base, check, fetchFn, now) {
  const problems = [];
  const started = now();
  let response;
  try {
    response = await fetchFn(new URL(check.path, base), { redirect: "manual" });
  } catch (cause) {
    return { path: check.path, ok: false, ms: 0, problems: [`接続できません(${cause.message})`] };
  }
  const ms = now() - started;
  const expected = check.status ?? 200;
  if (response.status !== expected)
    problems.push(`status が ${response.status}(期待: ${expected})`);

  if (response.status === expected && expected === 200) {
    const contentType = response.headers.get("content-type") ?? "";
    if (check.type && !contentType.includes(check.type)) {
      problems.push(`Content-Type が ${contentType || "(なし)"}(期待: ${check.type})`);
    }
    for (const [name, part] of Object.entries(check.header ?? {})) {
      const value = response.headers.get(name) ?? "";
      if (!value.includes(part)) problems.push(`ヘッダー ${name} に ${part} がありません`);
    }
    if (check.excludes || check.json) {
      const text = await response.text();
      for (const part of check.excludes ?? []) {
        if (text.includes(part)) problems.push(`本文に ${part} が含まれています`);
      }
      if (check.json) {
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          problems.push("JSON として読めません");
        }
        if (data !== undefined && !check.json(data)) problems.push("JSON の形が想定と違います");
      }
    }
  }
  return { path: check.path, ok: problems.length === 0, ms, slow: ms > SLOW_MS, problems };
}

/** すべてのチェックを、順に実行する(サーバーへの負荷を、小さくするため、並列にしない)。 */
export async function runSmoke(
  baseUrl,
  { fetchFn = fetch, now = Date.now, checks = SMOKE_CHECKS } = {},
) {
  const base = normalizeBase(baseUrl);
  const results = [];
  for (const check of checks) results.push(await runOne(base, check, fetchFn, now));
  return results;
}

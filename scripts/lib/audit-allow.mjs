// 依存の脆弱性チェックの判定(DOM・ファイル・時計に触れない純粋な計算。時刻は引数)。
// `npm audit --json` の結果から、high 以上の勧告を取り出し、期限つきの除外の一覧と突き合わせる。
export const BLOCKING_SEVERITIES = ["high", "critical"];

// 除外は、修正版がなく、実際の危険がほぼないものだけ。期限を過ぎたら、除外は無効(CI が止まる)。理由は決定ログ 0077。
export const ALLOWED_ADVISORIES = [
  {
    id: "GHSA-vfj7-8cjw-p6xm",
    until: "2026-11-03",
    reason: "braces(stylelint の開発用の依存)。修正版なし。外部の入力を受けない",
  },
];

const ADVISORY_ID = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i;

// via の中の、文字列は「別の依存から広がった」印。勧告そのもの(オブジェクト)だけを数える。
export function collectAdvisories(report) {
  const found = new Map();
  for (const vulnerability of Object.values(report?.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || via === null) continue;
      if (!BLOCKING_SEVERITIES.includes(via.severity)) continue;
      const id = String(via.url ?? "").match(ADVISORY_ID)?.[0] ?? `source-${via.source}`;
      if (!found.has(id)) {
        found.set(id, { id, severity: via.severity, name: via.name, title: via.title });
      }
    }
  }
  return [...found.values()];
}

const isExpired = (entry, now) => now.toISOString().slice(0, 10) > entry.until;

export function evaluateAudit(report, allowed = ALLOWED_ADVISORIES, now = new Date()) {
  const blocking = [];
  const ignored = [];
  const expired = [];
  for (const advisory of collectAdvisories(report)) {
    const entry = allowed.find((item) => item.id.toLowerCase() === advisory.id.toLowerCase());
    if (!entry) blocking.push(advisory);
    else if (isExpired(entry, now)) expired.push({ ...advisory, until: entry.until });
    else ignored.push({ ...advisory, until: entry.until, reason: entry.reason });
  }
  return { blocking, ignored, expired, ok: blocking.length === 0 && expired.length === 0 };
}

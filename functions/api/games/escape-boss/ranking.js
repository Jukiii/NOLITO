// GET/POST /api/games/escape-boss/ranking — オンラインランキング(Phase 19 PR 3。任意)。
// GET: ログイン不要(だれでも見られる)。?role=<役職id>&difficulty=<難易度id> → { entries: [...] }
// POST: ログイン + 参加設定(ranking_opt_in)が有効な人だけ。body は { roleId, difficultyId, jobId,
// nickname, title, score }(ゲームのクリア時に、main.js が送る)。1プレイごとの詳細な記録は、送らない。
import { requireEnabled, requireUser } from "../../../_lib/guard.js";
import { error, json, methodNotAllowed, readJson } from "../../../_lib/http.js";
import { clientIp, hit } from "../../../_lib/rate-limit.js";
import { getRankingEntries, saveRankingEntry } from "../../../_lib/ranking.js";
import {
  isKnownDifficulty,
  isKnownJob,
  isKnownRole,
  isPlausibleScore,
  isRankableDifficulty,
} from "../../../_lib/ranking-limits.js";
import { validateNickname, validateTitle } from "../../../_lib/validate.js";

export async function onRequestGet({ request, env }) {
  const disabled = requireEnabled(env);
  if (disabled) return disabled;

  const url = new URL(request.url);
  const roleId = url.searchParams.get("role") ?? "";
  const difficultyId = url.searchParams.get("difficulty") ?? "";
  if (!isKnownRole(roleId) || !isKnownDifficulty(difficultyId)) {
    return error(400, "invalid-ranking-key");
  }

  const now = Math.floor(Date.now() / 1000);
  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "ranking-view",
    subject: clientIp(request),
    limit: 60,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) return error(429, "rate-limited", { retryAfter: limit.retryAfter });

  const entries = await getRankingEntries(env.DB, roleId, difficultyId);
  return json({ entries });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUser(context, { write: true });
  if (auth.response) return auth.response;
  const { user, now } = auth;

  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "ranking-submit",
    subject: user.id,
    limit: 60,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) return error(429, "rate-limited", { retryAfter: limit.retryAfter });

  const body = await readJson(request);
  if (!body.ok) return error(body.error === "unsupported-media-type" ? 415 : 400, body.error);
  const { roleId, difficultyId, jobId, score } = body.value;

  // 参加していない人は、断る(main.js は、参加している人だけ、ここを呼ぶはずだが、念のため)
  if (!user.rankingOptIn) return error(403, "ranking-opt-out");
  if (!isKnownRole(roleId) || !isRankableDifficulty(difficultyId) || !isKnownJob(jobId)) {
    return error(400, "invalid-ranking-key");
  }
  if (!isPlausibleScore(roleId, score)) return error(400, "invalid-score");
  const nickname = validateNickname(body.value.nickname);
  if (!nickname.ok) return error(400, nickname.error);
  const title = validateTitle(body.value.title);
  if (!title.ok) return error(400, title.error);

  // 頻繁に呼ばれる(クリアのたび)ので、監査ログには残さない(参加設定の切り替えだけ残す)
  await saveRankingEntry(
    env.DB,
    user.id,
    {
      roleId,
      difficultyId,
      jobId,
      nickname: nickname.value,
      title: title.value,
      score,
    },
    now,
  );
  return json({ ok: true });
}

export const onRequest = () => methodNotAllowed(["GET", "POST"]);

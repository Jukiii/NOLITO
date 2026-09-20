// GET /api/licenses — 自分のライセンスの一覧。{ licenses: [{ id, productId, hint, redeemedAt, status }] }
// キーそのものは、サーバーも持っていない(ハッシュだけ)ので、返せない。hint は、末尾 4 文字。
import { requireUser } from "../_lib/guard.js";
import { json, methodNotAllowed } from "../_lib/http.js";
import { listLicenses } from "../_lib/licenses.js";

export async function onRequestGet(context) {
  const auth = await requireUser(context);
  if (auth.response) return auth.response;
  return json({ licenses: await listLicenses(context.env.DB, auth.user.id) });
}

export const onRequest = () => methodNotAllowed(["GET"]);

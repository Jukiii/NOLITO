// GET /articles/ — 公開の記事の一覧ページ(D1 から。Issue #195 PR 3)。
import { articleIndexResponse } from "../_lib/article-pages.js";
import { methodNotAllowed } from "../_lib/http.js";

export const onRequestGet = (context) => articleIndexResponse(context);
export const onRequest = () => methodNotAllowed(["GET"]);

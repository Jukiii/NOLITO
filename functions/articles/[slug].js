// GET /articles/<スラッグ>/ — 公開の記事ページ(D1 から。Issue #195 PR 3)。
import { articlePageResponse } from "../_lib/article-pages.js";
import { methodNotAllowed } from "../_lib/http.js";

export const onRequestGet = (context) => articlePageResponse(context);
export const onRequest = () => methodNotAllowed(["GET"]);

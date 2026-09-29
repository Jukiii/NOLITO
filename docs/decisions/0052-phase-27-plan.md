# 0052: Phase 27 の計画・PR1(依存の脆弱性チェック)・PR2(重要な操作への再認証の拡張)

## 背景

Phase 26(管理画面・RBAC)を、プロダクトの管理画面(PR1・PR2a・PR2b)で完了とするか、他の管理対象(語録・記事・ゲーム設定・ユーザー・ランキング・問い合わせ・更新履歴)にも広げるかを、チャットで確認した。**プロダクトだけで完了とし、Phase 27 へ進む**ことに決まった。

`docs/01_phases/phase-27.md` の仕様は、次のとおり(高レベルな一文の列挙):

> RBAC、将来MFA。再認証・権限チェック・監査ログ。世代管理・暗号化・復元テスト。初期から対策し、脆弱性チェック・依存更新・監査を段階導入。

このうち、RBAC・権限チェック・監査ログは、Phase 9(セッション・CSRF)・Phase 26(管理者ゲート・admin_audit_log)で、すでに基盤ができている。残りの項目(将来MFA・再認証の拡張・世代管理・暗号化・復元テスト・脆弱性チェック・依存更新・監査)は、それぞれ独立した作業になりうるため、「段階導入」の方針どおり、複数のPRに分けることにした。着手前に、最初のPRの範囲をチャットで確認し、**「依存の脆弱性チェック(npm audit を CI に組み込む)」**を選んだ(理由: 仕様の中で最も具体化しやすく、リスクが低いため)。

## 決定(PR1: 依存の脆弱性チェック)

- `package.json` に `"audit": "npm audit --audit-level=high"` を追加。CI(`.github/workflows/ci.yml`)の `check` ジョブに、`npm run check` のあとの手順として `npm run audit` を追加した。
- **しきい値は `high`**(moderate 以下は、CIを止めない)。理由: 実際に確認したところ、`wrangler`(devDependency。ローカル確認・CIでのみ使う。本番の配信物には含まれない)が依存する `undici`(`miniflare` 経由の間接依存)に、moderate の既知の脆弱性(GHSA-3wwx-pv8p-q78v。WebSocketのpermessage-deflate展開でのDoS)がある。`npm audit fix --force` は `wrangler` を古いバージョンへ強制的に戻す破壊的変更になり、かつ**最新の `wrangler`(4.143.0)でも、同じ `undici@7.29.0` に依存しており、直せない**(Cloudflare側の対応待ち)。moderateでCIを止めると、この直せない項目のために、恒久的にCIが赤くなるため、`high` 以上を、実際に対応可能な基準としてしきい値にした。
- この判断は、`npm run audit` を実行するたびに再評価される(`npm audit` は常に最新の脆弱性DBを見るため、しきい値だけを固定していて、個別の脆弱性を無視リストに入れているわけではない)。将来 `undici`/`wrangler` 側で直れば、警告は自然に消える。**`wrangler` は devDependency であり、生成される静的サイト・Cloudflare Pages Functions のランタイムには含まれないため、本番への影響はない**。
- 対象は、devDependencies を含む全ての依存(`--omit=dev` は使わない)。理由: このプロジェクトに `dependencies`(本番用の依存)は無く(静的サイト+Cloudflare Pages Functionsで、npm installされたパッケージをそのまま配信することはない)、`--omit=dev` にすると何も検査しなくなるため。devDependency も、CI・ローカル開発で実行されるコードであり、サプライチェーンのリスクはある。

## この PR でやらないこと(次のPR以降)

- 依存の自動更新(Dependabot等の設定)。「依存更新」の部分は、別PRで検討する。
- 再認証の適用範囲の拡張(管理APIへの適用など)
- バックアップの復元テストの実施・文書化
- 監査ログ(admin_audit_log)の個人情報の扱いの、さらなる強化
- 世代管理・暗号化・MFA(いずれも、仕様が抽象的で、対象が具体化していない。着手前に、都度チャットで範囲を確認する)

## テスト結果(PR1)

- `npm run audit`: 実行して、moderateの脆弱性(上記)が表示されるが、しきい値`high`未満のため、終了コード0(CIを止めない)ことを確認
- `npm run check`: 全2039件、成功(この PR では、`check` の中身は変更していない)

## 決定(PR2: 重要な操作への再認証の拡張)

Phase 27 PR1 の完了後、チャットで次のPRの範囲を確認し、**「重要な操作への再認証の拡張」**を選んだ。すでにアカウント削除(`DELETE /api/account`)にある「直近10分以内にログインしたセッションだけに許す」しくみ(`REAUTH_WINDOW_SECONDS`。セッション自体は最長90日有効)を、Phase 26 で追加した管理API(`/api/admin/products/*`)にも広げる。

**適用範囲は、削除(DELETE)だけに絞った**(チャットで確認)。理由: セッション有効期間(最長90日)に対して10分という窓は厳しく、これを作成(POST)・更新(PUT)を含む書き込み全般にそのまま適用すると、管理者がプロダクトを連続で編集するだけで、10分ごとに再ログインが必要になり、使い勝手を大きく損なう。一方、削除は取り消せない操作(監査ログに`before`の記録は残るが、UIから元に戻す手段はない)で、アカウント削除とまったく同じ性質のため、同じ基準(10分)をそのまま適用する。

### 実装

- `functions/_lib/guard.js`: `REAUTH_WINDOW_SECONDS`(`functions/api/account.js` から移動。共有の定数にした)。`requireUser(context, { write, recent })` に `recent` オプションを追加(`true` のとき、セッション作成から `REAUTH_WINDOW_SECONDS` を超えていれば `403 reauth-required`)。`requireAdmin` は、`options` をそのまま `requireUser` に渡す既存の実装のため、変更不要で `recent: true` を扱える。
- `functions/api/account.js`: 独自に書いていた `REAUTH_WINDOW_SECONDS`・再認証のチェックを削除し、`requireUser(context, { write: true, recent: true })` を使うよう置き換えた(検証ロジックの重複をなくした)。チェックの順序が、`確認の文字(confirm) → reauth` から `reauth → confirm`(`requireUser` の中で先に判定)に変わったが、テストへの影響はない(新鮮なセッションなら reauth は素通りするため、既存のテストの前提=フレッシュな `loggedIn()` は変わらず通る)。
- `functions/api/admin/products/[id].js`: `onRequestDelete` の `requireAdmin` 呼び出しに `recent: true` を追加。GET・PUT は変更なし。
- 画面(`/account/admin/products/`): 削除確認モーダルに、`reauth-required` のときだけ出す「もう一度ログインする」リンク(`/auth/google/login?reauth=1`)を追加。既存の `/account/` のアカウント削除ダイアログと同じ考え方(確認ボタンを隠し、再ログインのリンクを出す)。

## この PR2 でもやらないこと

- 作成(POST)・更新(PUT)への再認証の適用(上記の理由により、意図的に対象外)
- 依存の自動更新・バックアップの復元テスト・監査ログの個人情報対策の強化・世代管理・暗号化・MFA(引き続き、次のPR以降で、都度範囲を確認する)

## テスト結果(PR2)

- `npm run check`: 全2040件、成功(新規1件: `tests/products-admin-api.test.js` に、削除の再認証テストを追加)
- 既存の `tests/auth-flow.test.js`(アカウント削除の再認証テスト。境界値=599秒/601秒を含む)は、`requireUser` の実装を差し替えたあとも、変更なしで成功することを確認(検証ロジックの一本化が、既存の挙動を壊していないことの裏付け)

## 決定(PR3: 依存の自動更新)

PR1・PR2 の完了後、チャットで次のPRの範囲を確認し、**「依存の自動更新(Dependabot の設定)」**を選んだ。PR1(脆弱性チェック)・PR3(自動更新)は、仕様の「脆弱性チェック・依存更新・監査を段階導入」を、この2PRでカバーする形になる。

- `.github/dependabot.yml`(新規)を追加。対象は **npm**(`package.json`)と **github-actions**(`.github/workflows/*.yml`)の2つのエコシステム。どちらも、毎週月曜にチェックする(`schedule.interval: weekly`)。
- **npm は、マイナー・パッチの更新を1つのグループ(`npm-minor-patch`)にまとめる**(`groups`)。理由: このプロジェクトは1人の運営者が確認するため、細かい更新のたびに個別のPRが積み上がると、確認の手間が増え、埋もれて見落とすリスクが上がる。**メジャーの更新は、まとめず個別のPRのまま**(破壊的変更の可能性があるため、1件ずつ確認したい)。
- `open-pull-requests-limit: 10`(npmだけ。既定の5から余裕を持たせた。github-actionsは対象が少なく既定のままでよい)。
- **Dependabot が開くPRも、通常のPRと同じCI(`npm run check`・`npm run audit`)を自動で通る**(`.github/workflows/ci.yml` は `on: pull_request` で、ブランチを問わず動く既存の設定のため、Dependabotのブランチにも、そのまま適用される。CI設定自体の変更は不要)。
- **自動マージは設定しない**(この PR のスコープ外。依頼された内容は「Dependabotの設定」=PRを自動で開くところまでで、マージの判断は、都度、CIの結果を見て行う。`wrangler` のような、動作確認が必要な依存もあるため)。Dependabot が開いたPRは、今後の作業(このセッション、または次回以降)で、CIが通ることを確認してから、通常のPRと同じ手順でマージする。

## この PR3 でもやらないこと

- 自動マージの設定
- バックアップの復元テスト・監査ログの個人情報対策の強化・世代管理・暗号化・MFA(引き続き、次のPR以降で、都度範囲を確認する)

## テスト結果(PR3)

- `.github/dependabot.yml` の YAML 構文を、`yaml` パッケージ(既存の devDependency)で読み込んで確認
- `npm run check`: 全2040件、成功(この PR では、アプリケーションコードは変更していない)

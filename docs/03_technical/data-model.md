# データモデル
主なエンティティ:
- User
- Profile
- GameResult
- Achievement
- Vocabulary
- Job
- Role
- Product
- Article
- Purchase
- License
- AuditLog
- SupportRequest

語録は職種ID、難易度、役職対象、表示日本語、読み、ローマ字候補、説明、関連用語、学習ポイント、苦手判定情報、バージョンを持つ。
管理元は Markdown の原稿(`content/vocabulary/*.md`。下書き・確認の状況・確認メモを持つ)で、公開の JSON(`public/data/vocabulary/*.json`)は、検証を通して生成する(Phase 14。形式は `docs/04_templates/vocabulary-template.md`)。

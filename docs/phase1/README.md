# Phase 1: MVP開発 - ルートドキュメント

## ゴール
Phase 1 では AI Trainer のコア機能を 8 週間で形にし、目標設定 → AI ロードマップ → 進捗記録 → キャラクター成長まで一連の体験が成立する MVP を完成させる。

- Week 1-2: 設計 / 環境構築
- Week 3-4: 認証 / 目標設定 / AI 分析
- Week 5-6: 進捗入力 / カレンダービュー
- Week 7: キャラクター成長
- Week 8: テスト / デバッグ / デプロイ

## 機能マップ
| カテゴリ | 概要 | ドキュメント |
| --- | --- | --- |
| ユーザー認証 | Google OAuth を用いたログイン/サインアップとプロフィール生成 | [authentication.md](./features/authentication.md) |
| 目標設定・ロードマップ | メイン目標設定、AI 分析、ロードマップ/タスク生成 | [goal-roadmap.md](./features/goal-roadmap.md) |
| 進捗管理・可視化 | ホームダッシュボードとカレンダービューによる可視化 | [progress-visualization.md](./features/progress-visualization.md) |
| キャラクター成長 | 経験値・進化段階・演出によるゲーミフィケーション | [character-growth.md](./features/character-growth.md) |
| 設定・プロフィール | プロフィール表示と基本設定 | [settings-and-profile.md](./features/settings-and-profile.md) |

## UI/UXリソース
- [UI設計書](./web/ui-design.md)
- [UI/UX設計書](./web/ui-ux-design.md)
- [ホーム画面プロトタイプ](./design/home/prototype1/README.md)

## 非機能要件
1. **パフォーマンス**: ページロード3秒以内、AI分析30秒以内、アニメーション60fps
2. **セキュリティ**: Google OAuth 2.0、HTTPS、データ暗号化、CSRF/XSS対策
3. **可用性**: Render/Neon無料枠SLA準拠、DBバックアップはマネージド機能を利用
4. **スケーラビリティ**: 100〜500ユーザー想定、適切なインデックス設計、APIレート制限(無料1000req/日)
5. **ユーザビリティ**: モバイルファースト、ローディング表示、わかりやすいエラー
6. **保守性**: TypeScript、`@repo/api-schema`、Lint順守、再利用性重視

## データベース設計
- 詳細: [database-schema.md](./database/database-schema.md)
- 主要テーブル: `users`, `characters`, `goals`, `milestones`, `progress_logs`, `achievements`

## 制約事項
1. 目標は設定後に変更不可（達成/放棄でリセット）
2. 認証は Google のみ
3. Web 版のみ（モバイルは Phase 2+）
4. 無料ユーザーは目標再設定/AI分析を月3回まで
5. Render 無料枠のスリープ、DB 容量 0.5GB などインフラ制約

## ドキュメント構成
```
phase1/
├── README.md
├── features/
│   ├── authentication.md
│   ├── goal-roadmap.md
│   ├── progress-visualization.md
│   ├── character-growth.md
│   └── settings-and-profile.md
├── api/
│   └── api-specification.md
├── database/
│   └── database-schema.md
└── web/
    ├── ui-design.md
    └── ui-ux-design.md
```

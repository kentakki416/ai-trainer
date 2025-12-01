# AI Trainer - 開発計画概要

## このディレクトリについて
AI Trainer プロジェクトの計画・設計ドキュメントを保管します。各 README は概要とリンク集に留め、詳細は専用ドキュメントで管理します。

- プロダクト全体の背景・詳細: [overview.md](./overview.md)
- フェーズ別の実装計画: `phase*/README.md`
- 設計アセット（API/UI/DBなど）: 各フェーズ配下のサブディレクトリ

## プロダクト概要
- プロダクト名: **AI Trainer**
- 目的: 目標設定から日々の進捗記録、キャラクター成長までを AI が伴走
- ターゲット: 計画立案が苦手な学習者/自己啓発ユーザー
- 参考プロダクト: Duolingo, Todoist, Habitica

> 詳細は [overview.md](./overview.md#プロジェクト概要) を参照

## 開発フェーズ
| フェーズ | 期間 | ゴール | ドキュメント |
| --- | --- | --- | --- |
| Phase 1 | 8週間 | MVP 完成（認証〜進捗可視化） | [phase1/README.md](./phase1/README.md) |
| Phase 2 | 4週間 | 体験向上機能（通知/実績/統計） | [phase2/README.md](./phase2/README.md) |
| Phase 3 | 2週間 | ベータ/本番リリース準備 | [overview.md](./overview.md#phase-3-正式リリース準備２週間) |

Phase 1 の詳細な機能仕様は `phase1/features/*.md` を参照してください。Phase 2 以降も同様の構成に揃えていきます。

## 主要リファレンス
- 技術スタック/インフラ: [overview.md](./overview.md#技術スタック)
- 制約事項: [overview.md](./overview.md#制約事項)
- 将来拡張案: [overview.md](./overview.md#今後の拡張案phase-4以降)
- Phase 1 ドキュメント構成: [phase1/README.md](./phase1/README.md#ドキュメント構成)

## 日付情報
- 作成日: 2025-12-01
- 最終更新日: 2025-12-01
- バージョン: 1.0

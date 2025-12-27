# API Server

Express.js + TypeScript による API サーバー

## プロジェクト概要

レイヤードアーキテクチャに基づいた REST API サーバー。Prisma による型安全なデータアクセス、依存性注入による疎結合な設計を採用。

## ディレクトリ構成

```
apps/api/
├── src/
│   ├── index.ts                         # エントリーポイント（DI、サーバー起動）
│   ├── routes/                          # ルーティング定義
│   ├── controller/                      # リクエスト/レスポンスハンドリング
│   │   └── auth/                        # 認証関連のコントローラー
│   ├── service/                         # ビジネスロジック（関数型）
│   ├── repository/mysql/                # データアクセス層（Prisma）
│   │   └── aggregate/                   # 複数テーブルを跨ぐ操作
│   ├── client/                          # 外部APIクライアント（OAuth等）
│   ├── middleware/                      # 共通ミドルウェア
│   ├── log/                             # ロギング設定
│   ├── lib/                             # ユーティリティ（JWT等）
│   ├── const/                           # 定数定義
│   └── prisma/                          # Prisma設定、マイグレーション
├── .env.local                           # 環境変数
├── package.json
└── tsconfig.json
```

## アーキテクチャ

### 各層の責務

| 層 | 責務 | 実装スタイル |
|---|---|---|
| **Route** | エンドポイントとコントローラーのマッピング | Express Router |
| **Controller** | リクエスト受付・バリデーション（Zod）・レスポンス返却 | クラス型 + `execute` メソッド |
| **Service** | ビジネスロジック、トランザクション管理 | 関数型（Named Export） |
| **Repository** | データアクセスの抽象化（CRUD） | クラス型 + Interface |
| **Client** | 外部API接続の抽象化 | クラス型 |
| **Middleware** | 認証、ロギング、エラーハンドリング | Express Middleware |

### データフロー

```
Request → Route → Controller → Service → Repository/Client → Database/External API
                     ↓
                 Response
```

## 設計思想

### 依存性注入（DI）

- **index.ts で一元管理**: Repository、Client、Controller のインスタンスを index.ts でまとめて生成し、Router に注入
- **シングルトン管理**: 同じインスタンスを複数の Route で共有
- **テスタビリティ**: モックの注入が容易

### ドメインモデル層なし

- Prisma の生成型（`User`、`AuthAccount` 等）を Service 層で直接使用
- YAGNI 原則に基づき、必要になるまで抽象化しない
- Repository パターンで十分なデータアクセスの抽象化を実現

### 関数型 Service 層

- ビジネスロジックは Named Export の関数として実装
- Controller から必要な Repository/Client を引数として受け取る
- クラス化による過度な抽象化を避ける

## Interface 使用方針

| 層 | Interface | 理由 |
|---|---|---|
| **Controller** | ❌ 不要 | Express に依存、抽象化のメリット薄い |
| **Service** | ❌ 不要 | 関数のモックで十分 |
| **Repository** | ✅ 使用 | データベース実装の切り替え可能性（Prisma ↔ TypeORM 等） |
| **Client** | 🔶 ケースバイケース | 複数実装がある場合は使用（決済基盤等）、単一実装は不要（Google OAuth 等） |

### Interface と実装の配置

- **同じファイルに記述**: 実装が1つの場合は Interface と実装を同じファイルに配置（シンプル構成）
- **分離**: 複数実装が存在する場合のみファイルを分割

## 開発コマンド

```bash
# 開発サーバー起動（ホットリロード）
pnpm dev

# ビルド
pnpm build

# 本番サーバー起動
pnpm start

# リント
pnpm lint
pnpm lint:fix
```

## Prisma コマンド

```bash
# マイグレーションファイルの作成・実行
cd src/prisma
npx prisma migrate dev --name <migration名>

# クライアントの生成
cd src/prisma
npx prisma generate

# シードの実行
cd src/prisma
npx prisma db seed

# Studio の起動
npx prisma studio --url postgresql://postgres:password@localhost:5432/ai_trainer_dev
```

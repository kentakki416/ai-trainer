# API Server

Express.js + TypeScript による API サーバー

## プロジェクト概要

レイヤードアーキテクチャに基づいた REST API サーバー。Prisma による型安全なデータアクセス、依存性注入による疎結合な設計を採用。

## ディレクトリ構成

```
apps/api/
├── src/
│   ├── index.ts                         # エントリーポイント（DI、サーバー起動）
│   ├── client/                          # 外部APIクライアント（OAuth等）
│   ├── const/                           # 定数定義
│   ├── controller/                      # リクエスト/レスポンスハンドリング
│   │   └── auth/                        # 認証関連のコントローラー
│   ├── lib/                             # ユーティリティ（JWT等）
│   ├── log/                             # ロギング設定
│   ├── middleware/                      # 共通ミドルウェア
│   ├── prisma/                          # Prisma設定、マイグレーション
│   ├── repository/mysql/                # データアクセス層（Prisma）
│   │   └── aggregate/                   # 複数テーブルを跨ぐ操作
│   ├── routes/                          # ルーティング定義
│   ├── service/                         # ビジネスロジック（関数型）
│   └── types/                           # 型定義
│       └── domain/                      # ドメインモデルの型定義
├── .env.local                           # 環境変数
├── package.json
└── tsconfig.json
```

## 設計思想

### 依存方向

- レイヤードアーキテクチャを意識して、メインのアプリケーションロジックであるservice層がDBや外部ライブラリ等の詳細を知らなくて良いようにinterfaceを使用する。

### Interfaceの利用

- 引数やレスポンスにはアプリケーションの型を利用する（外部パッケージの型を変換して扱う）

### 関数型のService 層

- Service層はクラスベースではなく関数ベースにした理由
    1. クラスのDI・インスタンス化がめんどくさい
    2. controllerのテストはインテグレーションテストを想定しているためserviceのモックなどはしない
    3. クラスベースでの状態管理（プライベート引数等）を使用するケースが少ない
- Controller から必要な Repository/Client を引数として受け取る

### ドメインモデル

- types/domainにドメインモデルの型だけ定義している。
- 実装はドメインロジックが必要になるまでしない（おそらく必要になるケースが少ないので対応しない）
- Repository層でPrisma -> ドメインモデル型に変化することでInterfaceを差し替え可能なものにしている


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

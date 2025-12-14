# Step 3: API - スキーマ定義

## 目的
API のリクエスト/レスポンスのスキーマを `@repo/api-schema` パッケージで定義し、フロントエンドと API サーバー間で型安全に共有する。

## 実装箇所
- `packages/schema/src/api-schema/auth.ts`
- `packages/schema/src/api-schema/index.ts`

## なぜスキーマを共有するのか

このプロジェクトでは、フロントエンド（Web/Admin/Mobile）と API サーバー間の通信における型安全性を保証するため、Zod スキーマを共有パッケージ（`@repo/api-schema`）で管理しています。

**メリット**:
- API の型定義が 1 箇所に集約され、変更が容易
- フロントエンドとバックエンドで同じ型を使用するため、型の不一致が発生しない
- Zod によるランタイムバリデーションで、予期しないデータ構造を防ぐ
- TypeScript の型推論により、型定義とバリデーションを同時に行える

## 実装手順

### 1. Auth スキーマ定義

**ファイル**: `packages/schema/src/api-schema/auth.ts`

```typescript
import { z } from 'zod'

// GET /api/auth/me のレスポンス
export const authMeResponseSchema = z.object({
  avatar_url: z.string().nullable(),
  created_at: z.string(),
  email: z.string().nullable(),
  id: z.number(),
  name: z.string().nullable(),
})

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>
```

**注意点**:
- フィールド名は snake_case（API のレスポンス形式に合わせる）
- `created_at` は ISO 8601 形式の文字列（例: `2024-01-01T00:00:00.000Z`）
- nullable なフィールドは `.nullable()` を使用

### 2. エクスポート

**ファイル**: `packages/schema/src/api-schema/index.ts`

既存のエクスポートに追加：

```typescript
export * from './auth'
```

### 3. スキーマパッケージのビルド

スキーマを変更した場合は、必ずビルドを実行してください：

```bash
cd packages/schema
pnpm build
```

**重要**: スキーマパッケージをビルドしないと、API サーバーやフロントエンドアプリから最新のスキーマを参照できません。

## 動作確認

スキーマが正しくエクスポートされているか確認：

```bash
cd packages/schema
pnpm build
```

ビルドが成功すれば OK です。次のステップで API サーバーから実際にスキーマを使用します。
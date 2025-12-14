# Step 3: API - スキーマ定義

## 目的
API のリクエスト/レスポンスのスキーマを `@repo/api-schema` パッケージで定義し、フロントエンドと API サーバー間で型安全に共有する。

## なぜスキーマを共有するのか

このプロジェクトでは、フロントエンド（Web/Admin/Mobile）と API サーバー間の通信における型安全性を保証するため、Zod スキーマを共有パッケージ（`@repo/api-schema`）で管理しています。

**メリット**:
- API の型定義が 1 箇所に集約され、変更が容易
- フロントエンドとバックエンドで同じ型を使用するため、型の不一致が発生しない
- Zod によるランタイムバリデーションで、予期しないデータ構造を防ぐ
- TypeScript の型推論により、型定義とバリデーションを同時に行える

## 実装手順

### Auth スキーマ定義

**ファイル**: `packages/schema/src/api-schema/auth.ts`

```typescript
import { z } from 'zod'

// ========================================================
// GET /api/auth/google/callback
// ========================================================

/**
 * Google OAuth callbackのリクエストスキーマ
 */
export const authGoogleCallbackRequestSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
})

export type AuthGoogleCallbackRequest = z.infer<typeof authGoogleCallbackRequestSchema>

/**
 * Google OAuth callbackのレスポンススキーマ
 */
export const authGoogleCallbackResponseSchema = z.object({
  is_new_user: z.boolean(),
  token: z.string(),
  user: z.object({
    avatar_url: z.string().nullable(),
    created_at: z.string(),
    email: z.string().nullable(),
    id: z.number(),
    name: z.string().nullable(),
  }),
})

export type AuthGoogleCallbackResponse = z.infer<typeof authGoogleCallbackResponseSchema>

// ========================================================
// GET /api/auth/me
// ========================================================

/**
 * ユーザー認証のレスポンススキーマ
 */
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

### 共通スキーマ定義

**ファイル**: `packages/schema/src/api-schema/index.ts`

全エンドポイント共通で使用するスキーマを定義：

```typescript
import { z } from 'zod'

/**
 * エラーレスポンススキーマ（全エンドポイント共通）
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  status_code: z.number(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

export * from './auth'

// 今後、他のAPIスキーマを追加する場合はここに追記
// export * from './post'
// export * from './comment'

```

**注意点**:
- `errorResponseSchema` は全エンドポイント共通のエラー形式を定義
- `index.ts` で直接定義することで、auth 以外の API でも使用可能
- `export * from './auth'` で auth スキーマを全てエクスポート

### スキーマパッケージのビルド

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
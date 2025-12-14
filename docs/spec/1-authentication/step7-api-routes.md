# Step 5: API - Route 層と Dependency Injection

## 目的
ルーティングを定義し、Dependency Injection（DI）を実行してアプリケーションを起動する。このステップで、すべての層（Repository、Service、Controller）を統合し、実際に動作する API サーバーを構築します。

## 実装箇所
- `apps/api/src/route/auth-route.ts`
- `apps/api/src/index.ts`

## 実装手順

### Auth Route 作成

**ファイル**: `apps/api/src/route/auth-route.ts`

```typescript
import { Router } from 'express'

import { AuthGoogleController } from '../controller/auth/google'
import { AuthGoogleCallbackController } from '../controller/auth/google-callback'
import { AuthMeController } from '../controller/auth/me'
import { authMiddleware } from '../middleware/auth'

export const authRouter = (
  authGoogleController: AuthGoogleController,
  authGoogleCallbackController: AuthGoogleCallbackController,
  authMeController: AuthMeController
) => {
  const router = Router()

  // GET /api/auth/google
  router.get('/google', (req, res, next) =>
    authGoogleController.execute(req, res, next)
  )

  // GET /api/auth/google/callback
  router.get('/google/callback', (req, res, next) =>
    authGoogleCallbackController.execute(req, res, next)
  )

  // GET /api/auth/me
  router.get('/me', authMiddleware, (req, res, next) =>
    authMeController.execute(req, res, next)
  )

  return router
}
```

**実装のポイント**:
- `authRouter` 関数で Router インスタンスを生成
- Controller を引数で受け取る（Dependency Injection）
- `/me` エンドポイントには `authMiddleware` を適用（認証必須）
- 各エンドポイントで Controller の `execute` メソッドを呼び出し

### index.ts で DI + サーバー起動

**ファイル**: `apps/api/src/index.ts`

```typescript
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { PrismaClient } from '@prisma/client'

import { GoogleAuthLibraryClient } from './client/google-oauth'
import { AuthGoogleCallbackController } from './controller/auth/google-callback'
import { AuthGoogleController } from './controller/auth/google'
import { AuthMeController } from './controller/auth/me'
import { errorHandler } from './middleware/error-handler'
import { PrismaAccountRepository } from './repository/mysql/account'
import { PrismaUserCharacterRepository } from './repository/mysql/user-character'
import { PrismaUserRepository } from './repository/mysql/user'
import { authRouter } from './route/auth-route'

dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 8080
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// 環境変数チェック
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID environment variable is required')
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required')
}
if (!process.env.GOOGLE_CALLBACK_URL) {
  throw new Error('GOOGLE_CALLBACK_URL environment variable is required')
}

// データソースの初期化
const prisma = new PrismaClient()

// Repository のインスタンス化
const userRepository = new PrismaUserRepository(prisma)
const accountRepository = new PrismaAccountRepository(prisma)
const userCharacterRepository = new PrismaUserCharacterRepository(prisma)

// Client のインスタンス化
const googleOAuthClient = new GoogleAuthLibraryClient(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
)

// Controller のインスタンス化
const authGoogleController = new AuthGoogleController(googleOAuthClient)
const authGoogleCallbackController = new AuthGoogleCallbackController(
  userRepository,
  accountRepository,
  userCharacterRepository,
  googleOAuthClient,
  FRONTEND_URL
)
const authMeController = new AuthMeController(userRepository)

// ミドルウェア
app.use(
  cors({
    credentials: true,
    origin: FRONTEND_URL,
  })
)
app.use(express.json())

// ルーティング
app.use(
  '/api/auth',
  authRouter(authGoogleController, authGoogleCallbackController, authMeController)
)

// エラーハンドリング
app.use(errorHandler)

// サーバー起動
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
```

**実装のポイント**:

1. **環境変数の読み込み**
   - `dotenv` で `.env.local` ファイルから環境変数を読み込み
   - 必須の環境変数が未設定の場合はエラーをスロー（起動時にチェック）

2. **Dependency Injection**
   - Repository、Client、Controller を順番にインスタンス化
   - 依存関係を constructor で注入
   - これにより、テスト時に mock/stub に置き換えやすくなる

3. **ミドルウェアの設定**
   - `cors`: CORS を有効化（フロントエンドからのリクエストを許可）
   - `express.json()`: JSON ボディのパース

4. **ルーティングの設定**
   - `/api/auth` プレフィックスで `authRouter` を適用

5. **エラーハンドリング**
   - `errorHandler` を最後に設定（すべてのエラーをキャッチ）

6. **Graceful Shutdown**
   - `SIGTERM` シグナルを受け取ったら Prisma Client を切断して終了
   - Kubernetes などのコンテナ環境で必要

### 必要なパッケージのインストール

CORS サポートを追加するため、`cors` パッケージをインストールします：

```bash
cd apps/api
pnpm add cors
pnpm add -D @types/cors
```

## 動作確認

### API サーバー起動

```bash
cd apps/api
pnpm dev
```

以下のようなログが表示されれば成功です：

```
API server running on http://localhost:8080
```

### Google OAuth フローのテスト

1. ブラウザで以下の URL にアクセス：
   ```
   http://localhost:8080/api/auth/google
   ```

2. Google の認証画面が表示される

3. Google アカウントでログイン

4. 認証後、フロントエンドの URL にリダイレクトされる：
   ```
   http://localhost:3000/auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. データベースを確認：
   - `users` テーブルに新規ユーザーが作成されている
   - `accounts` テーブルに Google アカウント情報が保存されている
   - `user_characters` テーブルにデフォルトキャラクター（トレちゃん）が作成されている

### `/api/auth/me` エンドポイントのテスト

トークンを取得したら、以下のコマンドで現在のユーザー情報を取得できます：

```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:8080/api/auth/me
```

レスポンス例：

```json
{
  "id": 1,
  "email": "test@example.com",
  "name": "Test User",
  "avatar_url": "https://lh3.googleusercontent.com/a/...",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

## セキュリティに関する注意事項

### トークンの URL パラメータ送信

現在の実装では、認証成功後にトークンを URL パラメータとして送信しています：

```typescript
res.redirect(`${this.frontendUrl}/auth/callback?token=${result.token}`)
```

**リスク**:
- ブラウザの履歴に残る
- リファラーヘッダーで外部サイトに漏洩する可能性
- サーバーログに記録される可能性

**推奨される改善策（将来実装）**:
1. **セッションクッキーの使用**: HttpOnly、Secure、SameSite 属性を設定
2. **Authorization Code Flow**: 一時的なコードを発行し、フロントエンドから API を呼び出してトークンを取得
3. **POST リクエストでトークン送信**: リダイレクトではなく、フロントエンドが API を呼び出す形式

### 環境変数の必須チェック

JWT_SECRET、GOOGLE_CLIENT_ID などの重要な環境変数は、アプリケーション起動時にチェックし、未設定の場合はエラーをスローします。これにより、本番環境でのデフォルト値使用を防ぎます。

### CORS 設定

本番環境では、`origin` を適切に設定し、信頼できるドメインのみを許可してください：

```typescript
app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL, // 環境変数から取得
  })
)
```

複数のフロントエンドドメインを許可する場合：

```typescript
app.use(
  cors({
    credentials: true,
    origin: [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      // ... 他の信頼できるドメイン
    ],
  })
)
```

### HTTPS の使用

本番環境では、必ず HTTPS を使用してください：

- Google OAuth のコールバック URL を HTTPS に設定
- Cookie の Secure 属性を有効化
- HSTS（HTTP Strict Transport Security）ヘッダーを設定

## ディレクトリ構造（完成形）

```
apps/api/src/
├── client/
│   └── google-oauth.ts              # Google OAuth Client
├── controller/
│   └── auth/
│       ├── google.ts                # Google OAuth Controller
│       ├── google-callback.ts       # Google OAuth Callback Controller
│       └── me.ts                    # Get Current User Controller
├── lib/
│   └── jwt.ts                       # JWT ユーティリティ
├── middleware/
│   ├── auth.ts                      # 認証ミドルウェア
│   └── error-handler.ts             # エラーハンドラー
├── repository/
│   └── mysql/
│       ├── account.ts               # Account Repository
│       ├── user.ts                  # User Repository
│       └── user-character.ts        # UserCharacter Repository
├── route/
│   └── auth-route.ts                # Auth Route
├── service/
│   └── auth.ts                      # Auth Service
└── index.ts                         # エントリーポイント（DI + サーバー起動）
```

## トラブルシューティング

### 問題: `GOOGLE_CLIENT_ID environment variable is required` エラー

**原因**: `.env.local` ファイルが存在しないか、環境変数が設定されていない

**解決策**:
1. `apps/api/.env.local` ファイルを作成
2. 必要な環境変数を設定（[step2-api-client.md](./step2-api-client.md) を参照）

### 問題: `PrismaClient` のエラー

**原因**: Prisma のマイグレーションが実行されていない

**解決策**:
```bash
cd apps/api
pnpm prisma migrate dev
```

### 問題: CORS エラー

**原因**: フロントエンドの URL が CORS の `origin` に含まれていない

**解決策**:
1. `.env.local` の `FRONTEND_URL` を確認
2. フロントエンドが実際に動作している URL と一致していることを確認

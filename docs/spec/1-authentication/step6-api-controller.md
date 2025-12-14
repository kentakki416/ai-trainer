# Step 4: API - Controller 層とミドルウェア

## 目的
リクエスト/レスポンスハンドリングを実装し、HTTP 層と Service 層を繋ぐ。Controller 層は HTTP リクエストを受け取り、Service 層を呼び出して、レスポンスを返します。

## Controller 層の責務

Controller 層は以下の役割を担います：

1. **HTTP リクエストの解析**: クエリパラメータ、ボディ、ヘッダーの取得
2. **バリデーション**: リクエストデータの検証（Zod スキーマを使用）
3. **Service 層の呼び出し**: ビジネスロジックの実行
4. **レスポンスの生成**: JSON レスポンスの構築とステータスコードの設定
5. **エラーハンドリング**: 例外をキャッチして適切なエラーレスポンスを返す

## 実装箇所
- `apps/api/src/middleware/error-handler.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/controller/auth/google.ts`
- `apps/api/src/controller/auth/google-callback.ts`
- `apps/api/src/controller/auth/me.ts`

## 実装手順

### 1. エラーハンドラー作成

**ファイル**: `apps/api/src/middleware/error-handler.ts`

```typescript
import { NextFunction, Request, Response } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err)

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    })
  }

  return res.status(500).json({
    error: 'Internal server error',
  })
}
```

**実装のポイント**:
- `AppError` クラスでカスタムエラーを定義（ステータスコードとメッセージを含む）
- `errorHandler` ミドルウェアで全てのエラーをキャッチ
- `AppError` インスタンスの場合は指定されたステータスコードを使用
- その他のエラーは 500 Internal Server Error として処理
- 本番環境では、エラーログを適切なログサービスに送信することを推奨

### 2. 認証ミドルウェア作成

**ファイル**: `apps/api/src/middleware/auth.ts`

```typescript
import { NextFunction, Request, Response } from 'express'

import { verifyToken } from '../lib/jwt'
import { AppError } from './error-handler'

export interface AuthRequest extends Request {
  userId?: number
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'No token provided')
  }

  const token = authHeader.substring(7)
  const payload = verifyToken(token)

  if (!payload) {
    throw new AppError(401, 'Invalid or expired token')
  }

  req.userId = payload.userId
  next()
}
```

**実装のポイント**:
- `AuthRequest` インターフェースで `userId` プロパティを追加
- `Authorization` ヘッダーから Bearer トークンを取得
- トークンを検証し、ペイロードから `userId` を取得
- `req.userId` にユーザー ID を設定（後続のミドルウェアや Controller で使用）
- トークンが無効な場合は 401 Unauthorized エラーをスロー

### 3. Google OAuth Controller 作成

**ファイル**: `apps/api/src/controller/auth/google.ts`

```typescript
import { NextFunction, Request, Response } from 'express'

import { GoogleOAuthClient } from '../../client/google-auth'

export class AuthGoogleController {
  constructor(private googleOAuthClient: GoogleOAuthClient) {}

  execute(_req: Request, res: Response, _next: NextFunction) {
    const authUrl = this.googleOAuthClient.generateAuthUrl()
    res.redirect(authUrl)
  }
}
```

**実装のポイント**:
- Google の認証 URL を生成し、ユーザーをリダイレクト
- `execute` メソッドで HTTP リクエストを処理
- Constructor で `GoogleOAuthClient` を受け取る（Dependency Injection）

### 4. Google OAuth Callback Controller 作成

**ファイル**: `apps/api/src/controller/auth/google-callback.ts`

```typescript
import { NextFunction, Request, Response } from 'express'

import {
  AuthAccountRepository,
  UserCharacterRepository,
  UserRepository,
} from '../../repository/mysql'
import { GoogleOAuthClient } from '../../client/google-auth'
import { authenticateWithGoogle } from '../../service/auth-service'

export class AuthGoogleCallbackController {
  constructor(
    private userRepository: UserRepository,
    private authAccountRepository: AuthAccountRepository,
    private userCharacterRepository: UserCharacterRepository,
    private googleOAuthClient: GoogleOAuthClient,
    private frontendUrl: string
  ) {}

  async execute(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.query

      if (!code || typeof code !== 'string') {
        return res.redirect(`${this.frontendUrl}/login?error=no_code`)
      }

      const result = await authenticateWithGoogle(
        code,
        this.userRepository,
        this.authAccountRepository,
        this.userCharacterRepository,
        this.googleOAuthClient
      )

      // フロントエンドにリダイレクト
      res.redirect(`${this.frontendUrl}/auth/callback?token=${result.token}`)
    } catch (error) {
      console.error('OAuth callback error:', error)
      res.redirect(`${this.frontendUrl}/login?error=auth_failed`)
    }
  }
}
```

**実装のポイント**:
- Google からの認証コードを取得
- `authenticateWithGoogle` Service を呼び出してユーザーを認証
- 成功した場合、フロントエンドの `/auth/callback` にリダイレクト（トークンをクエリパラメータで渡す）
- エラーが発生した場合、フロントエンドの `/login` にリダイレクト（エラーメッセージをクエリパラメータで渡す）

**セキュリティ上の注意**:
- 現在の実装では、トークンを URL パラメータで渡していますが、これはセキュリティ上のリスクがあります（ブラウザ履歴に残る、リファラーヘッダーで漏洩する可能性）
- 本番環境では、セッションクッキーや Authorization Code Flow などの安全な方法を検討してください

### 5. Get Current User Controller 作成

**ファイル**: `apps/api/src/controller/auth/me.ts`

```typescript
import { NextFunction, Response } from 'express'

import { authMeResponseSchema } from '@repo/api-schema'

import { AppError } from '../../middleware/error-handler'
import { AuthRequest } from '../../middleware/auth'
import { getUserById } from '../../service/auth-service'
import { UserRepository } from '../../repository/mysql'

export class AuthMeController {
  constructor(private userRepository: UserRepository) {}

  async execute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await getUserById(req.userId!, this.userRepository)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      const response = authMeResponseSchema.parse({
        avatar_url: user.avatarUrl,
        created_at: user.createdAt.toISOString(),
        email: user.email,
        id: user.id,
        name: user.name,
      })

      res.json(response)
    } catch (error) {
      next(error)
    }
  }
}
```

**実装のポイント**:
- `authMiddleware` で設定された `req.userId` を使用してユーザー情報を取得
- ユーザーが存在しない場合は 404 Not Found エラーをスロー
- `authMeResponseSchema` でレスポンスを検証（型安全性を保証）
- エラーが発生した場合は `next(error)` でエラーハンドラーに渡す

## ディレクトリ構造

```
apps/api/src/
├── middleware/
│   ├── auth.ts              # 認証ミドルウェア
│   └── error-handler.ts     # エラーハンドラー
└── controller/
    └── auth/
        ├── google.ts              # Google OAuth Controller
        ├── google-callback.ts     # Google OAuth Callback Controller
        └── me.ts                  # Get Current User Controller
```

## テスト

Controller 層は統合テストまたは E2E テストで動作確認することが推奨されます。テストの例：

```typescript
// google-callback.test.ts の例
describe('AuthGoogleCallbackController', () => {
  let controller: AuthGoogleCallbackController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>

  beforeEach(() => {
    mockRequest = {
      query: { code: 'auth-code' },
    }
    mockResponse = {
      redirect: jest.fn(),
    }
    // ... Controller のインスタンス化
  })

  it('should redirect to frontend with token on success', async () => {
    await controller.execute(
      mockRequest as Request,
      mockResponse as Response,
      jest.fn()
    )

    expect(mockResponse.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback?token=')
    )
  })
})
```

## 動作確認

Controller 層は次のステップ（Route 層）で実際に使用されます。このステップでは、コンパイルエラーが発生しないことを確認してください：

```bash
cd apps/api
pnpm build
```

ビルドが成功すれば OK です。

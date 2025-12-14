# Step 6: API - Controller 層とミドルウェア
## 実装手順

### 認証ミドルウェア作成

**ファイル**: `apps/api/src/middleware/auth.ts`

```typescript
import { NextFunction, Request, Response } from 'express'

import { errorResponseSchema } from '@repo/api-schema'

import { verifyToken } from '../lib/jwt'

export interface AuthRequest extends Request {
  userId?: number
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const errorResponse = errorResponseSchema.parse({
        error: 'No token provided',
        status_code: 401,
      })
      return res.status(401).json(errorResponse)
    }

    const token = authHeader.substring(7)
    const payload = verifyToken(token)

    if (!payload) {
      const errorResponse = errorResponseSchema.parse({
        error: 'Invalid or expired token',
        status_code: 401,
      })
      return res.status(401).json(errorResponse)
    }

    req.userId = payload.userId
    next()
  } catch (error) {
    const errorResponse = errorResponseSchema.parse({
      error: 'Authentication failed',
      status_code: 500,
    })
    res.status(500).json(errorResponse)
  }
}
```

**実装のポイント**:
- `AuthRequest` インターフェースで `userId` プロパティを追加
- `Authorization` ヘッダーから Bearer トークンを取得
- トークンを検証し、ペイロードから `userId` を取得
- `req.userId` にユーザー ID を設定（後続のミドルウェアや Controller で使用）
- エラー時は `errorResponseSchema` でバリデーションした統一されたエラーレスポンスを返す
- ミドルウェア内で完全にエラーハンドリングを行い、適切なレスポンスを返す

### Google OAuth Controller 作成

**ファイル**: `apps/api/src/controller/auth/google.ts`

```typescript
import { Request, Response } from 'express'

import { errorResponseSchema } from '@repo/api-schema'

import { GoogleOAuthClient } from '../../client/google-auth'

export class AuthGoogleController {
  constructor(private googleOAuthClient: GoogleOAuthClient) {}

  execute(_req: Request, res: Response) {
    try {
      const authUrl = this.googleOAuthClient.generateAuthUrl()
      res.redirect(authUrl)
    } catch (error) {
      const errorResponse = errorResponseSchema.parse({
        error: error instanceof Error ? error.message : 'Failed to generate auth URL',
        status_code: 500,
      })
      res.status(500).json(errorResponse)
    }
  }
}
```

**実装のポイント**:
- Google の認証 URL を生成し、ユーザーをリダイレクト
- `execute` メソッドで HTTP リクエストを処理
- Constructor で `GoogleOAuthClient` を受け取る（Dependency Injection）
- エラー時は `errorResponseSchema` でバリデーションしたエラーレスポンスを返す
- Controller 内で完全にエラーハンドリングを行う

### Google OAuth Callback Controller 作成

**ファイル**: `apps/api/src/controller/auth/google-callback.ts`

```typescript
import { Request, Response } from 'express'

import {
  authGoogleCallbackRequestSchema,
  authGoogleCallbackResponseSchema,
  errorResponseSchema,
} from '@repo/api-schema'

import { AuthAccountRepository, UserRegistrationRepository } from '../../repository/mysql'
import { GoogleOAuthClient } from '../../client/google-auth'
import { authenticateWithGoogle } from '../../service/auth-service'

export class AuthGoogleCallbackController {
  constructor(
    private authAccountRepository: AuthAccountRepository,
    private userRegistrationRepository: UserRegistrationRepository,
    private googleOAuthClient: GoogleOAuthClient
  ) {}

  async execute(req: Request, res: Response) {
    try {
      // リクエストスキーマのバリデーション
      const validatedRequest = authGoogleCallbackRequestSchema.parse(req.query)

      // Service 層を呼び出して認証処理
      const result = await authenticateWithGoogle(
        validatedRequest.code,
        {
          authAccountRepository: this.authAccountRepository,
          userRegistrationRepository: this.userRegistrationRepository,
        },
        this.googleOAuthClient
      )

      // レスポンススキーマのバリデーション
      const response = authGoogleCallbackResponseSchema.parse({
        is_new_user: result.isNewUser,
        token: result.jwtToken,
        user: {
          avatar_url: result.user.avatarUrl,
          created_at: result.user.createdAt.toISOString(),
          email: result.user.email,
          id: result.user.id,
          name: result.user.name,
        },
      })

      res.status(200).json(response)
    } catch (error) {
      // エラーハンドリング
      if (error instanceof Error && error.name === 'ZodError') {
        const errorResponse = errorResponseSchema.parse({
          error: 'Invalid request parameters',
          status_code: 400,
        })
        return res.status(400).json(errorResponse)
      }

      const errorResponse = errorResponseSchema.parse({
        error: error instanceof Error ? error.message : 'Authentication failed',
        status_code: 500,
      })
      res.status(500).json(errorResponse)
    }
  }
}
```

**実装のポイント**:
- `authGoogleCallbackRequestSchema` でリクエスト（クエリパラメータ）をバリデーション
- `authenticateWithGoogle` Service を呼び出してユーザーを認証
- `authGoogleCallbackResponseSchema` でレスポンスをバリデーション
- JSON レスポンスを返す（リダイレクトではなく）
- Zod のバリデーションエラーは 400 Bad Request として処理
- その他のエラーは 500 Internal Server Error として処理
- Controller 内で完全にエラーハンドリングを行い、適切なレスポンスを返す

**アーキテクチャの変更**:
- フロントエンドへのリダイレクトではなく、JSON レスポンスを返す方式に変更
- フロントエンド側でレスポンスを受け取り、トークンを安全に保存する
- セキュリティリスク（URL パラメータでのトークン送信）を解消

### Get Current User Controller 作成

**ファイル**: `apps/api/src/controller/auth/me.ts`

```typescript
import { Response } from 'express'

import { authMeResponseSchema, errorResponseSchema } from '@repo/api-schema'

import { AuthRequest } from '../../middleware/auth'
import { getUserById } from '../../service/auth-service'
import { UserRepository } from '../../repository/mysql'

export class AuthMeController {
  constructor(private userRepository: UserRepository) {}

  async execute(req: AuthRequest, res: Response) {
    try {
      // req.userId は authMiddleware で設定される
      if (!req.userId) {
        const errorResponse = errorResponseSchema.parse({
          error: 'User ID not found in request',
          status_code: 401,
        })
        return res.status(401).json(errorResponse)
      }

      const user = await getUserById(req.userId, this.userRepository)

      if (!user) {
        const errorResponse = errorResponseSchema.parse({
          error: 'User not found',
          status_code: 404,
        })
        return res.status(404).json(errorResponse)
      }

      // レスポンススキーマのバリデーション
      const response = authMeResponseSchema.parse({
        avatar_url: user.avatarUrl,
        created_at: user.createdAt.toISOString(),
        email: user.email,
        id: user.id,
        name: user.name,
      })

      res.status(200).json(response)
    } catch (error) {
      const errorResponse = errorResponseSchema.parse({
        error: error instanceof Error ? error.message : 'Failed to get user information',
        status_code: 500,
      })
      res.status(500).json(errorResponse)
    }
  }
}
```

**実装のポイント**:
- `authMiddleware` で設定された `req.userId` を使用してユーザー情報を取得
- `req.userId` が存在しない場合は 401 Unauthorized を返す
- ユーザーが存在しない場合は 404 Not Found を返す
- `authMeResponseSchema` でレスポンスを検証（型安全性を保証）
- Controller 内で完全にエラーハンドリングを行い、適切なステータスコードとレスポンスを返す
- `errorResponseSchema` で統一されたエラーレスポンス形式を保証

## アーキテクチャのまとめ

### Controller の責務
1. **リクエストのバリデーション**: `@repo/api-schema` のスキーマでリクエストを検証
2. **レスポンスのバリデーション**: レスポンスもスキーマで検証し、型安全性を保証
3. **エラーハンドリング**: try-catch で全てのエラーをキャッチし、適切なステータスコードとレスポンスを返す
4. **HTTP 層と Service 層の橋渡し**: HTTP リクエストを受け取り、Service 層を呼び出し、HTTP レスポンスを返す

### error-logger の責務
- エラーログの記録
- 外部サービスへのエラー通知（Sentry, DataDog など）
- **レスポンスの内容は決定しない**（Controller が決定する）

### この設計の利点
1. **責務の明確化**: Controller がレスポンスを決定し、error-logger はロギングのみを担当
2. **型安全性**: 全てのリクエスト/レスポンスが Zod スキーマで検証される
3. **エラーレスポンスの統一**: `errorResponseSchema` で全エンドポイントのエラー形式が統一される
4. **テストのしやすさ**: Controller が完結しているため、単体テストが容易
5. **フロントエンドとの型共有**: `@repo/api-schema` を通じて型が共有される

## テスト

Controller 層は統合テストまたは E2E テストで動作確認することが推奨されます。テストの例：

```typescript
// google-callback.test.ts の例
describe('AuthGoogleCallbackController', () => {
  let controller: AuthGoogleCallbackController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockAuthAccountRepository: AuthAccountRepository
  let mockUserRegistrationRepository: UserRegistrationRepository
  let mockGoogleOAuthClient: GoogleOAuthClient

  beforeEach(() => {
    mockRequest = {
      query: { code: 'auth-code' },
    }
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    }
    mockAuthAccountRepository = {
      findByProvider: jest.fn(),
      create: jest.fn(),
    }
    mockUserRegistrationRepository = {
      createUserWithAuthAndCharacter: jest.fn(),
    }
    mockGoogleOAuthClient = {
      generateAuthUrl: jest.fn(),
      getUserInfo: jest.fn(),
    }

    controller = new AuthGoogleCallbackController(
      mockAuthAccountRepository,
      mockUserRegistrationRepository,
      mockGoogleOAuthClient
    )
  })

  it('should return JSON response with token on success', async () => {
    const mockUser = {
      avatarUrl: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
      email: 'test@example.com',
      id: 1,
      name: 'Test User',
    }

    ;(mockGoogleOAuthClient.getUserInfo as jest.Mock).mockResolvedValue({
      email: 'test@example.com',
      id: 'google-123',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
    })
    ;(mockAuthAccountRepository.findByProvider as jest.Mock).mockResolvedValue(null)
    ;(mockUserRegistrationRepository.createUserWithAuthAndCharacter as jest.Mock).mockResolvedValue(mockUser)

    await controller.execute(mockRequest as Request, mockResponse as Response)

    expect(mockResponse.status).toHaveBeenCalledWith(200)
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        is_new_user: true,
        token: expect.any(String),
        user: expect.objectContaining({
          email: 'test@example.com',
          id: 1,
        }),
      })
    )
  })

  it('should return 400 error when code is missing', async () => {
    mockRequest.query = {}

    await controller.execute(mockRequest as Request, mockResponse as Response)

    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid request parameters',
        status_code: 400,
      })
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

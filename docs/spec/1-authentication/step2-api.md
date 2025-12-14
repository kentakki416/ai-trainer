## Step 2: API - Repository層とスキーマ定義

### 目的
データアクセス層を実装し、ユーザーの作成・取得ができることを確認する。
また、API のリクエスト/レスポンスのスキーマを `@repo/api-schema` パッケージで定義し、フロントエンドと型安全に共有する。

### 実装箇所
- `packages/schema/src/api-schema/auth.ts` (新規)
- `apps/api/src/repository/mysql/user.ts`
- `apps/api/src/repository/mysql/account.ts`
- `apps/api/src/repository/mysql/user-character.ts`
- `apps/api/src/client/google-oauth.ts`

### 実装手順

#### 2-0. API スキーマ定義（@repo/api-schema）

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

**ファイル**: `packages/schema/src/api-schema/index.ts` に追加

```typescript
export * from './auth'
```

**ビルド**:

```bash
cd packages/schema
pnpm build
```

#### 2-1. User Repository作成

**ファイル**: `apps/api/src/repository/mysql/user.ts`

```typescript
import { PrismaClient, User } from '@prisma/client'

export interface UserRepository {
  create(data: CreateUserInput): Promise<User>
  findByEmail(email: string): Promise<User | null>
  findById(id: number): Promise<User | null>
}

export interface CreateUserInput {
  avatarUrl?: string
  email?: string
  name?: string
}

export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        avatarUrl: data.avatarUrl,
        email: data.email,
        name: data.name,
      },
    })
  }
}
```

#### 2-2. Account Repository作成

**ファイル**: `apps/api/src/repository/mysql/account.ts`

```typescript
import { Account, PrismaClient, User } from '@prisma/client'

export interface AccountRepository {
  create(data: CreateAccountInput): Promise<Account>
  findByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<AccountWithUser | null>
}

export interface CreateAccountInput {
  accessToken?: string
  expiresAt?: number
  idToken?: string
  provider: string
  providerAccountId: string
  refreshToken?: string
  scope?: string
  tokenType?: string
  userId: number
}

export type AccountWithUser = Account & { user: User }

export class PrismaAccountRepository implements AccountRepository {
  constructor(private prisma: PrismaClient) {}

  async findByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<AccountWithUser | null> {
    return this.prisma.account.findUnique({
      include: {
        user: true,
      },
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    })
  }

  async create(data: CreateAccountInput): Promise<Account> {
    return this.prisma.account.create({
      data: {
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
        idToken: data.idToken,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refreshToken: data.refreshToken,
        scope: data.scope,
        tokenType: data.tokenType,
        userId: data.userId,
      },
    })
  }
}
```

#### 2-3. UserCharacter Repository作成

**ファイル**: `apps/api/src/repository/mysql/user-character.ts`

```typescript
import { CharacterCode, PrismaClient, UserCharacter } from '@prisma/client'

export interface UserCharacterRepository {
  create(data: CreateUserCharacterInput): Promise<UserCharacter>
  findActiveByUserId(userId: number): Promise<UserCharacter | null>
  findByUserId(userId: number): Promise<UserCharacter[]>
}

export interface CreateUserCharacterInput {
  characterCode: CharacterCode
  isActive?: boolean
  nickName: string
  userId: number
}

export class PrismaUserCharacterRepository implements UserCharacterRepository {
  constructor(private prisma: PrismaClient) {}

  async findByUserId(userId: number): Promise<UserCharacter[]> {
    return this.prisma.userCharacter.findMany({
      include: {
        character: true,
      },
      orderBy: { createdAt: 'asc' },
      where: { userId },
    })
  }

  async findActiveByUserId(userId: number): Promise<UserCharacter | null> {
    return this.prisma.userCharacter.findFirst({
      include: {
        character: true,
      },
      where: {
        isActive: true,
        userId,
      },
    })
  }

  async create(data: CreateUserCharacterInput): Promise<UserCharacter> {
    return this.prisma.userCharacter.create({
      data: {
        characterCode: data.characterCode,
        isActive: data.isActive ?? false,
        nickName: data.nickName,
        userId: data.userId,
      },
      include: {
        character: true,
      },
    })
  }
}
```

#### 2-4. Google OAuth Client作成

**ファイル**: `apps/api/src/client/google-oauth.ts`

```typescript
import { OAuth2Client } from 'google-auth-library'

export interface GoogleOAuthClient {
  generateAuthUrl(): string
  getGoogleUser(code: string): Promise<GoogleUserInfo>
}

export interface GoogleUserInfo {
  email: string
  id: string
  name: string
  picture?: string
}

export class GoogleAuthLibraryClient implements GoogleOAuthClient {
  private oauth2Client: OAuth2Client

  constructor(
    clientId: string,
    clientSecret: string,
    callbackUrl: string
  ) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, callbackUrl)
  }

  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    })
  }

  async getGoogleUser(code: string): Promise<GoogleUserInfo> {
    const { tokens } = await this.oauth2Client.getToken(code)
    this.oauth2Client.setCredentials(tokens)

    if (!tokens.access_token) {
      throw new Error('Failed to get access token from Google')
    }

    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokens.access_token}`
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      email: data.email,
      id: data.id,
      name: data.name,
      picture: data.picture,
    }
  }
}
```

#### 2-5. 依存パッケージインストール

```bash
cd apps/api
pnpm add google-auth-library jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

### 動作確認

テストコードで確認（後のステップで実際のAPIから確認）

---

## Step 3: API - Service層

### 目的
ビジネスロジックを実装し、認証フローの核となる処理を作成する。

### 実装箇所
- `apps/api/src/service/auth.ts`
- `apps/api/src/lib/jwt.ts`

### 実装手順

#### 3-1. JWT ユーティリティ作成

**ファイル**: `apps/api/src/lib/jwt.ts`

```typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '30d'

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}

export interface JWTPayload {
  exp?: number
  iat?: number
  userId: number
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}
```

#### 3-2. Auth Service作成

**ファイル**: `apps/api/src/service/auth.ts`

```typescript
import { CharacterCode, User } from '@prisma/client'

import { AccountRepository } from '../repository/mysql/account'
import { UserCharacterRepository } from '../repository/mysql/user-character'
import { UserRepository } from '../repository/mysql/user'
import { GoogleOAuthClient, GoogleUserInfo } from '../client/google-oauth'
import { generateToken } from '../lib/jwt'

export interface AuthenticateWithGoogleResult {
  isNewUser: boolean
  token: string
  user: User
}

export const authenticateWithGoogle = async (
  code: string,
  userRepository: UserRepository,
  accountRepository: AccountRepository,
  userCharacterRepository: UserCharacterRepository,
  googleOAuthClient: GoogleOAuthClient
): Promise<AuthenticateWithGoogleResult> => {
  // Googleからユーザー情報を取得
  const googleUser: GoogleUserInfo = await googleOAuthClient.getGoogleUser(code)

  // 既存アカウントを検索
  const existingAccount = await accountRepository.findByProvider('google', googleUser.id)

  let user: User
  let isNewUser = false

  if (existingAccount) {
    // 既存ユーザーの場合
    user = existingAccount.user
  } else {
    // 新規ユーザー作成
    isNewUser = true

    user = await userRepository.create({
      avatarUrl: googleUser.picture,
      email: googleUser.email,
      name: googleUser.name,
    })

    // アカウントを作成
    await accountRepository.create({
      provider: 'google',
      providerAccountId: googleUser.id,
      userId: user.id,
    })

    // デフォルトキャラクター（トレちゃん）を作成
    await userCharacterRepository.create({
      characterCode: CharacterCode.TRAECHAN,
      isActive: true, // 初回作成時はアクティブに設定
      nickName: 'トレちゃん',
      userId: user.id,
    })
  }

  // JWTトークン生成
  const token = generateToken(user.id)

  return {
    isNewUser,
    token,
    user,
  }
}

export const getUserById = async (
  userId: number,
  userRepository: UserRepository
): Promise<User | null> => {
  return userRepository.findById(userId)
}
```

---

## Step 4: API - Controller層

### 目的
リクエスト/レスポンスハンドリングを実装する。

### 実装箇所
- `apps/api/src/controller/auth/google.ts`
- `apps/api/src/controller/auth/google-callback.ts`
- `apps/api/src/controller/auth/me.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/error-handler.ts`

### 実装手順

#### 4-1. エラーハンドラー作成

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

#### 4-2. 認証ミドルウェア作成

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

#### 4-3. Google OAuth Controller作成

**ファイル**: `apps/api/src/controller/auth/google.ts`

```typescript
import { NextFunction, Request, Response } from 'express'

import { GoogleOAuthClient } from '../../client/google-oauth'

export class AuthGoogleController {
  constructor(private googleOAuthClient: GoogleOAuthClient) {}

  execute(_req: Request, res: Response, _next: NextFunction) {
    const authUrl = this.googleOAuthClient.generateAuthUrl()
    res.redirect(authUrl)
  }
}
```

#### 4-4. Google OAuth Callback Controller作成

**ファイル**: `apps/api/src/controller/auth/google-callback.ts`

```typescript
import { NextFunction, Request, Response } from 'express'

import { AccountRepository } from '../../repository/mysql/account'
import { UserCharacterRepository } from '../../repository/mysql/user-character'
import { UserRepository } from '../../repository/mysql/user'
import { GoogleOAuthClient } from '../../client/google-oauth'
import { authenticateWithGoogle } from '../../service/auth'

export class AuthGoogleCallbackController {
  constructor(
    private userRepository: UserRepository,
    private accountRepository: AccountRepository,
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
        this.accountRepository,
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

#### 4-5. Get Current User Controller作成

**ファイル**: `apps/api/src/controller/auth/me.ts`

```typescript
import { NextFunction, Response } from 'express'

import { authMeResponseSchema } from '@repo/api-schema'

import { AppError } from '../../middleware/error-handler'
import { AuthRequest } from '../../middleware/auth'
import { getUserById } from '../../service/auth'
import { UserRepository } from '../../repository/mysql/user'

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

---

## Step 5: API - Route層 + DI

### 目的
ルーティングを定義し、index.tsでDIを実行してアプリケーションを起動する。

### 実装箇所
- `apps/api/src/route/auth-route.ts`
- `apps/api/src/index.ts`

### 実装手順

#### 5-1. Auth Route作成

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

#### 5-2. index.ts でDI + サーバー起動

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

### 動作確認

```bash
# APIサーバー起動
cd apps/api
pnpm dev

# ブラウザで以下にアクセス
# http://localhost:8080/api/auth/google
# → Google認証画面が表示される
# → 認証後、フロントエンドURLにリダイレクトされる（URLにtokenパラメータが含まれていることを確認）
```

**確認項目**:
- ✅ `/api/auth/google` にアクセスするとGoogle認証画面が表示される
- ✅ 認証後、`${FRONTEND_URL}/auth/callback?token=...` にリダイレクトされる
- ✅ データベースに新規ユーザーが作成される
- ✅ ユーザーのキャラクター（トレちゃん）が自動生成される（user_charactersテーブル）

---

## セキュリティに関する注意事項

### 1. トークンの URL パラメータ送信

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

### 2. 環境変数の必須チェック

JWT_SECRET、GOOGLE_CLIENT_ID などの重要な環境変数は、アプリケーション起動時にチェックし、未設定の場合はエラーをスローします。これにより、本番環境でのデフォルト値使用を防ぎます。

### 3. CORS 設定

本番環境では、`origin` を適切に設定し、信頼できるドメインのみを許可してください：

```typescript
app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL, // 環境変数から取得
  })
)
```


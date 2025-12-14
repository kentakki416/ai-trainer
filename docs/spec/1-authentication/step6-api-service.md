# Step 3: API - Service 層

## 目的
ビジネスロジックを実装し、認証フローの核となる処理を作成する。Service 層は Repository 層と Client 層を組み合わせて、実際の業務ロジックを実現します。

## Service 層の責務

Service 層は以下の役割を担います：

1. **ビジネスロジックの実装**: データの加工、複数の Repository の組み合わせ、業務ルールの適用
2. **トランザクション管理**: 複数のデータ操作をまとめて実行
3. **エラーハンドリング**: ビジネスエラーの検出と適切なエラーメッセージの生成
4. **外部サービスとの連携**: OAuth クライアントなど、外部サービスとの統合

## 実装箇所
- `apps/api/src/lib/jwt.ts`
- `apps/api/src/service/auth.ts`

## 実装手順

### 1. JWT ユーティリティ作成

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

**実装のポイント**:

1. **環境変数のチェック**
   - `JWT_SECRET` が未設定の場合、アプリケーション起動時にエラーをスロー
   - デフォルトの有効期限は 30 日（本番環境では適切に調整）

2. **generateToken 関数**
   - ユーザー ID を含む JWT トークンを生成
   - `expiresIn` でトークンの有効期限を設定

3. **verifyToken 関数**
   - トークンを検証し、ペイロードを返す
   - 検証失敗時は `null` を返す（例外をスローしない）
   - Controller 層で適切なエラーハンドリングを行う

### 2. Auth Service 作成

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

**実装のポイント**:

1. **authenticateWithGoogle 関数**
   - Google OAuth の認証コードを受け取り、ユーザーの認証・作成を行う
   - 新規ユーザーの場合、User、Account、UserCharacter を作成
   - 既存ユーザーの場合、既存の User を返す
   - JWT トークンを生成して返す
   - `isNewUser` フラグで新規ユーザーかどうかを判定（フロントエンドで初期設定画面を表示するなどに使用）

2. **getUserById 関数**
   - ユーザー ID からユーザー情報を取得（シンプルなラッパー関数）
   - Controller 層から呼び出される

3. **依存性注入（DI）**
   - Repository や Client を引数で受け取る
   - テストが容易になる（mock/stub に置き換えやすい）
   - Service 層がデータソースに依存しない

4. **トランザクション**
   - 現在の実装ではトランザクションを使用していませんが、将来的には Prisma の `$transaction` を使用して、User、Account、UserCharacter の作成を 1 つのトランザクションで行うことが推奨されます

**トランザクション対応の例**（将来的な改善案）:

```typescript
// Prisma Client を引数に追加
export const authenticateWithGoogle = async (
  code: string,
  prisma: PrismaClient,
  googleOAuthClient: GoogleOAuthClient
): Promise<AuthenticateWithGoogleResult> => {
  const googleUser = await googleOAuthClient.getGoogleUser(code)

  // トランザクション内で処理
  const result = await prisma.$transaction(async (tx) => {
    // トランザクション内で Repository を作成
    const userRepository = new PrismaUserRepository(tx)
    const accountRepository = new PrismaAccountRepository(tx)
    const userCharacterRepository = new PrismaUserCharacterRepository(tx)

    // ... 既存の処理
  })

  return result
}
```

## ディレクトリ構造

```
apps/api/src/
├── lib/
│   └── jwt.ts          # JWT ユーティリティ
└── service/
    └── auth.ts         # Auth Service
```

## テスト

Service 層は単体テストで動作確認することが推奨されます。テストの例：

```typescript
// auth.test.ts の例
describe('authenticateWithGoogle', () => {
  let userRepository: UserRepository
  let accountRepository: AccountRepository
  let userCharacterRepository: UserCharacterRepository
  let googleOAuthClient: GoogleOAuthClient

  beforeEach(() => {
    // Mock Repository と Client を作成
    userRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
    }
    accountRepository = {
      create: jest.fn(),
      findByProvider: jest.fn(),
    }
    userCharacterRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findActiveByUserId: jest.fn(),
    }
    googleOAuthClient = {
      generateAuthUrl: jest.fn(),
      getGoogleUser: jest.fn(),
    }
  })

  it('should create new user when account does not exist', async () => {
    // Arrange
    const mockGoogleUser = {
      id: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
    }
    const mockUser = { id: 1, ...mockGoogleUser }

    ;(googleOAuthClient.getGoogleUser as jest.Mock).mockResolvedValue(mockGoogleUser)
    ;(accountRepository.findByProvider as jest.Mock).mockResolvedValue(null)
    ;(userRepository.create as jest.Mock).mockResolvedValue(mockUser)

    // Act
    const result = await authenticateWithGoogle(
      'auth-code',
      userRepository,
      accountRepository,
      userCharacterRepository,
      googleOAuthClient
    )

    // Assert
    expect(result.isNewUser).toBe(true)
    expect(result.user).toEqual(mockUser)
    expect(result.token).toBeDefined()
    expect(userRepository.create).toHaveBeenCalledWith({
      email: mockGoogleUser.email,
      name: mockGoogleUser.name,
      avatarUrl: mockGoogleUser.picture,
    })
  })
})
```

## 動作確認

Service 層は次のステップ（Controller 層）で実際に使用されます。このステップでは、コンパイルエラーが発生しないことを確認してください：

```bash
cd apps/api
pnpm build
```

ビルドが成功すれば OK です。
# Step 5: API - Service 層

## 目的
ビジネスロジックを実装し、認証フローの核となる処理を作成する。Service 層は Repository 層と Client 層を組み合わせて、実際の業務ロジックを実現します。
## 実装手順

### 1. JWT ユーティリティ作成

**ファイル**: `apps/api/src/lib/jwt.ts`

```typescript
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
}

const JWT_SECRET: Secret = process.env.JWT_SECRET
const JWT_EXPIRATION: string = process.env.JWT_EXPIRATION || '30d'

export type JWTPayload = {
    exp?: number
    iat?: number
    userId: number
}

export const generateToken = (userId: number): string => {
    const options = {
        expiresIn: JWT_EXPIRATION as SignOptions['expiresIn']
    }
    return jwt.sign({ userId }, JWT_SECRET, options)
}

export const verifyToken = (token: string): JWTPayload | null => {
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

**ファイル**: `apps/api/src/service/auth-service.ts`

```typescript
import { CharacterCode, User } from '../prisma/generated/client'

import {
  AuthAccountRepository,
  UserRegistrationRepository,
} from '../repository/mysql'
import { GoogleOAuthClient, GoogleUserInfo } from '../client/google-auth'
import { generateToken } from '../lib/jwt'

export type AuthenticateWithGoogleResult = {
  isNewUser: boolean
  jwtToken: string
  user: User
}

export const authenticateWithGoogle = async (
  code: string,
  repository: {
    authAccountRepository: AuthAccountRepository
    userRegistrationRepository: UserRegistrationRepository
  },
  googleOAuthClient: GoogleOAuthClient
): Promise<AuthenticateWithGoogleResult> => {
  const { authAccountRepository, userRegistrationRepository } = repository

  // Googleからユーザー情報を取得
  const googleUser: GoogleUserInfo = await googleOAuthClient.getUserInfo(code)

  // 既存アカウントを検索
  const existingAccount = await authAccountRepository.findByProvider('google', googleUser.id)

  let user: User
  let isNewUser = false

  if (existingAccount) {
    // 既存ユーザーの場合
    user = existingAccount.user
  } else {
    // 新規ユーザー作成（トランザクション内で User, AuthAccount, UserCharacter を作成）
    isNewUser = true

    user = await userRegistrationRepository.createUserWithAuthAndCharacter({
      authAccount: {
        provider: 'google',
        providerAccountId: googleUser.id,
      },
      user: {
        avatarUrl: googleUser.picture,
        email: googleUser.email,
        name: googleUser.name,
      },
      userCharacter: {
        characterCode: CharacterCode.TRAECHAN,
        isActive: true,
        nickName: 'トレちゃん',
      },
    })
  }

  // JWTトークン生成
  const jwtToken = generateToken(user.id)

  return {
    isNewUser,
    jwtToken,
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
   - 新規ユーザーの場合、`UserRegistrationRepository.createUserWithAuthAndCharacter()` を呼び出して User、AuthAccount、UserCharacter をトランザクション内で作成
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

4. **トランザクション管理**
   - `UserRegistrationRepository` が内部で Prisma の `$transaction` を使用
   - User、AuthAccount、UserCharacter の作成が 1 つのトランザクションで実行される
   - データ不整合を防ぎ、原子性を保証

### 3. User Registration Repository 作成（集約）

新規ユーザー登録のためのトランザクション処理を Repository 層に集約します。

**ファイル**: `apps/api/src/repository/mysql/aggregate/user-registration.ts`

```typescript
import { CharacterCode, PrismaClient, User } from '../../../prisma/generated/client'

export type CreateUserRegistrationInput = {
  authAccount: {
    provider: string
    providerAccountId: string
  }
  user: {
    avatarUrl?: string
    email?: string
    name?: string
  }
  userCharacter: {
    characterCode: CharacterCode
    isActive?: boolean
    nickName: string
  }
}

export interface UserRegistrationRepository {
  createUserWithAuthAndCharacter(data: CreateUserRegistrationInput): Promise<User>
}

export class PrismaUserRegistrationRepository implements UserRegistrationRepository {
  constructor(private prisma: PrismaClient) {}

  async createUserWithAuthAndCharacter(data: CreateUserRegistrationInput): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      // 1. User 作成
      const user = await tx.user.create({
        data: {
          avatarUrl: data.user.avatarUrl,
          email: data.user.email,
          name: data.user.name,
        },
      })

      // 2. AuthAccount 作成
      await tx.authAccount.create({
        data: {
          provider: data.authAccount.provider,
          providerAccountId: data.authAccount.providerAccountId,
          userId: user.id,
        },
      })

      // 3. UserCharacter 作成
      await tx.userCharacter.create({
        data: {
          characterCode: data.userCharacter.characterCode,
          isActive: data.userCharacter.isActive ?? false,
          nickName: data.userCharacter.nickName,
          userId: user.id,
        },
      })

      return user
    })
  }
}
```

**実装のポイント**:

1. **集約パターン（Aggregate）**
   - 複数の Repository にまたがるトランザクション処理を専用 Repository に集約
   - `user.ts`、`auth-account.ts`、`user-character.ts` はシンプルな CRUD に集中
   - ビジネスルールに基づく複合操作は `aggregate/` ディレクトリに分離

2. **トランザクションの保証**
   - Prisma の `$transaction` を使用して原子性を保証
   - 3つのテーブル作成がすべて成功するか、すべて失敗するか
   - 途中でエラーが発生しても自動的にロールバック

3. **責務の分離**
   - Service 層は Prisma に依存しない（疎結合）
   - ORM 変更時の影響範囲が Repository 層に限定される
   - テストのしやすさ向上

## ディレクトリ構造

```
apps/api/src/
├── lib/
│   └── jwt.ts                         # JWT ユーティリティ
├── repository/
│   └── mysql/
│       ├── index.ts                   # Repository エクスポート
│       ├── user.ts                    # User Repository
│       ├── auth-account.ts            # AuthAccount Repository
│       ├── user-character.ts          # UserCharacter Repository
│       └── aggregate/                # 集約 Repository
│           └── user-registration.ts   # 新規ユーザー登録の集約
└── service/
    └── auth-service.ts                # Auth Service
```

## テスト

Service 層は単体テストで動作確認することが推奨されます。テストの例：

```typescript
// auth-service.test.ts の例
describe('authenticateWithGoogle', () => {
  let authAccountRepository: AuthAccountRepository
  let userRegistrationRepository: UserRegistrationRepository
  let googleOAuthClient: GoogleOAuthClient

  beforeEach(() => {
    // Mock Repository と Client を作成
    authAccountRepository = {
      create: jest.fn(),
      findByProvider: jest.fn(),
    }
    userRegistrationRepository = {
      createUserWithAuthAndCharacter: jest.fn(),
    }
    googleOAuthClient = {
      generateAuthUrl: jest.fn(),
      getUserInfo: jest.fn(),
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
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    ;(googleOAuthClient.getUserInfo as jest.Mock).mockResolvedValue(mockGoogleUser)
    ;(authAccountRepository.findByProvider as jest.Mock).mockResolvedValue(null)
    ;(userRegistrationRepository.createUserWithAuthAndCharacter as jest.Mock).mockResolvedValue(mockUser)

    // Act
    const result = await authenticateWithGoogle(
      'auth-code',
      {
        authAccountRepository,
        userRegistrationRepository,
      },
      googleOAuthClient
    )

    // Assert
    expect(result.isNewUser).toBe(true)
    expect(result.user).toEqual(mockUser)
    expect(result.jwtToken).toBeDefined()
    expect(userRegistrationRepository.createUserWithAuthAndCharacter).toHaveBeenCalledWith({
      authAccount: {
        provider: 'google',
        providerAccountId: 'google-123',
      },
      user: {
        email: mockGoogleUser.email,
        name: mockGoogleUser.name,
        avatarUrl: mockGoogleUser.picture,
      },
      userCharacter: {
        characterCode: CharacterCode.TRAECHAN,
        isActive: true,
        nickName: 'トレちゃん',
      },
    })
  })

  it('should return existing user when account exists', async () => {
    // Arrange
    const mockGoogleUser = {
      id: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
    }
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const mockExistingAccount = {
      id: 1,
      provider: 'google',
      providerAccountId: 'google-123',
      userId: 1,
      user: mockUser,
    }

    ;(googleOAuthClient.getUserInfo as jest.Mock).mockResolvedValue(mockGoogleUser)
    ;(authAccountRepository.findByProvider as jest.Mock).mockResolvedValue(mockExistingAccount)

    // Act
    const result = await authenticateWithGoogle(
      'auth-code',
      {
        authAccountRepository,
        userRegistrationRepository,
      },
      googleOAuthClient
    )

    // Assert
    expect(result.isNewUser).toBe(false)
    expect(result.user).toEqual(mockUser)
    expect(result.jwtToken).toBeDefined()
    expect(userRegistrationRepository.createUserWithAuthAndCharacter).not.toHaveBeenCalled()
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
# Step 4: API - Repository 層

## 目的
データアクセス層（Repository）を実装し、データベース操作を抽象化する。各 Repository は特定のエンティティ（User、Account、UserCharacter）に対する CRUD 操作を提供します。

## Repository パターンとは

Repository パターンは、データアクセスロジックをビジネスロジックから分離するデザインパターンです。

**メリット**:
- データアクセスロジックが 1 箇所に集約され、変更が容易
- ビジネスロジック（Service 層）がデータソース（MySQL、PostgreSQL など）に依存しない
- テストが容易（Repository を mock/stub に置き換えられる）
- インターフェースを定義することで、実装を柔軟に切り替えられる

## 実装手順

### 1. User Repository 作成

**ファイル**: `apps/api/src/repository/mysql/user.ts`

```typescript
import { PrismaClient, User } from '../../prisma/generated/client'

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
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  async findById(id: number): Promise<User | null> {
    return this._prisma.user.findUnique({ where: { id } })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this._prisma.user.findUnique({ where: { email } })
  }

  async create(data: CreateUserInput): Promise<User> {
    return this._prisma.user.create({
      data: {
        avatarUrl: data.avatarUrl,
        email: data.email,
        name: data.name,
      },
    })
  }
}
```

**注意点**:
- `UserRepository` インターフェースでデータアクセスの契約を定義
- `PrismaUserRepository` で具体的な実装を提供
- Prisma Client を constructor で受け取る（Dependency Injection）
- `findById` と `findByEmail` は存在しない場合 `null` を返す
- Prisma Client のimportパスは `../../prisma/generated/client` を使用

### 2. AuthAccount Repository 作成

**ファイル**: `apps/api/src/repository/mysql/auth-account.ts`

```typescript
import { AuthAccount, PrismaClient, User } from '../../prisma/generated/client'

export interface AuthAccountRepository {
  create(data: CreateAccountInput): Promise<AuthAccount>
  findByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<AuthAccountWithUser | null>
}

export type CreateAccountInput = {
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

export type AuthAccountWithUser = AuthAccount & { user: User }

export class PrismaAuthAccountRepository implements AuthAccountRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  async findByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<AuthAccountWithUser | null> {
    return this._prisma.authAccount.findUnique({
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

  async create(data: CreateAccountInput): Promise<AuthAccount> {
    return this._prisma.authAccount.create({
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

**注意点**:
- `AuthAccountRepository` インターフェースでデータアクセスの契約を定義
- `findByProvider` は provider と providerAccountId の複合ユニークキーで検索
- Prisma の `include` を使用してユーザー情報を同時に取得（Join）
- `AuthAccountWithUser` 型で AuthAccount と User の関連を明示的に型付け
- `CreateAccountInput` は **type** で定義（Union 型を含む可能性があるため。README.md のベストプラクティスに従う）
- Prisma Client のimportパスは `../../prisma/generated/client` を使用

### 3. UserCharacter Repository 作成

**ファイル**: `apps/api/src/repository/mysql/user-character.ts`

```typescript
import { CharacterCode, PrismaClient, UserCharacter } from '../../prisma/generated/client'

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
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  async findByUserId(userId: number): Promise<UserCharacter[]> {
    return this._prisma.userCharacter.findMany({
      include: {
        character: true,
      },
      orderBy: { createdAt: 'asc' },
      where: { userId },
    })
  }

  async findActiveByUserId(userId: number): Promise<UserCharacter | null> {
    return this._prisma.userCharacter.findFirst({
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
    return this._prisma.userCharacter.create({
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

**注意点**:
- `findByUserId` はユーザーの全キャラクターを作成日時昇順で取得
- `findActiveByUserId` はアクティブなキャラクターのみを取得
- `create` は `isActive` のデフォルト値を `false` に設定
- すべてのメソッドで `character` テーブルを include（キャラクター詳細情報を含める）
- Prisma Client のimportパスは `../../prisma/generated/client` を使用

## ディレクトリ構造

```
apps/api/src/
└── repository/
    └── mysql/
        ├── user.ts              # User Repository
        ├── auth-account.ts      # AuthAccount Repository
        └── user-character.ts    # UserCharacter Repository
```

## テスト

Repository 層のテストを実装することで、デバッグがしやすくなり、リファクタリング時の安全性も向上します。

### テストの準備

#### 1. テスト用の環境変数設定

**ファイル**: `apps/api/.env.test.local`

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_trainer_test"
```

**注意**: テスト用DBを本番DBと分離することで、テストデータが本番に影響しないようにします。

#### 2. テスト用DBのセットアップ

```bash
# テスト用DBの作成
createdb ai_trainer_test

# マイグレーション実行
cd apps/api/src/prisma
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_trainer_test" npx prisma migrate deploy

# シードの実行（Character データが必要な場合）
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_trainer_test" npx prisma db seed
```

#### 3. Jest 設定

**ファイル**: `apps/api/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
}
```

#### 4. テストセットアップファイル

**ファイル**: `apps/api/src/__tests__/setup.ts`

```typescript
// テストのタイムアウトを延長（DB操作があるため）
jest.setTimeout(30000)
```

---

### User Repository のテスト

**ファイル**: `apps/api/src/__tests__/repository/mysql/user.test.ts`

```typescript
import { PrismaClient } from '../../../prisma/generated/client'
import {
  PrismaUserRepository,
  UserRepository,
} from '../../../repository/mysql/user'

describe('PrismaUserRepository', () => {
  let prisma: PrismaClient
  let repository: UserRepository
  let createdUserIds: number[] = []

  beforeAll(() => {
    prisma = new PrismaClient()
    repository = new PrismaUserRepository(prisma)
  })

  afterAll(async () => {
    // テストで作成したユーザーを削除
    await prisma.user.deleteMany({
      where: {
        id: { in: createdUserIds },
      },
    })
    await prisma.$disconnect()
  })

  afterEach(() => {
    // 各テスト後にIDリストをクリア
    createdUserIds = []
  })

  describe('create', () => {
    it('should create a user with all fields', async () => {
      const user = await repository.create({
        avatarUrl: 'https://example.com/avatar.png',
        email: 'test@example.com',
        name: 'Test User',
      })

      createdUserIds.push(user.id)

      expect(user.id).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.name).toBe('Test User')
      expect(user.avatarUrl).toBe('https://example.com/avatar.png')
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a user with only email', async () => {
      const user = await repository.create({
        email: 'minimal@example.com',
      })

      createdUserIds.push(user.id)

      expect(user.id).toBeDefined()
      expect(user.email).toBe('minimal@example.com')
      expect(user.name).toBeNull()
      expect(user.avatarUrl).toBeNull()
    })

    it('should create a user without email (optional)', async () => {
      const user = await repository.create({
        name: 'Anonymous User',
      })

      createdUserIds.push(user.id)

      expect(user.id).toBeDefined()
      expect(user.email).toBeNull()
      expect(user.name).toBe('Anonymous User')
    })
  })

  describe('findById', () => {
    it('should find an existing user by id', async () => {
      // テストデータ作成
      const created = await repository.create({
        email: 'findbyid@example.com',
        name: 'Find By ID User',
      })
      createdUserIds.push(created.id)

      // 検索
      const found = await repository.findById(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.email).toBe('findbyid@example.com')
      expect(found?.name).toBe('Find By ID User')
    })

    it('should return null when user does not exist', async () => {
      const found = await repository.findById(999999)

      expect(found).toBeNull()
    })
  })

  describe('findByEmail', () => {
    it('should find an existing user by email', async () => {
      // テストデータ作成
      const created = await repository.create({
        email: 'findbyemail@example.com',
        name: 'Find By Email User',
      })
      createdUserIds.push(created.id)

      // 検索
      const found = await repository.findByEmail('findbyemail@example.com')

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.email).toBe('findbyemail@example.com')
      expect(found?.name).toBe('Find By Email User')
    })

    it('should return null when email does not exist', async () => {
      const found = await repository.findByEmail('nonexistent@example.com')

      expect(found).toBeNull()
    })

    it('should return null when searching with null email', async () => {
      const found = await repository.findByEmail(null as any)

      expect(found).toBeNull()
    })
  })
})
```

---

### AuthAccount Repository のテスト

**ファイル**: `apps/api/src/__tests__/repository/mysql/auth-account.test.ts`

```typescript
import { PrismaClient } from '../../../prisma/generated/client'
import {
  AuthAccountRepository,
  PrismaAuthAccountRepository,
} from '../../../repository/mysql/auth-account'
import { PrismaUserRepository } from '../../../repository/mysql/user'

describe('PrismaAuthAccountRepository', () => {
  let prisma: PrismaClient
  let repository: AuthAccountRepository
  let userRepository: PrismaUserRepository
  let createdUserIds: number[] = []
  let createdAccountIds: number[] = []

  beforeAll(() => {
    prisma = new PrismaClient()
    repository = new PrismaAuthAccountRepository(prisma)
    userRepository = new PrismaUserRepository(prisma)
  })

  afterAll(async () => {
    // テストで作成したデータを削除
    await prisma.authAccount.deleteMany({
      where: { id: { in: createdAccountIds } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    })
    await prisma.$disconnect()
  })

  afterEach(() => {
    createdUserIds = []
    createdAccountIds = []
  })

  describe('create', () => {
    it('should create an auth account with all fields', async () => {
      // テストユーザー作成
      const user = await userRepository.create({
        email: 'authtest@example.com',
        name: 'Auth Test User',
      })
      createdUserIds.push(user.id)

      // AuthAccount 作成
      const account = await repository.create({
        accessToken: 'ya29.test_access_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        provider: 'google',
        providerAccountId: 'google-12345',
        refreshToken: 'test_refresh_token',
        scope: 'openid email profile',
        tokenType: 'Bearer',
        userId: user.id,
      })
      createdAccountIds.push(account.id)

      expect(account.id).toBeDefined()
      expect(account.provider).toBe('google')
      expect(account.providerAccountId).toBe('google-12345')
      expect(account.userId).toBe(user.id)
      expect(account.accessToken).toBe('ya29.test_access_token')
      expect(account.refreshToken).toBe('test_refresh_token')
      expect(account.tokenType).toBe('Bearer')
      expect(account.scope).toBe('openid email profile')
      expect(account.idToken).toBe('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...')
      expect(account.expiresAt).toBeGreaterThan(0)
    })

    it('should create an auth account with minimal fields', async () => {
      const user = await userRepository.create({
        email: 'minimal@example.com',
      })
      createdUserIds.push(user.id)

      const account = await repository.create({
        provider: 'google',
        providerAccountId: 'google-minimal',
        userId: user.id,
      })
      createdAccountIds.push(account.id)

      expect(account.id).toBeDefined()
      expect(account.provider).toBe('google')
      expect(account.providerAccountId).toBe('google-minimal')
      expect(account.userId).toBe(user.id)
      expect(account.accessToken).toBeNull()
      expect(account.refreshToken).toBeNull()
    })
  })

  describe('findByProvider', () => {
    it('should find an existing account with user data', async () => {
      // テストデータ作成
      const user = await userRepository.create({
        email: 'findprovider@example.com',
        name: 'Find Provider User',
      })
      createdUserIds.push(user.id)

      const created = await repository.create({
        accessToken: 'test_token',
        provider: 'google',
        providerAccountId: 'google-find-test',
        userId: user.id,
      })
      createdAccountIds.push(created.id)

      // 検索
      const found = await repository.findByProvider('google', 'google-find-test')

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.provider).toBe('google')
      expect(found?.providerAccountId).toBe('google-find-test')
      expect(found?.user).toBeDefined()
      expect(found?.user.id).toBe(user.id)
      expect(found?.user.email).toBe('findprovider@example.com')
      expect(found?.user.name).toBe('Find Provider User')
    })

    it('should return null when account does not exist', async () => {
      const found = await repository.findByProvider(
        'google',
        'nonexistent-account'
      )

      expect(found).toBeNull()
    })

    it('should return null when provider matches but providerAccountId does not', async () => {
      const user = await userRepository.create({
        email: 'mismatch@example.com',
      })
      createdUserIds.push(user.id)

      const created = await repository.create({
        provider: 'google',
        providerAccountId: 'google-existing',
        userId: user.id,
      })
      createdAccountIds.push(created.id)

      // 異なるproviderAccountIdで検索
      const found = await repository.findByProvider('google', 'google-different')

      expect(found).toBeNull()
    })
  })
})
```

---

### UserCharacter Repository のテスト

**ファイル**: `apps/api/src/__tests__/repository/mysql/user-character.test.ts`

```typescript
import { CharacterCode, PrismaClient } from '../../../prisma/generated/client'
import {
  PrismaUserCharacterRepository,
  UserCharacterRepository,
} from '../../../repository/mysql/user-character'
import { PrismaUserRepository } from '../../../repository/mysql/user'

describe('PrismaUserCharacterRepository', () => {
  let prisma: PrismaClient
  let repository: UserCharacterRepository
  let userRepository: PrismaUserRepository
  let createdUserIds: number[] = []
  let createdCharacterIds: number[] = []

  beforeAll(() => {
    prisma = new PrismaClient()
    repository = new PrismaUserCharacterRepository(prisma)
    userRepository = new PrismaUserRepository(prisma)
  })

  afterAll(async () => {
    // テストで作成したデータを削除
    await prisma.userCharacter.deleteMany({
      where: { id: { in: createdCharacterIds } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    })
    await prisma.$disconnect()
  })

  afterEach(() => {
    createdUserIds = []
    createdCharacterIds = []
  })

  describe('create', () => {
    it('should create a user character with isActive true', async () => {
      const user = await userRepository.create({
        email: 'chartest@example.com',
        name: 'Character Test User',
      })
      createdUserIds.push(user.id)

      const userCharacter = await repository.create({
        characterCode: CharacterCode.ERIKA,
        isActive: true,
        nickName: 'Erika-chan',
        userId: user.id,
      })
      createdCharacterIds.push(userCharacter.id)

      expect(userCharacter.id).toBeDefined()
      expect(userCharacter.userId).toBe(user.id)
      expect(userCharacter.characterCode).toBe(CharacterCode.ERIKA)
      expect(userCharacter.nickName).toBe('Erika-chan')
      expect(userCharacter.isActive).toBe(true)
      expect(userCharacter.character).toBeDefined()
      expect(userCharacter.character.code).toBe(CharacterCode.ERIKA)
    })

    it('should create a user character with default isActive false', async () => {
      const user = await userRepository.create({
        email: 'inactive@example.com',
      })
      createdUserIds.push(user.id)

      const userCharacter = await repository.create({
        characterCode: CharacterCode.SAKURA,
        nickName: 'Sakura-san',
        userId: user.id,
      })
      createdCharacterIds.push(userCharacter.id)

      expect(userCharacter.isActive).toBe(false)
    })
  })

  describe('findByUserId', () => {
    it('should find all characters for a user ordered by createdAt', async () => {
      const user = await userRepository.create({
        email: 'multichar@example.com',
      })
      createdUserIds.push(user.id)

      // 複数のキャラクター作成
      const char1 = await repository.create({
        characterCode: CharacterCode.ERIKA,
        nickName: 'First',
        userId: user.id,
      })
      createdCharacterIds.push(char1.id)

      const char2 = await repository.create({
        characterCode: CharacterCode.SAKURA,
        nickName: 'Second',
        userId: user.id,
      })
      createdCharacterIds.push(char2.id)

      const char3 = await repository.create({
        characterCode: CharacterCode.AOI,
        nickName: 'Third',
        userId: user.id,
      })
      createdCharacterIds.push(char3.id)

      // 検索
      const characters = await repository.findByUserId(user.id)

      expect(characters).toHaveLength(3)
      expect(characters[0].nickName).toBe('First')
      expect(characters[1].nickName).toBe('Second')
      expect(characters[2].nickName).toBe('Third')
      // character 情報も含まれていることを確認
      expect(characters[0].character).toBeDefined()
      expect(characters[1].character).toBeDefined()
      expect(characters[2].character).toBeDefined()
    })

    it('should return empty array when user has no characters', async () => {
      const user = await userRepository.create({
        email: 'nochar@example.com',
      })
      createdUserIds.push(user.id)

      const characters = await repository.findByUserId(user.id)

      expect(characters).toHaveLength(0)
    })
  })

  describe('findActiveByUserId', () => {
    it('should find the active character for a user', async () => {
      const user = await userRepository.create({
        email: 'activechar@example.com',
      })
      createdUserIds.push(user.id)

      // 非アクティブなキャラクター
      const inactive = await repository.create({
        characterCode: CharacterCode.ERIKA,
        isActive: false,
        nickName: 'Inactive',
        userId: user.id,
      })
      createdCharacterIds.push(inactive.id)

      // アクティブなキャラクター
      const active = await repository.create({
        characterCode: CharacterCode.SAKURA,
        isActive: true,
        nickName: 'Active',
        userId: user.id,
      })
      createdCharacterIds.push(active.id)

      // 検索
      const found = await repository.findActiveByUserId(user.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(active.id)
      expect(found?.nickName).toBe('Active')
      expect(found?.isActive).toBe(true)
      expect(found?.character).toBeDefined()
    })

    it('should return null when user has no active character', async () => {
      const user = await userRepository.create({
        email: 'noactive@example.com',
      })
      createdUserIds.push(user.id)

      // 非アクティブなキャラクターのみ作成
      const inactive = await repository.create({
        characterCode: CharacterCode.ERIKA,
        isActive: false,
        nickName: 'Only Inactive',
        userId: user.id,
      })
      createdCharacterIds.push(inactive.id)

      const found = await repository.findActiveByUserId(user.id)

      expect(found).toBeNull()
    })

    it('should return null when user has no characters', async () => {
      const user = await userRepository.create({
        email: 'emptyuser@example.com',
      })
      createdUserIds.push(user.id)

      const found = await repository.findActiveByUserId(user.id)

      expect(found).toBeNull()
    })
  })
})
```

---

### テストの実行

#### 1. package.json にテストスクリプトを追加

**ファイル**: `apps/api/package.json`

```json
{
  "scripts": {
    "test": "NODE_ENV=test jest",
    "test:watch": "NODE_ENV=test jest --watch",
    "test:coverage": "NODE_ENV=test jest --coverage"
  }
}
```

#### 2. テストの実行

```bash
# すべてのテストを実行
cd apps/api
pnpm test

# 特定のテストファイルのみ実行
pnpm test user.test.ts

# ウォッチモード（開発中に便利）
pnpm test:watch

# カバレッジレポート生成
pnpm test:coverage
```

---

### テストのディレクトリ構造

```
apps/api/
├── src/
│   ├── __tests__/
│   │   ├── setup.ts                           # テストのセットアップ
│   │   └── repository/
│   │       └── mysql/
│   │           ├── user.test.ts               # User Repository のテスト
│   │           ├── auth-account.test.ts       # AuthAccount Repository のテスト
│   │           └── user-character.test.ts     # UserCharacter Repository のテスト
│   └── repository/
│       └── mysql/
│           ├── user.ts
│           ├── auth-account.ts
│           └── user-character.ts
├── .env.test.local                            # テスト用環境変数
└── jest.config.js                             # Jest 設定
```

---

### テストのベストプラクティス

1. **各テスト後のクリーンアップ**: `afterAll` でテストデータを削除してDB をクリーンに保つ
2. **独立したテストケース**: 各テストは他のテストに依存しないようにする
3. **テスト用DBの使用**: 本番DBと分離してテストを実行
4. **エッジケースのテスト**: 存在しないデータの検索、null値など
5. **明確なテスト名**: テストケースの意図が分かる名前をつける

これらのテストを実装することで、Repository 層の動作を確実に検証でき、リファクタリング時の安全性も確保できます。

## 動作確認

Repository 層は次のステップ（Service 層、Controller 層）で実際に使用されます。このステップでは、コンパイルエラーが発生しないことを確認してください：

```bash
cd apps/api
pnpm build
```

ビルドが成功すれば OK です。

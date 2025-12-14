# API Server

Express.js + TypeScript による API サーバー

## アーキテクチャ

### ディレクトリ構成

```
apps/api/
├── src/
│   ├── index.ts                              # エントリーポイント、DI、サーバー起動等
│   ├── route/                                # ルーティング定義
│   │   ├── user-route.ts                     # 
│   │   └── payment-route.ts                  # 
│   ├── controller/                           # リクエスト/レスポンスハンドリング
│   │   ├── user/                             # API単位で分割
│   │   │   ├── get.ts                        # UserGetController
│   │   │   └── create.ts                     # UserCreateController
│   │   └── payment/
│   │       ├── get.ts                        # PaymentGetController
│   │       └── create.ts                     # PaymentCreateController
│   ├── service/                              # ビジネスロジック
│   │   ├── user.ts                           # getUser(), createUser() 等
│   │   └── payment.ts                        # getPayment(), createPayment() 等
│   ├── repository/                           # データアクセス層
│   │   ├── mysql/                            # MySQL (Prisma)
│   │   │   ├── user.ts                       
│   │   │   └── payment.ts                    
│   │   ├── mongo/                            # MongoDB (Mongoose)
│   │   │   └── log.ts                        
│   │   └── redis/                            # Redis (ioredis)
│   │       ├── cache.ts                      
│   │       └── session.ts                    
│   ├── client/                               # 外部APIクライアント
│   │   ├── payment.ts                        # PaymentClient + StripePaymentClient
│   │   └── email.ts                          # EmailClient + SendGridEmailClient
│   ├── middleware/                           # 共通ミドルウェア
│   │   ├── auth.ts                           # 認証チェック
│   │   ├── error-handler.ts                  # エラーハンドリング
│   │   └── request-logger.ts                 # リクエストロギング
│   ├── logger/
│   │   └── index.ts                          # ロガー設定
│   └── types/
│       └── index.ts                          # 共通型定義
├── .env.local                                # 環境変数
├── test/                                     # テスト
├── package.json
└── tsconfig.json
```

### 各層の責務

#### 0. index.ts（エントリーポイント）
- アプリケーションの起動
- 依存性注入（DI）
- ミドルウェアの登録
- ルーティングの登録

### DI（依存性注入）の方針

**推奨: `index.ts` でまとめて初期化し、route に注入する**

#### なぜ index.ts でまとめて DI するのか？

**アプローチ1: 各 route ファイルで DI**
```typescript
// routes/user.ts
const userRepository = new PrismaUserRepository(prisma)
const userController = new UserController(userRepository)
```
**問題点:**
- インスタンスが複数の route で重複して作られる（メモリ無駄）
- シングルトンの管理が難しい
- テスト時のモック注入が面倒

**アプローチ2: index.ts でまとめて DI（推奨）**
```typescript
// index.ts
const userRepository = new PrismaUserRepository(prisma)
app.use('/api/user', userRouter(userRepository))
```
**メリット:**
- ✅ インスタンスの一元管理（シングルトン）
- ✅ テスト時のモック注入が容易
- ✅ 依存関係の変更が 1 箇所で済む

**例:**
```typescript
// index.ts
import express from 'express'
import { PrismaClient } from '@prisma/client'
import mongoose from 'mongoose'
import Redis from 'ioredis'
import { PrismaUserRepository } from './repository/mysql/user'
import { MongooseLogRepository } from './repository/mongo/log'
import { RedisCacheRepository } from './repository/redis/cache'

const app = express()

// データソースの初期化
const prisma = new PrismaClient()
const mongoConnection = await mongoose.connect(process.env.MONGODB_URL!)
const redis = new Redis(process.env.REDIS_URL!)

// Repository のインスタンス化
const userRepository = new PrismaUserRepository(prisma)
const logRepository = new MongooseLogRepository()
const cacheRepository = new RedisCacheRepository(redis)

// Controller のインスタンス化（DI）
const userGetController = new UserGetController(userRepository, logRepository, cacheRepository)

// ルーティング
app.use('/api/user', userRouter(userGetController, ...))

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  await mongoose.disconnect()
  await redis.quit()
  process.exit(0)
})
```

---

#### 1. Route (`route/`)
- API エンドポイントとコントローラーのマッピング
- Express Router を使用してルーティングを定義
- Controller インスタンスを受け取り、execute メソッドを呼び出す

**例:**
```typescript
// route/user-route.ts
import { Router } from 'express'
import { UserGetController } from '../controller/user/get'
import { UserCreateController } from '../controller/user/create'
import { UserUpdateController } from '../controller/user/update'
import { UserDeleteController } from '../controller/user/delete'

export const userRouter = (
  userGetController: UserGetController,
  userCreateController: UserCreateController,
  userUpdateController: UserUpdateController,
  userDeleteController: UserDeleteController
) => {
  const router = Router()

  // GET /api/user/:id
  router.get('/:id', (req, res, next) => userGetController.execute(req, res, next))

  // POST /api/user
  router.post('/', (req, res, next) => userCreateController.execute(req, res, next))

  // PUT /api/user/:id
  router.put('/:id', (req, res, next) => userUpdateController.execute(req, res, next))

  // DELETE /api/user/:id
  router.delete('/:id', (req, res, next) => userDeleteController.execute(req, res, next))

  return router
}
```

---

#### 2. Controller (`controller/`)
- リクエストの受け取りとレスポンスの返却
- リクエストパラメータのバリデーション（Zod）
- 適切なService 層の呼び出し
- エラーハンドリング
- **API単位でファイル分割 + クラス型 + execute メソッド**

**例:**
```typescript
// controller/user/get.ts
import { Request, Response, NextFunction } from 'express'
import { GetUserRequest, GetUserRequestSchema } from '@repo/api-schema'
import { UserRepository } from '../../repository/mysql/user'
import { getUser } from '../../service/user'
import { AppError } from '../../middleware/error-handler'

export class UserGetController {
  constructor(private userRepository: UserRepository) {}

  async execute(req: Request, res: Response, next: NextFunction) {
    try {
      // バリデーション
      const validation = GetUserRequestSchema.safeParse({ id: req.params.id })
      if (!validation.success) {
        throw new AppError(400, validation.error.message)
      }

      // Service 呼び出し
      const result = await getUser(validation.data, this.userRepository)

      if (!result) {
        throw new AppError(404, 'User not found')
      }

      // レスポンス返却
      res.json(result)
    } catch (error) {
      next(error)  // エラーミドルウェアに渡す
    }
  }
}
```

---

#### 3. Service (`service/`)
- ビジネスロジックの実装
- Repository/Client 層の呼び出し
- トランザクション管理
- **実装スタイル: 関数型**（個人開発レベルではシンプルに）
- **Interface は不要**（ビジネスロジックは通常切り替えない）
- **呼び出し方: Named Export で個別import**（推奨）

**例:**
```typescript
// service/user.ts
import { GetUserRequest, GetUserResponse } from '@repo/api-schema'
import { UserRepository } from '../repository/mysql/user'
import { PaymentClient } from '../client/payment'

export const getUser = async (
  request: GetUserRequest,
  userRepository: UserRepository,
  paymentClient: PaymentClient
): Promise<GetUserResponse> => {
  const user = await userRepository.findById(request.id)
  const paymentInfo = await paymentClient.getPaymentInfo(user.id)

  return {
    id: user.id,
    message: `ユーザーID ${user.id} の情報を取得しました`,
    paymentStatus: paymentInfo.status,
    timestamp: new Date().toISOString(),
  }
}
```

**Controller からの呼び出し:**
```typescript
// controller/user/get.ts
import { getUser } from '../../service/user'  // ✅ Named import

const result = await getUser(request, this.userRepository, this.paymentClient)
```

**理由:**
- ✅ **明示的**: どの関数を使っているか一目でわかる
- ✅ **Tree Shaking**: 使っていない関数はバンドルから除外される
- ✅ **IDE補完が効きやすい**

---

#### 4. Repository (`repository/`)
- データベースアクセスの抽象化
- CRUD 操作の実装
- **Interface を定義する**（テストしやすさ、実装の切り替え可能性）
- **データソース別にディレクトリを分割**（MySQL, MongoDB, Redis等）
- **Interface と実装は同じファイルに書く**（シンプル構成、実装が1つの場合）

---

#### Interface の配置方針

**推奨: Interface と実装を同じファイルに書く**

```typescript
// repository/mysql/user.ts
// ✅ 推奨: 同じファイルに Interface と実装
export interface UserRepository {
  findById(id: string): Promise<User | null>
}

export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }
}
```

**理由:**
- ✅ **ファイル数が少ない**（管理しやすい）
- ✅ **個人開発では実装は1つだけ**のことが多い（Prisma、Stripe等）
- ✅ **Interface と実装の関連性が高い**（一緒にある方が理解しやすい）
- ✅ **YAGNI原則**：実際に差し替えが必要になったら分離すれば良い

**分離が必要になるケース:**
- 複数の実装が実際に存在する（例: Prisma + TypeORM）
- テスト用のMock実装を別ファイルで管理したい場合

その場合は以下のように分離：
```typescript
// repository/mysql/user-repository.ts (Interface)
export interface UserRepository { ... }

// repository/mysql/prisma-user-repository.ts (Prisma実装)
export class PrismaUserRepository implements UserRepository { ... }

// repository/mysql/typeorm-user-repository.ts (TypeORM実装)
export class TypeORMUserRepository implements UserRepository { ... }
```

---

#### データソース別の責務

| データソース | 用途 | 例 |
|------------|------|-----|
| **MySQL** (Prisma) | トランザクション管理が必要な主データ | User, Payment, Order |
| **MongoDB** (Mongoose) | ログ、履歴、JSON ドキュメント | ActivityLog, AuditLog |
| **Redis** (ioredis) | キャッシュ、セッション、リアルタイムデータ | Cache, Session, RateLimiting |

---

#### 例: MySQL (Prisma)

```typescript
// repository/mysql/user.ts
import { PrismaClient, User } from '@prisma/client'

// Interface定義
export interface UserRepository {
  findById(id: string): Promise<User | null>
  create(user: CreateUserInput): Promise<User>
}

// Prisma実装
export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async create(user: CreateUserInput): Promise<User> {
    return this.prisma.user.create({ data: user })
  }
}
```

---

#### 例: MongoDB (Mongoose)

```typescript
// repository/mongo/log.ts
import mongoose, { Schema, Document } from 'mongoose'

// Interface定義
export interface LogRepository {
  create(log: CreateLogInput): Promise<Log>
  findByUserId(userId: string): Promise<Log[]>
}

// Mongoose Schema
interface LogDocument extends Document {
  userId: string
  action: string
  timestamp: Date
}

const logSchema = new Schema<LogDocument>({
  userId: { type: String, required: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
})

const LogModel = mongoose.model<LogDocument>('Log', logSchema)

// Mongoose実装
export class MongooseLogRepository implements LogRepository {
  async create(log: CreateLogInput): Promise<Log> {
    const doc = await LogModel.create(log)
    return doc.toObject()
  }

  async findByUserId(userId: string): Promise<Log[]> {
    const docs = await LogModel.find({ userId }).exec()
    return docs.map((doc) => doc.toObject())
  }
}
```

---

#### 例: Redis (ioredis)

```typescript
// repository/redis/cache.ts
import Redis from 'ioredis'

// Interface定義
export interface CacheRepository {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
}

// ioredis実装
export class RedisCacheRepository implements CacheRepository {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value)
    } else {
      await this.redis.set(key, value)
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key)
  }
}
```

---

#### 5. Client (`client/`)
- 外部 API への接続を抽象化
- OpenAPI クライアント、決済基盤クライアント、OAuth プロバイダーなど
- **Interface の使用はケースバイケース**（詳細は「Interface 使用ルール」を参照）
- **Service に書かない**（データソースの抽象化として分離）
- **Interface を使う場合は、Interface と実装を同じファイルに書く**（シンプル構成）

**例 1: Interface を使う場合（決済クライアント）**
```typescript
// client/payment.ts
export interface PaymentClient {
  getPaymentInfo(userId: string): Promise<PaymentInfo>
  createCharge(amount: number): Promise<Charge>
}

export class StripePaymentClient implements PaymentClient {
  constructor(private stripeApiKey: string) {}

  async getPaymentInfo(userId: string): Promise<PaymentInfo> {
    // Stripe API を呼び出し
  }

  async createCharge(amount: number): Promise<Charge> {
    // Stripe API を呼び出し
  }
}
```

**例 2: Interface を使わない場合（Google OAuth）**
```typescript
// client/google-auth.ts
export type GoogleAuthUrlOptions = {
  accessType?: 'offline' | 'online'
  prompt?: 'none' | 'consent' | 'select_account'
  scope?: string[]
}

export class GoogleOAuthClient {
  generateAuthUrl(options?: GoogleAuthUrlOptions): string {
    // Google 固有の型安全な実装
  }

  async getUserInfo(code: string): Promise<GoogleUserInfo> {
    // Google 固有の実装
  }
}
```

**分離が必要になるケース（複数実装が存在する場合）:**
```typescript
// client/payment/payment-client.ts (Interface)
export interface PaymentClient { ... }

// client/payment/stripe-payment-client.ts (Stripe実装)
export class StripePaymentClient implements PaymentClient { ... }

// client/payment/paypal-payment-client.ts (PayPal実装)
export class PayPalPaymentClient implements PaymentClient { ... }
```

#### 6. Middleware (`middleware/`)
- 認証/認可（auth.ts）
- リクエストロギング（request-logger.ts）
- エラーハンドリング（error-handler.ts）
- レート制限など

#### 7. Logger (`logger/`)
- ロギングの一元管理
- Winston、Pino などのロギングライブラリを使用

---

### Interface を使う判断基準

| 層 | Interface | 判断基準 |
|---|---|---|
| Controller | ❌ 不要 | Express に依存するため抽象化のメリットが薄い |
| Service | ❌ 不要 | ビジネスロジックは通常切り替えない。関数のモックで十分 |
| Repository | ✅ 推奨 | データベースの実装を差し替える可能性が高い（Prisma ↔ TypeORM など）|
| Client | 🔶 ケースバイケース | 下記の詳細ルールを参照 |

---

### Client 層の Interface 使用ルール（重要）

Client 層では、以下の基準で Interface の使用を判断する：

#### ✅ Interface を使う場合

**条件:**
- 複数の実装が実際に存在する、または近い将来追加する予定がある
- プロバイダー間で API の形式が似ている（共通の抽象化が自然）

**例: 決済クライアント（Stripe/PayPal）**
```typescript
// client/payment.ts
export interface PaymentClient {
  createCharge(amount: number): Promise<Charge>
  refund(chargeId: string): Promise<void>
}

export class StripePaymentClient implements PaymentClient {
  async createCharge(amount: number): Promise<Charge> {
    // Stripe 固有の実装
  }
  async refund(chargeId: string): Promise<void> {
    // Stripe 固有の実装
  }
}

export class PayPalPaymentClient implements PaymentClient {
  async createCharge(amount: number): Promise<Charge> {
    // PayPal 固有の実装
  }
  async refund(chargeId: string): Promise<void> {
    // PayPal 固有の実装
  }
}
```

**メリット:**
- ✅ 実行時にプロバイダーを切り替え可能
- ✅ テスト時にモック実装を注入しやすい
- ✅ 依存性注入（DI）との相性が良い

---

#### ❌ Interface を使わない場合

**条件:**
- プロバイダー固有の API パラメータが多く、共通化すると型安全性が損なわれる
- 近い将来も他のプロバイダーを追加する予定がない（YAGNI 原則）
- 抽象化することで `Record<string, any>` のような汎用的な型になってしまう

**例: Google OAuth クライアント**
```typescript
// client/google-auth.ts
export type GoogleAuthUrlOptions = {
  accessType?: 'offline' | 'online'         // Google 固有
  prompt?: 'none' | 'consent' | 'select_account'  // Google 固有
  scope?: string[]
  state?: string
}

export class GoogleOAuthClient {
  generateAuthUrl(options?: GoogleAuthUrlOptions): string {
    // Google 固有の型安全な実装
  }

  async getUserInfo(code: string): Promise<GoogleUserInfo> {
    // Google 固有の実装
  }
}
```

**将来 GitHub OAuth を追加する場合:**
```typescript
// client/github-auth.ts
export type GitHubAuthUrlOptions = {
  allowSignup?: boolean    // GitHub 固有
  scope?: string[]
  state?: string
  // accessType や prompt は存在しない
}

export class GitHubOAuthClient {
  generateAuthUrl(options?: GitHubAuthUrlOptions): string {
    // GitHub 固有の型安全な実装
  }

  async getUserInfo(code: string): Promise<GitHubUserInfo> {
    // GitHub 固有の実装
  }
}
```

**メリット:**
- ✅ プロバイダー固有の型安全性を確保（リテラル型で厳密に定義）
- ✅ 過度な抽象化を避け、シンプルに保つ
- ✅ IDE の補完が正確に効く
- ✅ テストはモックライブラリ（Jest など）で対応可能

**デメリット:**
- ❌ プロバイダーごとに独立した実装が必要
- ❌ 真のポリモーフィズムは使えない（共通インターフェースでの統一的な扱いは不可。ファクトリーパターンなどで実行時の切り替え自体は可能だが、型ガードや条件分岐が必要）
- ❌ テストは Jest の mock 機能に依存する（モック実装の DI ではなく、ライブラリレベルのモックが必要）

---

### Interface 使用のメリット・デメリット まとめ

#### ✅ Interface を使うメリット
1. **テストのしやすさ**: モック実装（Interface を実装したテスト用クラス）を DI で注入しやすい
2. **実装の切り替え**: 実行時に異なる実装を使える（真のポリモーフィズム）
3. **依存性の逆転**: 上位層が下位層の具象に依存しない（SOLID の D）
4. **契約の明示**: インターフェースが API 契約として機能

#### ❌ Interface を使うデメリット
1. **型安全性の損失**: 汎用的な型（`Record<string, any>` など）になりやすい
2. **過度な抽象化**: 実装が 1 つしかない場合は YAGNI 違反
3. **複雑性の増加**: ファイル数が増え、理解が難しくなる
4. **不要なメソッドの強制**: プロバイダー間で異なる機能を無理やり統一

---

### テストにおける違い（重要）

#### ✅ Interface ありの場合: モック実装を DI

```typescript
// テストファイル
class MockPaymentClient implements PaymentClient {
  async createCharge(amount: number): Promise<Charge> {
    return { id: 'mock-charge-id', amount }
  }
}

// テストコード
const mockClient = new MockPaymentClient()
const service = new PaymentService(mockClient)  // DI で注入

await service.processPayment(100)
// モックの振る舞いをテストできる
```

**メリット:**
- ✅ テストコードが読みやすい（実際のクラス構造を模倣）
- ✅ Jest に依存しない（他のテストフレームワークでも使える）
- ✅ モックの振る舞いを明示的に定義できる

---

#### ❌ Interface なしの場合: Jest の mock 機能を使用

```typescript
// テストファイル
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn().mockReturnValue('https://mock-url.com'),
    getToken: jest.fn().mockResolvedValue({
      tokens: { access_token: 'mock-token' }
    }),
  })),
}))

// テストコード
const client = new GoogleOAuthClient('id', 'secret', 'callback')
const url = client.generateAuthUrl()
expect(url).toBe('https://mock-url.com')
```

**デメリット:**
- ❌ Jest に強く依存する（他のテストフレームワークに移行しづらい）
- ❌ モックの設定が複雑になりがち（ライブラリ全体をモック）
- ❌ テストコードが読みづらい場合がある

**ただし、これでも十分テスト可能:**
- Google OAuth のように単一実装で型安全性を優先する場合、このアプローチで問題ない
- 実際の開発では Jest がデファクトスタンダードなので、実用上の問題は少ない

---



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

## primsaコマンド
```bash
# マイグレーションファイルの作成・実行
cd src/prisma
npx prisma migarete dev --name <migrationファイル名>

# クライアントの生成
cd src/prisma
nxp prisma generate

# シードの実行
cd src/prisma
npx prisma db seed

# studioの起動
npx prisma studio --url postgresql://postgres:password@localhost:5432/ai_trainer_dev  
```
# API Server

Express.js + TypeScript による API サーバー

## アーキテクチャ

### ディレクトリ構成

```
apps/api/src/
├── index.ts           # エントリーポイント、DI、サーバー起動
├── route/             # ルーティング定義
├── controller/        # リクエスト/レスポンスハンドリング
├── service/           # ビジネスロジック
├── repository/        # データアクセス層（interface + 実装）
├── client/            # 外部 API クライアント（interface + 実装）
├── middleware/        # 共通ミドルウェア（認証、エラーハンドリングなど）
└── logger/            # ロギング
```

### 各層の責務

#### 1. Route (`route/`)
- API エンドポイントとコントローラーのマッピング
- Express Router を使用してルーティングを定義

#### 2. Controller (`controller/`)
- リクエストの受け取りとレスポンスの返却
- リクエストパラメータのバリデーション（Zod）
- Service 層の呼び出し
- エラーハンドリング
- **Interface は不要**（Express に依存するため抽象化のメリットが薄い）

#### 3. Service (`service/`)
- ビジネスロジックの実装
- Repository/Client 層の呼び出し
- トランザクション管理
- **実装スタイル: 関数型**（個人開発レベルではシンプルに）
- **Interface は不要**（ビジネスロジックは通常切り替えない）

**例:**
```typescript
import { GetUserRequest, GetUserResponse } from '@repo/api-schema'
import { UserRepository } from '../repository/user-repository'
import { PaymentClient } from '../client/payment/payment-client'

export const getUserService = async (
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

#### 4. Repository (`repository/`)
- データベースアクセスの抽象化
- CRUD 操作の実装
- **Interface を定義する**（テストしやすさ、実装の切り替え可能性）

**例:**
```typescript
// repository/user-repository.ts
export interface UserRepository {
  findById(id: string): Promise<User | null>
  create(user: CreateUserInput): Promise<User>
}

// repository/prisma-user-repository.ts
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

#### 5. Client (`client/`)
- 外部 API への接続を抽象化
- OpenAPI クライアント、決済基盤クライアントなど
- **Interface を定義する**（Repository と同様の理由）
- **Service に書かない**（データソースの抽象化として分離）

**例:**
```typescript
// client/payment/payment-client.ts
export interface PaymentClient {
  getPaymentInfo(userId: string): Promise<PaymentInfo>
  createCharge(amount: number): Promise<Charge>
}

// client/payment/stripe-payment-client.ts
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

#### 6. Middleware (`middleware/`)
- 認証/認可
- リクエストロギング
- エラーハンドリング
- レート制限など

#### 7. Logger (`logger/`)
- ロギングの一元管理
- Winston、Pino などのロギングライブラリを使用

### Interface を噛ませる判断基準

| 層 | Interface | 理由 |
|---|---|---|
| Controller | ❌ 不要 | Express に依存するため抽象化のメリットが薄い |
| Service | ❌ 不要 | ビジネスロジックは通常切り替えない。関数のモックで十分 |
| Repository | ✅ 必要 | テストしやすさ、DB 実装の切り替え可能性 |
| Client | ✅ 必要 | テストしやすさ、外部 API の切り替え可能性 |

### DI（依存性注入）

`index.ts` で各層を初期化し、依存関係を注入します。

```typescript
// index.ts
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { createLogger } from './logger'
import { PrismaUserRepository } from './repository/prisma-user-repository'
import { StripePaymentClient } from './client/payment/stripe-payment-client'
import { userRouter } from './route/user-route'

const app = express()
const logger = createLogger()
const prisma = new PrismaClient()

// 依存性の初期化
const userRepository = new PrismaUserRepository(prisma)
const paymentClient = new StripePaymentClient(process.env.STRIPE_API_KEY!)

// ルーティング（依存を注入）
app.use('/api/user', userRouter(userRepository, paymentClient))

// サーバー起動
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
```

### コマンド

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

## 環境変数

`.env.local` ファイルに環境変数を定義：

```
PORT=8080
DATABASE_URL=postgresql://...
```

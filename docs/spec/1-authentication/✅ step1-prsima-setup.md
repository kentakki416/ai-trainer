## Step 1: データベースセットアップ

### ゴール
DBの設計＆Prismaを使ってUseDB接続を確認する。

### 実装手順

#### 1-1. Prismaスキーマ作成

**ファイル**: `apps/api/src/prisma/schema.prisma`

```prisma
// Generator
generator client {
    provider = "prisma-client"
    output = "./generated"
}

// Data source
datasource db {
    provider = "mysql"
}

// ユーザー（認証プロバイダー非依存）
model User {
    id        Int      @id @default(autoincrement())
    email     String?  @unique
    name      String?
    avatarUrl String?  @map("avatar_url")
    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    accounts       Account[]
    userCharacters UserCharacter[]

    @@map("users")
}

// 認証プロバイダー
enum Provider {
    GOOGLE
    GITHUB
    CREDENTIALS
}

// 認証アカウント（複数プロバイダー対応）
model Account {
    id                Int      @id @default(autoincrement())
    userId            Int      @map("user_id")
    provider          String   // "google", "github", "credentials" など
    providerAccountId String   @map("provider_account_id") // プロバイダー側のユーザーID
    accessToken       String?  @map("access_token") @db.Text
    refreshToken      String?  @map("refresh_token") @db.Text
    expiresAt         Int?     @map("expires_at")
    tokenType         String?  @map("token_type")
    scope             String?
    idToken           String?  @map("id_token") @db.Text
    createdAt         DateTime @default(now()) @map("created_at")
    updatedAt         DateTime @updatedAt @map("updated_at")

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([provider, providerAccountId])
    @@index([userId])
    @@map("accounts")
}

// キャラクターコード
enum CharacterCode {
    TRAECHAN
    MASTER
}

// キャラクターマスター
model Character {
    characterCode CharacterCode @id @map("character_code")
    name String @db.VarChar(100)
    description String @db.Text
    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    userCharacters UserCharacter[]

    @@map("characters")
}

// ユーザーが保持するキャラクター
model UserCharacter {
    id Int @id @default(autoincrement())
    userId Int @map("user_id")
    characterCode CharacterCode @map("character_code")
    nickName String @db.VarChar(100) @map("nick_name")
    level Int @default(1) 
    experience Int @default(0)
    isActive Boolean @default(false) @map("is_active")
    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    character Character @relation(fields: [characterCode], references: [characterCode], onDelete: Restrict)
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, isActive])
    @@index([characterCode])
    @@map("user_characters")
}

```

**設計のポイント**:
- **User**: ユーザー基本情報（認証プロバイダー非依存）
  - 認証情報は`Account`テーブルで管理
  - 複数の認証プロバイダーに対応可能
- **Account**: 認証プロバイダーごとのアカウント情報
  - 1ユーザーが複数のプロバイダーでログイン可能（User 1:N Account）
  - Google、GitHub、メールパスワードなど、将来的な拡張に対応
  - トークン情報を保存（リフレッシュトークン対応）
- **Character**: キャラクターマスターデータ
  - `CharacterCode` Enumで型安全性を確保
  - トレちゃん（`TRAECHAN`）、マスター（`MASTER`）など
- **UserCharacter**: ユーザーが保持するキャラクター
  - 1ユーザーが複数のキャラクターを持てる（User 1:N UserCharacter）
  - `isActive`: 現在アクティブなキャラクターを識別
  - `nickName`: ユーザーがキャラクターにつけた名前
  - `level`, `experience`: ユーザーごとに異なる成長データ

#### 1-2. prismaの設定ファイルを作成
**ファイル**： `apps/api/src/prisma/primsa.config.ts`

```typescript
import path from 'path'

import dotenv from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// .env.local ファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

export default defineConfig({
    datasource: {
        url: env('DATABASE_URL'),
    },
    migrations: {
        path: './migrations',
        seed: 'npx tsx ./seed.ts'
    },
    schema: './schema.prisma',
})
```
#### 1-3. 環境変数設定

**ファイル**: `apps/api/.env.local`

```env
# Server
PORT=8080
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# Database
DATABASE_URL="mysql://root:password@localhost:3306/ai_trainer_dev"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:8080/api/auth/google/callback"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=7d

# Frontend URL
FRONTEND_URL="http://localhost:3000"
```

#### 1-4. 必要なパッケージをインストール

```bash
cd apps/api
pnpm add @prisma/adapter-mariadb
```

#### 1-5 PrismaClientを生成
```bash
cd apps/api/src/prisma
npx prisma generate
```

#### 1-6. prisma.client.tsの作成
クライアントをexportするためのファイルを追加

**ファイル**: `apps/api/src/prisma/prisma.client.ts`

```typescript
import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from './generated/client'

const adapter = new PrismaMariaDb({
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,
  database: process.env.DB_NAME || 'ai_trainer_dev',
  host: process.env.DB_HOST || 'localhost',
  password: process.env.DB_PASSWORD || 'password',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
})

export const prisma = new PrismaClient({ adapter })
```

#### 1-7. マイグレーション実行

```bash
cd apps/api/src/prisma
npx prisma migrate dev --name init
```

#### 1-8. 初期データの投入（Character）

マイグレーション後、キャラクターマスターデータを投入します。

**ファイル**: `apps/api/src/prisma/seed.ts`

```typescript
import path from 'path'

import dotenv from 'dotenv'

import { CharacterCode } from './generated/client'
import { prisma } from './prisma.client'

// .env.local ファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

async function main() {
  // トレちゃんのマスターデータを作成
  await prisma.character.upsert({
    create: {
      characterCode: CharacterCode.TRAECHAN,
      description: '目標達成をサポートするあなたの相棒',
      name: 'トレちゃん',
    },
    update: {},
    where: { characterCode: CharacterCode.TRAECHAN },
  })

  // マスターのマスターデータを作成
  await prisma.character.upsert({
    create: {
      characterCode: CharacterCode.MASTER,
      description: 'あなたの成長を見守る師匠',
      name: 'マスター',
    },
    update: {},
    where: { characterCode: CharacterCode.MASTER },
  })

  console.log('Character master data seeded successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```


```bash
# シードデータ投入
cd apps/api/src/prisma
npx prisma db seed
```

### 動作確認

```bash
# Prisma Studioでテーブルを確認
cd apps/api
npx prisma studio --url mysql://mysql:password@localhost:3306/ai_trainer_dev
# ブラウザで http://localhost:5555 にアクセス
# users, character_masters, user_characters テーブルが表示されることを確認
```

**確認項目**:
- ✅ `users` テーブルが存在する
- ✅ `accounts` テーブルが存在する
- ✅ `characters` テーブルが存在する
- ✅ `user_characters` テーブルが存在する
- ✅ インデックスが正しく設定されている
- ✅ `characters` に「トレちゃん」と「マスター」のデータが存在する


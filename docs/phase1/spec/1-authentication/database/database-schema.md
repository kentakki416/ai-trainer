# AI Trainer - データベース設計書

## 1. データベース概要

### 1.1 使用技術
- **RDBMS**: PostgreSQL 15.x
- **ORM**: Prisma 5.x
- **Hosting**: AWS RDS (Multi-AZ for production)

### 1.2 設計方針
- **正規化**: 第3正規形を基本とする
- **Soft Delete**: 重要データは物理削除せず、`deleted_at` で論理削除
- **Timestamp**: 全テーブルに `created_at`, `updated_at` を持たせる
- **UUID vs Serial**: 主キーは `Serial ID` を使用（シンプルさ優先）

---

## 2. ER図

```
                    ┌──────────┐
                    │  Users   │
                    └──────────┘
                         │
        ┌────────────────┼────────────────┬──────────────┐
        │                │                │              │
        │ 1:1            │ 1:N            │ 1:N          │ 1:N
        ▼                ▼                ▼              ▼
   ┌──────────┐     ┌──────┐      ┌──────────────┐ ┌──────────────┐
   │Characters│     │Goals │      │ProgressLogs  │ │Achievements  │
   └──────────┘     └──────┘      └──────────────┘ └──────────────┘
                        │               ▲
              ┌─────────┼─────────┐     │
              │         │         │     │
              │ 1:N     │ 1:N     │ 1:N │ 1:N
              ▼         ▼         │     │
        ┌──────────┐ ┌──────────────┐   │
        │Milestones│ │AISuggestions │   │
        └──────────┘ └──────────────┘   │
              │                         │
              └─────────────────────────┘
```

---

## 3. テーブル定義

### 3.1 Users

**説明**: ユーザー情報を管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| name | VARCHAR(100) | NOT NULL | ユーザー名 |
| google_id | VARCHAR(255) | UNIQUE, NOT NULL | Google OAuth ID |
| icon_url | TEXT | NULL | プロフィール画像URL |
| notification_enabled | BOOLEAN | DEFAULT true | 通知有効フラグ |
| notification_time | TIME | DEFAULT '20:00' | 通知時刻 |
| timezone | VARCHAR(50) | DEFAULT 'Asia/Tokyo' | タイムゾーン |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |

**Index**:
- `idx_users_email` (email)
- `idx_users_google_id` (google_id)

---

### 3.2 Characters

**説明**: ユーザーのキャラクター情報（1ユーザー1キャラクター）

**設計方針**:
- 同じキャラクターが進化していく（レベルに応じて4段階に進化）
- ゴール達成でカラーバリエーション・アクセサリーが解放される
- 将来的に複数キャラクター対応も可能な設計（Phase 2以降）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | キャラクターID |
| user_id | INTEGER | UNIQUE, NOT NULL, FK(users.id) | ユーザーID |
| name | VARCHAR(50) | NOT NULL | キャラクター名（デフォルト: "トレちゃん"） |
| level | INTEGER | DEFAULT 1 | レベル（1〜∞） |
| experience | INTEGER | DEFAULT 0 | 経験値（学習時間に応じて蓄積） |
| appearance_stage | VARCHAR(20) | DEFAULT 'stage1' | 見た目ステージ (*1) |
| appearance_color | VARCHAR(20) | DEFAULT 'blue' | 色バリエーション (*2) |
| appearance_accessory | VARCHAR(50) | NULL | アクセサリー (*3) |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |

**Index**:
- `idx_characters_user_id` (user_id)

**(*1) appearance_stage の取りうる値**:
- `stage1`: ひよこ状態（レベル 1-10）
- `stage2`: 成長期（レベル 11-25）
- `stage3`: 大人（レベル 26-50）
- `stage4`: 伝説級（レベル 51以上）

**(*2) appearance_color の取りうる値**:
- `blue`: デフォルト（初期状態）
- `gold`: ゴール1個達成で解放
- `silver`: ゴール2個達成で解放
- `rainbow`: ゴール3個達成で解放

**(*3) appearance_accessory の取りうる値**:
- `null`: アクセサリーなし（初期状態）
- `ribbon`: ゴール1個達成で解放
- `glasses`: ゴール2個達成で解放
- `crown`: ゴール3個達成で解放

**計算ロジック**:
```sql
-- レベル計算: level = floor(sqrt(experience / 10)) + 1
-- 次のレベルまでの経験値: next_level_exp = ((level) ** 2) * 10

-- 進化段階の判定:
-- CASE
--   WHEN level BETWEEN 1 AND 10 THEN 'stage1'
--   WHEN level BETWEEN 11 AND 25 THEN 'stage2'
--   WHEN level BETWEEN 26 AND 50 THEN 'stage3'
--   WHEN level >= 51 THEN 'stage4'
-- END

-- 経験値の獲得: 学習時間（時間） × 10 = 経験値
-- 例: 1時間学習 → 10経験値、10時間学習 → 100経験値
```

---

### 3.3 Goals

**説明**: ユーザーの目標

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | 目標ID |
| user_id | INTEGER | NOT NULL, FK(users.id) | ユーザーID |
| title | VARCHAR(255) | NOT NULL | 目標タイトル |
| description | TEXT | NULL | 目標詳細 |
| target_date | DATE | NOT NULL | 達成希望日 |
| status | VARCHAR(20) | DEFAULT 'pending_analysis' | ステータス (*1) |
| ai_analysis | JSONB | NULL | AI分析結果 (*2) |
| estimated_hours | DECIMAL(6,1) | NULL | 推定学習時間 |
| actual_hours | DECIMAL(6,1) | DEFAULT 0 | 実績学習時間 |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |
| achieved_at | TIMESTAMP | NULL | 達成日時 |
| abandoned_at | TIMESTAMP | NULL | 放棄日時 |

**Index**:
- `idx_goals_user_id` (user_id)
- `idx_goals_status` (status)

**(*1) status の取りうる値**:
- `pending_analysis`: AI分析待ち
- `analyzed`: AI分析完了、ユーザー確認待ち
- `active`: 進行中
- `achieved`: 達成
- `abandoned`: 放棄

**(*2) ai_analysis の例** (JSONB):
```json
{
  "estimated_hours": 200,
  "breakdown": {
    "vocabulary": 60,
    "grammar": 40,
    "listening": 60,
    "reading": 40
  },
  "recommendations": [
    "毎日30分以上の学習を推奨",
    "週に1回は模擬試験を受けると効果的"
  ],
  "analyzed_at": "2025-12-01T10:00:00Z"
}
```

---

### 3.4 Milestones

**説明**: 目標の中間ゴール

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | マイルストーンID |
| goal_id | INTEGER | NOT NULL, FK(goals.id) | 目標ID |
| title | VARCHAR(255) | NOT NULL | マイルストーンタイトル |
| description | TEXT | NULL | 詳細 |
| target_date | DATE | NOT NULL | 達成予定日 |
| estimated_hours | DECIMAL(6,1) | NULL | 推定学習時間 |
| actual_hours | DECIMAL(6,1) | DEFAULT 0 | 実績学習時間 |
| status | VARCHAR(20) | DEFAULT 'pending' | ステータス (*3) |
| order | INTEGER | NOT NULL | 順序（0, 1, 2, ...） |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |
| achieved_at | TIMESTAMP | NULL | 達成日時 |

**Index**:
- `idx_milestones_goal_id` (goal_id)
- `idx_milestones_status` (status)
- `idx_milestones_order` (goal_id, order)

**(*3) status の取りうる値**:
- `pending`: 未達成
- `achieved`: 達成済み

---

### 3.5 ProgressLogs

**説明**: 日々の進捗記録

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | 進捗ログID |
| goal_id | INTEGER | NOT NULL, FK(goals.id) | 目標ID |
| milestone_id | INTEGER | NULL, FK(milestones.id) | 関連マイルストーン |
| user_id | INTEGER | NOT NULL, FK(users.id) | ユーザーID |
| date | DATE | NOT NULL | 学習日 |
| content | TEXT | NOT NULL | 学習内容 |
| hours | DECIMAL(4,1) | NOT NULL | 学習時間 |
| rating | INTEGER | NULL | 達成度（1〜5） |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |

**Index**:
- `idx_progress_logs_goal_id` (goal_id)
- `idx_progress_logs_user_date` (user_id, date)
- `idx_progress_logs_date` (date)

**Unique Constraint**:
- `unique_user_date` (user_id, date) - 1日1回の入力を想定

---

### 3.6 Achievements

**説明**: ユーザーの実績・バッジ

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | 実績ID |
| user_id | INTEGER | NOT NULL, FK(users.id) | ユーザーID |
| type | VARCHAR(50) | NOT NULL | 実績タイプ (*4) |
| title | VARCHAR(100) | NOT NULL | 実績タイトル |
| description | TEXT | NULL | 実績説明 |
| icon_url | TEXT | NULL | アイコンURL |
| unlocked_at | TIMESTAMP | DEFAULT NOW() | 解除日時 |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |

**Index**:
- `idx_achievements_user_id` (user_id)
- `idx_achievements_type` (type)

**Unique Constraint**:
- `unique_user_achievement` (user_id, type)

**(*4) type の例**:
- `streak_7`: 連続7日間入力
- `streak_30`: 連続30日間入力
- `total_hours_100`: 累計100時間学習
- `milestone_3`: 中間ゴール3つ達成
- `goal_1`: 目標1つ達成

---

### 3.7 AISuggestions

**説明**: AIからの提案（定期的な再分析結果）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | 提案ID |
| goal_id | INTEGER | NOT NULL, FK(goals.id) | 目標ID |
| suggestion_type | VARCHAR(50) | NOT NULL | 提案タイプ (*5) |
| content | JSONB | NOT NULL | 提案内容 (*6) |
| status | VARCHAR(20) | DEFAULT 'pending' | ステータス (*7) |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| reviewed_at | TIMESTAMP | NULL | レビュー日時 |

**Index**:
- `idx_ai_suggestions_goal_id` (goal_id)
- `idx_ai_suggestions_status` (status)

**(*5) suggestion_type の例**:
- `milestone_adjustment`: マイルストーン調整提案
- `pace_warning`: ペース警告
- `encouragement`: 励ましメッセージ

**(*6) content の例** (JSONB):
```json
{
  "message": "進捗が順調です！次の中間ゴールの日程を早めることをお勧めします。",
  "proposed_milestones": [
    { "id": 3, "new_target_date": "2025-02-15", "old_target_date": "2025-03-01" }
  ]
}
```

**(*7) status の取りうる値**:
- `pending`: レビュー待ち
- `accepted`: 受け入れ
- `rejected`: 拒否
- `expired`: 期限切れ

---

## 4. Prisma Schema

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                   Int            @id @default(autoincrement())
  email                String         @unique
  name                 String
  googleId             String         @unique @map("google_id")
  avatarUrl            String?        @map("avatar_url")
  notificationEnabled  Boolean        @default(true) @map("notification_enabled")
  notificationTime     String         @default("20:00") @map("notification_time")
  timezone             String         @default("Asia/Tokyo")
  createdAt            DateTime       @default(now()) @map("created_at")
  updatedAt            DateTime       @updatedAt @map("updated_at")

  character            Character?
  goals                Goal[]
  progressLogs         ProgressLog[]
  achievements         Achievement[]

  @@index([email])
  @@index([googleId])
  @@map("users")
}

model Character {
  id                  Int       @id @default(autoincrement())
  userId              Int       @unique @map("user_id")
  name                String    @default("トレちゃん")
  level               Int       @default(1)
  experience          Int       @default(0)
  appearanceStage     String    @default("stage1") @map("appearance_stage")
  appearanceColor     String    @default("blue") @map("appearance_color")
  appearanceAccessory String?   @map("appearance_accessory")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("characters")
}

model Goal {
  id             Int            @id @default(autoincrement())
  userId         Int            @map("user_id")
  title          String
  description    String?
  targetDate     DateTime       @map("target_date") @db.Date
  status         String         @default("pending_analysis")
  aiAnalysis     Json?          @map("ai_analysis")
  estimatedHours Decimal?       @map("estimated_hours") @db.Decimal(6, 1)
  actualHours    Decimal        @default(0) @map("actual_hours") @db.Decimal(6, 1)
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")
  achievedAt     DateTime?      @map("achieved_at")
  abandonedAt    DateTime?      @map("abandoned_at")

  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  milestones     Milestone[]
  progressLogs   ProgressLog[]
  aiSuggestions  AISuggestion[]

  @@index([userId])
  @@index([status])
  @@map("goals")
}

model Milestone {
  id             Int           @id @default(autoincrement())
  goalId         Int           @map("goal_id")
  title          String
  description    String?
  targetDate     DateTime      @map("target_date") @db.Date
  estimatedHours Decimal?      @map("estimated_hours") @db.Decimal(6, 1)
  actualHours    Decimal       @default(0) @map("actual_hours") @db.Decimal(6, 1)
  status         String        @default("pending")
  order          Int
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")
  achievedAt     DateTime?     @map("achieved_at")

  goal           Goal          @relation(fields: [goalId], references: [id], onDelete: Cascade)
  progressLogs   ProgressLog[]

  @@index([goalId])
  @@index([status])
  @@index([goalId, order])
  @@map("milestones")
}

model ProgressLog {
  id          Int       @id @default(autoincrement())
  goalId      Int       @map("goal_id")
  milestoneId Int?      @map("milestone_id")
  userId      Int       @map("user_id")
  date        DateTime  @db.Date
  content     String
  hours       Decimal   @db.Decimal(4, 1)
  rating      Int?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  goal        Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)
  milestone   Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date], name: "unique_user_date")
  @@index([goalId])
  @@index([userId, date])
  @@index([date])
  @@map("progress_logs")
}

model Achievement {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  type        String
  title       String
  description String?
  iconUrl     String?   @map("icon_url")
  unlockedAt  DateTime  @default(now()) @map("unlocked_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type], name: "unique_user_achievement")
  @@index([userId])
  @@index([type])
  @@map("achievements")
}

model AISuggestion {
  id             Int       @id @default(autoincrement())
  goalId         Int       @map("goal_id")
  suggestionType String    @map("suggestion_type")
  content        Json
  status         String    @default("pending")
  createdAt      DateTime  @default(now()) @map("created_at")
  reviewedAt     DateTime? @map("reviewed_at")

  goal           Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@index([goalId])
  @@index([status])
  @@map("ai_suggestions")
}
```

---

## 5. マイグレーション戦略

### 5.1 初期セットアップ

```bash
# Prisma初期化
cd apps/api
pnpm prisma init

# マイグレーション作成
pnpm prisma migrate dev --name init

# クライアント生成
pnpm prisma generate
```

### 5.2 マイグレーション手順

1. **開発環境**:
   ```bash
   pnpm prisma migrate dev --name add_new_column
   ```

2. **本番環境**:
   ```bash
   pnpm prisma migrate deploy
   ```

### 5.3 シードデータ

```typescript
// apps/api/prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // テストユーザー作成
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      googleId: 'google_test_id',
      character: {
        create: {
          name: 'トレちゃん',
        },
      },
    },
  })

  console.log({ user })
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

実行:
```bash
pnpm prisma db seed
```

---

## 6. バックアップ・リストア

### 6.1 バックアップ（自動）

- **AWS RDS 自動バックアップ**: 日次スナップショット（保持期間7日）
- **手動バックアップ**: 重要なリリース前に手動スナップショット

### 6.2 リストア手順

```bash
# RDS スナップショットからの復元
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ai-trainer-db-restored \
  --db-snapshot-identifier ai-trainer-db-snapshot-2025-12-01
```

---

## 7. パフォーマンス最適化

### 7.1 インデックス戦略

- 頻繁に検索されるカラムにインデックスを設定
- 複合インデックス: `(user_id, date)` など

### 7.2 N+1クエリ対策

Prismaの`include`を使用して一括取得:

```typescript
const goals = await prisma.goal.findMany({
  where: { userId: 1 },
  include: {
    milestones: true,
    progressLogs: {
      orderBy: { date: 'desc' },
      take: 10,
    },
  },
})
```

---

**作成日**: 2025-12-01
**最終更新日**: 2025-12-01
**バージョン**: 1.0

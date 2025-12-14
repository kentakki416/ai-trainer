# 目標設定・ロードマップ作成機能 - データベーススキーマ

## 1. 概要

この機能では、目標、マイルストーン、タスク、AI提案を管理します。
基本的なテーブル定義は `1-authentication/database/database-schema.md` に記載されています。

このドキュメントでは、ロードマップ作成に特化したテーブルを追加定義します。

---

## 2. テーブル定義

### 2.1 Tasks（日次タスク）

**説明**: AI提案またはユーザー作成の日々のタスク

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | タスクID |
| goal_id | INTEGER | NOT NULL, FK(goals.id) | 目標ID |
| milestone_id | INTEGER | NULL, FK(milestones.id) | 関連マイルストーン |
| title | VARCHAR(255) | NOT NULL | タスクタイトル |
| date | DATE | NOT NULL | タスクの予定日 |
| estimated_minutes | INTEGER | NOT NULL | 推定所要時間（分） |
| actual_minutes | INTEGER | NULL | 実際の所要時間（分） |
| completed | BOOLEAN | DEFAULT false | 完了フラグ |
| order | INTEGER | NOT NULL | 表示順序 |
| source | VARCHAR(20) | DEFAULT 'ai' | タスク生成元 (*1) |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |
| completed_at | TIMESTAMP | NULL | 完了日時 |

**Index**:
- `idx_tasks_goal_id` (goal_id)
- `idx_tasks_date` (date)
- `idx_tasks_goal_date` (goal_id, date)

**(*1) source の取りうる値**:
- `ai`: AI提案タスク
- `user`: ユーザー作成タスク

---

### 2.2 AIAnalysisHistory（AI分析履歴）

**説明**: AI分析の実行履歴を記録（月間制限管理用）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | 履歴ID |
| user_id | INTEGER | NOT NULL, FK(users.id) | ユーザーID |
| goal_id | INTEGER | NOT NULL, FK(goals.id) | 目標ID |
| analysis_type | VARCHAR(50) | NOT NULL | 分析タイプ (*2) |
| status | VARCHAR(20) | DEFAULT 'pending' | ステータス (*3) |
| request_data | JSONB | NULL | リクエストデータ |
| response_data | JSONB | NULL | レスポンスデータ |
| error_message | TEXT | NULL | エラーメッセージ |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| completed_at | TIMESTAMP | NULL | 完了日時 |

**Index**:
- `idx_ai_analysis_user_id` (user_id)
- `idx_ai_analysis_goal_id` (goal_id)
- `idx_ai_analysis_created_at` (created_at)

**(*2) analysis_type の取りうる値**:
- `goal_initial`: 初回目標分析
- `goal_reanalysis`: 再分析
- `milestone_generation`: マイルストーン生成
- `task_generation`: タスク生成

**(*3) status の取りうる値**:
- `pending`: 処理待ち
- `processing`: 処理中
- `completed`: 完了
- `failed`: 失敗

---

### 2.3 StudyStreak（連続学習記録）

**説明**: ユーザーの連続学習日数を記録（実績解除用）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| id | SERIAL | PRIMARY KEY | 記録ID |
| user_id | INTEGER | UNIQUE, NOT NULL, FK(users.id) | ユーザーID |
| current_streak | INTEGER | DEFAULT 0 | 現在の連続日数 |
| longest_streak | INTEGER | DEFAULT 0 | 最長連続日数 |
| last_logged_date | DATE | NULL | 最後に記録した日 |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |

**Index**:
- `idx_study_streak_user_id` (user_id)

**計算ロジック**:
```sql
-- 連続日数の更新ロジック
-- 1. 最後の記録日が昨日 → current_streak + 1
-- 2. 最後の記録日が今日 → 変更なし
-- 3. 最後の記録日が昨日より前 → current_streak = 1（リセット）
-- 4. current_streak > longest_streak → longest_streak = current_streak
```

---

## 3. 既存テーブルへの追加カラム

### 3.1 Goals テーブルへの追加

既存の `Goals` テーブルに以下のカラムを追加:

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| current_level | TEXT | NULL | ユーザーの現在のレベル |
| category | VARCHAR(50) | NULL | 目標カテゴリ（学習/資格/スキルなど） |
| ai_analysis_count | INTEGER | DEFAULT 0 | AI分析実行回数 |

---

### 3.2 Milestones テーブルへの追加

既存の `Milestones` テーブルに以下のカラムを追加:

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|-----|------|
| source | VARCHAR(20) | DEFAULT 'ai' | 生成元（ai/user） |

---

## 4. Prisma Schema

```prisma
// apps/api/prisma/schema.prisma に追加

model Task {
  id               Int        @id @default(autoincrement())
  goalId           Int        @map("goal_id")
  milestoneId      Int?       @map("milestone_id")
  title            String
  date             DateTime   @db.Date
  estimatedMinutes Int        @map("estimated_minutes")
  actualMinutes    Int?       @map("actual_minutes")
  completed        Boolean    @default(false)
  order            Int
  source           String     @default("ai")
  createdAt        DateTime   @default(now()) @map("created_at")
  updatedAt        DateTime   @updatedAt @map("updated_at")
  completedAt      DateTime?  @map("completed_at")

  goal             Goal       @relation(fields: [goalId], references: [id], onDelete: Cascade)
  milestone        Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)

  @@index([goalId])
  @@index([date])
  @@index([goalId, date])
  @@map("tasks")
}

model AIAnalysisHistory {
  id            Int       @id @default(autoincrement())
  userId        Int       @map("user_id")
  goalId        Int       @map("goal_id")
  analysisType  String    @map("analysis_type")
  status        String    @default("pending")
  requestData   Json?     @map("request_data")
  responseData  Json?     @map("response_data")
  errorMessage  String?   @map("error_message")
  createdAt     DateTime  @default(now()) @map("created_at")
  completedAt   DateTime? @map("completed_at")

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  goal          Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([goalId])
  @@index([createdAt])
  @@map("ai_analysis_history")
}

model StudyStreak {
  id             Int       @id @default(autoincrement())
  userId         Int       @unique @map("user_id")
  currentStreak  Int       @default(0) @map("current_streak")
  longestStreak  Int       @default(0) @map("longest_streak")
  lastLoggedDate DateTime? @map("last_logged_date") @db.Date
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("study_streaks")
}
```

---

## 5. マイグレーション手順

### 5.1 新規テーブル作成

```bash
cd apps/api
pnpm prisma migrate dev --name add_roadmap_tables
```

### 5.2 シードデータ

```typescript
// apps/api/prisma/seed.ts に追加

async function seedRoadmapData() {
  const user = await prisma.user.findFirst()
  if (!user) return

  // サンプル目標作成
  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      title: 'TOEIC 800点取得',
      description: 'キャリアアップのため',
      targetDate: new Date('2025-06-01'),
      status: 'active',
      currentLevel: 'TOEIC 500点',
      category: '資格',
      estimatedHours: 200,
      aiAnalysis: {
        estimated_hours: 200,
        breakdown: {
          vocabulary: 60,
          grammar: 40,
          listening: 60,
          reading: 40,
        },
        recommendations: [
          '毎日30分以上の学習を推奨',
          '週に1回は模擬試験を受けると効果的',
        ],
      },
    },
  })

  // サンプルマイルストーン作成
  const milestone = await prisma.milestone.create({
    data: {
      goalId: goal.id,
      title: 'TOEIC 650点達成',
      targetDate: new Date('2025-03-01'),
      estimatedHours: 100,
      order: 0,
      source: 'ai',
    },
  })

  // サンプルタスク作成
  await prisma.task.createMany({
    data: [
      {
        goalId: goal.id,
        milestoneId: milestone.id,
        title: '英単語30個暗記',
        date: new Date(),
        estimatedMinutes: 30,
        order: 0,
        source: 'ai',
      },
      {
        goalId: goal.id,
        milestoneId: milestone.id,
        title: '文法問題20問',
        date: new Date(),
        estimatedMinutes: 30,
        order: 1,
        source: 'ai',
      },
    ],
  })

  // 連続記録初期化
  await prisma.studyStreak.create({
    data: {
      userId: user.id,
      currentStreak: 0,
      longestStreak: 0,
    },
  })

  console.log('Roadmap seed data created')
}
```

---

## 6. インデックス戦略

### 6.1 パフォーマンス最適化

**頻繁に実行されるクエリ**:
1. 特定日のタスク一覧取得: `SELECT * FROM tasks WHERE goal_id = ? AND date = ?`
2. 月間進捗サマリー: `SELECT * FROM progress_logs WHERE user_id = ? AND date BETWEEN ? AND ?`
3. AI分析回数チェック: `SELECT COUNT(*) FROM ai_analysis_history WHERE user_id = ? AND created_at >= ?`

**推奨インデックス**:
- Tasks: `(goal_id, date)` 複合インデックス
- ProgressLogs: `(user_id, date)` 複合インデックス（既存）
- AIAnalysisHistory: `(user_id, created_at)` 複合インデックス

---

## 7. データ整合性

### 7.1 制約事項

1. **タスク日付**: 目標の `target_date` を超えるタスクは作成不可
2. **AI分析回数**: 無料ユーザーは月3回まで（アプリケーションレベルで制御）
3. **連続記録**: 1日1回のみ更新可能

### 7.2 カスケード削除

- 目標削除 → 関連するタスク、マイルストーン、AI分析履歴もすべて削除
- マイルストーン削除 → 関連するタスクの `milestone_id` は NULL に設定

---

## 8. パフォーマンス考慮事項

### 8.1 N+1問題の回避

タスク一覧取得時に目標・マイルストーン情報も一括取得:

```typescript
const tasks = await prisma.task.findMany({
  where: {
    goalId: 1,
    date: new Date('2025-12-01'),
  },
  include: {
    goal: true,
    milestone: true,
  },
  orderBy: {
    order: 'asc',
  },
})
```

### 8.2 集計クエリの最適化

週次/月次サマリーは頻繁に取得されるため、キャッシュの利用を検討:
- Redis にサマリーデータをキャッシュ（TTL: 1時間）
- 進捗ログ作成時にキャッシュを無効化

---

**作成日**: 2025-12-02
**最終更新日**: 2025-12-02
**バージョン**: 1.0

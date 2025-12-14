# 2. ロードマップ作成機能 - 実装ガイド

このドキュメントは、ロードマップ作成機能を**ステップ単位で動作確認しながら実装する**ためのガイドです。

**前提条件**: `1. 認証機能` が完了していること

## 📋 実装の全体像

```
Step 1: データベース拡張（動作確認: 目標・マイルストーン・タスクテーブル作成）
  ↓
Step 2: 目標作成API（動作確認: 目標を作成してDBに保存）
  ↓
Step 3: AI分析API（モックAPI）（動作確認: 固定レスポンスを返す）
  ↓
Step 4: Web: オンボーディング画面（動作確認: 目標入力→AI分析→結果表示）
  ↓
Step 5: マイルストーンCRUD API（動作確認: 中間ゴール編集）
  ↓
Step 6: タスクCRUD API（動作確認: 日次タスク管理）
  ↓
Step 7: AI分析API（実装）（動作確認: OpenAI/Claude APIで実際に分析）
  ↓
Step 8: 一括タスク完了API（動作確認: 複数タスク完了→経験値加算）
```

---

## Step 1: データベース拡張

### 目的
目標、マイルストーン、タスク、AI分析履歴などのテーブルを追加する。

### 実装箇所
- `apps/api/prisma/schema.prisma`

### 実装手順

#### 1-1. Prismaスキーマ拡張

**ファイル**: `apps/api/prisma/schema.prisma`（既存ファイルに追加）

```prisma
// User モデルに追加
model User {
  // ... 既存のフィールド

  achievements         Achievement[]
  goals                Goal[]
  progressLogs         ProgressLog[]
  studyStreak          StudyStreak?

  // ... 既存のリレーション
}

model Goal {
  abandonedAt    DateTime?      @map("abandoned_at")
  achievedAt     DateTime?      @map("achieved_at")
  actualHours    Decimal        @default(0) @map("actual_hours") @db.Decimal(6, 1)
  aiAnalysis     Json?          @map("ai_analysis")
  category       String?
  createdAt      DateTime       @default(now()) @map("created_at")
  currentLevel   String?        @map("current_level")
  description    String?
  estimatedHours Decimal?       @map("estimated_hours") @db.Decimal(6, 1)
  id             Int            @id @default(autoincrement())
  status         String         @default("pending_analysis")
  targetDate     DateTime       @map("target_date") @db.Date
  title          String
  updatedAt      DateTime       @updatedAt @map("updated_at")
  userId         Int            @map("user_id")

  aiSuggestions  AISuggestion[]
  milestones     Milestone[]
  progressLogs   ProgressLog[]
  tasks          Task[]
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@map("goals")
}

model Milestone {
  achievedAt     DateTime?     @map("achieved_at")
  actualHours    Decimal       @default(0) @map("actual_hours") @db.Decimal(6, 1)
  createdAt      DateTime      @default(now()) @map("created_at")
  description    String?
  estimatedHours Decimal?      @map("estimated_hours") @db.Decimal(6, 1)
  goalId         Int           @map("goal_id")
  id             Int           @id @default(autoincrement())
  order          Int
  source         String        @default("ai")
  status         String        @default("pending")
  targetDate     DateTime      @map("target_date") @db.Date
  title          String
  updatedAt      DateTime      @updatedAt @map("updated_at")

  goal           Goal          @relation(fields: [goalId], references: [id], onDelete: Cascade)
  progressLogs   ProgressLog[]
  tasks          Task[]

  @@index([goalId])
  @@index([status])
  @@index([goalId, order])
  @@map("milestones")
}

model Task {
  actualMinutes    Int?      @map("actual_minutes")
  completed        Boolean   @default(false)
  completedAt      DateTime? @map("completed_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  date             DateTime  @db.Date
  estimatedMinutes Int       @map("estimated_minutes")
  goalId           Int       @map("goal_id")
  id               Int       @id @default(autoincrement())
  milestoneId      Int?      @map("milestone_id")
  order            Int
  source           String    @default("ai")
  title            String
  updatedAt        DateTime  @updatedAt @map("updated_at")

  goal             Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)
  milestone        Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)

  @@index([goalId])
  @@index([date])
  @@index([goalId, date])
  @@map("tasks")
}

model ProgressLog {
  content     String
  createdAt   DateTime   @default(now()) @map("created_at")
  date        DateTime   @db.Date
  goalId      Int        @map("goal_id")
  hours       Decimal    @db.Decimal(4, 1)
  id          Int        @id @default(autoincrement())
  milestoneId Int?       @map("milestone_id")
  rating      Int?
  updatedAt   DateTime   @updatedAt @map("updated_at")
  userId      Int        @map("user_id")

  goal        Goal       @relation(fields: [goalId], references: [id], onDelete: Cascade)
  milestone   Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date], name: "unique_user_date")
  @@index([goalId])
  @@index([userId, date])
  @@index([date])
  @@map("progress_logs")
}

model Achievement {
  createdAt   DateTime @default(now()) @map("created_at")
  description String?
  iconUrl     String?  @map("icon_url")
  id          Int      @id @default(autoincrement())
  title       String
  type        String
  unlockedAt  DateTime @default(now()) @map("unlocked_at")
  userId      Int      @map("user_id")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type], name: "unique_user_achievement")
  @@index([userId])
  @@index([type])
  @@map("achievements")
}

model AISuggestion {
  content        Json
  createdAt      DateTime  @default(now()) @map("created_at")
  goalId         Int       @map("goal_id")
  id             Int       @id @default(autoincrement())
  reviewedAt     DateTime? @map("reviewed_at")
  status         String    @default("pending")
  suggestionType String    @map("suggestion_type")

  goal           Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@index([goalId])
  @@index([status])
  @@map("ai_suggestions")
}

model StudyStreak {
  createdAt      DateTime  @default(now()) @map("created_at")
  currentStreak  Int       @default(0) @map("current_streak")
  id             Int       @id @default(autoincrement())
  lastLoggedDate DateTime? @map("last_logged_date") @db.Date
  longestStreak  Int       @default(0) @map("longest_streak")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  userId         Int       @unique @map("user_id")

  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("study_streaks")
}
```

#### 1-2. マイグレーション実行

```bash
cd apps/api
pnpm prisma migrate dev --name add_roadmap_tables
pnpm prisma generate
```

### 動作確認

```bash
# Prisma Studioでテーブルを確認
cd apps/api
pnpm prisma studio
```

**確認項目**:
- ✅ `goals` テーブルが存在する
- ✅ `milestones` テーブルが存在する
- ✅ `tasks` テーブルが存在する
- ✅ `progress_logs` テーブルが存在する
- ✅ `achievements` テーブルが存在する
- ✅ `ai_suggestions` テーブルが存在する
- ✅ `study_streaks` テーブルが存在する

---

## Step 2: 目標作成API

### 目的
ユーザーが新規目標を作成し、DBに保存できることを確認する。

### 実装箇所
- `packages/schema/src/api-schema/goal.ts`
- `apps/api/src/index.ts`

### 実装手順

#### 2-1. Zodスキーマ定義

**ファイル**: `packages/schema/src/api-schema/goal.ts`

```typescript
import { z } from 'zod'

export const goalCreateRequestSchema = z.object({
  category: z.string().optional(),
  current_level: z.string().optional(),
  description: z.string().optional(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
})

export type GoalCreateRequest = z.infer<typeof goalCreateRequestSchema>

export const goalResponseSchema = z.object({
  abandoned_at: z.string().nullable(),
  achieved_at: z.string().nullable(),
  actual_hours: z.number(),
  ai_analysis: z.any().nullable(),
  category: z.string().nullable(),
  created_at: z.string(),
  current_level: z.string().nullable(),
  description: z.string().nullable(),
  estimated_hours: z.number().nullable(),
  id: z.number(),
  status: z.enum(['pending_analysis', 'analyzed', 'active', 'achieved', 'abandoned']),
  target_date: z.string(),
  title: z.string(),
  updated_at: z.string(),
})

export type GoalResponse = z.infer<typeof goalResponseSchema>
```

**ファイル**: `packages/schema/src/api-schema/index.ts`（既存ファイルに追加）

```typescript
export * from './auth'
export * from './goal'
```

#### 2-2. スキーマビルド

```bash
cd packages/schema
pnpm build
```

#### 2-3. 目標作成API実装

**ファイル**: `apps/api/src/index.ts`（既存ファイルに追加）

```typescript
import { goalCreateRequestSchema } from '@repo/api-schema'

// ... 既存のコード

// 目標一覧取得
app.get('/api/goals', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const goals = await prisma.goal.findMany({
      orderBy: { createdAt: 'desc' },
      where: { userId: req.userId },
    })

    res.json({
      goals: goals.map((goal) => ({
        abandoned_at: goal.abandonedAt?.toISOString() || null,
        achieved_at: goal.achievedAt?.toISOString() || null,
        actual_hours: Number(goal.actualHours),
        category: goal.category,
        created_at: goal.createdAt.toISOString(),
        description: goal.description,
        estimated_hours: goal.estimatedHours ? Number(goal.estimatedHours) : null,
        id: goal.id,
        status: goal.status,
        target_date: goal.targetDate.toISOString().split('T')[0],
        title: goal.title,
      })),
    })
  } catch (error) {
    console.error('Get goals error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 目標作成
app.post('/api/goals', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const body = goalCreateRequestSchema.parse(req.body)

    const goal = await prisma.goal.create({
      data: {
        category: body.category,
        currentLevel: body.current_level,
        description: body.description,
        targetDate: new Date(body.target_date),
        title: body.title,
        userId: req.userId!,
      },
    })

    res.status(201).json({
      abandoned_at: null,
      achieved_at: null,
      actual_hours: 0,
      ai_analysis: null,
      category: goal.category,
      created_at: goal.createdAt.toISOString(),
      current_level: goal.currentLevel,
      description: goal.description,
      estimated_hours: null,
      id: goal.id,
      status: goal.status,
      target_date: goal.targetDate.toISOString().split('T')[0],
      title: goal.title,
      updated_at: goal.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        details: error.errors,
        error: 'Validation failed',
      })
    }
    console.error('Create goal error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 目標詳細取得
app.get('/api/goals/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const goalId = parseInt(req.params.id)

    const goal = await prisma.goal.findFirst({
      include: {
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
      where: {
        id: goalId,
        userId: req.userId,
      },
    })

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' })
    }

    res.json({
      abandoned_at: goal.abandonedAt?.toISOString() || null,
      achieved_at: goal.achievedAt?.toISOString() || null,
      actual_hours: Number(goal.actualHours),
      ai_analysis: goal.aiAnalysis,
      category: goal.category,
      created_at: goal.createdAt.toISOString(),
      current_level: goal.currentLevel,
      description: goal.description,
      estimated_hours: goal.estimatedHours ? Number(goal.estimatedHours) : null,
      id: goal.id,
      milestones: goal.milestones.map((m) => ({
        achieved_at: m.achievedAt?.toISOString() || null,
        actual_hours: Number(m.actualHours),
        estimated_hours: m.estimatedHours ? Number(m.estimatedHours) : null,
        id: m.id,
        order: m.order,
        status: m.status,
        target_date: m.targetDate.toISOString().split('T')[0],
        title: m.title,
      })),
      status: goal.status,
      target_date: goal.targetDate.toISOString().split('T')[0],
      title: goal.title,
      updated_at: goal.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Get goal error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

### 動作確認

```bash
# APIサーバーが起動していることを確認
cd apps/api
pnpm dev

# curlでテスト（TOKENは実際のJWTトークンに置き換える）
# 1. 目標作成
curl -X POST http://localhost:8080/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TOEIC 800点取得",
    "description": "キャリアアップのため",
    "target_date": "2025-06-01",
    "category": "資格",
    "current_level": "TOEIC 500点"
  }'

# 2. 目標一覧取得
curl http://localhost:8080/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. 目標詳細取得
curl http://localhost:8080/api/goals/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**確認項目**:
- ✅ 目標を作成できる
- ✅ 作成した目標が一覧に表示される
- ✅ 目標詳細を取得できる
- ✅ データベースに目標が保存されている

---

## Step 3: AI分析API（モック）

### 目的
AI分析の基本フローを確認するため、まず固定のレスポンスを返すモックAPIを実装する。

### 実装箇所
- `packages/schema/src/api-schema/goal.ts`
- `apps/api/src/index.ts`

### 実装手順

#### 3-1. Zodスキーマ追加

**ファイル**: `packages/schema/src/api-schema/goal.ts`（既存ファイルに追加）

```typescript
export const goalAnalyzeRequestSchema = z.object({
  additional_context: z.string().optional(),
  current_level: z.string().min(1),
})

export type GoalAnalyzeRequest = z.infer<typeof goalAnalyzeRequestSchema>

export const milestoneSchema = z.object({
  estimated_hours: z.number(),
  order: z.number(),
  target_date: z.string(),
  title: z.string(),
})

export const goalAnalyzeResponseSchema = z.object({
  analysis: z.object({
    breakdown: z.record(z.number()),
    estimated_hours: z.number(),
    recommendations: z.array(z.string()),
  }),
  goal_id: z.number(),
  status: z.string(),
  suggested_milestones: z.array(milestoneSchema),
})

export type GoalAnalyzeResponse = z.infer<typeof goalAnalyzeResponseSchema>
```

#### 3-2. スキーマビルド

```bash
cd packages/schema
pnpm build
```

#### 3-3. AI分析API実装（モック）

**ファイル**: `apps/api/src/index.ts`（既存ファイルに追加）

```typescript
import { goalAnalyzeRequestSchema } from '@repo/api-schema'

// AI分析リクエスト（モック版）
app.post(
  '/api/goals/:id/analyze',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const goalId = parseInt(req.params.id)
      const body = goalAnalyzeRequestSchema.parse(req.body)

      // 目標の存在確認
      const goal = await prisma.goal.findFirst({
        where: {
          id: goalId,
          userId: req.userId,
        },
      })

      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' })
      }

      // 既に分析済みの場合はエラー
      if (goal.status !== 'pending_analysis') {
        return res.status(400).json({
          error: 'Goal already analyzed',
          message: '目標は既に分析済みです',
        })
      }

      // モックのAI分析結果
      const aiAnalysis = {
        breakdown: {
          grammar: 40,
          listening: 60,
          reading: 40,
          vocabulary: 60,
        },
        estimated_hours: 200,
        recommendations: [
          '毎日30分以上の学習を推奨',
          '週に1回は模擬試験を受けると効果的',
          'リスニングに重点を置くと効率的',
        ],
      }

      // 中間ゴール生成
      const targetDate = new Date(goal.targetDate)
      const today = new Date()
      const daysUntilTarget = Math.floor(
        (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      const suggestedMilestones = [
        {
          estimated_hours: 30,
          order: 0,
          target_date: new Date(
            today.getTime() + (daysUntilTarget / 4) * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0],
          title: '英単語帳1冊完了',
        },
        {
          estimated_hours: 100,
          order: 1,
          target_date: new Date(
            today.getTime() + (daysUntilTarget / 2) * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0],
          title: `${goal.title.includes('TOEIC') ? 'TOEIC 650点達成' : '中間目標達成'}`,
        },
        {
          estimated_hours: 180,
          order: 2,
          target_date: new Date(
            today.getTime() + ((daysUntilTarget * 3) / 4) * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0],
          title: `${goal.title.includes('TOEIC') ? 'TOEIC 750点達成' : '最終調整段階'}`,
        },
      ]

      // 目標を更新
      await prisma.goal.update({
        data: {
          aiAnalysis,
          currentLevel: body.current_level,
          estimatedHours: aiAnalysis.estimated_hours,
          status: 'analyzed',
        },
        where: { id: goalId },
      })

      // マイルストーンを作成
      for (const milestone of suggestedMilestones) {
        await prisma.milestone.create({
          data: {
            estimatedHours: milestone.estimated_hours,
            goalId,
            order: milestone.order,
            source: 'ai',
            targetDate: new Date(milestone.target_date),
            title: milestone.title,
          },
        })
      }

      res.json({
        analysis: aiAnalysis,
        goal_id: goalId,
        status: 'analyzed',
        suggested_milestones: suggestedMilestones,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          details: error.errors,
          error: 'Validation failed',
        })
      }
      console.error('Analyze goal error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// 目標確認（analyzed -> active）
app.put(
  '/api/goals/:id/confirm',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const goalId = parseInt(req.params.id)

      const goal = await prisma.goal.findFirst({
        where: {
          id: goalId,
          userId: req.userId,
        },
      })

      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' })
      }

      if (goal.status !== 'analyzed') {
        return res.status(400).json({
          error: 'Invalid status',
          message: '分析済みの目標のみ確認できます',
        })
      }

      const updatedGoal = await prisma.goal.update({
        data: { status: 'active' },
        where: { id: goalId },
      })

      res.json({
        id: updatedGoal.id,
        status: updatedGoal.status,
        updated_at: updatedGoal.updatedAt.toISOString(),
      })
    } catch (error) {
      console.error('Confirm goal error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)
```

### 動作確認

```bash
# APIサーバーが起動していることを確認

# 1. 目標作成
curl -X POST http://localhost:8080/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TOEIC 800点取得",
    "target_date": "2025-06-01",
    "current_level": "TOEIC 500点"
  }'

# 2. AI分析リクエスト（目標IDは1と仮定）
curl -X POST http://localhost:8080/api/goals/1/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_level": "TOEIC 500点",
    "additional_context": "平日は1時間、週末は2時間学習可能"
  }'

# 3. 目標詳細取得（マイルストーンが追加されていることを確認）
curl http://localhost:8080/api/goals/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. 目標確認（active状態に変更）
curl -X PUT http://localhost:8080/api/goals/1/confirm \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**確認項目**:
- ✅ AI分析をリクエストできる
- ✅ 分析結果が返される
- ✅ マイルストーンが自動生成される
- ✅ 目標のステータスが `analyzed` に変更される
- ✅ 目標確認で `active` に変更される

---

## Step 4: Web - オンボーディング画面

### 目的
初回ユーザーが目標を入力し、AI分析を受け、結果を確認できる画面を実装する。

### 実装箇所
- `apps/web/src/app/onboarding/page.tsx`
- `apps/web/src/lib/api.ts`

### 実装手順

#### 4-1. APIクライアント拡張

**ファイル**: `apps/web/src/lib/api.ts`（既存ファイルに追加）

```typescript
import { GoalAnalyzeRequest, GoalAnalyzeResponse, GoalCreateRequest, GoalResponse } from '@repo/api-schema'

// ApiClient クラスに追加
async createGoal(data: GoalCreateRequest): Promise<GoalResponse> {
  return this.fetch('/api/goals', {
    body: JSON.stringify(data),
    method: 'POST',
  })
}

async analyzeGoal(
  goalId: number,
  data: GoalAnalyzeRequest
): Promise<GoalAnalyzeResponse> {
  return this.fetch(`/api/goals/${goalId}/analyze`, {
    body: JSON.stringify(data),
    method: 'POST',
  })
}

async confirmGoal(goalId: number): Promise<void> {
  return this.fetch(`/api/goals/${goalId}/confirm`, {
    method: 'PUT',
  })
}

async getGoal(goalId: number): Promise<any> {
  return this.fetch(`/api/goals/${goalId}`)
}
```

#### 4-2. オンボーディング画面実装

**ファイル**: `apps/web/src/app/onboarding/page.tsx`

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { GoalAnalyzeResponse } from '@repo/api-schema'

import { apiClient } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

type Step = 1 | 2 | 3 | 4

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Step 1: 目標入力
  const [goalTitle, setGoalTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [category, setCategory] = useState('資格')

  // Step 2: 現在の状況
  const [currentLevel, setCurrentLevel] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')

  // Step 3-4: AI分析結果
  const [goalId, setGoalId] = useState<number | null>(null)
  const [analysisResult, setAnalysisResult] = useState<GoalAnalyzeResponse | null>(null)

  if (!isAuthenticated()) {
    router.push('/login')
    return null
  }

  const handleStep1Next = async () => {
    if (!goalTitle || !targetDate) {
      alert('目標内容と達成希望日を入力してください')
      return
    }

    setLoading(true)
    try {
      const goal = await apiClient.createGoal({
        category,
        target_date: targetDate,
        title: goalTitle,
      })
      setGoalId(goal.id)
      setStep(2)
    } catch (error) {
      alert('目標の作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2Next = async () => {
    if (!currentLevel || !goalId) {
      alert('現在のレベルを入力してください')
      return
    }

    setLoading(true)
    setStep(3) // AI分析中画面へ

    try {
      const result = await apiClient.analyzeGoal(goalId, {
        additional_context: additionalContext,
        current_level: currentLevel,
      })
      setAnalysisResult(result)
      setStep(4) // 結果表示へ
    } catch (error) {
      alert('AI分析に失敗しました')
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!goalId) return

    setLoading(true)
    try {
      await apiClient.confirmGoal(goalId)
      router.push('/')
    } catch (error) {
      alert('目標の確認に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        {/* Step 1: 目標入力 */}
        {step === 1 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-6 flex items-center justify-between">
              <button
                className="text-blue-600 hover:text-blue-700"
                onClick={() => router.push('/')}
                type="button"
              >
                ← スキップ
              </button>
              <span className="text-gray-500">ステップ 1/4</span>
            </div>

            <h2 className="mb-6 text-2xl font-bold">あなたの目標を教えてください</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  目標内容 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="例: TOEIC 800点取得"
                  type="text"
                  value={goalTitle}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  達成希望日 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  onChange={(e) => setTargetDate(e.target.value)}
                  type="date"
                  value={targetDate}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  目標カテゴリ
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  onChange={(e) => setCategory(e.target.value)}
                  value={category}
                >
                  <option value="資格">📚 資格</option>
                  <option value="学習">📖 学習</option>
                  <option value="スキル">💻 スキル</option>
                  <option value="その他">✨ その他</option>
                </select>
              </div>

              <button
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                disabled={loading}
                onClick={handleStep1Next}
                type="button"
              >
                {loading ? '処理中...' : '次へ →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 現在の状況入力 */}
        {step === 2 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-6 flex items-center justify-between">
              <button
                className="text-blue-600 hover:text-blue-700"
                onClick={() => setStep(1)}
                type="button"
              >
                ← 戻る
              </button>
              <span className="text-gray-500">ステップ 2/4</span>
            </div>

            <h2 className="mb-6 text-2xl font-bold">現在の状況を教えてください</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  現在のレベル <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  placeholder="例: TOEIC 200点"
                  type="text"
                  value={currentLevel}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  その他の情報（任意）
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="例: 平日は1時間、週末は2時間学習可能です"
                  rows={4}
                  value={additionalContext}
                />
              </div>

              <button
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                disabled={loading}
                onClick={handleStep2Next}
                type="button"
              >
                {loading ? '処理中...' : 'AI分析開始 →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: AI分析中 */}
        {step === 3 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-6 text-center">
              <span className="text-gray-500">ステップ 3/4</span>
            </div>

            <div className="py-12 text-center">
              <div className="mb-6 text-6xl">🤔</div>
              <h2 className="mb-4 text-2xl font-bold">AIが目標を分析しています...</h2>
              <div className="mx-auto mb-6 h-2 w-64 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full w-3/4 animate-pulse rounded-full bg-blue-600" />
              </div>
              <p className="text-gray-600">推定学習時間を計算中...</p>
            </div>
          </div>
        )}

        {/* Step 4: AI分析結果 */}
        {step === 4 && analysisResult && (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-6 flex items-center justify-between">
              <button
                className="text-blue-600 hover:text-blue-700"
                onClick={() => setStep(2)}
                type="button"
              >
                ← 戻る
              </button>
              <span className="text-gray-500">ステップ 4/4</span>
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold">🎯 {goalTitle}</h2>
              <p className="text-gray-600">📅 達成日: {targetDate}</p>
            </div>

            <hr className="my-6" />

            <div className="mb-6">
              <h3 className="mb-4 text-xl font-bold">📊 AI分析結果</h3>
              <div className="space-y-2 rounded-lg bg-blue-50 p-4">
                <p>
                  <span className="font-semibold">⏱️ 推定学習時間:</span>{' '}
                  {analysisResult.analysis.estimated_hours}時間
                </p>
                <p>
                  <span className="font-semibold">📚 1日の推奨学習:</span> 30分〜1時間
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="mb-2 font-semibold">💡 推奨事項:</h4>
              <ul className="list-inside list-disc space-y-1 text-gray-700">
                {analysisResult.analysis.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>

            <hr className="my-6" />

            <div className="mb-6">
              <h3 className="mb-4 text-xl font-bold">
                🏁 中間ゴール ({analysisResult.suggested_milestones.length}つ)
              </h3>
              <div className="space-y-3">
                {analysisResult.suggested_milestones.map((milestone, index) => (
                  <div
                    className="rounded-lg border border-gray-200 p-4"
                    key={index}
                  >
                    <p className="font-semibold">✓ {milestone.title}</p>
                    <p className="text-sm text-gray-600">
                      目標日: {milestone.target_date}
                    </p>
                    <p className="text-sm text-gray-600">
                      推定: {milestone.estimated_hours}時間
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:bg-gray-300"
              disabled={loading}
              onClick={handleConfirm}
              type="button"
            >
              {loading ? '処理中...' : '開始する!'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

### 動作確認

```bash
# Webアプリが起動していることを確認
cd apps/web
pnpm dev

# ブラウザで http://localhost:3000/onboarding にアクセス
# 1. Step 1: 目標を入力
# 2. Step 2: 現在の状況を入力
# 3. Step 3: AI分析中のアニメーション表示
# 4. Step 4: 分析結果と中間ゴールを確認
# 5. 「開始する」でホーム画面へ
```

**確認項目**:
- ✅ 4ステップの画面遷移が正常に動作する
- ✅ 目標作成APIが呼ばれる
- ✅ AI分析APIが呼ばれる
- ✅ 分析結果と中間ゴールが表示される
- ✅ 確認後、ホーム画面へ遷移する

---

## Step 5: マイルストーンCRUD API

### 目的
中間ゴールの編集機能を実装する（追加・更新・削除）。

### 実装手順は省略（基本的なCRUD操作）

---

## Step 6: タスクCRUD API

### 目的
日次タスクの管理機能を実装する。

### 実装手順は省略（基本的なCRUD操作）

---

## Step 7: AI分析API（実装）

### 目的
OpenAI APIまたはClaude APIを使って、実際のAI分析を実装する。

### 実装箇所
- `apps/api/src/lib/ai-analyzer.ts`

### 実装手順

#### 7-1. AIアナライザー作成

**ファイル**: `apps/api/src/lib/ai-analyzer.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || ''

interface AnalysisInput {
  additional_context?: string
  current_level: string
  target_date: string
  title: string
}

interface AnalysisResult {
  breakdown: Record<string, number>
  estimated_hours: number
  recommendations: string[]
}

export async function analyzeGoalWithAI(
  input: AnalysisInput
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey: CLAUDE_API_KEY })

  const prompt = `
あなたは学習プランニングの専門家です。以下の目標について分析してください。

目標: ${input.title}
達成希望日: ${input.target_date}
現在のレベル: ${input.current_level}
${input.additional_context ? `追加情報: ${input.additional_context}` : ''}

以下のJSON形式で回答してください：
{
  "estimated_hours": <推定学習時間（数値）>,
  "breakdown": {
    "<分野1>": <時間数>,
    "<分野2>": <時間数>
  },
  "recommendations": [
    "<推奨事項1>",
    "<推奨事項2>"
  ]
}

JSONのみを返してください。説明は不要です。
`

  const message = await client.messages.create({
    max_tokens: 1024,
    messages: [{ content: prompt, role: 'user' }],
    model: 'claude-3-5-sonnet-20241022',
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  try {
    return JSON.parse(content.text)
  } catch (error) {
    console.error('Failed to parse AI response:', content.text)
    throw new Error('AI analysis failed')
  }
}
```

#### 7-2. API実装の更新

**ファイル**: `apps/api/src/index.ts`（Step 3で作成したモック部分を置き換え）

```typescript
import { analyzeGoalWithAI } from './lib/ai-analyzer'

// AI分析リクエスト（実装版）
app.post(
  '/api/goals/:id/analyze',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const goalId = parseInt(req.params.id)
      const body = goalAnalyzeRequestSchema.parse(req.body)

      const goal = await prisma.goal.findFirst({
        where: {
          id: goalId,
          userId: req.userId,
        },
      })

      if (!goal) {
        return res.status(404).json({ error: 'Goal not found' })
      }

      if (goal.status !== 'pending_analysis') {
        return res.status(400).json({
          error: 'Goal already analyzed',
        })
      }

      // AI分析を実行
      const aiAnalysis = await analyzeGoalWithAI({
        additional_context: body.additional_context,
        current_level: body.current_level,
        target_date: goal.targetDate.toISOString().split('T')[0],
        title: goal.title,
      })

      // ... 以降はStep 3と同じ
    } catch (error) {
      // ... エラーハンドリング
    }
  }
)
```

#### 7-3. 依存パッケージインストール

```bash
cd apps/api
pnpm add @anthropic-ai/sdk
```

#### 7-4. 環境変数設定

**ファイル**: `apps/api/.env.local`（追加）

```env
CLAUDE_API_KEY=sk-ant-api...
```

### 動作確認

```bash
# APIサーバーを再起動
cd apps/api
pnpm dev

# Webアプリでオンボーディングを実行し、実際にAI分析が行われることを確認
```

**確認項目**:
- ✅ Claude APIが呼ばれる
- ✅ 目標に応じた分析結果が返される
- ✅ 推定時間や推奨事項が適切に生成される

---

## Step 8: 一括タスク完了API

### 目的
複数タスクを一括完了し、キャラクターの経験値を加算する。

### 実装箇所
- `packages/schema/src/api-schema/task.ts`
- `apps/api/src/index.ts`

### 実装手順は省略（経験値計算とDB更新）

---

## ✅ 完了チェックリスト

すべてのステップが完了したら、以下を確認してください：

### データベース
- [ ] すべてのロードマップ関連テーブルが作成されている
- [ ] マイグレーションが正常に実行されている

### API
- [ ] 目標作成・取得・更新・削除ができる
- [ ] AI分析（モック/実装）が動作する
- [ ] マイルストーンCRUDが動作する
- [ ] タスクCRUDが動作する
- [ ] 一括タスク完了と経験値加算が動作する

### Web
- [ ] オンボーディング画面が正常に動作する
- [ ] 4ステップすべてが遷移する
- [ ] AI分析結果が表示される
- [ ] 目標確認後、ホーム画面へ遷移する

### コーディング規約
- [ ] セミコロンなし
- [ ] シングルクォート使用
- [ ] インポート順序が正しい
- [ ] オブジェクトキーがアルファベット順
- [ ] ESLintエラーがない

---

## 次のステップ

ロードマップ作成機能が完成したら、次は **3. ホーム画面とダッシュボード** の実装に進んでください。

参照: `docs/phase1/spec/3-home/IMPLEMENTATION.md`（作成予定）

# 進捗管理・可視化機能 - API仕様書

## 1. API概要

この機能は、ホーム画面（ダッシュボード）での進捗可視化とカレンダービューをサポートします。

基本的なAPI仕様は `1-authentication/api/api-specification.md` に記載されています。
このドキュメントでは、進捗可視化に特化したエンドポイントを定義します。

---

## 2. ダッシュボードAPI

### 2.1 ダッシュボード情報取得

**Endpoint**: `GET /dashboard`

**認証**: 必要

**説明**: ホーム画面に表示する情報を一括取得

**レスポンス**:
```json
{
  "active_goal": {
    "actual_hours": 45.5,
    "estimated_hours": 200,
    "id": 1,
    "progress_percentage": 22.75,
    "target_date": "2025-06-01",
    "title": "TOEIC 800点取得"
  },
  "character": {
    "appearance_stage": "stage2",
    "experience": 250,
    "id": 1,
    "level": 5,
    "name": "トレちゃん",
    "next_level_experience": 360
  },
  "next_milestone": {
    "days_remaining": 120,
    "id": 2,
    "progress_percentage": 37.5,
    "target_date": "2025-04-01",
    "title": "TOEIC 650点達成"
  },
  "pending_suggestions": 1,
  "today_tasks": [
    {
      "completed": false,
      "estimated_minutes": 30,
      "id": 1,
      "title": "英単語30個暗記"
    },
    {
      "completed": true,
      "estimated_minutes": 30,
      "id": 2,
      "title": "文法問題20問"
    }
  ],
  "user": {
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "email": "john@example.com",
    "id": 1,
    "name": "John Doe"
  },
  "weekly_summary": {
    "days_logged": 5,
    "streak": 5,
    "total_hours": 7.5
  }
}
```

**Zodスキーマ** (`packages/schema/src/api-schema/dashboard.ts`):
```typescript
import { z } from 'zod'

export const dashboardResponseSchema = z.object({
  active_goal: z.object({
    actual_hours: z.number(),
    estimated_hours: z.number().nullable(),
    id: z.number(),
    progress_percentage: z.number(),
    target_date: z.string(),
    title: z.string(),
  }).nullable(),
  character: z.object({
    appearance_stage: z.string(),
    experience: z.number(),
    id: z.number(),
    level: z.number(),
    name: z.string(),
    next_level_experience: z.number(),
  }),
  next_milestone: z.object({
    days_remaining: z.number(),
    id: z.number(),
    progress_percentage: z.number(),
    target_date: z.string(),
    title: z.string(),
  }).nullable(),
  pending_suggestions: z.number(),
  today_tasks: z.array(
    z.object({
      completed: z.boolean(),
      estimated_minutes: z.number(),
      id: z.number(),
      title: z.string(),
    })
  ),
  user: z.object({
    avatar_url: z.string().nullable(),
    email: z.string(),
    id: z.number(),
    name: z.string(),
  }),
  weekly_summary: z.object({
    days_logged: z.number(),
    streak: z.number(),
    total_hours: z.number(),
  }),
})

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
```

**処理フロー**:
1. ユーザーの現在のアクティブな目標を取得
2. キャラクター情報を取得
3. 次の未達成マイルストーンを取得
4. 今日のタスク一覧を取得
5. 今週のサマリーを計算
6. 未確認のAI提案数を取得
7. すべての情報を統合して返す

---

## 3. カレンダーAPI

### 3.1 月次カレンダー取得

**Endpoint**: `GET /calendar/monthly`

**認証**: 必要

**クエリパラメータ**:
- `year` (number, required): 年（例: 2025）
- `month` (number, required): 月（1-12）
- `goal_id` (number, optional): 特定の目標でフィルター

**レスポンス**:
```json
{
  "days": [
    {
      "date": "2025-12-01",
      "goal_hours": 1.0,
      "has_log": true,
      "hours": 1.5,
      "rating": 4,
      "status": "above_goal"
    },
    {
      "date": "2025-12-02",
      "goal_hours": 1.0,
      "has_log": true,
      "hours": 0.8,
      "rating": 3,
      "status": "below_goal"
    },
    {
      "date": "2025-12-03",
      "goal_hours": 1.0,
      "has_log": false,
      "hours": 0,
      "rating": null,
      "status": "not_logged"
    }
  ],
  "month": 12,
  "summary": {
    "average_hours": 1.2,
    "days_logged": 20,
    "total_days": 31,
    "total_hours": 45.5
  },
  "year": 2025
}
```

**Zodスキーマ**:
```typescript
export const monthlyCalendarResponseSchema = z.object({
  days: z.array(
    z.object({
      date: z.string(),
      goal_hours: z.number(),
      has_log: z.boolean(),
      hours: z.number(),
      rating: z.number().nullable(),
      status: z.enum(['above_goal', 'below_goal', 'not_logged']),
    })
  ),
  month: z.number().min(1).max(12),
  summary: z.object({
    average_hours: z.number(),
    days_logged: z.number(),
    total_days: z.number(),
    total_hours: z.number(),
  }),
  year: z.number(),
})
```

**status の意味**:
- `above_goal`: 目標時間を超過（緑）
- `below_goal`: 目標の50%以上（黄色）
- `not_logged`: 未入力（灰色）

---

### 3.2 特定日の詳細取得

**Endpoint**: `GET /calendar/daily/:date`

**認証**: 必要

**パスパラメータ**:
- `date` (string): 日付（YYYY-MM-DD）

**レスポンス**:
```json
{
  "date": "2025-12-01",
  "progress_log": {
    "content": "英単語100個暗記、文法問題20問",
    "created_at": "2025-12-01T20:00:00Z",
    "goal_id": 1,
    "hours": 1.5,
    "id": 1,
    "milestone_id": 1,
    "rating": 4
  },
  "tasks": [
    {
      "actual_minutes": 35,
      "completed": true,
      "completed_at": "2025-12-01T20:00:00Z",
      "estimated_minutes": 30,
      "id": 1,
      "title": "英単語30個暗記"
    },
    {
      "actual_minutes": 55,
      "completed": true,
      "completed_at": "2025-12-01T20:30:00Z",
      "estimated_minutes": 30,
      "id": 2,
      "title": "文法問題20問"
    }
  ]
}
```

**Zodスキーマ**:
```typescript
export const dailyDetailResponseSchema = z.object({
  date: z.string(),
  progress_log: z.object({
    content: z.string(),
    created_at: z.string(),
    goal_id: z.number(),
    hours: z.number(),
    id: z.number(),
    milestone_id: z.number().nullable(),
    rating: z.number().nullable(),
  }).nullable(),
  tasks: z.array(
    z.object({
      actual_minutes: z.number().nullable(),
      completed: z.boolean(),
      completed_at: z.string().nullable(),
      estimated_minutes: z.number(),
      id: z.number(),
      title: z.string(),
    })
  ),
})
```

---

## 4. 統計API

### 4.1 目標別統計取得

**Endpoint**: `GET /goals/:goal_id/statistics`

**認証**: 必要

**レスポンス**:
```json
{
  "daily_average": 1.2,
  "goal_id": 1,
  "milestones": {
    "achieved": 1,
    "total": 3
  },
  "progress": {
    "actual_hours": 45.5,
    "estimated_hours": 200,
    "percentage": 22.75,
    "remaining_hours": 154.5
  },
  "streak": {
    "current": 5,
    "longest": 12
  },
  "weekly_breakdown": [
    {
      "average_hours": 1.0,
      "days_logged": 5,
      "total_hours": 7.0,
      "week_end": "2025-12-07",
      "week_start": "2025-12-01"
    }
  ]
}
```

**Zodスキーマ**:
```typescript
export const goalStatisticsResponseSchema = z.object({
  daily_average: z.number(),
  goal_id: z.number(),
  milestones: z.object({
    achieved: z.number(),
    total: z.number(),
  }),
  progress: z.object({
    actual_hours: z.number(),
    estimated_hours: z.number().nullable(),
    percentage: z.number(),
    remaining_hours: z.number(),
  }),
  streak: z.object({
    current: z.number(),
    longest: z.number(),
  }),
  weekly_breakdown: z.array(
    z.object({
      average_hours: z.number(),
      days_logged: z.number(),
      total_hours: z.number(),
      week_end: z.string(),
      week_start: z.string(),
    })
  ),
})
```

---

### 4.2 グラフデータ取得

**Endpoint**: `GET /goals/:goal_id/chart-data`

**認証**: 必要

**クエリパラメータ**:
- `period` (string): 期間（`week`, `month`, `all`）

**レスポンス**:
```json
{
  "goal_id": 1,
  "labels": ["12/01", "12/02", "12/03", "12/04", "12/05"],
  "period": "week",
  "values": [1.5, 2.0, 0.0, 1.0, 1.5]
}
```

**Zodスキーマ**:
```typescript
export const chartDataResponseSchema = z.object({
  goal_id: z.number(),
  labels: z.array(z.string()),
  period: z.enum(['week', 'month', 'all']),
  values: z.array(z.number()),
})
```

---

## 5. 進捗比較API

### 5.1 ペース比較

**Endpoint**: `GET /goals/:goal_id/pace-analysis`

**認証**: 必要

**説明**: 現在のペースと目標達成に必要なペースを比較

**レスポンス**:
```json
{
  "current_pace": {
    "daily_average": 0.8,
    "weekly_average": 5.6
  },
  "goal_id": 1,
  "required_pace": {
    "daily_average": 1.1,
    "weekly_average": 7.7
  },
  "status": "behind",
  "suggestion": "目標達成には、あと週2時間の学習が必要です"
}
```

**Zodスキーマ**:
```typescript
export const paceAnalysisResponseSchema = z.object({
  current_pace: z.object({
    daily_average: z.number(),
    weekly_average: z.number(),
  }),
  goal_id: z.number(),
  required_pace: z.object({
    daily_average: z.number(),
    weekly_average: z.number(),
  }),
  status: z.enum(['on_track', 'ahead', 'behind']),
  suggestion: z.string(),
})
```

**status の意味**:
- `on_track`: 目標達成ペースを維持
- `ahead`: 目標より早いペース
- `behind`: 目標より遅いペース

---

## 6. 通知API

### 6.1 未確認通知取得

**Endpoint**: `GET /notifications/unread`

**認証**: 必要

**レスポンス**:
```json
{
  "notifications": [
    {
      "action_url": "/ai/suggestions/5",
      "created_at": "2025-12-01T10:00:00Z",
      "id": 1,
      "message": "進捗が順調です！次の中間ゴールの日程を早めることをお勧めします。",
      "read": false,
      "title": "AI提案",
      "type": "ai_suggestion"
    },
    {
      "action_url": null,
      "created_at": "2025-12-01T09:00:00Z",
      "id": 2,
      "message": "5日連続で学習を記録しました！",
      "read": false,
      "title": "連続記録達成",
      "type": "achievement"
    }
  ],
  "unread_count": 2
}
```

**Zodスキーマ**:
```typescript
export const notificationsResponseSchema = z.object({
  notifications: z.array(
    z.object({
      action_url: z.string().nullable(),
      created_at: z.string(),
      id: z.number(),
      message: z.string(),
      read: z.boolean(),
      title: z.string(),
      type: z.enum(['ai_suggestion', 'achievement', 'reminder', 'milestone']),
    })
  ),
  unread_count: z.number(),
})
```

---

### 6.2 通知を既読にする

**Endpoint**: `PUT /notifications/:id/read`

**認証**: 必要

**レスポンス**:
```json
{
  "id": 1,
  "read": true,
  "read_at": "2025-12-01T11:00:00Z"
}
```

---

### 6.3 全通知を既読にする

**Endpoint**: `PUT /notifications/read-all`

**認証**: 必要

**レスポンス**:
```json
{
  "message": "All notifications marked as read",
  "updated_count": 5
}
```

---

## 7. エラーハンドリング

### 7.1 データが存在しない

**Status**: `404 Not Found`

**レスポンス**:
```json
{
  "error": "Not Found",
  "message": "指定した日付に進捗記録が存在しません"
}
```

### 7.2 無効な日付形式

**Status**: `400 Bad Request`

**レスポンス**:
```json
{
  "error": "Invalid date format",
  "message": "日付はYYYY-MM-DD形式で指定してください"
}
```

---

**作成日**: 2025-12-02
**最終更新日**: 2025-12-02
**バージョン**: 1.0

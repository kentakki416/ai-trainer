# 目標設定・ロードマップ作成機能 - API仕様書

## 1. API概要

この機能は、ユーザーの目標設定からAI分析、中間ゴールの生成、日々のタスク提案までをサポートします。

### 1.1 関連するエンドポイント

基本的な目標・マイルストーン・進捗APIは `1-authentication/api/api-specification.md` に記載されています。
このドキュメントでは、ロードマップ作成に特化したエンドポイントを定義します。

---

## 2. 目標分析API

### 2.1 AI分析リクエスト

**Endpoint**: `POST /goals/:goal_id/analyze`

**認証**: 必要

**説明**: 目標に対してAI分析をリクエストし、推定学習時間や推奨計画を取得

**リクエストボディ**:
```json
{
  "current_level": "TOEIC 200点",
  "additional_context": "平日は1時間、週末は2時間学習可能"
}
```

**Zodスキーマ** (`packages/schema/src/api-schema/goal.ts`):
```typescript
export const goalAnalyzeRequestSchema = z.object({
  additional_context: z.string().optional(),
  current_level: z.string().min(1),
})
```

**レスポンス**:
```json
{
  "goal_id": 1,
  "analysis": {
    "breakdown": {
      "grammar": 40,
      "listening": 60,
      "reading": 40,
      "vocabulary": 60
    },
    "estimated_hours": 200,
    "recommendations": [
      "毎日30分以上の学習を推奨",
      "週に1回は模擬試験を受けると効果的"
    ]
  },
  "status": "analyzed",
  "suggested_milestones": [
    {
      "estimated_hours": 30,
      "order": 0,
      "target_date": "2025-02-15",
      "title": "英単語帳1冊完了"
    },
    {
      "estimated_hours": 60,
      "order": 1,
      "target_date": "2025-04-01",
      "title": "TOEIC 500点達成"
    }
  ]
}
```

**処理フロー**:
1. 目標の現在のステータスが `pending_analysis` であることを確認
2. AI API（OpenAI/Claude）にリクエストを送信
3. 分析結果を `goals.ai_analysis` に保存
4. 推奨される中間ゴールを生成
5. 目標のステータスを `analyzed` に更新
6. レスポンスを返す

**エラーレスポンス**:
- `400 Bad Request`: 目標が既に分析済み
- `403 Forbidden`: 月間AI分析回数制限超過（無料ユーザー: 3回）
- `404 Not Found`: 目標が存在しない

---

### 2.2 AI分析状況確認

**Endpoint**: `GET /goals/:goal_id/analyze/status`

**認証**: 必要

**説明**: AI分析の進行状況を確認（非同期処理の場合）

**レスポンス**:
```json
{
  "goal_id": 1,
  "progress": 75,
  "status": "analyzing"
}
```

**status の取りうる値**:
- `pending`: 分析待ち
- `analyzing`: 分析中
- `completed`: 分析完了
- `failed`: 分析失敗

---

## 3. タスク提案API

### 3.1 日次タスク取得

**Endpoint**: `GET /goals/:goal_id/tasks/daily`

**認証**: 必要

**クエリパラメータ**:
- `date` (string, optional): 取得する日付（YYYY-MM-DD）、デフォルトは今日

**説明**: 指定した日のAI提案タスク一覧を取得

**レスポンス**:
```json
{
  "date": "2025-12-01",
  "goal_id": 1,
  "tasks": [
    {
      "completed": false,
      "estimated_minutes": 30,
      "id": 1,
      "order": 0,
      "title": "英単語30個暗記"
    },
    {
      "completed": false,
      "estimated_minutes": 30,
      "id": 2,
      "order": 1,
      "title": "文法問題20問"
    }
  ],
  "total_estimated_minutes": 60
}
```

**Zodスキーマ**:
```typescript
export const dailyTasksResponseSchema = z.object({
  date: z.string(),
  goal_id: z.number(),
  tasks: z.array(
    z.object({
      completed: z.boolean(),
      estimated_minutes: z.number(),
      id: z.number(),
      order: z.number(),
      title: z.string(),
    })
  ),
  total_estimated_minutes: z.number(),
})
```

---

### 3.2 タスクの完了マーク

**Endpoint**: `PUT /tasks/:task_id/complete`

**認証**: 必要

**リクエストボディ**:
```json
{
  "completed": true,
  "actual_minutes": 35
}
```

**レスポンス**:
```json
{
  "actual_minutes": 35,
  "completed": true,
  "completed_at": "2025-12-01T20:00:00Z",
  "id": 1,
  "title": "英単語30個暗記"
}
```

**処理フロー**:
1. タスクの完了状態を更新
2. 実際の所要時間を記録
3. 関連する目標の `actual_hours` を更新
4. キャラクターの経験値を加算

---

### 3.3 タスクの一括完了

**Endpoint**: `POST /goals/:goal_id/tasks/batch-complete`

**認証**: 必要

**説明**: 複数のタスクを一括で完了マーク

**リクエストボディ**:
```json
{
  "date": "2025-12-01",
  "task_completions": [
    {
      "actual_minutes": 35,
      "task_id": 1
    },
    {
      "actual_minutes": 25,
      "task_id": 2
    }
  ]
}
```

**Zodスキーマ**:
```typescript
export const batchCompleteTasksRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  task_completions: z.array(
    z.object({
      actual_minutes: z.number().min(1).max(1440),
      task_id: z.number(),
    })
  ),
})
```

**レスポンス**:
```json
{
  "character_update": {
    "experience_gained": 10,
    "level_up": false,
    "new_level": 5
  },
  "completed_count": 2,
  "total_minutes": 60
}
```

---

### 3.4 カスタムタスク作成

**Endpoint**: `POST /goals/:goal_id/tasks`

**認証**: 必要

**説明**: ユーザーが自分でタスクを追加

**リクエストボディ**:
```json
{
  "date": "2025-12-01",
  "estimated_minutes": 45,
  "milestone_id": 2,
  "title": "模擬試験1回"
}
```

**Zodスキーマ**:
```typescript
export const createTaskRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimated_minutes: z.number().min(1).max(1440),
  milestone_id: z.number().optional(),
  title: z.string().min(1).max(255),
})
```

**レスポンス**:
```json
{
  "completed": false,
  "date": "2025-12-01",
  "estimated_minutes": 45,
  "goal_id": 1,
  "id": 10,
  "milestone_id": 2,
  "order": 2,
  "title": "模擬試験1回"
}
```

---

### 3.5 タスク編集

**Endpoint**: `PUT /tasks/:task_id`

**認証**: 必要

**リクエストボディ**:
```json
{
  "estimated_minutes": 40,
  "title": "模擬試験1回（Part 5-6のみ）"
}
```

**レスポンス**:
```json
{
  "estimated_minutes": 40,
  "id": 10,
  "title": "模擬試験1回（Part 5-6のみ）",
  "updated_at": "2025-12-01T11:00:00Z"
}
```

---

### 3.6 タスク削除

**Endpoint**: `DELETE /tasks/:task_id`

**認証**: 必要

**レスポンス**:
```json
{
  "message": "Task deleted successfully"
}
```

---

## 4. 進捗サマリーAPI

### 4.1 週次サマリー取得

**Endpoint**: `GET /goals/:goal_id/summary/weekly`

**認証**: 必要

**クエリパラメータ**:
- `week_offset` (number, optional): 何週間前か（0=今週、1=先週、...）

**レスポンス**:
```json
{
  "days_logged": 5,
  "goal_id": 1,
  "streak": 5,
  "total_hours": 7.5,
  "week_end": "2025-12-07",
  "week_start": "2025-12-01"
}
```

---

### 4.2 月次サマリー取得

**Endpoint**: `GET /goals/:goal_id/summary/monthly`

**認証**: 必要

**クエリパラメータ**:
- `year` (number): 年
- `month` (number): 月（1-12）

**レスポンス**:
```json
{
  "daily_breakdown": [
    {
      "date": "2025-12-01",
      "hours": 1.5,
      "logged": true
    },
    {
      "date": "2025-12-02",
      "hours": 2.0,
      "logged": true
    }
  ],
  "days_logged": 20,
  "goal_id": 1,
  "month": 12,
  "total_hours": 45.5,
  "year": 2025
}
```

---

## 5. AI再提案API

### 5.1 AI提案一覧

**Endpoint**: `GET /ai/suggestions`

**認証**: 必要

**説明**: AIからの定期的な提案（ペース調整、励ましなど）を取得

**レスポンス**: `1-authentication/api/api-specification.md` の 9.1 を参照

---

### 5.2 AI提案の受け入れ/拒否

**Endpoint**: `PUT /ai/suggestions/:id`

**認証**: 必要

**説明**: AI提案を受け入れるか拒否する

**レスポンス**: `1-authentication/api/api-specification.md` の 9.2 を参照

---

## 6. ロードマップ関連Zodスキーマ

### `packages/schema/src/api-schema/task.ts`

```typescript
import { z } from 'zod'

export const taskSchema = z.object({
  completed: z.boolean(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  date: z.string(),
  estimated_minutes: z.number(),
  goal_id: z.number(),
  id: z.number(),
  milestone_id: z.number().nullable(),
  order: z.number(),
  title: z.string(),
  updated_at: z.string(),
})

export type Task = z.infer<typeof taskSchema>

export const dailyTasksResponseSchema = z.object({
  date: z.string(),
  goal_id: z.number(),
  tasks: z.array(taskSchema),
  total_estimated_minutes: z.number(),
})

export const createTaskRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimated_minutes: z.number().min(1).max(1440),
  milestone_id: z.number().optional(),
  title: z.string().min(1).max(255),
})

export const batchCompleteTasksRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  task_completions: z.array(
    z.object({
      actual_minutes: z.number().min(1).max(1440),
      task_id: z.number(),
    })
  ),
})

export const goalAnalyzeRequestSchema = z.object({
  additional_context: z.string().optional(),
  current_level: z.string().min(1),
})
```

---

## 7. エラーハンドリング

### 7.1 AI分析回数制限エラー

**Status**: `403 Forbidden`

**レスポンス**:
```json
{
  "error": "AI analysis limit exceeded",
  "message": "無料ユーザーは月3回までAI分析を利用できます。",
  "retry_after": "2025-01-01T00:00:00Z"
}
```

### 7.2 タスクの重複エラー

**Status**: `400 Bad Request`

**レスポンス**:
```json
{
  "error": "Task already exists",
  "message": "指定した日付に同じタイトルのタスクが既に存在します"
}
```

---

**作成日**: 2025-12-02
**最終更新日**: 2025-12-02
**バージョン**: 1.0

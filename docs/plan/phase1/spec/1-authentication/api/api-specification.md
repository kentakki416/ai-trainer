# AI Trainer - API仕様書

## 1. API概要

### 1.1 ベースURL
- **開発環境**: `http://localhost:8080/api`
- **本番環境**: `https://api.ai-trainer.example.com/api`

### 1.2 認証
- **方式**: Bearer Token (JWT)
- **ヘッダー**: `Authorization: Bearer <token>`

### 1.3 レスポンス形式
- **Content-Type**: `application/json`
- **エラーレスポンス形式**:
  ```json
  {
    "error": "Error message",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
  ```

### 1.4 HTTPステータスコード
- `200 OK`: 成功
- `201 Created`: リソース作成成功
- `400 Bad Request`: リクエストパラメータ不正
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限エラー
- `404 Not Found`: リソースが存在しない
- `500 Internal Server Error`: サーバーエラー

---

## 2. 認証API

### 2.1 Google OAuth ログイン

**Endpoint**: `GET /auth/google`

**説明**: Google OAuth認証画面にリダイレクト

**レスポンス**:
- Status: `302 Found`
- Location: Google OAuth consent screen

---

### 2.2 Google OAuth コールバック

**Endpoint**: `GET /auth/google/callback`

**説明**: Google OAuth認証後のコールバック。JWTトークンを発行してフロントエンドにリダイレクト

**クエリパラメータ**:
- `code` (string): Google OAuth認証コード

**レスポンス**:
- Status: `302 Found`
- Location: `https://app.ai-trainer.example.com/dashboard?token=<jwt_token>`

---

### 2.3 現在のユーザー情報取得

**Endpoint**: `GET /auth/me`

**認証**: 必要

**レスポンス**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "avatar_url": "https://lh3.googleusercontent.com/...",
  "notification_enabled": true,
  "notification_time": "20:00",
  "timezone": "Asia/Tokyo",
  "created_at": "2025-12-01T10:00:00Z"
}
```

**Zodスキーマ** (`packages/schema/src/api-schema/auth.ts`):
```typescript
import { z } from 'zod'

export const userSchema = z.object({
  avatar_url: z.string().nullable(),
  created_at: z.string(),
  email: z.string().email(),
  id: z.number(),
  name: z.string(),
  notification_enabled: z.boolean(),
  notification_time: z.string(),
  timezone: z.string(),
})

export type User = z.infer<typeof userSchema>
```

---

### 2.4 ログアウト

**Endpoint**: `POST /auth/logout`

**認証**: 必要

**レスポンス**:
```json
{
  "message": "Logged out successfully"
}
```

---

## 3. 目標API

### 3.1 目標一覧取得

**Endpoint**: `GET /goals`

**認証**: 必要

**クエリパラメータ**:
- `status` (string, optional): フィルター (`active`, `achieved`, `abandoned`)

**レスポンス**:
```json
{
  "goals": [
    {
      "id": 1,
      "title": "TOEIC 800点取得",
      "description": "2025年6月までに達成",
      "target_date": "2025-06-01",
      "status": "active",
      "estimated_hours": 200,
      "actual_hours": 45.5,
      "created_at": "2025-12-01T10:00:00Z",
      "milestones_count": 3,
      "achieved_milestones_count": 1
    }
  ]
}
```

**Zodスキーマ** (`packages/schema/src/api-schema/goal.ts`):
```typescript
export const goalListResponseSchema = z.object({
  goals: z.array(
    z.object({
      achieved_milestones_count: z.number(),
      actual_hours: z.number(),
      created_at: z.string(),
      description: z.string().nullable(),
      estimated_hours: z.number().nullable(),
      id: z.number(),
      milestones_count: z.number(),
      status: z.enum(['pending_analysis', 'analyzed', 'active', 'achieved', 'abandoned']),
      target_date: z.string(),
      title: z.string(),
    })
  ),
})
```

---

### 3.2 目標作成

**Endpoint**: `POST /goals`

**認証**: 必要

**リクエストボディ**:
```json
{
  "title": "TOEIC 800点取得",
  "description": "キャリアアップのため",
  "target_date": "2025-06-01",
  "current_level": "TOEIC 500点"
}
```

**Zodスキーマ**:
```typescript
export const goalCreateRequestSchema = z.object({
  current_level: z.string().optional(),
  description: z.string().optional(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
})
```

**レスポンス**:
```json
{
  "id": 1,
  "title": "TOEIC 800点取得",
  "description": "キャリアアップのため",
  "target_date": "2025-06-01",
  "status": "pending_analysis",
  "created_at": "2025-12-01T10:00:00Z"
}
```

**処理フロー**:
1. 目標をDBに保存（status: `pending_analysis`）
2. バックグラウンドジョブでAI分析を実行
3. 分析完了後、status を `analyzed` に更新

---

### 3.3 目標詳細取得

**Endpoint**: `GET /goals/:id`

**認証**: 必要

**レスポンス**:
```json
{
  "id": 1,
  "title": "TOEIC 800点取得",
  "description": "キャリアアップのため",
  "target_date": "2025-06-01",
  "status": "active",
  "estimated_hours": 200,
  "actual_hours": 45.5,
  "ai_analysis": {
    "estimated_hours": 200,
    "breakdown": {
      "vocabulary": 60,
      "grammar": 40,
      "listening": 60,
      "reading": 40
    },
    "recommendations": [
      "毎日30分以上の学習を推奨"
    ]
  },
  "created_at": "2025-12-01T10:00:00Z",
  "milestones": [
    {
      "id": 1,
      "title": "TOEIC 500点達成",
      "target_date": "2025-03-01",
      "estimated_hours": 50,
      "actual_hours": 45.5,
      "status": "achieved",
      "order": 0,
      "achieved_at": "2025-02-28T15:00:00Z"
    }
  ]
}
```

---

### 3.4 目標確認（AI分析後）

**Endpoint**: `PUT /goals/:id/confirm`

**認証**: 必要

**説明**: AI分析完了後、ユーザーが目標を確認して進行中にする

**レスポンス**:
```json
{
  "id": 1,
  "status": "active",
  "updated_at": "2025-12-01T11:00:00Z"
}
```

---

### 3.5 目標達成

**Endpoint**: `PUT /goals/:id/achieve`

**認証**: 必要

**レスポンス**:
```json
{
  "id": 1,
  "status": "achieved",
  "achieved_at": "2025-06-01T10:00:00Z"
}
```

---

### 3.6 目標放棄

**Endpoint**: `PUT /goals/:id/abandon`

**認証**: 必要

**レスポンス**:
```json
{
  "id": 1,
  "status": "abandoned",
  "abandoned_at": "2025-06-01T10:00:00Z"
}
```

---

## 4. マイルストーンAPI

### 4.1 マイルストーン一覧取得

**Endpoint**: `GET /goals/:goal_id/milestones`

**認証**: 必要

**レスポンス**:
```json
{
  "milestones": [
    {
      "id": 1,
      "title": "TOEIC 500点達成",
      "description": null,
      "target_date": "2025-03-01",
      "estimated_hours": 50,
      "actual_hours": 45.5,
      "status": "achieved",
      "order": 0,
      "achieved_at": "2025-02-28T15:00:00Z"
    }
  ]
}
```

---

### 4.2 マイルストーン作成

**Endpoint**: `POST /goals/:goal_id/milestones`

**認証**: 必要

**リクエストボディ**:
```json
{
  "title": "英単語帳1冊完了",
  "description": "ターゲット1900を一周",
  "target_date": "2025-02-15",
  "estimated_hours": 30,
  "order": 1
}
```

**Zodスキーマ**:
```typescript
export const milestoneCreateRequestSchema = z.object({
  description: z.string().optional(),
  estimated_hours: z.number().optional(),
  order: z.number().int(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
})
```

**レスポンス**:
```json
{
  "id": 2,
  "goal_id": 1,
  "title": "英単語帳1冊完了",
  "target_date": "2025-02-15",
  "estimated_hours": 30,
  "status": "pending",
  "order": 1,
  "created_at": "2025-12-01T10:00:00Z"
}
```

---

### 4.3 マイルストーン更新

**Endpoint**: `PUT /milestones/:id`

**認証**: 必要

**リクエストボディ**:
```json
{
  "title": "英単語帳1冊完了",
  "target_date": "2025-02-20",
  "estimated_hours": 35
}
```

**レスポンス**:
```json
{
  "id": 2,
  "title": "英単語帳1冊完了",
  "target_date": "2025-02-20",
  "estimated_hours": 35,
  "updated_at": "2025-12-01T11:00:00Z"
}
```

---

### 4.4 マイルストーン達成

**Endpoint**: `PUT /milestones/:id/achieve`

**認証**: 必要

**レスポンス**:
```json
{
  "id": 2,
  "status": "achieved",
  "achieved_at": "2025-02-20T15:00:00Z"
}
```

---

### 4.5 マイルストーン削除

**Endpoint**: `DELETE /milestones/:id`

**認証**: 必要

**レスポンス**:
```json
{
  "message": "Milestone deleted successfully"
}
```

---

## 5. 進捗API

### 5.1 進捗ログ一覧取得

**Endpoint**: `GET /progress`

**認証**: 必要

**クエリパラメータ**:
- `goal_id` (number, optional): 目標でフィルター
- `start_date` (string, optional): 開始日（YYYY-MM-DD）
- `end_date` (string, optional): 終了日（YYYY-MM-DD）

**レスポンス**:
```json
{
  "progress_logs": [
    {
      "id": 1,
      "goal_id": 1,
      "milestone_id": 1,
      "date": "2025-12-01",
      "content": "英単語100個暗記",
      "hours": 1.5,
      "rating": 4,
      "created_at": "2025-12-01T20:00:00Z"
    }
  ]
}
```

---

### 5.2 進捗ログ作成

**Endpoint**: `POST /progress`

**認証**: 必要

**リクエストボディ**:
```json
{
  "goal_id": 1,
  "milestone_id": 1,
  "date": "2025-12-01",
  "content": "英単語100個暗記、文法問題20問",
  "hours": 1.5,
  "rating": 4
}
```

**Zodスキーマ**:
```typescript
export const progressCreateRequestSchema = z.object({
  content: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goal_id: z.number(),
  hours: z.number().min(0).max(24),
  milestone_id: z.number().optional(),
  rating: z.number().int().min(1).max(5).optional(),
})
```

**レスポンス**:
```json
{
  "progress_log": {
    "id": 1,
    "goal_id": 1,
    "date": "2025-12-01",
    "content": "英単語100個暗記、文法問題20問",
    "hours": 1.5,
    "rating": 4,
    "created_at": "2025-12-01T20:00:00Z"
  },
  "character_update": {
    "experience_gained": 15,
    "new_level": 3,
    "level_up": true
  }
}
```

**処理フロー**:
1. 進捗ログをDBに保存
2. 目標の `actual_hours` を更新
3. キャラクターの経験値を加算（hours × 10）
4. レベルアップチェック
5. 実績解除チェック（連続日数など）

---

### 5.3 進捗ログ更新

**Endpoint**: `PUT /progress/:id`

**認証**: 必要

**リクエストボディ**:
```json
{
  "content": "英単語120個暗記",
  "hours": 2.0,
  "rating": 5
}
```

**レスポンス**:
```json
{
  "id": 1,
  "content": "英単語120個暗記",
  "hours": 2.0,
  "rating": 5,
  "updated_at": "2025-12-01T21:00:00Z"
}
```

---

### 5.4 進捗ログ削除

**Endpoint**: `DELETE /progress/:id`

**認証**: 必要

**レスポンス**:
```json
{
  "message": "Progress log deleted successfully"
}
```

---

## 6. キャラクターAPI

### 6.1 キャラクター情報取得

**Endpoint**: `GET /character`

**認証**: 必要

**レスポンス**:
```json
{
  "id": 1,
  "user_id": 1,
  "name": "トレちゃん",
  "level": 5,
  "experience": 250,
  "next_level_experience": 360,
  "appearance_stage": "stage2",
  "appearance_color": "blue",
  "appearance_accessory": "hat",
  "created_at": "2025-12-01T10:00:00Z"
}
```

**Zodスキーマ**:
```typescript
export const characterResponseSchema = z.object({
  appearance_accessory: z.string().nullable(),
  appearance_color: z.string(),
  appearance_stage: z.string(),
  created_at: z.string(),
  experience: z.number(),
  id: z.number(),
  level: z.number(),
  name: z.string(),
  next_level_experience: z.number(),
  user_id: z.number(),
})
```

---

### 6.2 キャラクター名変更

**Endpoint**: `PUT /character`

**認証**: 必要

**リクエストボディ**:
```json
{
  "name": "トレ太郎"
}
```

**レスポンス**:
```json
{
  "id": 1,
  "name": "トレ太郎",
  "updated_at": "2025-12-01T11:00:00Z"
}
```

---

## 7. ユーザー設定API

### 7.1 設定取得

**Endpoint**: `GET /user/settings`

**認証**: 必要

**レスポンス**:
```json
{
  "notification_enabled": true,
  "notification_time": "20:00",
  "timezone": "Asia/Tokyo"
}
```

---

### 7.2 設定更新

**Endpoint**: `PUT /user/settings`

**認証**: 必要

**リクエストボディ**:
```json
{
  "notification_enabled": false,
  "notification_time": "21:00",
  "timezone": "Asia/Tokyo"
}
```

**レスポンス**:
```json
{
  "notification_enabled": false,
  "notification_time": "21:00",
  "timezone": "Asia/Tokyo",
  "updated_at": "2025-12-01T11:00:00Z"
}
```

---

## 8. 実績API

### 8.1 実績一覧取得

**Endpoint**: `GET /achievements`

**認証**: 必要

**レスポンス**:
```json
{
  "achievements": [
    {
      "id": 1,
      "type": "streak_7",
      "title": "連続7日間入力",
      "description": "7日間連続で進捗を記録しました",
      "icon_url": "/icons/streak-7.png",
      "unlocked_at": "2025-12-07T20:00:00Z"
    }
  ]
}
```

---

## 9. AI提案API

### 9.1 AI提案一覧取得

**Endpoint**: `GET /ai/suggestions`

**認証**: 必要

**クエリパラメータ**:
- `status` (string, optional): `pending`, `accepted`, `rejected`

**レスポンス**:
```json
{
  "suggestions": [
    {
      "id": 1,
      "goal_id": 1,
      "suggestion_type": "milestone_adjustment",
      "content": {
        "message": "進捗が順調です！次の中間ゴールの日程を早めることをお勧めします。",
        "proposed_milestones": [
          {
            "id": 3,
            "new_target_date": "2025-02-15",
            "old_target_date": "2025-03-01"
          }
        ]
      },
      "status": "pending",
      "created_at": "2025-12-01T10:00:00Z"
    }
  ]
}
```

---

### 9.2 AI提案の受け入れ/拒否

**Endpoint**: `PUT /ai/suggestions/:id`

**認証**: 必要

**リクエストボディ**:
```json
{
  "action": "accept"
}
```

**action の取りうる値**:
- `accept`: 提案を受け入れる
- `reject`: 提案を拒否する

**レスポンス**:
```json
{
  "id": 1,
  "status": "accepted",
  "reviewed_at": "2025-12-01T11:00:00Z"
}
```

**処理フロー（accept の場合）**:
1. 提案内容に基づいてマイルストーンを更新
2. 提案のステータスを `accepted` に更新

---

## 10. ダッシュボードAPI

### 10.1 ダッシュボード情報取得

**Endpoint**: `GET /dashboard`

**認証**: 必要

**レスポンス**:
```json
{
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "avatar_url": "https://lh3.googleusercontent.com/..."
  },
  "character": {
    "id": 1,
    "name": "トレちゃん",
    "level": 5,
    "experience": 250,
    "next_level_experience": 360,
    "appearance_stage": "stage2"
  },
  "active_goal": {
    "id": 1,
    "title": "TOEIC 800点取得",
    "target_date": "2025-06-01",
    "estimated_hours": 200,
    "actual_hours": 45.5,
    "progress_percentage": 22.75
  },
  "next_milestone": {
    "id": 2,
    "title": "TOEIC 650点達成",
    "target_date": "2025-04-01",
    "days_remaining": 120
  },
  "weekly_summary": {
    "total_hours": 7.5,
    "days_logged": 5,
    "streak": 5
  },
  "pending_suggestions": 1
}
```

---

## 11. Zodスキーマ一覧

### `packages/schema/src/api-schema/index.ts`

```typescript
export * from './auth'
export * from './goal'
export * from './milestone'
export * from './progress'
export * from './character'
export * from './user'
export * from './achievement'
export * from './ai'
```

---

## 12. エラーハンドリング

### 12.1 バリデーションエラー

**Status**: `400 Bad Request`

**レスポンス例**:
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "target_date",
      "message": "Invalid date format. Expected YYYY-MM-DD"
    },
    {
      "field": "hours",
      "message": "Hours must be between 0 and 24"
    }
  ]
}
```

### 12.2 認証エラー

**Status**: `401 Unauthorized`

**レスポンス例**:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 12.3 リソースが見つからない

**Status**: `404 Not Found`

**レスポンス例**:
```json
{
  "error": "Not Found",
  "message": "Goal with id 123 not found"
}
```

---

## 13. レート制限

**制限**: 15分あたり100リクエスト/ユーザー

**超過時のレスポンス**:
- Status: `429 Too Many Requests`
- Headers:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: 1701436800` (Unix timestamp)

**レスポンス例**:
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 300
}
```

---

**作成日**: 2025-12-01
**最終更新日**: 2025-12-01
**バージョン**: 1.0

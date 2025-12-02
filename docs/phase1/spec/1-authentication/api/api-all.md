## API設計

**主要エンドポイント**:

### 認証
- `POST /api/auth/google`: Google OAuth認証
- `POST /api/auth/refresh`: トークンリフレッシュ
- `POST /api/auth/logout`: ログアウト

### 目標
- `POST /api/goals`: 目標作成
- `GET /api/goals/:id`: 目標取得
- `PATCH /api/goals/:id`: 目標更新（達成/放棄のみ）

### 中間ゴール
- `POST /api/milestones`: 中間ゴール作成
- `GET /api/milestones`: 中間ゴール一覧取得
- `PATCH /api/milestones/:id`: 中間ゴール更新
- `DELETE /api/milestones/:id`: 中間ゴール削除

### 日々のタスク
- `GET /api/tasks/daily`: 今日のタスク一覧取得
- `POST /api/tasks`: タスク作成
- `PATCH /api/tasks/:id`: タスク更新
- `DELETE /api/tasks/:id`: タスク削除
- `POST /api/tasks/:id/complete`: タスク完了記録

### 進捗記録
- `POST /api/progress`: 進捗記録作成
- `GET /api/progress`: 進捗記録一覧取得
- `GET /api/progress/:date`: 特定日の進捗取得
- `PATCH /api/progress/:id`: 進捗記録更新
- `DELETE /api/progress/:id`: 進捗記録削除

### キャラクター
- `GET /api/character`: キャラクター情報取得
- `PATCH /api/character`: キャラクター外見変更

### AI機能
- `POST /api/ai/analyze-goal`: 目標分析
- `POST /api/ai/generate-milestones`: 中間ゴール生成
- `POST /api/ai/generate-daily-tasks`: 日々のタスク生成

---

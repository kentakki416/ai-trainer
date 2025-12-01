import cors from 'cors'
import dotenv from 'dotenv'
import express, { Request, Response } from 'express'

import {
  getUserRequestSchema,
  getUserResponseSchema,
  type GetUserRequest,
  type GetUserResponse,
} from '@repo/api-schema'

// 環境変数を読み込み
dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 8080

// ミドルウェア
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ルートエンドポイント
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'API Server is running',
    version: '1.0.0',
  })
})

// ヘルスチェックエンドポイント
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// ユーザー取得API: GET /api/user/:id
app.get('/api/user/:id', (req: Request, res: Response) => {
  try {
    // リクエストパラメータをバリデーション
    // TypeScriptの型チェックを有効にするため、型推論された型を使用
    const requestData: GetUserRequest = {
      id: req.params.id,
    }
    const validatedRequest = getUserRequestSchema.parse(requestData)

    // 固定値のレスポンスデータを返す
    // TypeScriptの型チェックを有効にするため、型推論された型を使用
    const responseData: GetUserResponse = {
      id: validatedRequest.id,
      message: `ユーザーID ${validatedRequest.id} の情報を取得しました`,
      timestamp: new Date().toISOString(),
    }
    // バリデーションを実行（型チェック済みのデータを検証）
    const validatedResponse = getUserResponseSchema.parse(responseData)

    res.json(validatedResponse)
  } catch (error) {
    // バリデーションエラーの場合
    if (error instanceof Error) {
      res.status(400).json({
        error: 'バリデーションエラー',
        message: error.message,
      })
    } else {
      res.status(500).json({
        error: 'サーバーエラー',
        message: '予期しないエラーが発生しました',
      })
    }
  }
})

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 API Server is running on http://localhost:${PORT}`)
})

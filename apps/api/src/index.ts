import cors from 'cors'
import express from 'express'

import { GoogleOAuthClient } from './client/google-oauth'
import { AuthGoogleController } from './controller/auth/google'
import { AuthGoogleCallbackController } from './controller/auth/google-callback'
import { AuthMeController } from './controller/auth/me'
import { logger } from './log'
import { authMiddleware } from './middleware/auth'
import { requestLogger } from './middleware/request-logger'
import { prisma } from './prisma/prisma.client'
import {
  PrismaAuthAccountRepository,
  PrismaUserRepository,
  // PrismaUserCharacterRepository,
  PrismaUserRegistrationRepository
} from './repository/mysql'
import { authRouter } from './routes/auth-router'

const app = express()
const PORT = process.env.PORT || 8080
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// 環境変数チェック
if (!process.env.GOOGLE_CLIENT_ID) {
  logger.error('GOOGLE_CLIENT_ID environment variable is required')
  throw new Error('GOOGLE_CLIENT_ID environment variable is required')
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  logger.error('GOOGLE_CLIENT_SECRET environment variable is required')
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required')
}
if (!process.env.GOOGLE_CALLBACK_URL) {
  logger.error('GOOGLE_CALLBACK_URL environment variable is required')
  throw new Error('GOOGLE_CALLBACK_URL environment variable is required')
}
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required')
  throw new Error('JWT_SECRET environment variable is required')
}

// Repository のインスタンス化
const userRepository = new PrismaUserRepository(prisma)
const authAccountRepository = new PrismaAuthAccountRepository(prisma)
// const userCharacterRepository = new PrismaUserCharacterRepository(prisma)
const userRegistrationRepository = new PrismaUserRegistrationRepository(prisma)

// Client のインスタンス化
const googleOAuthClient = new GoogleOAuthClient(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
)

// Controller のインスタンス化
const authGoogleController = new AuthGoogleController(googleOAuthClient)
const authGoogleCallbackController = new AuthGoogleCallbackController(
  authAccountRepository,
  userRegistrationRepository,
  googleOAuthClient,
)
const authMeController = new AuthMeController(userRepository)

// cors設定のミドルウェア
app.use(
  cors({
    credentials: true,
    origin: FRONTEND_URL,
  })
)

// jsonを変換するミドルウェア
app.use(express.json())

// 認証ミドルウェア
app.use(authMiddleware)

// リクエストのロギングミドルウェア（認証前に配置することで全リクエストをログ）
app.use(requestLogger)

// ルーティング
app.use(
  '/api/auth',
  authRouter(authGoogleController, authGoogleCallbackController, authMeController)
)

// サーバー起動
app.listen(PORT, () => {
  logger.info('API server running', {
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    url: `http://localhost:${PORT}`,
  })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  await prisma.$disconnect()
  logger.info('Database connection closed')
  process.exit(0)
})

// 予期しない例外をキャッチ（念のため）
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection',  reason as Error )
  process.exit(1)
})
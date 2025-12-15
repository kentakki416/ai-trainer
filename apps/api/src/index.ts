import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { GoogleOAuthClient } from './client/google-oauth'
import { AuthGoogleController } from './controller/auth/google'
import { AuthGoogleCallbackController } from './controller/auth/google-callback'
import { AuthMeController } from './controller/auth/me'
import { prisma } from './prisma/prisma.client'
import {
  PrismaAuthAccountRepository,
  PrismaUserRepository,
  // PrismaUserCharacterRepository,
  PrismaUserRegistrationRepository
} from './repository/mysql'
import { authRouter } from './routes/auth-router'

dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 8080
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// 環境変数チェック
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID environment variable is required')
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required')
}
if (!process.env.GOOGLE_CALLBACK_URL) {
  throw new Error('GOOGLE_CALLBACK_URL environment variable is required')
}
if (!process.env.JWT_SECRET) {
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

// ミドルウェア
app.use(
  cors({
    credentials: true,
    origin: FRONTEND_URL,
  })
)
app.use(express.json())

// ルーティング
app.use(
  '/api/auth',
  authRouter(authGoogleController, authGoogleCallbackController, authMeController)
)

// サーバー起動
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server running on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
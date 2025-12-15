import { Router } from 'express'

import { AuthGoogleController } from '../controller/auth/google'
import { AuthGoogleCallbackController } from '../controller/auth/google-callback'
import { AuthMeController } from '../controller/auth/me'
import { authMiddleware } from '../middleware/auth'

/**
 * 認証関連のルーター
 */
export const authRouter = (
  authGoogleController: AuthGoogleController,
  authGoogleCallbackController: AuthGoogleCallbackController,
  authMeController: AuthMeController
): Router => {
  const router = Router()

  // GET /api/auth/google
  router.get('/google', (req, res) => authGoogleController.execute(req, res))

  // GET /api/auth/google/callback
  router.get('/google/callback', async (req, res) =>
    authGoogleCallbackController.execute(req, res)
  )

  // GET /api/auth/me
  router.get('/me', authMiddleware, async (req, res) =>
    authMeController.execute(req, res)
  )

  return router
}

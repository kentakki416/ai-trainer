import { Request, Response } from 'express'

import {
  authGoogleCallbackRequestSchema,
  authGoogleCallbackResponseSchema,
  ErrorResponse,
} from '@repo/api-schema'

import { GoogleOAuthClient } from '../../client/google-auth'
import { AuthAccountRepository, UserRegistrationRepository } from '../../repository/mysql'
import { authenticateWithGoogle } from '../../service/auth-service'

/**
 * Google からのコールバックを処理し、JWT を返すAPI
 */
export class AuthGoogleCallbackController {
  constructor(
    private authAccountRepository: AuthAccountRepository,
    private userRegistrationRepository: UserRegistrationRepository,
    private googleOAuthClient: GoogleOAuthClient
  ) {}

  async execute(req: Request, res: Response) {
    try {
      // リクエストスキーマのバリデーション
      const validatedRequest = authGoogleCallbackRequestSchema.parse(req.query)

      // Service 層を呼び出して認証処理
      const result = await authenticateWithGoogle(
        validatedRequest.code,
        {
          authAccountRepository: this.authAccountRepository,
          userRegistrationRepository: this.userRegistrationRepository,
        },
        this.googleOAuthClient
      )

      // レスポンススキーマのバリデーション
      const response = authGoogleCallbackResponseSchema.parse({
        is_new_user: result.isNewUser,
        token: result.jwtToken,
        user: {
          avatar_url: result.user.avatarUrl,
          created_at: result.user.createdAt.toISOString(),
          email: result.user.email,
          id: result.user.id,
          name: result.user.name,
        },
      })

      res.status(200).json(response)
    } catch (error) {
      // エラーハンドリング
      if (error instanceof Error && error.name === 'ZodError') {
        const errorResponse: ErrorResponse = {
          error: 'Invalid request parameters',
          status_code: 400,
        }
        return res.status(400).json(errorResponse)
      }

      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Authentication failed',
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}
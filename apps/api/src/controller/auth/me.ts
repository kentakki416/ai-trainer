import { Response } from 'express'

import { authMeResponseSchema, ErrorResponse } from '@repo/api-schema'

import { logger } from '../../log'
import { AuthRequest } from '../../middleware/auth'
import { UserRepository } from '../../repository/mysql'
import { getUserById } from '../../service/auth-service'

/**
 * 現在ログイン中のユーザー情報を取得するAPI
 */
export class AuthMeController {
  constructor(private userRepository: UserRepository) {}

  async execute(req: AuthRequest, res: Response) {
    try {
      logger.info('AuthMeController: Fetching user information', {
        requestedUserId: req.userId,
      })

      const user = await getUserById(req.userId!, this.userRepository)

      if (!user) {
        logger.warn('AuthMeController: User not found', {
          requestedUserId: req.userId,
        })
        const errorResponse: ErrorResponse = {
          error: 'User not found',
          status_code: 404,
        }
        return res.status(404).json(errorResponse)
      }

      logger.info('AuthMeController: User information retrieved successfully', {
        userId: user.id,
      })

      // レスポンススキーマのバリデーション
      const response = authMeResponseSchema.parse({
        avatar_url: user.avatarUrl,
        created_at: user.createdAt.toISOString(),
        email: user.email,
        id: user.id,
        name: user.name,
      })

      res.status(200).json(response)
    } catch (error) {
      logger.error(
        'AuthMeController: Failed to get user information',
        error instanceof Error ? error : new Error('Unknown error')
      )
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Failed to get user information',
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}
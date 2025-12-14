import { Response } from 'express'

import { authMeResponseSchema, ErrorResponse } from '@repo/api-schema'

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
      const user = await getUserById(req.userId!, this.userRepository)

      if (!user) {
        const errorResponse: ErrorResponse = {
          error: 'User not found',
          status_code: 404,
        }
        return res.status(404).json(errorResponse)
      }

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
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Failed to get user information',
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}
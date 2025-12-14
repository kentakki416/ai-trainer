import { Request, Response } from 'express'

import { ErrorResponse } from '@repo/api-schema'

import { GoogleOAuthClient } from '../../client/google-auth'

/**
 * Google OAuth 認証を開始（Googleの認証画面にリダイレクト）API
 */
export class AuthGoogleController {
  constructor(private googleOAuthClient: GoogleOAuthClient) {}

  execute(_req: Request, res: Response) {
    try {
      const authUrl = this.googleOAuthClient.generateAuthUrl()
      res.redirect(authUrl)
    } catch (error) {
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Failed to generate auth URL',
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}
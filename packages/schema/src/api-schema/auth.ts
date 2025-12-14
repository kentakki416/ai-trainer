import { z } from 'zod'

// ========================================================
// GET /api/auth/google/callback
// ========================================================

/**
 * Google OAuth callbackのリクエストスキーマ
 */
export const authGoogleCallbackRequestSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
})

export type AuthGoogleCallbackRequest = z.infer<typeof authGoogleCallbackRequestSchema>

/**
 * Google OAuth callbackのレスポンススキーマ
 */
export const authGoogleCallbackResponseSchema = z.object({
  is_new_user: z.boolean(),
  token: z.string(),
  user: z.object({
    avatar_url: z.string().nullable(),
    created_at: z.string(),
    email: z.string().nullable(),
    id: z.number(),
    name: z.string().nullable(),
  }),
})

export type AuthGoogleCallbackResponse = z.infer<typeof authGoogleCallbackResponseSchema>

// ========================================================
// GET /api/auth/me
// ========================================================

/**
 * ユーザー情報取得のレスポンススキーマ
 */
export const authMeResponseSchema = z.object({
  avatar_url: z.string().nullable(),
  created_at: z.string(),
  email: z.string().nullable(),
  id: z.number(),
  name: z.string().nullable(),
})

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>
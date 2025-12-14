import { z } from 'zod'

// =================================
// GET /api/auth/me
// =================================

/**
 * ユーザー認証のレスポンススキーマ
 */
export const authMeResponseSchema = z.object({
  avatar_url: z.string().nullable(),
  created_at: z.string(),
  email: z.string().nullable(),
  id: z.number(),
  name: z.string().nullable(),
})

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>
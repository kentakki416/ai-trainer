import { NextFunction, Request, Response } from 'express'

import { ErrorResponse } from '@repo/api-schema'

import { verifyToken } from '../lib/jwt'

export interface AuthRequest extends Request {
  userId?: number
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const errorResponse: ErrorResponse = {
        error: 'No token provided',
        status_code: 401,
      }
      return res.status(401).json(errorResponse)
    }

    const token = authHeader.substring(7)
    const payload = verifyToken(token)

    if (!payload) {
      const errorResponse: ErrorResponse = {
        error: 'Invalid or expired token',
        status_code: 401,
      }
      return res.status(401).json(errorResponse)
    }

    req.userId = payload.userId
    next()
  } catch {
    const errorResponse: ErrorResponse = {
      error: 'Authentication failed',
      status_code: 500,
    }
    res.status(500).json(errorResponse)
  }
}
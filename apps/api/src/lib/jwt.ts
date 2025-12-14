import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
}

const JWT_SECRET: Secret = process.env.JWT_SECRET
const JWT_EXPIRATION: string = process.env.JWT_EXPIRATION || '30d'

export type JWTPayload = {
    exp?: number
    iat?: number
    userId: number
}

export function generateToken(userId: number): string {
    const options = {
        expiresIn: JWT_EXPIRATION as SignOptions['expiresIn']
    }
    return jwt.sign({ userId }, JWT_SECRET, options)
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch {
        return null
    }
}
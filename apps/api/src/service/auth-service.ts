import { GoogleOAuthClient, GoogleUserInfo } from '../client/google-oauth'
import { generateToken } from '../lib/jwt'
import { logger } from '../log'
import { CharacterCode, User } from '../prisma/generated/client'
import {
    AuthAccountRepository,
    UserRegistrationRepository,
    UserRepository,
} from '../repository/mysql'

export type AuthenticateWithGoogleResult = {
    isNewUser: boolean
    jwtToken: string
    user: User
}

/**
 * Googleアカウントでの認証
 */
export const authenticateWithGoogle = async (
    code: string,
    repository: {
        authAccountRepository: AuthAccountRepository
        userRegistrationRepository: UserRegistrationRepository
    },
    googleAuthClient: GoogleOAuthClient
): Promise<AuthenticateWithGoogleResult> => {
    const { authAccountRepository, userRegistrationRepository } = repository

    logger.info('AuthService: Starting Google authentication')

    // Googleからユーザー情報を取得
    const googleUser: GoogleUserInfo = await googleAuthClient.getUserInfo(code)
    logger.debug('AuthService: Retrieved Google user info', {
        email: googleUser.email,
        googleId: googleUser.id,
    })

    // 既存アカウントを取得
    const existingAccount = await authAccountRepository.findByProvider('google', googleUser.id)

    let user: User
    let isNewUser = false

    if (existingAccount) {
        logger.info('AuthService: Existing user found', {
            userId: existingAccount.user.id,
        })
        user = existingAccount.user
    } else {
        isNewUser = true
        logger.info('AuthService: Creating new user')

        // 新規ユーザー、アカウント、キャラクターを作成
        user = await userRegistrationRepository.createUserWithAuthAccountAndUserCharacterTx({
            authAccount: {
                provider: 'google',
                providerAccountId: googleUser.id,
            },
            user: {
                avatarUrl: googleUser.picture,
                email: googleUser.email,
                name: googleUser.name,
            },
            userCharacter: {
                characterCode: CharacterCode.TRAECHAN,
                isActive: true,
                nickName: 'トレちゃん',
            },
        })
        logger.info('AuthService: New user created', {
            userId: user.id,
        })
    }

    // JWTトークンの生成
    const jwtToken = generateToken(user.id)
    logger.debug('AuthService: JWT token generated', {
        userId: user.id,
    })

    return {
        isNewUser,
        jwtToken,
        user
    }
}

/**
 * ユーザーIDからユーザー情報を取得
 */
export const getUserById = async (
    userId: number,
    userRepository: UserRepository
): Promise<User | null> => {
    logger.debug('AuthService: Fetching user by ID', {
        userId,
    })
    const user = await userRepository.findById(userId)
    if (user) {
        logger.debug('AuthService: User found', {
            userId: user.id,
        })
    } else {
        logger.debug('AuthService: User not found', {
            userId,
        })
    }
    return user
}

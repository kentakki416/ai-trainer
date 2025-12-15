import { GoogleOAuthClient, GoogleUserInfo } from '../client/google-oauth'
import { generateToken } from '../lib/jwt'
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

    // Googleからユーザー情報を取得
    const googleUser: GoogleUserInfo = await googleAuthClient.getUserInfo(code)

    // 既存アカウントを取得
    const existingAccount = await authAccountRepository.findByProvider('google', googleUser.id)

    let user: User
    let isNewUser = false

    if (existingAccount) {
        user = existingAccount.user
    } else {
        isNewUser = true

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
    }

    // JWTトークンの生成
    const jwtToken = generateToken(user.id)

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
    return userRepository.findById(userId)
}

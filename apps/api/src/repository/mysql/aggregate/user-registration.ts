import { PrismaClient } from '../../../prisma/generated/client'
import { Prisma as PrismaTypes } from '../../../prisma/generated/client'
import { CharacterCode as PrismaCharacterCode } from '../../../prisma/generated/client'
import { CharacterCode, User } from '../../../types/domain'

/**
 * ユーザー登録時の入力
 */
export type CreateUserRegistrationInput = {
    authAccount: {
        provider: string
        providerAccountId: string
    }
    user: {
        avatarUrl?: string
        email?: string
        name?: string
    }
    userCharacter: {
        characterCode: CharacterCode
        isActive?: boolean
        nickName: string
    }
}

/**
 * ユーザー登録リポジトリのインターフェース
 */
export interface UserRegistrationRepository {
    createUserWithAuthAccountAndUserCharacterTx(data: CreateUserRegistrationInput): Promise<User>
}

/**
 * Prisma実装のユーザー登録リポジトリ
 */
export class PrismaUserRegistrationRepository implements UserRegistrationRepository {
    constructor(private prisma: PrismaClient) {}

    /**
     * ユーザーの新規作成時のDB処理（トランザクション）
     * User, AuthAccount, UserCharacterを同時に作成する集約処理
     */
    async createUserWithAuthAccountAndUserCharacterTx(
        data: CreateUserRegistrationInput
    ): Promise<User> {
        const prismaUser = await this.prisma.$transaction(async (tx) => {
            // User 作成
            const user = await tx.user.create({
                data: {
                    avatarUrl: data.user.avatarUrl,
                    email: data.user.email,
                    name: data.user.name,
                },
            })

            // AuthAccount 作成
            await tx.authAccount.create({
                data: {
                    provider: data.authAccount.provider,
                    providerAccountId: data.authAccount.providerAccountId,
                    userId: user.id,
                },
            })

            // UserCharacter 作成
            const prismaCharacterCode = data.userCharacter.characterCode as PrismaCharacterCode

            await tx.userCharacter.create({
                data: {
                    characterCode: prismaCharacterCode,
                    isActive: data.userCharacter.isActive ?? false,
                    nickName: data.userCharacter.nickName,
                    userId: user.id,
                },
            })

            return user
        })

        return this._toDomainUser(prismaUser)
    }

    /**
     * Prismaの型 → ドメインの型に変換
     */
    private _toDomainUser(prismaUser: PrismaTypes.UserGetPayload<{}>): User {
        return {
            avatarUrl: prismaUser.avatarUrl,
            createdAt: prismaUser.createdAt,
            email: prismaUser.email,
            id: prismaUser.id,
            name: prismaUser.name,
            updatedAt: prismaUser.updatedAt,
        }
    }
}

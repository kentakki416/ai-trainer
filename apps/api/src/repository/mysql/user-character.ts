import { PrismaClient } from '../../prisma/generated/client'
import { Prisma as PrismaTypes } from '../../prisma/generated/client'
import { CharacterCode as PrismaCharacterCode } from '../../prisma/generated/client'
import { CharacterCode, UserCharacter } from '../../types/domain'

/**
 * ユーザーキャラクター作成時の入力
 */
export type CreateUserCharacterInput = {
    characterCode: CharacterCode
    isActive?: boolean
    nickName: string
    userId: number
}

/**
 * ユーザーキャラクターリポジトリのインターフェース
 */
export interface UserCharacterRepository {
    create(data: CreateUserCharacterInput): Promise<UserCharacter>
    findActiveByUserId(userId: number): Promise<UserCharacter | null>
    findByUserId(userId: number): Promise<UserCharacter[]>
}

/**
 * Prisma実装のユーザーキャラクターリポジトリ
 */
export class PrismaUserCharacterRepository implements UserCharacterRepository {
    private _prisma: PrismaClient

    constructor(prisma: PrismaClient) {
        this._prisma = prisma
    }

    async findByUserId(userId: number): Promise<UserCharacter[]> {
        const prismaUserCharacters = await this._prisma.userCharacter.findMany({
            orderBy: { createdAt: 'asc' },
            where: { userId },
        })

        return prismaUserCharacters.map((pc) => this._toDomainUserCharacter(pc))
    }

    async findActiveByUserId(userId: number): Promise<UserCharacter | null> {
        const prismaUserCharacter = await this._prisma.userCharacter.findFirst({
            where: {
                isActive: true,
                userId,
            },
        })

        if (!prismaUserCharacter) return null

        return this._toDomainUserCharacter(prismaUserCharacter)
    }

    async create(data: CreateUserCharacterInput): Promise<UserCharacter> {
        const prismaCharacterCode = data.characterCode as PrismaCharacterCode

        const prismaUserCharacter = await this._prisma.userCharacter.create({
            data: {
                characterCode: prismaCharacterCode,
                isActive: data.isActive ?? false,
                nickName: data.nickName,
                userId: data.userId,
            },
        })

        return this._toDomainUserCharacter(prismaUserCharacter)
    }

    /**
     * Prismaの型 → ドメインの型に変換
     */
    private _toDomainCharacterCode(prismaCode: PrismaCharacterCode): CharacterCode {
        return prismaCode as CharacterCode
    }

    private _toDomainUserCharacter(
        prismaUserCharacter: PrismaTypes.UserCharacterGetPayload<{}>
    ): UserCharacter {
        return {
            characterCode: this._toDomainCharacterCode(prismaUserCharacter.characterCode),
            createdAt: prismaUserCharacter.createdAt,
            experience: prismaUserCharacter.experience,
            id: prismaUserCharacter.id,
            isActive: prismaUserCharacter.isActive,
            level: prismaUserCharacter.level,
            nickName: prismaUserCharacter.nickName,
            updatedAt: prismaUserCharacter.updatedAt,
            userId: prismaUserCharacter.userId,
        }
    }
}

import { CharacterCode, PrismaClient, UserCharacter } from '../../prisma/generated/client'

export interface UserCharacterRepository {
  create(data: CreateUserCharacterInput): Promise<UserCharacter>
  findActiveByUserId(userId: number): Promise<UserCharacter | null>
  findByUserId(userId: number): Promise<UserCharacter[]>
}

export type CreateUserCharacterInput = {
  characterCode: CharacterCode
  isActive?: boolean
  nickName: string
  userId: number
}

export class PrismaUserCharacterRepository implements UserCharacterRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  async findByUserId(userId: number): Promise<UserCharacter[]> {
    return this._prisma.userCharacter.findMany({
      include: {
        character: true,
      },
      orderBy: { createdAt: 'asc' },
      where: { userId },
    })
  }

  async findActiveByUserId(userId: number): Promise<UserCharacter | null> {
    return this._prisma.userCharacter.findFirst({
      include: {
        character: true,
      },
      where: {
        isActive: true,
        userId,
      },
    })
  }

  async create(data: CreateUserCharacterInput): Promise<UserCharacter> {
    return this._prisma.userCharacter.create({
      data: {
        characterCode: data.characterCode,
        isActive: data.isActive ?? false,
        nickName: data.nickName,
        userId: data.userId,
      },
      include: {
        character: true,
      },
    })
  }
}
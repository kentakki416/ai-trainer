import { CharacterCode, PrismaClient, User } from '../../../prisma/generated/client'

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

export interface UserRegistrationRepository {
  createUserWithAuthAccountAndUserCharacterTx(data: CreateUserRegistrationInput): Promise<User>
}

export class PrismaUserRegistrationRepository implements UserRegistrationRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * ユーザーの新規作成時のDB処理
   */
  async createUserWithAuthAccountAndUserCharacterTx(data: CreateUserRegistrationInput): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
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
      await tx.userCharacter.create({
        data: {
          characterCode: data.userCharacter.characterCode,
          isActive: data.userCharacter.isActive ?? false,
          nickName: data.userCharacter.nickName,
          userId: user.id,
        },
      })

      return user
    })
  }
}

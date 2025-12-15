import { PrismaClient, User } from '../../prisma/generated/client'

export interface UserRepository {
  create(data: CreateUserInput): Promise<User>
  findByEmail(email: string): Promise<User | null>
  findById(id: number): Promise<User | null>
}

export type CreateUserInput = {
  avatarUrl?: string
  email?: string
  name?: string
}

export class PrismaUserRepository implements UserRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  async findById(id: number): Promise<User | null> {
    return this._prisma.user.findUnique({ where: { id } })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this._prisma.user.findUnique({ where: { email } })
  }

  async create(data: CreateUserInput): Promise<User> {
    return this._prisma.user.create({
      data: {
        avatarUrl: data.avatarUrl,
        email: data.email,
        name: data.name,
      },
    })
  }
}
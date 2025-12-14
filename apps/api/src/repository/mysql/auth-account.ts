import  { AuthAccount, PrismaClient, User } from '../../prisma/generated/client'

export interface AuthAccountRepository {
    create(data: CreateAuthAccountInput): Promise<AuthAccount>
    findByProvider(
        provider: string,
        providerAccountId: string
    ): Promise<AuthAccountWithUser | null>
}

export type CreateAuthAccountInput = {
    accessToken?: string
    expiresAt?: number
    idToken?: string
    provider: string
    providerAccountId: string
    refreshToken?: string
    scope?: string
    tokenType?: string
    userId: number
}

export type AuthAccountWithUser = AuthAccount & { user: User}

export class PrismaAuthAccountRepository implements AuthAccountRepository {
    private _prisma: PrismaClient

    constructor(prisma: PrismaClient) {
        this._prisma = prisma
    }

    public async findByProvider(provider: string, providerAccountId: string): Promise<AuthAccountWithUser | null> {
        return this._prisma.authAccount.findUnique({
            include: {
                user: true,
            },
            where: {
                provider_providerAccountId: {
                    provider,
                    providerAccountId
                }
            }
        })
    }

    public async create(data: CreateAuthAccountInput): Promise<AuthAccount> {
        return this._prisma.authAccount.create({
            data: {
                accessToken: data.accessToken,
                expiresAt: data.expiresAt,
                idToken: data.idToken,
                provider: data.provider,
                providerAccountId: data.providerAccountId,
                refreshToken: data.refreshToken,
                scope: data.scope,
                tokenType: data.tokenType,
                userId: data.userId
            }
        })
    }
}

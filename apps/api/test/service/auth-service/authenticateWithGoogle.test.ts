import { CharacterCode, User } from '../../../src/prisma/generated/client'
import { authenticateWithGoogle } from '../../../src/service/auth-service'

// モック
const mockGetUserInfo = jest.fn()
const mockFindByProvider = jest.fn()
const mockCreateUserWithAuthAccountAndUserCharacterTx = jest.fn()

const mockGoogleAuthClient = {
    getUserInfo: mockGetUserInfo,
}

const mockRepository = {
    authAccountRepository: {
        findByProvider: mockFindByProvider,
    },
    userRegistrationRepository: {
        createUserWithAuthAccountAndUserCharacterTx: mockCreateUserWithAuthAccountAndUserCharacterTx,
    },
}

// JWT生成をモック
jest.mock('../../../src/lib/jwt', () => ({
    generateToken: jest.fn((userId: number) => `mock-jwt-token-${userId}`),
}))

describe('authenticateWithGoogle', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('既存ユーザーの場合、ユーザー情報とJWTトークンを返す', async () => {
        // Arrange
        const mockGoogleUser = {
            email: 'test@example.com',
            id: 'google-123',
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg',
        }

        const mockExistingUser: User = {
            avatarUrl: 'https://example.com/avatar.jpg',
            createdAt: new Date(),
            email: 'test@example.com',
            id: 1,
            name: 'Test User',
            updatedAt: new Date(),
        }

        const mockExistingAccount = {
            createdAt: new Date(),
            id: 1,
            provider: 'google' as const,
            providerAccountId: 'google-123',
            updatedAt: new Date(),
            user: mockExistingUser,
            userId: 1,
        }

        mockGetUserInfo.mockResolvedValue(mockGoogleUser)
        mockFindByProvider.mockResolvedValue(mockExistingAccount)

        // Act
        const result = await authenticateWithGoogle(
            'auth-code',
            mockRepository as any,
            mockGoogleAuthClient as any
        )

        // Assert
        expect(result.isNewUser).toBe(false)
        expect(result.user).toEqual(mockExistingUser)
        expect(result.jwtToken).toBe('mock-jwt-token-1')
        expect(mockGetUserInfo).toHaveBeenCalledWith('auth-code')
        expect(mockFindByProvider).toHaveBeenCalledWith('google', 'google-123')
        expect(mockCreateUserWithAuthAccountAndUserCharacterTx).not.toHaveBeenCalled()
    })

    it('新規ユーザーの場合、ユーザーを作成してJWTトークンを返す', async () => {
        // Arrange
        const mockGoogleUser = {
            email: 'newuser@example.com',
            id: 'google-456',
            name: 'New User',
            picture: 'https://example.com/new-avatar.jpg',
        }

        const mockNewUser: User = {
            avatarUrl: 'https://example.com/new-avatar.jpg',
            createdAt: new Date(),
            email: 'newuser@example.com',
            id: 2,
            name: 'New User',
            updatedAt: new Date(),
        }

        mockGetUserInfo.mockResolvedValue(mockGoogleUser)
        mockFindByProvider.mockResolvedValue(null)
        mockCreateUserWithAuthAccountAndUserCharacterTx.mockResolvedValue(mockNewUser)

        // Act
        const result = await authenticateWithGoogle(
            'auth-code',
            mockRepository as any,
            mockGoogleAuthClient as any
        )

        // Assert
        expect(result.isNewUser).toBe(true)
        expect(result.user).toEqual(mockNewUser)
        expect(result.jwtToken).toBe('mock-jwt-token-2')
        expect(mockGetUserInfo).toHaveBeenCalledWith('auth-code')
        expect(mockFindByProvider).toHaveBeenCalledWith('google', 'google-456')
        expect(mockCreateUserWithAuthAccountAndUserCharacterTx).toHaveBeenCalledWith({
            authAccount: {
                provider: 'google',
                providerAccountId: 'google-456',
            },
            user: {
                avatarUrl: 'https://example.com/new-avatar.jpg',
                email: 'newuser@example.com',
                name: 'New User',
            },
            userCharacter: {
                characterCode: CharacterCode.TRAECHAN,
                isActive: true,
                nickName: 'トレちゃん',
            },
        })
    })

    it('Google認証エラー時にエラーをスローする', async () => {
        // Arrange
        const mockError = new Error('Google authentication failed')
        mockGetUserInfo.mockRejectedValue(mockError)

        // Act & Assert
        await expect(
            authenticateWithGoogle(
                'invalid-code',
                mockRepository as any,
                mockGoogleAuthClient as any
            )
        ).rejects.toThrow('Google authentication failed')
    })
})

import { User } from '../../../src/prisma/generated/client'
import { getUserById } from '../../../src/service/auth-service'

// JWT生成をモック（auth-service.tsがjwtをimportしているため必要）
jest.mock('../../../src/lib/jwt', () => ({
    generateToken: jest.fn(),
}))

// モック
const mockFindById = jest.fn()

const mockUserRepository = {
    findById: mockFindById,
}

describe('getUserById', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('ユーザーが存在する場合、ユーザー情報を返す', async () => {
        // Arrange
        const mockUser: User = {
            avatarUrl: 'https://example.com/avatar.jpg',
            createdAt: new Date(),
            email: 'test@example.com',
            id: 1,
            name: 'Test User',
            updatedAt: new Date(),
        }

        mockFindById.mockResolvedValue(mockUser)

        // Act
        const result = await getUserById(1, mockUserRepository as any)

        // Assert
        expect(result).toEqual(mockUser)
        expect(mockFindById).toHaveBeenCalledWith(1)
        expect(mockFindById).toHaveBeenCalledTimes(1)
    })

    it('ユーザーが存在しない場合、nullを返す', async () => {
        // Arrange
        mockFindById.mockResolvedValue(null)

        // Act
        const result = await getUserById(999, mockUserRepository as any)

        // Assert
        expect(result).toBeNull()
        expect(mockFindById).toHaveBeenCalledWith(999)
        expect(mockFindById).toHaveBeenCalledTimes(1)
    })

    it('データベースエラー時にエラーをスローする', async () => {
        // Arrange
        const mockError = new Error('Database connection failed')
        mockFindById.mockRejectedValue(mockError)

        // Act & Assert
        await expect(getUserById(1, mockUserRepository as any)).rejects.toThrow(
            'Database connection failed'
        )
        expect(mockFindById).toHaveBeenCalledWith(1)
    })
})

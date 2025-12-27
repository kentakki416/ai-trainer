/**
 * キャラクターコード
 */
export type CharacterCode = 'TRAECHAN' | 'MASTER'

/**
 * キャラクタードメイン型
 */
export type Character = {
    characterCode: CharacterCode
    createdAt: Date
    description: string
    name: string
    updatedAt: Date
}

/**
 * ユーザーキャラクタードメイン型
 */
export type UserCharacter = {
    characterCode: CharacterCode
    createdAt: Date
    experience: number
    id: number
    isActive: boolean
    level: number
    nickName: string
    updatedAt: Date
    userId: number
}

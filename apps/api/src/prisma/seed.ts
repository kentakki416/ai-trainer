import { CharacterCode } from './generated/client'
import { prisma } from './prisma.client'

async function main() {
  // トレちゃんのマスターデータを作成
  await prisma.character.upsert({
    create: {
      characterCode: CharacterCode.TRAECHAN,
      description: '目標達成をサポートするあなたの相棒',
      name: 'トレちゃん',
    },
    update: {},
    where: { characterCode: CharacterCode.TRAECHAN },
  })

  // マスターのマスターデータを作成
  await prisma.character.upsert({
    create: {
      characterCode: CharacterCode.MASTER,
      description: 'あなたの成長を見守る師匠',
      name: 'マスター',
    },
    update: {},
    where: { characterCode: CharacterCode.MASTER },
  })

  console.log('Character master data seeded successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
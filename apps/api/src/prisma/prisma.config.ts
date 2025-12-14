import path from 'path'

import dotenv from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// .env.local ファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

export default defineConfig({
    datasource: {
        url: env('DATABASE_URL'),
    },
    migrations: {
        path: './migrations',
        seed: 'npx tsx ./seed.ts'
    },
    schema: './schema.prisma',
})

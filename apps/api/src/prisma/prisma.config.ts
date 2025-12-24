import { defineConfig, env } from 'prisma/config'

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

import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from './generated/client'

const adapter = new PrismaMariaDb({
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,
  database: process.env.DB_NAME || 'ai_trainer_dev',
  host: process.env.DB_HOST || 'localhost',
  password: process.env.DB_PASSWORD || 'password',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
})

export const prisma = new PrismaClient({ adapter })
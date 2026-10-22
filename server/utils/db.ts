import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  sectoraPrisma?: PrismaClient
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL || 'postgresql://sectora:sectora@localhost:5432/sectora?schema=public',
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.sectoraPrisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.sectoraPrisma = prisma
}

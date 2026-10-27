import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  sectoraPrisma?: PrismaClient
}

// The pool is capped because a hosted pooler limits clients per database (Supabase session mode: 15 in total).
// Every server process holds its own pool, so the cap times the number of processes must stay under that limit.
// Idle connections are released so a quiet server does not keep its share.
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL || 'postgresql://sectora:sectora@localhost:5432/sectora?schema=public',
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.sectoraPrisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.sectoraPrisma = prisma
}

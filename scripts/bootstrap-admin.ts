import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { hashPassword } from '../server/utils/password'

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim()
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
const databaseUrl = process.env.DATABASE_URL

if (!email || !displayName || !password || !databaseUrl) {
  throw new Error('Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD, and DATABASE_URL first.')
}

if (password.length < 14) {
  throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 14 characters.')
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

try {
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
  if (adminCount > 0) {
    throw new Error('An Admin already exists. Create additional Admin accounts from the application.')
  }

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
  })
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      action: 'bootstrap_admin_created',
      entityType: 'User',
      entityId: user.id,
    },
  })
  process.stdout.write(`Created first Admin account: ${user.email}\n`)
} finally {
  await prisma.$disconnect()
}

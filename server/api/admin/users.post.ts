import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'
import { hashPassword } from '../../utils/password'
import { auditData, readValidatedPayload } from '../../utils/validation'

const schema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(14).max(200),
  role: z.enum(['ADMIN', 'USER']),
  unitIds: z.array(z.string().min(1).max(64)).max(100),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user: actor } = await requireRole(event, 'ADMIN')
  const body = await readValidatedPayload(event, schema)
  const unitIds = [...new Set(body.unitIds)]
  // A User account stands for one work unit; Admins (Pusdatin) see every unit and hold none.
  if (body.role === 'USER' && unitIds.length !== 1) {
    throw createError({ statusCode: 400, statusMessage: 'Akun User harus terhubung ke tepat satu unit kerja.' })
  }
  if (body.role === 'ADMIN') unitIds.length = 0
  const existingUnits = await prisma.unit.count({ where: { id: { in: unitIds }, isActive: true } })
  if (existingUnits !== unitIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih unit yang masih aktif.' })
  }

  const created = await prisma.$transaction(async (tx) => {
    const account = await tx.user.create({
      data: {
        email: body.email.toLowerCase(),
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        memberships: { create: unitIds.map((unitId) => ({ unitId })) },
      },
      select: { id: true, email: true, displayName: true, role: true, isActive: true },
    })
    await tx.auditEvent.create(auditData(actor.id, 'user_created', 'User', account.id, { role: account.role, unitIds }))
    return account
  })

  return { user: created }
})

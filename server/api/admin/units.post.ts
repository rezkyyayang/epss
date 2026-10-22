import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'
import { auditData, readValidatedPayload } from '../../utils/validation'

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,32}$/),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const body = await readValidatedPayload(event, schema)
  const unit = await prisma.$transaction(async (tx) => {
    const created = await tx.unit.create({ data: body })
    await tx.membership.create({ data: { unitId: created.id, userId: user.id } })
    await tx.auditEvent.create(auditData(user.id, 'unit_created', 'Unit', created.id, { code: created.code }))
    return created
  })
  return { unit }
})

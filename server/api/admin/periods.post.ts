import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'
import { auditData, readValidatedPayload } from '../../utils/validation'

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).default('DRAFT'),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const body = await readValidatedPayload(event, schema)
  if (body.startsAt && body.endsAt && new Date(body.endsAt) <= new Date(body.startsAt)) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal akhir harus setelah tanggal mulai.' })
  }
  if (body.status === 'ACTIVE') {
    throw createError({ statusCode: 400, statusMessage: 'Lengkapi katalog sebelum mengaktifkan periode.' })
  }

  const period = await prisma.$transaction(async (tx) => {
    const created = await tx.period.create({
      data: {
        name: body.name,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        status: body.status,
      },
    })
    await tx.auditEvent.create(auditData(user.id, 'period_created', 'Period', created.id))
    return created
  })

  return { period }
})

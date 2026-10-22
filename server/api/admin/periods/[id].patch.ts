import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../../utils/auth'
import { isCatalogReady } from '../../../utils/catalog'
import { prisma } from '../../../utils/db'
import { auditData, readRouteId, readValidatedPayload } from '../../../utils/validation'

const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const id = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  const period = await prisma.period.findUnique({ where: { id } })
  if (!period) throw createError({ statusCode: 404, statusMessage: 'Periode tidak ditemukan.' })

  const nextStart = body.startsAt === undefined ? period.startsAt : body.startsAt ? new Date(body.startsAt) : null
  const nextEnd = body.endsAt === undefined ? period.endsAt : body.endsAt ? new Date(body.endsAt) : null
  if (nextStart && nextEnd && nextEnd <= nextStart) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal akhir harus setelah tanggal mulai.' })
  }

  if (body.status === 'ACTIVE') {
    const domains = await prisma.domain.findMany({
      where: { periodId: id },
      select: { weight: true, indicators: { select: { weight: true, maturityLevels: { select: { level: true } } } } },
    })
    if (!isCatalogReady(domains)) {
      throw createError({ statusCode: 409, statusMessage: 'Lengkapi katalog terlebih dahulu: total bobot domain dan bobot indikator per domain harus 100%, dan setiap indikator perlu tingkat kematangan.' })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.period.update({
      where: { id },
      data: {
        ...body,
        startsAt: body.startsAt === undefined ? undefined : body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null,
      },
    })
    await tx.auditEvent.create(auditData(user.id, 'period_updated', 'Period', id, { fields: Object.keys(body) }))
    return saved
  })
  return { period: updated }
})

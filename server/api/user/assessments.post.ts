import { z } from 'zod'
import { assertSameOrigin, requireRole, requireUnitAccess } from '../../utils/auth'
import { isCatalogReady } from '../../utils/catalog'
import { prisma } from '../../utils/db'
import { auditData, readValidatedPayload } from '../../utils/validation'

const schema = z.object({ periodId: z.string().min(1).max(64), unitId: z.string().min(1).max(64) })

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'USER')
  const body = await readValidatedPayload(event, schema)
  await requireUnitAccess(event, body.unitId)

  const assessment = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Period" WHERE "id" = ${body.periodId} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 409, statusMessage: 'Periode ini belum aktif.' })
    const period = await tx.period.findUnique({
      where: { id: body.periodId },
      include: {
        domains: {
          include: { indicators: { include: { maturityLevels: true } } },
        },
      },
    })
    if (!period || period.status !== 'ACTIVE') throw createError({ statusCode: 409, statusMessage: 'Periode ini belum aktif.' })
    const assignment = await tx.periodAssignment.findUnique({ where: { periodId_unitId: { periodId: body.periodId, unitId: body.unitId } } })
    if (!assignment) throw createError({ statusCode: 403, statusMessage: 'Unit ini belum ditugaskan pada periode tersebut.' })
    const unit = await tx.unit.findUnique({ where: { id: body.unitId }, select: { isActive: true } })
    if (!unit?.isActive) throw createError({ statusCode: 403, statusMessage: 'Unit ini tidak aktif.' })

    const existing = await tx.assessment.findUnique({ where: { periodId_unitId: { periodId: body.periodId, unitId: body.unitId } } })
    if (existing) {
      if (existing.createdById !== user.id) throw createError({ statusCode: 403, statusMessage: 'Penilaian unit ini sudah dibuka oleh akun lain.' })
      return existing
    }

    const indicators = period.domains.flatMap((domain) => domain.indicators)
    if (!isCatalogReady(period.domains)) {
      throw createError({ statusCode: 409, statusMessage: 'Katalog periode belum lengkap.' })
    }
    const created = await tx.assessment.create({
      data: {
        periodId: body.periodId,
        unitId: body.unitId,
        createdById: user.id,
        responses: { create: indicators.map(({ id }) => ({ indicatorId: id })) },
      },
    })
    await tx.statusEvent.create({
      data: { assessmentId: created.id, actorId: user.id, fromStatus: null, toStatus: 'DRAFT' },
    })
    await tx.auditEvent.create(auditData(user.id, 'assessment_created', 'Assessment', created.id, { periodId: body.periodId, unitId: body.unitId }))
    return created
  })

  return { assessment }
})

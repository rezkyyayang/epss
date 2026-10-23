import { z } from 'zod'
import { assertSameOrigin, requireRole, requireUnitAccess } from '../../utils/auth'
import { isCatalogReady } from '../../utils/catalog'
import { prisma } from '../../utils/db'
import { auditData, readValidatedPayload } from '../../utils/validation'

const schema = z.object({
  periodId: z.string().min(1).max(64),
  unitId: z.string().min(1).max(64),
  // Required to open a new assessment; ignored when the unit's assessment for the period already exists.
  activityName: z.string().trim().min(3).max(240).optional(),
  activityYear: z.number().int().min(2000).max(2100).optional(),
})

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

    // A user assesses exactly one statistical activity per period, even when they belong to several units.
    const otherInPeriod = await tx.assessment.findFirst({ where: { periodId: body.periodId, createdById: user.id }, select: { id: true } })
    if (otherInPeriod) {
      throw createError({ statusCode: 409, statusMessage: 'Anda sudah mengisi satu kegiatan statistik pada periode ini. Setiap periode hanya untuk satu kegiatan.' })
    }

    const indicators = period.domains.flatMap((domain) => domain.indicators)
    if (!isCatalogReady(period.domains)) {
      throw createError({ statusCode: 409, statusMessage: 'Katalog periode belum lengkap.' })
    }
    if (!body.activityName || !body.activityYear) {
      throw createError({ statusCode: 400, statusMessage: 'Isi nama dan tahun kegiatan statistik sebelum memulai penilaian.' })
    }
    const created = await tx.assessment.create({
      data: {
        periodId: body.periodId,
        unitId: body.unitId,
        createdById: user.id,
        activityName: body.activityName,
        activityYear: body.activityYear,
        // One bulk insert instead of one per indicator keeps the transaction short when the database is far away.
        responses: { createMany: { data: indicators.map(({ id }) => ({ indicatorId: id })) } },
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

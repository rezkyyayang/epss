import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const schema = z.object({ unitIds: z.array(z.string().min(1).max(64)).max(100) })

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const periodId = readRouteId(event)
  const { unitIds } = await readValidatedPayload(event, schema)
  const uniqueIds = [...new Set(unitIds)]
  const activeUnitCount = await prisma.unit.count({ where: { id: { in: uniqueIds }, isActive: true } })
  if (activeUnitCount !== uniqueIds.length) throw createError({ statusCode: 400, statusMessage: 'Pilih unit yang masih aktif.' })

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Period" WHERE "id" = ${periodId} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Periode tidak ditemukan.' })
    if (await tx.assessment.count({ where: { periodId } })) {
      throw createError({ statusCode: 409, statusMessage: 'Penugasan unit terkunci setelah penilaian pertama dibuat.' })
    }
    await tx.periodAssignment.deleteMany({ where: { periodId } })
    if (uniqueIds.length) {
      await tx.periodAssignment.createMany({ data: uniqueIds.map((unitId) => ({ periodId, unitId })) })
    }
    await tx.auditEvent.create(auditData(user.id, 'period_assignments_updated', 'Period', periodId, { unitIds: uniqueIds }))
  })
  return { ok: true, unitIds: uniqueIds }
})

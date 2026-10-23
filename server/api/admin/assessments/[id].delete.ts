import { assertSameOrigin } from '../../../utils/auth'
import { requireAssessmentReviewAccess } from '../../../utils/authorization'
import { prisma } from '../../../utils/db'
import { auditData, readRouteId } from '../../../utils/validation'

// Resets a unit's assessment by deleting it: answers, evidence links, verification and status history
// go with it (cascade), so the unit starts the period again from the activity form. The audit event keeps
// a record of what was removed.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const { user } = await requireAssessmentReviewAccess(event, id)

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const existing = await tx.assessment.findUniqueOrThrow({
      where: { id },
      select: { periodId: true, unitId: true, createdById: true, status: true, activityName: true, activityYear: true },
    })
    await tx.assessment.delete({ where: { id } })
    await tx.auditEvent.create(auditData(user.id, 'assessment_reset', 'Assessment', id, existing))
  })
  return { ok: true }
})

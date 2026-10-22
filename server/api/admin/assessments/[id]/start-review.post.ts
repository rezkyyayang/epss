import { assertSameOrigin } from '../../../../utils/auth'
import { requireAssessmentReviewAccess } from '../../../../utils/authorization'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const { user, assessment } = await requireAssessmentReviewAccess(event, id)
  if (!['SUBMITTED', 'RESUBMITTED'].includes(assessment.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Penilaian ini tidak siap untuk diperiksa.' })
  }

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessment.findUniqueOrThrow({ where: { id }, select: { status: true } })
    if (!['SUBMITTED', 'RESUBMITTED'].includes(current.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Penilaian ini tidak siap untuk diperiksa.' })
    }
    const changed = await tx.assessment.updateMany({ where: { id, status: current.status }, data: { status: 'IN_REVIEW' } })
    if (changed.count !== 1) throw createError({ statusCode: 409, statusMessage: 'Status penilaian berubah. Muat ulang sebelum memeriksa.' })
    await tx.statusEvent.create({ data: { assessmentId: id, actorId: user.id, fromStatus: current.status, toStatus: 'IN_REVIEW' } })
    await tx.auditEvent.create(auditData(user.id, 'review_started', 'Assessment', id))
  })
  return { status: 'IN_REVIEW' }
})

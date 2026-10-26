import { z } from 'zod'
import { assertSameOrigin } from '../../../../utils/auth'
import { requireAssessmentReviewAccess } from '../../../../utils/authorization'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const schema = z.object({
  reason: z.string().trim().min(10, 'Tulis alasan minimal 10 karakter.').max(1000),
})

// Reopens a sent verification instead of deleting it: the unit's answers and Pusdatin's final levels stay,
// the assessment goes back to IN_REVIEW (so the unit stops seeing final scores), and the reason is kept
// in the status history.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const { user } = await requireAssessmentReviewAccess(event, id)
  const body = await readValidatedPayload(event, schema)

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessment.findUniqueOrThrow({ where: { id }, select: { status: true, verifiedAt: true } })
    if (current.status !== 'VERIFIED') {
      throw createError({ statusCode: 409, statusMessage: 'Hanya hasil verifikasi yang sudah dikirim yang dapat dibuka ulang.' })
    }
    await tx.assessment.update({ where: { id }, data: { status: 'IN_REVIEW', verifiedAt: null } })
    await tx.statusEvent.create({ data: { assessmentId: id, actorId: user.id, fromStatus: 'VERIFIED', toStatus: 'IN_REVIEW', reason: body.reason } })
    await tx.auditEvent.create(auditData(user.id, 'assessment_reopened', 'Assessment', id, { reason: body.reason, previousVerifiedAt: current.verifiedAt }))
  })
  return { status: 'IN_REVIEW' }
})

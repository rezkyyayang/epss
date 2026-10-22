import { assertSameOrigin } from '../../../../utils/auth'
import { canVerify, requireAssessmentReviewAccess } from '../../../../utils/authorization'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId } from '../../../../utils/validation'

// Sends the verification result: every indicator needs a final level, then the assessment locks
// as VERIFIED and the unit sees the final scores.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const { user } = await requireAssessmentReviewAccess(event, id)

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessment.findUniqueOrThrow({ where: { id }, select: { status: true } })
    if (!canVerify(current.status)) {
      throw createError({ statusCode: 409, statusMessage: current.status === 'VERIFIED' ? 'Hasil verifikasi sudah dikirim.' : 'Penilaian ini belum dikirim oleh unit kerja.' })
    }
    const responses = await tx.assessmentResponse.findMany({ where: { assessmentId: id }, select: { id: true, verification: { select: { id: true } } } })
    const unverified = responses.filter(({ verification }) => !verification)
    if (!responses.length || unverified.length) {
      throw createError({
        statusCode: 409,
        statusMessage: `${unverified.length} indikator belum diberi level final.`,
        data: { unverifiedResponseIds: unverified.map(({ id: responseId }) => responseId) },
      })
    }
    await tx.assessment.update({ where: { id }, data: { status: 'VERIFIED', verifiedAt: new Date() } })
    await tx.statusEvent.create({ data: { assessmentId: id, actorId: user.id, fromStatus: current.status, toStatus: 'VERIFIED' } })
    await tx.auditEvent.create(auditData(user.id, 'assessment_verified', 'Assessment', id, { responseCount: responses.length }))
  })
  return { status: 'VERIFIED' }
})

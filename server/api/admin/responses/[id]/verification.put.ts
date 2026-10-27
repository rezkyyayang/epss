import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../../../utils/auth'
import { assertAssignedVerifier, canVerify } from '../../../../utils/authorization'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const schema = z.object({
  maturityLevelId: z.string().min(1).max(64),
  comment: z.string().trim().max(4000).default(''),
})

// Saves Pusdatin's final level and comment for one indicator. The first saved indicator moves
// the assessment from SUBMITTED to IN_REVIEW so the unit can see verification has started.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const id = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  const response = await prisma.assessmentResponse.findUnique({
    where: { id },
    select: { id: true, indicatorId: true, assessmentId: true },
  })
  if (!response) throw createError({ statusCode: 404, statusMessage: 'Jawaban tidak ditemukan.' })
  const level = await prisma.maturityLevel.findUnique({ where: { id: body.maturityLevelId }, select: { indicatorId: true } })
  if (!level || level.indicatorId !== response.indicatorId) {
    throw createError({ statusCode: 400, statusMessage: 'Level final tidak sesuai dengan indikator ini.' })
  }

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${response.assessmentId} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const assessment = await tx.assessment.findUniqueOrThrow({ where: { id: response.assessmentId }, select: { status: true, periodId: true, unitId: true } })
    if (!canVerify(assessment.status)) {
      throw createError({ statusCode: 409, statusMessage: assessment.status === 'VERIFIED' ? 'Hasil verifikasi sudah dikirim dan terkunci.' : 'Penilaian ini belum dikirim oleh unit kerja.' })
    }
    await assertAssignedVerifier(tx, assessment, user.id)
    const verification = await tx.responseVerification.upsert({
      where: { responseId: id },
      create: { responseId: id, maturityLevelId: body.maturityLevelId, comment: body.comment, verifierId: user.id },
      update: { maturityLevelId: body.maturityLevelId, comment: body.comment, verifierId: user.id },
      select: { maturityLevelId: true, comment: true, updatedAt: true },
    })
    if (assessment.status === 'SUBMITTED') {
      await tx.assessment.update({ where: { id: response.assessmentId }, data: { status: 'IN_REVIEW' } })
      await tx.statusEvent.create({ data: { assessmentId: response.assessmentId, actorId: user.id, fromStatus: 'SUBMITTED', toStatus: 'IN_REVIEW' } })
    }
    await tx.auditEvent.create(auditData(user.id, 'response_verified', 'AssessmentResponse', id, { maturityLevelId: body.maturityLevelId }))
    return { verification, assessmentStatus: assessment.status === 'SUBMITTED' ? 'IN_REVIEW' : assessment.status }
  })
  return result
})

import { z } from 'zod'
import { assertSameOrigin, requireRole, requireUnitAccess } from '../../../../utils/auth'
import { prisma } from '../../../../utils/db'
import { auditData, readValidatedPayload, readRouteId } from '../../../../utils/validation'

const schema = z.object({
  outcome: z.enum(['APPROVE', 'REQUEST_REVISION']),
  comment: z.string().trim().max(4000).default(''),
  reviewedVersion: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const id = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  const response = await prisma.assessmentResponse.findUnique({
    where: { id },
    include: { assessment: { select: { id: true, unitId: true, status: true } } },
  })
  if (!response) throw createError({ statusCode: 404, statusMessage: 'Jawaban tidak ditemukan.' })
  await requireUnitAccess(event, response.assessment.unitId)
  if (response.assessment.status !== 'IN_REVIEW') {
    throw createError({ statusCode: 409, statusMessage: 'Mulai pemeriksaan sebelum memberi keputusan.' })
  }
  if (response.status !== 'PENDING') {
    throw createError({ statusCode: 409, statusMessage: 'Jawaban ini sudah memiliki keputusan untuk versi terkini.' })
  }
  if (response.version !== body.reviewedVersion) {
    throw createError({ statusCode: 409, statusMessage: 'Versi jawaban berubah. Muat ulang sebelum memeriksa.' })
  }
  if (body.outcome === 'REQUEST_REVISION' && !body.comment) {
    throw createError({ statusCode: 400, statusMessage: 'Tulis alasan revisi untuk indikator ini.' })
  }

  const statusAfterDecision = body.outcome === 'APPROVE' ? 'APPROVED' : 'NEEDS_REVISION'
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${response.assessment.id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessmentResponse.findUnique({
      where: { id },
      select: { version: true, status: true, assessment: { select: { id: true, status: true } } },
    })
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Jawaban tidak ditemukan.' })
    if (current.assessment.status !== 'IN_REVIEW') throw createError({ statusCode: 409, statusMessage: 'Mulai pemeriksaan sebelum memberi keputusan.' })
    if (current.status !== 'PENDING' || current.version !== body.reviewedVersion) {
      throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum memeriksa.' })
    }
    const claimed = await tx.assessmentResponse.updateMany({
      where: { id, version: body.reviewedVersion, status: 'PENDING' },
      data: { status: statusAfterDecision },
    })
    if (claimed.count !== 1) {
      throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum memeriksa.' })
    }
    await tx.reviewDecision.create({
      data: {
        responseId: id,
        reviewerId: user.id,
        outcome: body.outcome,
        comment: body.comment,
        reviewedVersion: body.reviewedVersion,
      },
    })
    const allResponses = await tx.assessmentResponse.findMany({
      where: { assessmentId: response.assessment.id },
      select: { status: true },
    })
    let nextAssessmentStatus: 'IN_REVIEW' | 'REVISION_REQUIRED' | 'APPROVED' = 'IN_REVIEW'
    let approvedAt: Date | null = null
    if (allResponses.every(({ status }) => status !== 'PENDING')) {
      if (allResponses.some(({ status }) => status === 'NEEDS_REVISION')) {
        nextAssessmentStatus = 'REVISION_REQUIRED'
      } else {
        nextAssessmentStatus = 'APPROVED'
        approvedAt = new Date()
      }
    }

    if (nextAssessmentStatus !== current.assessment.status) {
      await tx.assessment.update({ where: { id: response.assessment.id }, data: { status: nextAssessmentStatus, approvedAt } })
      await tx.statusEvent.create({
        data: {
          assessmentId: response.assessment.id,
          actorId: user.id,
          fromStatus: current.assessment.status,
          toStatus: nextAssessmentStatus,
          reason: nextAssessmentStatus === 'REVISION_REQUIRED' ? 'Pemeriksaan indikator selesai; ada jawaban yang perlu revisi.' : null,
        },
      })
    }

    await tx.auditEvent.create(auditData(user.id, 'response_reviewed', 'AssessmentResponse', id, {
      outcome: body.outcome,
      reviewedVersion: body.reviewedVersion,
      nextAssessmentStatus,
    }))
    return { responseStatus: statusAfterDecision, assessmentStatus: nextAssessmentStatus }
  })

  return result
})

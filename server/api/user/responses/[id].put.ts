import { z } from 'zod'
import { assertSameOrigin } from '../../../utils/auth'
import { assertPeriodOpen, canEditResponse, requireOwnedResponse } from '../../../utils/authorization'
import { prisma } from '../../../utils/db'
import { auditData, readValidatedPayload, readRouteId } from '../../../utils/validation'

const schema = z.object({
  // An answer is saved only together with its level; an explanation or link without one is not a draft yet.
  maturityLevelId: z.string({ error: 'Pilih tingkat kematangan sebelum menyimpan.' }).min(1).max(64),
  explanation: z.string().trim().max(12000),
  expectedVersion: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  const { user, response } = await requireOwnedResponse(event, id)
  const assessment = response.assessment
  if (!canEditResponse(assessment.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Jawaban terkunci setelah penilaian dikirim.' })
  }
  if (response.version !== body.expectedVersion) {
    throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menyimpan.' })
  }
  if (body.maturityLevelId) {
    const level = await prisma.maturityLevel.findUnique({ where: { id: body.maturityLevelId }, select: { indicatorId: true } })
    if (!level || level.indicatorId !== response.indicatorId) {
      throw createError({ statusCode: 400, statusMessage: 'Tingkat kematangan tidak sesuai dengan indikator ini.' })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${assessment.id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessmentResponse.findUnique({ where: { id }, select: { version: true, assessment: { select: { status: true, period: { select: { status: true } } } } } })
    if (!current || current.version !== body.expectedVersion) {
      throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menyimpan.' })
    }
    if (!canEditResponse(current.assessment.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Jawaban terkunci setelah penilaian dikirim.' })
    }
    assertPeriodOpen(current.assessment.period.status)
    const changed = await tx.assessmentResponse.updateMany({
      where: { id, version: body.expectedVersion },
      data: {
        maturityLevelId: body.maturityLevelId,
        explanation: body.explanation,
        version: { increment: 1 },
      },
    })
    if (changed.count !== 1) throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menyimpan.' })
    const saved = await tx.assessmentResponse.findUniqueOrThrow({ where: { id } })
    await tx.auditEvent.create(auditData(user.id, 'assessment_response_saved', 'AssessmentResponse', id, { version: saved.version }))
    return saved
  })
  return { response: updated }
})

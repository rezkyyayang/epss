import { z } from 'zod'
import { assertSameOrigin } from '../../../utils/auth'
import { canEditResponse, requireOwnedResponse } from '../../../utils/authorization'
import { prisma } from '../../../utils/db'
import { auditData, readValidatedPayload, readRouteId } from '../../../utils/validation'

const schema = z.object({
  maturityLevelId: z.string().min(1).max(64).nullable(),
  explanation: z.string().trim().max(12000),
  expectedVersion: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  const { user, response } = await requireOwnedResponse(event, id)
  const assessment = response.assessment
  if (!['DRAFT', 'REVISION_REQUIRED'].includes(assessment.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Jawaban terkunci setelah dikirim.' })
  }

  if (!canEditResponse(assessment.status, response.status)) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya jawaban yang perlu revisi yang dapat diubah.' })
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
    const current = await tx.assessmentResponse.findUnique({ where: { id }, select: { id: true, version: true, status: true } })
    if (!current || current.version !== body.expectedVersion) {
      throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menyimpan.' })
    }
    const changed = await tx.assessmentResponse.updateMany({
      where: { id, version: body.expectedVersion, status: current.status },
      data: {
        maturityLevelId: body.maturityLevelId,
        explanation: body.explanation,
        status: current.status === 'NEEDS_REVISION' ? 'PENDING' : current.status,
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

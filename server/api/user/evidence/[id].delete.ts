import { assertSameOrigin } from '../../../utils/auth'
import { requireRole } from '../../../utils/auth'
import { canEditResponse, requireOwnedResponse } from '../../../utils/authorization'
import { prisma } from '../../../utils/db'
import { auditData, readRouteId } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const { user } = await requireRole(event, 'USER')
  const evidence = await prisma.evidence.findUnique({
    where: { id },
    include: { response: { select: { id: true, assessmentId: true } } },
  })
  if (!evidence) throw createError({ statusCode: 404, statusMessage: 'Bukti tidak ditemukan.' })
  const { response } = await requireOwnedResponse(event, evidence.response.id)
  if (!canEditResponse(response.assessment.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Bukti terkunci setelah penilaian dikirim.' })
  }

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${response.assessment.id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessmentResponse.findUnique({ where: { id: response.id }, select: { version: true, assessment: { select: { status: true } } } })
    if (!current || current.version !== response.version) throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menghapus bukti.' })
    if (!canEditResponse(current.assessment.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Bukti terkunci setelah penilaian dikirim.' })
    }
    const changed = await tx.assessmentResponse.updateMany({
      where: { id: response.id, version: current.version },
      data: { version: { increment: 1 } },
    })
    if (changed.count !== 1) throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menghapus bukti.' })
    await tx.evidence.delete({ where: { id } })
    await tx.auditEvent.create(auditData(user.id, 'evidence_link_deleted', 'Evidence', id, { responseId: evidence.response.id, url: evidence.url }))
  })
  return { ok: true }
})

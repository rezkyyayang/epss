import { assertSameOrigin } from '../../../../utils/auth'
import { requireOwnedAssessment } from '../../../../utils/authorization'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const { user, assessment } = await requireOwnedAssessment(event, id)
  const nextStatus = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessment.findUniqueOrThrow({ where: { id }, select: { status: true, activityName: true, activityYear: true } })
    if (current.status !== 'DRAFT') throw createError({ statusCode: 409, statusMessage: 'Penilaian ini sudah dikirim.' })
    if (!current.activityName.trim() || !current.activityYear) {
      throw createError({ statusCode: 409, statusMessage: 'Lengkapi nama dan tahun kegiatan statistik sebelum mengirim.' })
    }
    const responses = await tx.assessmentResponse.findMany({
      where: { assessmentId: id },
      include: { indicator: true, evidence: { select: { id: true } } },
    })
    const incomplete = responses.filter((response) => !response.maturityLevelId || !response.explanation.trim() || (response.indicator.requiresEvidence && !response.evidence.length))
    if (!responses.length || incomplete.length) {
      throw createError({
        statusCode: 409,
        statusMessage: `${incomplete.length} indikator belum memenuhi syarat pengiriman.`,
        data: { incompleteResponseIds: incomplete.map(({ id: responseId }) => responseId) },
      })
    }

    const newStatus = 'SUBMITTED' as const
    const changed = await tx.assessment.updateMany({
      where: { id, status: 'DRAFT' },
      data: { status: newStatus, submittedAt: new Date() },
    })
    if (changed.count !== 1) throw createError({ statusCode: 409, statusMessage: 'Status penilaian berubah. Muat ulang sebelum mengirim.' })
    await tx.statusEvent.create({
      data: { assessmentId: id, actorId: user.id, fromStatus: current.status, toStatus: newStatus },
    })
    await tx.auditEvent.create(auditData(user.id, 'assessment_submitted', 'Assessment', id, { responseCount: responses.length }))
    return newStatus
  })
  return { status: nextStatus }
})

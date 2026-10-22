import { z } from 'zod'
import { assertSameOrigin } from '../../../../utils/auth'
import { canEditResponse, requireOwnedAssessment } from '../../../../utils/authorization'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const schema = z.object({
  activityName: z.string().trim().min(3).max(240),
  activityYear: z.number().int().min(2000).max(2100),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const { user } = await requireOwnedAssessment(event, id)
  const body = await readValidatedPayload(event, schema)

  const assessment = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessment.findUniqueOrThrow({ where: { id }, select: { status: true } })
    if (!canEditResponse(current.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Data kegiatan terkunci setelah penilaian dikirim.' })
    }
    const saved = await tx.assessment.update({
      where: { id },
      data: { activityName: body.activityName, activityYear: body.activityYear },
      select: { activityName: true, activityYear: true },
    })
    await tx.auditEvent.create(auditData(user.id, 'assessment_activity_saved', 'Assessment', id, saved))
    return saved
  })
  return { assessment }
})

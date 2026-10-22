import { requireAssessmentReviewAccess } from '../../../utils/authorization'
import { prisma } from '../../../utils/db'
import { readRouteId } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const id = readRouteId(event)
  await requireAssessmentReviewAccess(event, id)
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      period: { select: { id: true, name: true, status: true } },
      unit: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, displayName: true, email: true } },
      responses: {
        orderBy: [{ indicator: { domain: { position: 'asc' } } }, { indicator: { position: 'asc' } }],
        include: {
          indicator: {
            include: { domain: true, maturityLevels: { orderBy: { level: 'asc' } } },
          },
          maturityLevel: true,
          evidence: { orderBy: { createdAt: 'asc' }, select: { id: true, url: true, createdAt: true } },
          verification: {
            select: { maturityLevelId: true, comment: true, updatedAt: true, verifier: { select: { displayName: true } } },
          },
        },
      },
      statusEvents: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { displayName: true } } } },
    },
  })
  if (!assessment) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
  return { assessment }
})

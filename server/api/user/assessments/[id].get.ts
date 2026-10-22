import { requireOwnedAssessment } from '../../../utils/authorization'
import { prisma } from '../../../utils/db'
import { maxEvidenceLinks, readRouteId } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const id = readRouteId(event)
  await requireOwnedAssessment(event, id)
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      period: { select: { id: true, name: true, startsAt: true, endsAt: true, status: true } },
      unit: { select: { id: true, name: true, code: true } },
      responses: {
        orderBy: [{ indicator: { domain: { position: 'asc' } } }, { indicator: { position: 'asc' } }],
        include: {
          indicator: {
            include: {
              domain: true,
              maturityLevels: { orderBy: { level: 'asc' } },
            },
          },
          maturityLevel: true,
          evidence: { orderBy: { createdAt: 'asc' }, select: { id: true, url: true, createdAt: true } },
          decisions: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: { reviewer: { select: { displayName: true } } },
          },
        },
      },
      statusEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!assessment) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
  return { assessment, maxEvidenceLinks }
})

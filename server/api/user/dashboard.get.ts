import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'USER')
  const unitIds = user.memberships.map(({ id }) => id)
  const [periods, assessments] = await Promise.all([
    unitIds.length
      ? prisma.periodAssignment.findMany({
          where: { unitId: { in: unitIds }, period: { status: 'ACTIVE' }, unit: { isActive: true } },
          orderBy: [{ period: { startsAt: 'asc' } }, { period: { name: 'asc' } }],
          include: {
            period: { select: { id: true, name: true, startsAt: true, endsAt: true } },
            unit: { select: { id: true, name: true, code: true } },
          },
        })
      : Promise.resolve([]),
    prisma.assessment.findMany({
      where: { createdById: user.id, unitId: { in: unitIds } },
      orderBy: { updatedAt: 'desc' },
      include: {
        period: { select: { id: true, name: true, status: true, endsAt: true } },
        unit: { select: { id: true, name: true, code: true } },
        responses: { select: { id: true, status: true, maturityLevelId: true, explanation: true } },
      },
    }),
  ])

  const available = periods.map(({ period, unit }) => ({ period, unit }))

  return {
    user,
    available,
    assessments: assessments.map(({ responses, ...assessment }) => ({
      ...assessment,
      totalResponses: responses.length,
      completedResponses: responses.filter((response) => Boolean(response.maturityLevelId) && Boolean(response.explanation.trim())).length,
      revisionCount: responses.filter((response) => response.status === 'NEEDS_REVISION').length,
    })),
  }
})

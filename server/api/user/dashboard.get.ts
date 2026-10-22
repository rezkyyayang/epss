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

  // The dashboard leads with one assessment: the latest one in an active period, else the latest overall.
  // Its responses carry just enough of the catalog to compute domain scores on the client.
  const focusAssessment = assessments.find(({ period }) => period.status === 'ACTIVE') ?? assessments[0]
  const focusResponses = focusAssessment
    ? await prisma.assessmentResponse.findMany({
        where: { assessmentId: focusAssessment.id },
        select: {
          maturityLevelId: true,
          indicator: {
            select: {
              weight: true,
              maturityLevels: { select: { id: true, level: true } },
              domain: { select: { id: true, name: true, weight: true, position: true } },
            },
          },
        },
      })
    : []

  return {
    user,
    available,
    focus: focusAssessment ? { assessmentId: focusAssessment.id, responses: focusResponses } : null,
    assessments: assessments.map(({ responses, ...assessment }) => ({
      ...assessment,
      totalResponses: responses.length,
      completedResponses: responses.filter((response) => Boolean(response.maturityLevelId) && Boolean(response.explanation.trim())).length,
      revisionCount: responses.filter((response) => response.status === 'NEEDS_REVISION').length,
    })),
  }
})

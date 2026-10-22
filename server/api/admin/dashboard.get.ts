import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'

// One period at a time: every unit assigned to it, with the answers needed to score each unit's
// self-assessment and Pusdatin's final levels on the client.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const query = getQuery(event)
  const periods = await prisma.period.findMany({
    select: { id: true, name: true, status: true },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  })
  const requested = typeof query.periodId === 'string' ? periods.find(({ id }) => id === query.periodId) : undefined
  const period = requested ?? periods.find(({ status }) => status === 'ACTIVE') ?? periods[0]
  if (!period) return { periods, periodId: null, rows: [] }

  const [assignments, assessments] = await Promise.all([
    prisma.periodAssignment.findMany({
      where: { periodId: period.id },
      select: { unit: { select: { id: true, name: true, code: true } } },
      orderBy: { unit: { name: 'asc' } },
    }),
    prisma.assessment.findMany({
      where: { periodId: period.id },
      select: {
        id: true,
        unitId: true,
        status: true,
        activityName: true,
        activityYear: true,
        submittedAt: true,
        verifiedAt: true,
        responses: {
          orderBy: [{ indicator: { domain: { position: 'asc' } } }, { indicator: { position: 'asc' } }],
          select: {
            maturityLevelId: true,
            explanation: true,
            verification: { select: { maturityLevelId: true } },
            indicator: {
              select: {
                id: true,
                code: true,
                title: true,
                weight: true,
                maturityLevels: { select: { id: true, level: true } },
                domain: { select: { id: true, name: true, weight: true, position: true } },
              },
            },
          },
        },
      },
    }),
  ])

  const byUnit = new Map(assessments.map((assessment) => [assessment.unitId, assessment]))
  return {
    periods,
    periodId: period.id,
    rows: assignments.map(({ unit }) => ({ unit, assessment: byUnit.get(unit.id) ?? null })),
  }
})

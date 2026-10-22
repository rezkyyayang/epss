import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'ADMIN')
  const unitIds = user.memberships.map(({ id }) => id)
  const [assessments, counts] = unitIds.length ? await Promise.all([
    prisma.assessment.findMany({
        where: { unitId: { in: unitIds } },
        select: { id: true, status: true, updatedAt: true, submittedAt: true, period: { select: { name: true } }, unit: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
    prisma.assessment.groupBy({ by: ['status'], where: { unitId: { in: unitIds } }, _count: { _all: true } }),
  ]) : [[], []]

  return {
    queue: assessments.filter(({ status }) => ['SUBMITTED', 'RESUBMITTED', 'IN_REVIEW'].includes(status)),
    counts: Object.fromEntries(counts.map(({ status, _count }) => [status, _count._all])),
    hasUnitAccess: unitIds.length > 0,
  }
})

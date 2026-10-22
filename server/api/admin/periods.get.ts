import { requireRole } from '../../utils/auth'
import { isCatalogReady } from '../../utils/catalog'
import { prisma } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const periods = await prisma.period.findMany({
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { domains: true, assessments: true } },
      assignments: { include: { unit: { select: { id: true, name: true, code: true } } } },
      domains: {
        select: {
          weight: true,
          indicators: { select: { weight: true, maturityLevels: { select: { level: true } } } },
        },
      },
    },
  })

  return {
    periods: periods.map(({ domains, ...period }) => ({
      ...period,
      indicatorCount: domains.reduce((sum, domain) => sum + domain.indicators.length, 0),
      catalogReady: isCatalogReady(domains),
    })),
  }
})

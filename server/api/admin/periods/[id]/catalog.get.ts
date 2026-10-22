import { requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/db'
import { readRouteId } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const periodId = readRouteId(event)
  const period = await prisma.period.findUnique({ where: { id: periodId }, select: { id: true, name: true, status: true } })
  if (!period) throw createError({ statusCode: 404, statusMessage: 'Periode tidak ditemukan.' })

  const domains = await prisma.domain.findMany({
    where: { periodId },
    orderBy: { position: 'asc' },
    include: {
      indicators: { orderBy: { position: 'asc' }, include: { maturityLevels: { orderBy: { level: 'asc' } } } },
    },
  })
  const locked = (await prisma.assessment.count({ where: { periodId } })) > 0
  return { period, domains, locked }
})

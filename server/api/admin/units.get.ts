import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const units = await prisma.unit.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { memberships: true, assessments: true } } },
  })
  return { units }
})

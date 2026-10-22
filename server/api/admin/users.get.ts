import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      createdAt: true,
      memberships: { include: { unit: { select: { id: true, name: true, code: true } } } },
    },
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
  })
  return { users }
})

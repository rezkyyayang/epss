import { archiveSelect } from '../utils/archive'
import { requireSession } from '../utils/auth'
import { prisma } from '../utils/db'

// Every signed-in account reads the archive; only Admins change it.
export default defineEventHandler(async (event) => {
  await requireSession(event)
  const documents = await prisma.archiveDocument.findMany({
    orderBy: [{ type: 'asc' }, { year: 'desc' }, { title: 'asc' }],
    select: archiveSelect,
  })
  return { documents }
})

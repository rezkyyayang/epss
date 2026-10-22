import { assertSameOrigin, clearSessionCookie, requireSession } from '../../utils/auth'
import { prisma } from '../../utils/db'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { sessionId } = await requireSession(event)
  await prisma.session.delete({ where: { id: sessionId } })
  clearSessionCookie(event)
  return { ok: true }
})

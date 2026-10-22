import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../../utils/auth'
import { prisma } from '../../../utils/db'
import { hashPassword } from '../../../utils/password'
import { auditData, readRouteId, readValidatedPayload } from '../../../utils/validation'

const schema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(14).max(200).optional(),
}).refine((body) => body.isActive !== undefined || body.password !== undefined)

// Deactivates or reactivates an account, or sets a new password. Either change signs the account out
// everywhere, except the Admin's own current session when they reset their own password.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user: actor, sessionId } = await requireRole(event, 'ADMIN')
  const id = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  if (id === actor.id && body.isActive === false) {
    throw createError({ statusCode: 400, statusMessage: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' })
  }
  const account = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Akun tidak ditemukan.' })
  const passwordHash = body.password ? await hashPassword(body.password) : undefined

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.user.update({
      where: { id },
      data: { isActive: body.isActive, passwordHash },
      select: { id: true, email: true, displayName: true, role: true, isActive: true },
    })
    await tx.session.deleteMany({ where: { userId: id, id: { not: sessionId } } })
    await tx.auditEvent.create(auditData(actor.id, 'user_updated', 'User', id, {
      isActive: body.isActive,
      passwordReset: Boolean(passwordHash),
    }))
    return saved
  })
  return { user: updated }
})

import { z } from 'zod'
import { maxPasswordLength, unmetPasswordRules } from '../../../app/utils/passwordPolicy'
import { assertSameOrigin, requireSession } from '../../utils/auth'
import { prisma } from '../../utils/db'
import { loginThrottleKeys, readClientIp, releaseLoginAttempt, reserveLoginAttempt } from '../../utils/login-throttle'
import { hashPassword, verifyPassword } from '../../utils/password'
import { auditData, readValidatedPayload } from '../../utils/validation'

const schema = z.object({
  currentPassword: z.string().min(1).max(maxPasswordLength),
  newPassword: z.string().min(1).max(maxPasswordLength),
})

// Any signed-in account can change its own password. The current password is required and counts against
// the same throttle as sign-in, so a borrowed session cannot be used to guess it. Other sessions end.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user, sessionId } = await requireSession(event)
  const body = await readValidatedPayload(event, schema)

  const unmet = unmetPasswordRules(body.newPassword)
  if (unmet.length) {
    throw createError({ statusCode: 400, statusMessage: `Kata sandi baru belum memenuhi syarat: ${unmet.join(', ').toLowerCase()}.` })
  }
  if (body.newPassword === body.currentPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Kata sandi baru harus berbeda dari kata sandi saat ini.' })
  }

  const throttleKeys = loginThrottleKeys(user.email, readClientIp(event))
  if (!await reserveLoginAttempt(throttleKeys)) {
    throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' })
  }
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
  if (!account || !await verifyPassword(body.currentPassword, account.passwordHash)) {
    throw createError({ statusCode: 400, statusMessage: 'Kata sandi saat ini tidak cocok.' })
  }
  await releaseLoginAttempt(throttleKeys)

  const passwordHash = await hashPassword(body.newPassword)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } })
    await tx.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } })
    await tx.auditEvent.create(auditData(user.id, 'password_changed', 'User', user.id))
  })
  return { ok: true }
})

import { z } from 'zod'
import { assertSameOrigin, createSessionToken, hashSessionToken, setSessionCookie } from '../../utils/auth'
import { prisma } from '../../utils/db'
import { loginThrottleKeys, readClientIp, releaseLoginAttempt, reserveLoginAttempt } from '../../utils/login-throttle'
import { verifyPassword } from '../../utils/password'

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const parsed = loginSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Periksa kembali email dan kata sandi.' })
  }

  const email = parsed.data.email.toLowerCase()
  const throttleKeys = loginThrottleKeys(email, readClientIp(event))
  if (!await reserveLoginAttempt(throttleKeys)) {
    throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { unit: { select: { id: true, name: true, code: true } } } } },
  })
  const valid = user?.isActive ? await verifyPassword(parsed.data.password, user.passwordHash) : false
  if (!user || !valid) {
    throw createError({ statusCode: 401, statusMessage: 'Email atau kata sandi tidak cocok.' })
  }

  await releaseLoginAttempt(throttleKeys)
  const token = createSessionToken()
  const hours = Number(process.env.SESSION_DURATION_HOURS || 12)
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  })
  await setSessionCookie(event, token)

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      memberships: user.memberships.map(({ unit }) => unit),
    },
  }
})

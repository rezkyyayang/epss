import { createHash } from 'node:crypto'
import { getRequestHeader } from 'h3'
import type { H3Event } from 'h3'
import { prisma } from './db'

const windowMs = 15 * 60 * 1000
const maxAttemptsPerAccount = 5
const maxAttemptsPerIp = 30

function throttleKey(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

// Behind a reverse proxy the socket address is the proxy itself. With TRUST_PROXY=true the
// last X-Forwarded-For entry is used, because that is the one the proxy appended and the client cannot forge.
export function readClientIp(event: H3Event) {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = getRequestHeader(event, 'x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean)
    if (forwarded?.length) return forwarded[forwarded.length - 1]
  }
  return event.node.req.socket.remoteAddress || 'unknown'
}

export function loginThrottleKeys(email: string, clientIp: string) {
  return {
    account: throttleKey(`${email}:${clientIp}`),
    ip: throttleKey(`ip:${clientIp}`),
  }
}

// The attempt is counted before the password is checked. The increment runs as a single
// upsert, so parallel requests each get their own count and cannot all slip under the limit.
async function reserveAttempt(keyHash: string, maxAttempts: number) {
  const now = new Date()
  await prisma.loginThrottle.updateMany({
    where: {
      keyHash,
      OR: [
        { blockedUntil: { lte: now } },
        { blockedUntil: null, updatedAt: { lte: new Date(now.getTime() - windowMs) } },
      ],
    },
    data: { failedAttempts: 0, blockedUntil: null },
  })
  const row = await prisma.loginThrottle.upsert({
    where: { keyHash },
    create: { keyHash, failedAttempts: 1 },
    update: { failedAttempts: { increment: 1 } },
  })
  if (row.blockedUntil && row.blockedUntil > now) return false
  if (row.failedAttempts > maxAttempts) {
    await prisma.loginThrottle.update({ where: { keyHash }, data: { blockedUntil: new Date(now.getTime() + windowMs) } })
    return false
  }
  return true
}

export async function reserveLoginAttempt(keys: ReturnType<typeof loginThrottleKeys>) {
  const ipAllowed = await reserveAttempt(keys.ip, maxAttemptsPerIp)
  if (!ipAllowed) return false
  return reserveAttempt(keys.account, maxAttemptsPerAccount)
}

// A correct password clears the account counter and gives the attempt back to the IP budget.
export async function releaseLoginAttempt(keys: ReturnType<typeof loginThrottleKeys>) {
  await prisma.loginThrottle.deleteMany({ where: { keyHash: keys.account } })
  await prisma.loginThrottle.updateMany({
    where: { keyHash: keys.ip, failedAttempts: { gt: 0 } },
    data: { failedAttempts: { decrement: 1 } },
  })
}

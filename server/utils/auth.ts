import { createHash, randomBytes } from 'node:crypto'
import { createError, deleteCookie, getCookie, getRequestHeader, setCookie } from 'h3'
import type { H3Event } from 'h3'
import type { UserRole } from '../../generated/prisma/client'
import { prisma } from './db'

const publicUser = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  memberships: {
    include: {
      unit: { select: { id: true, name: true, code: true } },
    },
  },
} as const

type CurrentSession = Awaited<ReturnType<typeof loadSession>>

// requireRole and requireUnitAccess both need the session, so the lookup runs once per request
// and later callers reuse the same promise.
export function requireSession(event: H3Event): Promise<CurrentSession> {
  event.context.sectoraSession ??= loadSession(event)
  return event.context.sectoraSession as Promise<CurrentSession>
}

async function loadSession(event: H3Event) {
  const config = useRuntimeConfig(event)
  const token = getCookie(event, config.sessionCookieName)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Silakan masuk untuk melanjutkan.' })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { memberships: { include: { unit: true } } } } },
  })

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } })
    clearSessionCookie(event)
    throw createError({ statusCode: 401, statusMessage: 'Sesi berakhir. Silakan masuk kembali.' })
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      role: session.user.role,
      memberships: session.user.memberships.map(({ unit }) => unit),
    },
  }
}

export async function requireRole(event: H3Event, role: UserRole) {
  const current = await requireSession(event)
  if (current.user.role !== role) {
    throw createError({ statusCode: 403, statusMessage: 'Anda tidak memiliki akses ke halaman ini.' })
  }
  return current
}

export async function requireUnitAccess(event: H3Event, unitId: string) {
  const current = await requireSession(event)
  const membership = current.user.memberships.find((unit) => unit.id === unitId)
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Unit ini tidak termasuk dalam akses Anda.' })
  }
  return current
}

export function assertSameOrigin(event: H3Event) {
  const origin = getRequestHeader(event, 'origin')
  const fallbackOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000']
  const allowedOrigins = (process.env.APP_ORIGIN || fallbackOrigins.join(','))
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin
      } catch {
        return null
      }
    })
    .filter((value): value is string => value !== null)
  let valid = false
  try {
    valid = Boolean(origin && allowedOrigins.includes(new URL(origin).origin))
  } catch {
    valid = false
  }
  if (!valid) {
    throw createError({ statusCode: 403, statusMessage: 'Permintaan tidak dapat diverifikasi.' })
  }
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function setSessionCookie(event: H3Event, token: string) {
  const config = useRuntimeConfig(event)
  const hours = Number(process.env.SESSION_DURATION_HOURS || config.sessionDurationHours || 12)
  setCookie(event, config.sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: hours * 60 * 60,
  })
}

export function clearSessionCookie(event: H3Event) {
  const config = useRuntimeConfig(event)
  deleteCookie(event, config.sessionCookieName, { path: '/' })
}

export async function writeAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
  return prisma.auditEvent.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined,
    },
  })
}

export const userSelect = publicUser

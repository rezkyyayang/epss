import { createError } from 'h3'
import type { H3Event } from 'h3'
import { z } from 'zod'

export const idSchema = z.string().min(1).max(64)
export const maxEvidenceLinks = 10

export async function readValidatedPayload<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Periksa isian yang dikirim.',
      data: { issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) },
    })
  }
  return parsed.data
}

// Only plain web links are stored, so a saved value can never render as a javascript: or data: link.
export function parseWebUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
  return url.href
}

// Prisma reports a unique constraint failure as P2002; callers turn it into a 409 with their own message.
export function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export function readRouteId(event: H3Event, key = 'id') {
  const value = getRouterParam(event, key)
  const parsed = idSchema.safeParse(value)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Parameter tidak valid.' })
  return parsed.data
}

export function auditData(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
  return {
    data: {
      actorId,
      action,
      entityType,
      entityId,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined,
    },
  }
}

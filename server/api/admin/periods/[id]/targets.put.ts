import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/db'
import { auditData, idSchema, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const schema = z.object({
  targets: z.array(z.object({ domainId: idSchema, target: z.number().finite().nullable() })).min(1).max(50),
})

// Sets Pusdatin's target score per domain. Unlike the catalog this stays editable after assessments exist,
// because targets are a reference for reading results, not part of how a unit is scored.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const periodId = readRouteId(event)
  const { targets } = await readValidatedPayload(event, schema)

  const domains = await prisma.domain.findMany({
    where: { periodId, id: { in: targets.map(({ domainId }) => domainId) } },
    select: { id: true, name: true, indicators: { select: { maturityLevels: { select: { level: true } } } } },
  })
  if (domains.length !== new Set(targets.map(({ domainId }) => domainId)).size) {
    throw createError({ statusCode: 400, statusMessage: 'Domain tidak termasuk dalam katalog periode ini.' })
  }
  // A target lives on the same scale as the domain's levels: 0 up to its highest level.
  const maxLevelOf = new Map(domains.map(({ id, indicators }) => [id, Math.max(0, ...indicators.flatMap(({ maturityLevels }) => maturityLevels.map(({ level }) => level)))]))
  for (const { domainId, target } of targets) {
    const max = maxLevelOf.get(domainId) ?? 0
    if (target !== null && (target < 0 || target > max)) {
      const name = domains.find(({ id }) => id === domainId)?.name
      throw createError({ statusCode: 400, statusMessage: `Target ${name} harus antara 0 dan ${max}.` })
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const { domainId, target } of targets) {
      await tx.domain.update({ where: { id: domainId }, data: { target: target === null ? null : Math.round(target * 100) / 100 } })
    }
    await tx.auditEvent.create(auditData(user.id, 'domain_targets_updated', 'Period', periodId, { targets }))
  })
  return { ok: true }
})

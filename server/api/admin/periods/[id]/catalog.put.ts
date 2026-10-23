import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../../../utils/auth'
import { hasValidLevels, maxLevels, minLevels, sumWeights } from '../../../../utils/catalog'
import { prisma } from '../../../../utils/db'
import { auditData, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const weightSchema = z.number().int().min(1).max(100)
const levelSchema = z.object({
  level: z.number().int().min(1).max(maxLevels),
  title: z.string().trim().max(160).default(''),
  criterion: z.string().trim().min(1).max(3000),
  evidenceGuide: z.string().trim().max(3000).default(''),
})
const indicatorSchema = z.object({
  code: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(240),
  criterion: z.string().trim().max(12000).default(''),
  weight: weightSchema,
  requiresEvidence: z.boolean().default(false),
  maturityLevels: z.array(levelSchema).min(minLevels).max(maxLevels),
})
const schema = z.object({
  domains: z.array(z.object({
    code: z.string().trim().min(1).max(32),
    name: z.string().trim().min(1).max(160),
    weight: weightSchema,
    indicators: z.array(indicatorSchema).min(1),
  })).min(1),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const periodId = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  if (!body.domains.every((domain) => domain.indicators.every(hasValidLevels))) {
    throw createError({ statusCode: 400, statusMessage: `Tingkat kematangan tiap indikator harus berurutan mulai Level 1, antara ${minLevels} dan ${maxLevels} level.` })
  }
  if (sumWeights(body.domains) !== 100) {
    throw createError({ statusCode: 400, statusMessage: 'Total bobot domain harus 100%.' })
  }
  const unbalanced = body.domains.find((domain) => sumWeights(domain.indicators) !== 100)
  if (unbalanced) {
    throw createError({ statusCode: 400, statusMessage: `Total bobot indikator pada ${unbalanced.name} harus 100%.` })
  }
  const domainCodes = body.domains.map(({ code }) => code.toUpperCase())
  const codeScopesValid = new Set(domainCodes).size === domainCodes.length && body.domains.every((domain) => {
    const indicatorCodes = domain.indicators.map(({ code }) => code.toUpperCase())
    return new Set(indicatorCodes).size === indicatorCodes.length
  })
  if (!codeScopesValid) throw createError({ statusCode: 400, statusMessage: 'Kode domain dan kode indikator dalam satu domain harus unik.' })
  const indicatorCount = body.domains.reduce((sum, domain) => sum + domain.indicators.length, 0)

  // Rows get their ids here so the whole catalog goes in as three bulk inserts. Nested creates send one
  // insert per row, and with the database in another region that ran past the transaction time limit.
  const domainRows = body.domains.map((domain, domainIndex) => ({
    id: randomUUID(), periodId, code: domain.code.toUpperCase(), name: domain.name, weight: domain.weight, position: domainIndex,
  }))
  const indicatorRows = body.domains.flatMap((domain, domainIndex) => domain.indicators.map((indicator, indicatorIndex) => ({
    id: randomUUID(),
    domainId: domainRows[domainIndex].id,
    code: indicator.code.toUpperCase(),
    title: indicator.title,
    criterion: indicator.criterion,
    weight: indicator.weight,
    requiresEvidence: indicator.requiresEvidence,
    position: indicatorIndex,
    levels: indicator.maturityLevels,
  })))
  const levelRows = indicatorRows.flatMap(({ id, levels }) => levels.map(({ level, title, criterion, evidenceGuide }) => ({ indicatorId: id, level, title, criterion, evidenceGuide })))

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Period" WHERE "id" = ${periodId} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Periode tidak ditemukan.' })
    if (await tx.assessment.count({ where: { periodId } })) {
      throw createError({ statusCode: 409, statusMessage: 'Katalog terkunci setelah penilaian pertama dibuat.' })
    }
    const domainIds = (await tx.domain.findMany({ where: { periodId }, select: { id: true } })).map(({ id }) => id)
    const indicatorIds = (await tx.indicator.findMany({ where: { domainId: { in: domainIds } }, select: { id: true } })).map(({ id }) => id)
    await tx.maturityLevel.deleteMany({ where: { indicatorId: { in: indicatorIds } } })
    await tx.indicator.deleteMany({ where: { id: { in: indicatorIds } } })
    await tx.domain.deleteMany({ where: { id: { in: domainIds } } })

    await tx.domain.createMany({ data: domainRows })
    await tx.indicator.createMany({ data: indicatorRows.map(({ levels: _levels, ...row }) => row) })
    await tx.maturityLevel.createMany({ data: levelRows })
    await tx.auditEvent.create(auditData(user.id, 'period_catalog_replaced', 'Period', periodId, { domainCount: body.domains.length, indicatorCount }))
  }, { maxWait: 10_000, timeout: 20_000 })
  return { ok: true }
})

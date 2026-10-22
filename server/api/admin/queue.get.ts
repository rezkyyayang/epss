import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'

const statusValues = ['SUBMITTED', 'IN_REVIEW', 'REVISION_REQUIRED', 'RESUBMITTED', 'APPROVED'] as const

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'ADMIN')
  const query = getQuery(event)
  const unitIds = user.memberships.map(({ id }) => id)
  if (!unitIds.length) return { assessments: [], units: [], periods: [], hasUnitAccess: false }
  const unitId = typeof query.unitId === 'string' ? query.unitId : undefined
  if (unitId && !unitIds.includes(unitId)) throw createError({ statusCode: 403, statusMessage: 'Unit ini tidak termasuk dalam akses Anda.' })
  const statusParsed = z.enum(statusValues).safeParse(query.status)
  const periodId = typeof query.periodId === 'string' ? query.periodId : undefined

  const assessments = await prisma.assessment.findMany({
    where: {
      unitId: unitId || { in: unitIds },
      status: statusParsed.success ? statusParsed.data : { in: [...statusValues] },
      periodId,
    },
    orderBy: [{ submittedAt: 'asc' }, { updatedAt: 'asc' }],
    take: 100,
    include: {
      period: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true, code: true } },
      createdBy: { select: { displayName: true } },
      responses: { select: { id: true, status: true, maturityLevelId: true, explanation: true } },
    },
  })
  const [units, periods] = await Promise.all([
    prisma.unit.findMany({ where: { id: { in: unitIds }, isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
    prisma.period.findMany({ select: { id: true, name: true }, orderBy: { startsAt: 'desc' } }),
  ])

  return {
    assessments: assessments.map(({ responses, ...assessment }) => ({
      ...assessment,
      totalResponses: responses.length,
      completedResponses: responses.filter((response) => Boolean(response.maturityLevelId) && Boolean(response.explanation.trim())).length,
      revisionCount: responses.filter((response) => response.status === 'NEEDS_REVISION').length,
    })),
    units,
    periods,
    hasUnitAccess: true,
  }
})

import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'

// Drafts stay with the unit; Pusdatin sees an assessment from the moment it is submitted.
const statusValues = ['SUBMITTED', 'IN_REVIEW', 'VERIFIED'] as const

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const query = getQuery(event)
  const unitId = typeof query.unitId === 'string' ? query.unitId : undefined
  const statusParsed = z.enum(statusValues).safeParse(query.status)
  const periodId = typeof query.periodId === 'string' ? query.periodId : undefined

  const [assessments, units, periods] = await Promise.all([
    prisma.assessment.findMany({
      where: {
        unitId,
        status: statusParsed.success ? statusParsed.data : { in: [...statusValues] },
        periodId,
      },
      orderBy: [{ submittedAt: 'asc' }, { updatedAt: 'asc' }],
      take: 200,
      include: {
        period: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, code: true } },
        createdBy: { select: { displayName: true } },
        responses: { select: { id: true, maturityLevelId: true, explanation: true, verification: { select: { id: true } } } },
      },
    }),
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
    prisma.period.findMany({ select: { id: true, name: true }, orderBy: { startsAt: 'desc' } }),
  ])

  return {
    assessments: assessments.map(({ responses, ...assessment }) => ({
      ...assessment,
      totalResponses: responses.length,
      completedResponses: responses.filter((response) => Boolean(response.maturityLevelId) && Boolean(response.explanation.trim())).length,
      verifiedResponses: responses.filter((response) => Boolean(response.verification)).length,
    })),
    units,
    periods,
  }
})

import { requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/db'
import { readRouteId } from '../../../../utils/validation'

// Who verifies which unit in a period, with each unit's verification progress and the Admins who can be assigned.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const periodId = readRouteId(event)
  const period = await prisma.period.findUnique({ where: { id: periodId }, select: { id: true, name: true, status: true } })
  if (!period) throw createError({ statusCode: 404, statusMessage: 'Periode tidak ditemukan.' })

  const [assignments, verifiers, assessments] = await Promise.all([
    prisma.periodAssignment.findMany({
      where: { periodId },
      select: { unit: { select: { id: true, name: true, code: true } }, verifier: { select: { id: true, displayName: true, isActive: true } } },
      orderBy: { unit: { name: 'asc' } },
    }),
    prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    }),
    prisma.assessment.findMany({
      where: { periodId },
      select: { id: true, unitId: true, status: true, responses: { select: { verification: { select: { id: true } } } } },
    }),
  ])

  const byUnit = new Map(assessments.map((assessment) => [assessment.unitId, assessment]))
  return {
    period,
    verifiers,
    rows: assignments.map(({ unit, verifier }) => {
      const assessment = byUnit.get(unit.id)
      return {
        unit,
        verifier,
        assessment: assessment
          ? {
              id: assessment.id,
              status: assessment.status,
              totalResponses: assessment.responses.length,
              verifiedResponses: assessment.responses.filter(({ verification }) => Boolean(verification)).length,
            }
          : null,
      }
    }),
  }
})

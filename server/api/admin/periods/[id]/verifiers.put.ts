import { z } from 'zod'
import { assertSameOrigin, requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/db'
import { auditData, idSchema, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const schema = z.object({
  assignments: z.array(z.object({ unitId: idSchema, verifierId: idSchema.nullable() })).min(1).max(200),
})

// Sets the responsible verifier for units already assigned to the period. Allowed at any time, also after
// assessments exist, so work can be handed over mid-period. null clears the assignment.
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const periodId = readRouteId(event)
  const { assignments } = await readValidatedPayload(event, schema)

  const verifierIds = [...new Set(assignments.map(({ verifierId }) => verifierId).filter((id): id is string => Boolean(id)))]
  const validVerifiers = await prisma.user.count({ where: { id: { in: verifierIds }, role: 'ADMIN', isActive: true } })
  if (validVerifiers !== verifierIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Verifikator harus akun Admin yang aktif.' })
  }

  await prisma.$transaction(async (tx) => {
    for (const { unitId, verifierId } of assignments) {
      const { count } = await tx.periodAssignment.updateMany({ where: { periodId, unitId }, data: { verifierId } })
      if (!count) throw createError({ statusCode: 400, statusMessage: 'Unit ini tidak ditugaskan pada periode tersebut.' })
    }
    await tx.auditEvent.create(auditData(user.id, 'period_verifiers_assigned', 'Period', periodId, { assignments }))
  })
  return { ok: true }
})

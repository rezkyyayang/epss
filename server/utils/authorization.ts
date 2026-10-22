import { createError } from 'h3'
import type { H3Event } from 'h3'
import { requireRole, requireUnitAccess } from './auth'
import { prisma } from './db'

// During a revision round every response that is not approved was returned to the User.
// Its status leaves NEEDS_REVISION after the first edit, so checking for NEEDS_REVISION alone would lock it again.
export function canEditResponse(assessmentStatus: string, responseStatus: string) {
  if (assessmentStatus === 'DRAFT') return true
  return assessmentStatus === 'REVISION_REQUIRED' && responseStatus !== 'APPROVED'
}

export async function requireOwnedAssessment(event: H3Event, assessmentId: string) {
  const current = await requireRole(event, 'USER')
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, createdById: true, unitId: true, status: true, periodId: true },
  })
  if (!assessment || assessment.createdById !== current.user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
  }
  await requireUnitAccess(event, assessment.unitId)
  return { ...current, assessment }
}

export async function requireOwnedResponse(event: H3Event, responseId: string) {
  const current = await requireRole(event, 'USER')
  const response = await prisma.assessmentResponse.findUnique({
    where: { id: responseId },
    include: { assessment: { select: { id: true, createdById: true, unitId: true, status: true, periodId: true } } },
  })
  if (!response || response.assessment.createdById !== current.user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Jawaban tidak ditemukan.' })
  }
  await requireUnitAccess(event, response.assessment.unitId)
  return { ...current, response }
}

export async function requireAssessmentReviewAccess(event: H3Event, assessmentId: string) {
  const current = await requireRole(event, 'ADMIN')
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, unitId: true, status: true, periodId: true },
  })
  if (!assessment) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
  await requireUnitAccess(event, assessment.unitId)
  return { ...current, assessment }
}

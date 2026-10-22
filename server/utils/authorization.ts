import { createError } from 'h3'
import type { H3Event } from 'h3'
import { requireRole, requireUnitAccess } from './auth'
import { prisma } from './db'

// A unit edits its answers only while the assessment is a draft; submitting hands it to Pusdatin for good.
export function canEditResponse(assessmentStatus: string) {
  return assessmentStatus === 'DRAFT'
}

// Closing a period freezes its drafts: the unit can no longer change or send them.
export function assertPeriodOpen(periodStatus: string) {
  if (periodStatus !== 'ACTIVE') {
    throw createError({ statusCode: 409, statusMessage: 'Periode ini sudah tidak aktif, sehingga isian tidak dapat diubah atau dikirim.' })
  }
}

// Pusdatin verifies only after the unit has submitted, and stops once the verification result is sent.
export function canVerify(assessmentStatus: string) {
  return assessmentStatus === 'SUBMITTED' || assessmentStatus === 'IN_REVIEW'
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

// Admins are Pusdatin staff who verify every unit, so access is by role alone.
export async function requireAssessmentReviewAccess(event: H3Event, assessmentId: string) {
  const current = await requireRole(event, 'ADMIN')
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, unitId: true, status: true, periodId: true },
  })
  if (!assessment) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
  return { ...current, assessment }
}

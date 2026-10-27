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

// Setting final levels and sending the result belong to the verifier assigned to the unit for that period.
// A unit with no verifier yet stays open to any Admin, so verification is not blocked before assignments are made.
export async function assertAssignedVerifier(
  client: Pick<typeof prisma, 'periodAssignment'>,
  assessment: { periodId: string; unitId: string },
  userId: string,
) {
  const assignment = await client.periodAssignment.findUnique({
    where: { periodId_unitId: { periodId: assessment.periodId, unitId: assessment.unitId } },
    select: { verifierId: true, verifier: { select: { displayName: true } } },
  })
  if (assignment?.verifierId && assignment.verifierId !== userId) {
    const name = assignment.verifier?.displayName ?? 'verifikator lain'
    throw createError({ statusCode: 403, statusMessage: `Penilaian ini ditugaskan ke ${name}. Hanya verifikator tersebut yang dapat memverifikasinya.` })
  }
}

// Admins are Pusdatin staff who can open every unit; who may verify is checked by assertAssignedVerifier.
export async function requireAssessmentReviewAccess(event: H3Event, assessmentId: string) {
  const current = await requireRole(event, 'ADMIN')
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, unitId: true, status: true, periodId: true },
  })
  if (!assessment) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
  return { ...current, assessment }
}

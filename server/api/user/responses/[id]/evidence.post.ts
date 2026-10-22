import { z } from 'zod'
import { assertSameOrigin } from '../../../../utils/auth'
import { canEditResponse, requireOwnedResponse } from '../../../../utils/authorization'
import { prisma } from '../../../../utils/db'
import { auditData, maxEvidenceLinks, readRouteId, readValidatedPayload } from '../../../../utils/validation'

const schema = z.object({ url: z.string().trim().min(1).max(2000) })

// Only plain web links are stored, so a saved value can never render as a javascript: or data: link.
function parseEvidenceUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
  return url.href
}

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = readRouteId(event)
  const body = await readValidatedPayload(event, schema)
  const url = parseEvidenceUrl(body.url)
  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'Tautan harus diawali http:// atau https://, misalnya https://drive.google.com/...' })
  }
  const { user, response } = await requireOwnedResponse(event, id)
  if (!canEditResponse(response.assessment.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Bukti terkunci setelah penilaian dikirim.' })
  }
  if (!response.maturityLevelId) {
    throw createError({ statusCode: 409, statusMessage: 'Pilih dan simpan tingkat kematangan sebelum menambah tautan bukti.' })
  }

  const evidence = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Assessment" WHERE "id" = ${response.assessment.id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, statusMessage: 'Penilaian tidak ditemukan.' })
    const current = await tx.assessmentResponse.findUnique({
      where: { id },
      select: { id: true, version: true, assessment: { select: { status: true } }, evidence: { select: { url: true } } },
    })
    if (!current || current.version !== response.version) {
      throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menambah tautan.' })
    }
    if (!canEditResponse(current.assessment.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Bukti terkunci setelah penilaian dikirim.' })
    }
    if (current.evidence.length >= maxEvidenceLinks) {
      throw createError({ statusCode: 409, statusMessage: `Satu indikator dapat memuat paling banyak ${maxEvidenceLinks} tautan bukti.` })
    }
    if (current.evidence.some((item) => item.url === url)) {
      throw createError({ statusCode: 409, statusMessage: 'Tautan ini sudah ada pada indikator ini.' })
    }
    const changed = await tx.assessmentResponse.updateMany({
      where: { id, version: response.version },
      data: { version: { increment: 1 } },
    })
    if (changed.count !== 1) throw createError({ statusCode: 409, statusMessage: 'Jawaban berubah di sesi lain. Muat ulang sebelum menambah tautan.' })
    const created = await tx.evidence.create({ data: { responseId: id, addedById: user.id, url } })
    await tx.auditEvent.create(auditData(user.id, 'evidence_link_added', 'Evidence', created.id, { responseId: id, version: current.version + 1 }))
    return created
  })
  return { evidence: { id: evidence.id, url: evidence.url, createdAt: evidence.createdAt } }
})

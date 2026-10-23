import { archiveSelect, readArchivePayload } from '../../../utils/archive'
import { assertSameOrigin, requireRole } from '../../../utils/auth'
import { prisma } from '../../../utils/db'
import { auditData, readRouteId } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const id = readRouteId(event)
  const data = await readArchivePayload(event)
  const document = await prisma.$transaction(async (tx) => {
    const existing = await tx.archiveDocument.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Dokumen tidak ditemukan.' })
    const saved = await tx.archiveDocument.update({ where: { id }, data, select: archiveSelect })
    await tx.auditEvent.create(auditData(user.id, 'archive_document_updated', 'ArchiveDocument', id, { type: saved.type, year: saved.year }))
    return saved
  })
  return { document }
})

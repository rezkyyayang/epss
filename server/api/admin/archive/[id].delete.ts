import { assertSameOrigin, requireRole } from '../../../utils/auth'
import { prisma } from '../../../utils/db'
import { auditData, readRouteId } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const id = readRouteId(event)
  await prisma.$transaction(async (tx) => {
    const existing = await tx.archiveDocument.findUnique({ where: { id }, select: { title: true, type: true } })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Dokumen tidak ditemukan.' })
    await tx.archiveDocument.delete({ where: { id } })
    await tx.auditEvent.create(auditData(user.id, 'archive_document_deleted', 'ArchiveDocument', id, existing))
  })
  return { ok: true }
})

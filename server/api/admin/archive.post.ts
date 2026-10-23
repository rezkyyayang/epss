import { archiveSelect, readArchivePayload } from '../../utils/archive'
import { assertSameOrigin, requireRole } from '../../utils/auth'
import { prisma } from '../../utils/db'
import { auditData } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { user } = await requireRole(event, 'ADMIN')
  const data = await readArchivePayload(event)
  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.archiveDocument.create({ data, select: archiveSelect })
    await tx.auditEvent.create(auditData(user.id, 'archive_document_created', 'ArchiveDocument', created.id, { type: created.type, year: created.year }))
    return created
  })
  return { document }
})

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

// The first archive documents, as Pusdatin listed them. The 2025 SDI report shares its link with the 2025
// IPS report in that list; correct it from the Admin screen once the right link is known.
const documents: Array<{ type: string; title: string; year: number; url: string }> = [
  { type: 'Hasil EPSS LAN', title: 'Hasil EPSS LAN 2023', year: 2023, url: 'https://drive.google.com/file/d/16Tf1IhyLZWk2GiXx89eFQC17_-nzvyyk/view' },
  { type: 'Hasil EPSS LAN', title: 'Hasil EPSS LAN 2024', year: 2024, url: 'https://drive.google.com/file/d/1g3MbdEEPtLP7pUeX9SCuNLv8GGXv8Bb1/view' },
  { type: 'Hasil IPS Internal LAN', title: 'Laporan IPS Internal Unit Kerja LAN 2025', year: 2025, url: 'https://lembagaadministrasinegara1.sharepoint.com/:b:/s/pusdatinsquad/IQAmC_gRjZyARJKp3Ba-2Mh4AeJ_uvSO0gYfBYAc0TN7TCc?e=xt8ODz' },
  { type: 'Laporan SDI', title: 'Laporan SDI LAN 2023', year: 2023, url: 'https://drive.google.com/file/d/10kIBSdYDlafaTR1EUy8gVXuZh0soqK7X/view?usp=sharing' },
  { type: 'Laporan SDI', title: 'Laporan SDI LAN 2025', year: 2025, url: 'https://lembagaadministrasinegara1.sharepoint.com/:b:/s/pusdatinsquad/IQAmC_gRjZyARJKp3Ba-2Mh4AeJ_uvSO0gYfBYAc0TN7TCc?e=xt8ODz' },
]

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('Set DATABASE_URL first.')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })

// Safe to run again: a document with the same type and title is left as it is, so Admin edits survive.
try {
  let created = 0
  for (const document of documents) {
    const existing = await prisma.archiveDocument.findFirst({ where: { type: document.type, title: document.title }, select: { id: true } })
    if (existing) {
      process.stdout.write(`skipped  ${document.title}\n`)
      continue
    }
    const saved = await prisma.archiveDocument.create({ data: document })
    await prisma.auditEvent.create({ data: { actorId: null, action: 'archive_document_seeded', entityType: 'ArchiveDocument', entityId: saved.id, details: { type: document.type, year: document.year } } })
    created++
    process.stdout.write(`created  ${document.title}\n`)
  }
  process.stdout.write(`Archive: ${created} created, ${documents.length - created} skipped.\n`)
} finally {
  await prisma.$disconnect()
}

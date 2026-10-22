import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

// LAN work units at eselon II level, from the 2025 organization chart
// (Peraturan LAN Nomor 1 Tahun 2025 tentang Organisasi dan Tata Kerja LAN, lan.go.id/struktur-organisasi-lan).
// Leadership levels (Kepala, Sekretariat Utama, Deputi) are left out: they oversee these units rather than fill assessments.
const units: Array<{ code: string; name: string }> = [
  { code: 'INSPEKTORAT', name: 'Inspektorat' },
  { code: 'BIRO-RK', name: 'Biro Perencanaan dan Keuangan' },
  { code: 'BIRO-HOSDM', name: 'Biro Hukum, Organisasi, dan Sumber Daya Manusia' },
  { code: 'BIRO-UKSH', name: 'Biro Umum, Kerja Sama, dan Hubungan Masyarakat' },
  { code: 'DIT-SPKKAN', name: 'Direktorat Strategi Peningkatan Kualitas Kebijakan Administrasi Negara' },
  { code: 'DIT-APKK', name: 'Direktorat Advokasi dan Pengembangan Kinerja Kebijakan' },
  { code: 'DIT-PKJF', name: 'Direktorat Penguatan Kapasitas Jabatan Fungsional Bidang Pengembangan Kapasitas dan Pembelajaran Aparatur Sipil Negara' },
  { code: 'DIT-SPT', name: 'Direktorat Sistem Pembelajaran Terintegrasi' },
  { code: 'DIT-TDP', name: 'Direktorat Teknologi dan Digitalisasi Pembelajaran' },
  { code: 'DIT-EPASN', name: 'Direktorat Ekosistem Pembelajaran Aparatur Sipil Negara' },
  { code: 'DIT-PMK', name: 'Direktorat Pembelajaran Manajerial Kepemimpinan' },
  { code: 'DIT-PKSK', name: 'Direktorat Pembelajaran Karakter dan Sosial Kultural' },
  { code: 'DIT-PTF', name: 'Direktorat Pembelajaran Teknis dan Fungsional' },
  { code: 'DIT-PMPK', name: 'Direktorat Penjaminan Mutu Pengembangan Kapasitas' },
  { code: 'DIT-PMP', name: 'Direktorat Penjaminan Mutu Pembelajaran' },
  { code: 'PUSJAR-TALENTA', name: 'Pusat Pembelajaran dan Strategi Kebijakan Talenta Aparatur Sipil Negara Nasional' },
  { code: 'PUSJAR-MP', name: 'Pusat Pembelajaran dan Strategi Kebijakan Manajemen Pemerintahan' },
  { code: 'PUSJAR-PP', name: 'Pusat Pembelajaran dan Strategi Kebijakan Pelayanan Publik' },
  { code: 'PUSJAR-MK', name: 'Pusat Pembelajaran dan Strategi Kebijakan Manajemen Kinerja' },
  { code: 'PUSDATIN', name: 'Pusat Data dan Informasi' },
]

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('Set DATABASE_URL first.')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })

// Safe to run again: a unit is matched by code, then by name ignoring case, so a unit typed in by hand
// earlier is tidied to the official name and code instead of being duplicated. Memberships keep pointing at it.
try {
  const summary = { created: 0, updated: 0, unchanged: 0 }
  for (const unit of units) {
    const existing = await prisma.unit.findUnique({ where: { code: unit.code } })
      ?? await prisma.unit.findFirst({ where: { name: { equals: unit.name, mode: 'insensitive' } } })
    if (!existing) {
      const created = await prisma.unit.create({ data: unit })
      await prisma.auditEvent.create({ data: { actorId: null, action: 'unit_seeded', entityType: 'Unit', entityId: created.id, details: { code: unit.code } } })
      summary.created++
      process.stdout.write(`created  ${unit.code}\n`)
    } else if (existing.code !== unit.code || existing.name !== unit.name) {
      await prisma.unit.update({ where: { id: existing.id }, data: unit })
      await prisma.auditEvent.create({
        data: { actorId: null, action: 'unit_seed_corrected', entityType: 'Unit', entityId: existing.id, details: { from: { code: existing.code, name: existing.name }, to: unit } },
      })
      summary.updated++
      process.stdout.write(`updated  ${existing.code} -> ${unit.code}\n`)
    } else {
      summary.unchanged++
    }
  }
  process.stdout.write(`Units: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged.\n`)
} finally {
  await prisma.$disconnect()
}

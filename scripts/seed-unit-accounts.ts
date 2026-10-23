import 'dotenv/config'
import { randomInt } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { hashPassword } from '../server/utils/password'

// One User account per work unit, signed in with the unit's official mailbox. Unit codes match scripts/seed-units.ts.
const accounts: Array<{ email: string; displayName: string; unitCode: string }> = [
  { email: 'biro_renaku@lan.go.id', displayName: 'Biro Renaku', unitCode: 'BIRO-RK' },
  { email: 'biro.hos@lan.go.id', displayName: 'Biro HOS', unitCode: 'BIRO-HOSDM' },
  { email: 'humas@lan.go.id', displayName: 'Biro UKH', unitCode: 'BIRO-UKSH' },
  { email: 'inspektorat@lan.go.id', displayName: 'Inspektorat', unitCode: 'INSPEKTORAT' },
  { email: 'pusdatin@lan.go.id', displayName: 'Pusdatin', unitCode: 'PUSDATIN' },
  { email: 'dspk2an@lan.go.id', displayName: 'Dit SPK2AN', unitCode: 'DIT-SPKKAN' },
  { email: 'dapkk@lan.go.id', displayName: 'Dit APKK', unitCode: 'DIT-APKK' },
  { email: 'pusakaasn@lan.go.id', displayName: 'Dit PKJFASN', unitCode: 'DIT-PKJF' },
  { email: 'asncorpu@lan.go.id', displayName: 'Dit SPT', unitCode: 'DIT-SPT' },
  { email: 'dit.tekdigi@lan.go.id', displayName: 'Dit Tekdijar', unitCode: 'DIT-TDP' },
  { email: 'direkjarasn@lan.go.id', displayName: 'Dit Ekjar', unitCode: 'DIT-EPASN' },
  { email: 'ditjarmapim@lan.go.id', displayName: 'Ditjar MAPIM', unitCode: 'DIT-PMK' },
  { email: 'ditjar.ksk@lan.go.id', displayName: 'Ditjar KSK', unitCode: 'DIT-PKSK' },
  { email: 'dit-ptf@lan.go.id', displayName: 'Ditjar TF', unitCode: 'DIT-PTF' },
  { email: 'dirpmpk@lan.go.id', displayName: 'Dit PMPK', unitCode: 'DIT-PMPK' },
  { email: 'akreditasi@lan.go.id', displayName: 'Dit PMP', unitCode: 'DIT-PMP' },
  { email: 'pusjar_sktan@lan.go.id', displayName: 'Pusjar SKTAN', unitCode: 'PUSJAR-TALENTA' },
  { email: 'pusjarskmp@lan.go.id', displayName: 'Pusjar SKMP', unitCode: 'PUSJAR-MP' },
  { email: 'pusjarskpp@lan.go.id', displayName: 'Pusjar SKPP', unitCode: 'PUSJAR-PP' },
  { email: 'lan.aceh@lan.go.id', displayName: 'Pusjar SKMK', unitCode: 'PUSJAR-MK' },
  { email: 'politeknikstialanjkt@lan.go.id', displayName: 'Poltek STIA LAN Jakarta', unitCode: 'POLTEK-JKT' },
  { email: 'politeknikstialanbdg@lan.go.id', displayName: 'Poltek STIA LAN Bandung', unitCode: 'POLTEK-BDG' },
  { email: 'politeknikstialanmks@lan.go.id', displayName: 'Poltek STIA LAN Makassar', unitCode: 'POLTEK-MKS' },
]

const outputPath = 'data/unit-accounts.csv'
// No 0/O, 1/l/I: the passwords are read off a sheet and typed by hand.
const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePassword(length = 16) {
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('Set DATABASE_URL first.')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })

// Safe to run again: an email that already has an account is skipped and its password left alone.
try {
  const units = await prisma.unit.findMany({ where: { code: { in: accounts.map((account) => account.unitCode) } } })
  const unitByCode = new Map(units.map((unit) => [unit.code, unit]))
  const missing = accounts.filter((account) => !unitByCode.get(account.unitCode)?.isActive).map((account) => account.unitCode)
  if (missing.length > 0) {
    throw new Error(`Missing or inactive units: ${missing.join(', ')}. Run npm run units:seed first.`)
  }

  const rows = ['email,display_name,unit,password']
  let skipped = 0
  for (const account of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } })
    if (existing) {
      skipped++
      process.stdout.write(`skipped  ${account.email} (already exists)\n`)
      continue
    }
    const unit = unitByCode.get(account.unitCode)!
    const password = generatePassword()
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: account.email,
          displayName: account.displayName,
          passwordHash: await hashPassword(password),
          role: 'USER',
          memberships: { create: [{ unitId: unit.id }] },
        },
      })
      await tx.auditEvent.create({
        data: { actorId: null, action: 'user_seeded', entityType: 'User', entityId: user.id, details: { unitCode: unit.code } },
      })
    })
    rows.push([account.email, account.displayName, unit.name, password].map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
    process.stdout.write(`created  ${account.email}\n`)
  }

  if (rows.length > 1) {
    await mkdir('data', { recursive: true })
    await writeFile(outputPath, `${rows.join('\n')}\n`, { flag: 'wx' })
    process.stdout.write(`Passwords for new accounts written to ${outputPath}. Hand them out privately, then delete the file.\n`)
  }
  process.stdout.write(`Accounts: ${rows.length - 1} created, ${skipped} skipped.\n`)
} finally {
  await prisma.$disconnect()
}

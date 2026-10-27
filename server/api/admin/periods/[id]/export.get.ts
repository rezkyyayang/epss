import ExcelJS from 'exceljs'
import { levelOf, predicateBands, scorePredicate, weightedScore, withFinalLevels } from '../../../../../app/utils/score'
import { requireRole } from '../../../../utils/auth'
import { prisma } from '../../../../utils/db'
import { readRouteId } from '../../../../utils/validation'

const statusLabels: Record<string, string> = {
  DRAFT: 'Draf',
  SUBMITTED: 'Menunggu verifikasi',
  IN_REVIEW: 'Dalam verifikasi',
  VERIFIED: 'Terverifikasi',
}
const fixedHeaders = ['No', 'Unit kerja', 'Kode unit', 'Kegiatan statistik', 'Tahun kegiatan', 'Status', 'Nilai mandiri', 'Nilai akhir', 'Predikat']
const brand = 'FF0B6470'

// The recap of one period as an Excel file: one row per assigned unit, with the final score and every
// indicator's final level. Final values exist only once Pusdatin has sent the verification; other units
// still get a row with their status so the list matches the dashboard.
export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const periodId = readRouteId(event)
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    select: {
      name: true,
      domains: {
        orderBy: { position: 'asc' },
        select: { id: true, name: true, weight: true, indicators: { orderBy: { position: 'asc' }, select: { id: true, code: true, title: true, weight: true } } },
      },
    },
  })
  if (!period) throw createError({ statusCode: 404, statusMessage: 'Periode tidak ditemukan.' })

  const [assignments, assessments] = await Promise.all([
    prisma.periodAssignment.findMany({
      where: { periodId },
      select: { unit: { select: { id: true, name: true, code: true } } },
      orderBy: { unit: { name: 'asc' } },
    }),
    prisma.assessment.findMany({
      where: { periodId },
      select: {
        unitId: true,
        status: true,
        activityName: true,
        activityYear: true,
        responses: {
          select: {
            maturityLevelId: true,
            verification: { select: { maturityLevelId: true } },
            indicator: {
              select: {
                id: true,
                weight: true,
                maturityLevels: { select: { id: true, level: true } },
                domain: { select: { id: true, name: true, weight: true, position: true } },
              },
            },
          },
        },
      },
    }),
  ])
  const byUnit = new Map(assessments.map((assessment) => [assessment.unitId, assessment]))
  const indicators = period.domains.flatMap((domain) => domain.indicators)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sectoral'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Rekap', { views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }] })

  // Two header rows: domains span their indicators on the first, indicator codes and titles sit on the second.
  const domainRow = sheet.getRow(1)
  const headerRow = sheet.getRow(2)
  fixedHeaders.forEach((label, index) => {
    sheet.mergeCells(1, index + 1, 2, index + 1)
    domainRow.getCell(index + 1).value = label
  })
  let column = fixedHeaders.length + 1
  for (const domain of period.domains) {
    if (!domain.indicators.length) continue
    const last = column + domain.indicators.length - 1
    if (last > column) sheet.mergeCells(1, column, 1, last)
    domainRow.getCell(column).value = `${domain.name} (bobot ${domain.weight}%)`
    domain.indicators.forEach((indicator, index) => {
      headerRow.getCell(column + index).value = `${indicator.code} ${indicator.title} (bobot ${indicator.weight}%)`
    })
    column = last + 1
  }
  for (const row of [domainRow, headerRow]) {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brand } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
  }
  headerRow.height = 60

  assignments.forEach(({ unit }, index) => {
    const assessment = byUnit.get(unit.id)
    const responses = assessment?.responses ?? []
    const verified = assessment?.status === 'VERIFIED'
    const self = responses.length ? weightedScore(responses) : null
    const final = verified ? weightedScore(withFinalLevels(responses)) : null
    const finalResponses = new Map(withFinalLevels(responses).map((response) => [response.indicator.id, response]))
    const finalLevels = indicators.map(({ id }) => {
      const response = finalResponses.get(id)
      return verified && response ? levelOf(response) : null
    })
    const row = sheet.addRow([
      index + 1,
      unit.name,
      unit.code,
      assessment?.activityName || null,
      assessment?.activityYear ?? null,
      assessment ? statusLabels[assessment.status] ?? assessment.status : 'Belum mulai',
      self?.total ?? null,
      final?.total ?? null,
      final ? scorePredicate(final.total, final.maxLevel) : null,
      ...finalLevels,
    ])
    row.getCell(7).numFmt = '0.00'
    row.getCell(8).numFmt = '0.00'
    row.getCell(8).font = { bold: true }
    row.alignment = { vertical: 'top', wrapText: true }
  })

  sheet.columns.forEach((sheetColumn, index) => {
    sheetColumn.width = [5, 34, 14, 36, 10, 18, 10, 10, 12][index] ?? 16
    if (index >= 4 && index !== 5 && index !== 8) sheetColumn.alignment = { vertical: 'top', horizontal: 'center' }
  })
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: fixedHeaders.length + indicators.length } }

  const notes = workbook.addWorksheet('Keterangan')
  notes.columns = [{ width: 28 }, { width: 90 }]
  notes.addRows([
    ['Periode', period.name],
    ['Diunduh', new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date())],
    ['Nilai mandiri', 'Dihitung dari level yang dipilih unit kerja.'],
    ['Nilai akhir', 'Dihitung dari level final Pusdatin. Kosong bila verifikasi belum dikirim.'],
    ['Nilai per indikator', 'Level final hasil verifikasi Pusdatin untuk tiap indikator.'],
    ['Rumus', 'Jumlah (bobot domain × jumlah (bobot indikator × level)), bobot dalam pecahan.'],
    ['Predikat (skala 1–5)', predicateBands.map(({ min, label }) => min ? `${label} ≥ ${min.toFixed(2).replace('.', ',')}` : label).join('; ')],
  ])
  notes.getColumn(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = `Rekap ${period.name}.xlsx`.replace(/[\\/:*?"<>|]/g, '-')
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'no-store',
  })
  return Buffer.from(buffer)
})

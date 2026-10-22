// Domain and indicator weights and level criteria follow the owner's indicator sheet.
// The sheet names domains only by number, so the names stay "Domain N" until the owner renames them.
interface StandardIndicator { title: string; weight: number; levels: [string, string, string] }
interface StandardDomain { name: string; weight: number; indicators: StandardIndicator[] }

const standardDomains: StandardDomain[] = [
  {
    name: 'Domain 1',
    weight: 25,
    indicators: [
      { title: 'Standar Data Statistik', weight: 50, levels: ['Tidak ada/belum memenuhi', 'Sudah ada kebijakan/regulasi', 'Sudah mengajukan/konsultasi ke Walidata terkait standar data'] },
      { title: 'Metadata Statistik', weight: 50, levels: ['Tidak ada/belum memenuhi', 'Terdapat KAK/Juknis kegiatan', 'Sudah mengajukan/konsultasi ke Walidata terkait metadata'] },
    ],
  },
  {
    name: 'Domain 2',
    weight: 20,
    indicators: [
      { title: 'Aktualitas dan Ketepatan Waktu', weight: 50, levels: ['Tidak ada timeline perencanaan publikasi', 'Sudah ada timeline perencanaan publikasi', 'Pemutakhiran/publikasi sesuai timeline perencanaan publikasi'] },
      { title: 'Keterbandingan', weight: 25, levels: ['Tidak bisa dibandingkan wilayah dan waktu (kegiatan tidak berulang)', 'Kegiatan tidak berulang tetapi bisa dibandingkan antar wilayah', 'Bisa dibandingkan wilayah dan waktu (berulang minimal 2 tahun pelaksanaan)'] },
      { title: 'Konsistensi', weight: 25, levels: ['Tidak ada metodologi acuan/referensi', 'Terdapat metodologi/referensi yang digunakan', 'Reviu metodologi'] },
    ],
  },
  {
    name: 'Domain 3',
    weight: 30,
    indicators: [
      { title: 'Perencanaan Data', weight: 25, levels: ['Tidak ada identifikasi kebutuhan data', 'Terdapat KAK/Juknis kegiatan/Instrument kegiatan/Design statistik', 'Sudah mengajukan/konsultasi ke walidata'] },
      { title: 'Pengumpulan Data', weight: 25, levels: ['Tidak ada media pengumpulan data', 'Sudah ada media pengumpulan data', 'Sudah ada media pengumpulan data yang terstandar (rule yang jelas dalam instrument, ada SOP, ada juknis/alur pengumpulan data)'] },
      { title: 'Pengolahan dan Analisis Data', weight: 25, levels: ['Tidak ada proses pengolahan dan analisis data', 'Terdapat data statistik (agregat data)', 'Sudah dalam bentuk interpretasi output atau analisis dari data statistik yang dihasilkan'] },
      { title: 'Penyebarluasan Data', weight: 25, levels: ['Tidak dilakukan penyebarluasan data', 'Penyebarluasan dilakukan melalui media unit kerja (medsos, poster, infografis, dsb)', 'Penyebarluasan data melalui Portal Data, IDC LAN, atau web lan.go.id'] },
    ],
  },
  {
    name: 'Domain 4',
    weight: 15,
    indicators: [
      { title: 'SDM yang Memadai dan Kapabel', weight: 25, levels: ['Tidak ada SDM yang memadai dan kapabel', 'SDM pernah mengikuti pelatihan literasi data', 'Terdapat peta jabatan Statistisi dan/atau Pranata Komputer dan/atau SDM yang memiliki background IT/Data'] },
      { title: 'Kolaborasi dengan Instansi Pusat/Daerah', weight: 25, levels: ['Tidak ada kolaborasi dengan instansi pemerintah lain', 'Terdapat kolaborasi/koordinasi instansi eksternal (cukup kegiatan koordinasi baik informal atau formal)', 'Kolaborasi dengan instansi pemerintah lain berupa MoU/PKS'] },
      { title: 'Kolaborasi dengan Walidata (Pusdatin LAN)', weight: 50, levels: ['Tidak ada kolaborasi dengan Walidata', 'PIC Data menghadiri Forum Satu Data LAN', 'Kolaborasi dengan Walidata terkait pengajuan romantik, reviu instrumen, dsb.'] },
    ],
  },
  {
    name: 'Domain 5',
    weight: 10,
    indicators: [
      { title: 'Pengelolaan Kegiatan Statistik (Romantik)', weight: 100, levels: ['Tidak ada/belum memenuhi', 'Terdapat KAK/Juknis kegiatan', 'Sudah pernah mengajukan Romantik ke Pusdatin dan BPS'] },
    ],
  },
]

export function buildStandardCatalog() {
  return standardDomains.map((domain, domainIndex) => ({
    code: `D${domainIndex + 1}`,
    name: domain.name,
    weight: domain.weight,
    indicators: domain.indicators.map((indicator, indicatorIndex) => ({
      code: `${domainIndex + 1}.${indicatorIndex + 1}`,
      title: indicator.title,
      criterion: '',
      weight: indicator.weight,
      requiresEvidence: false,
      maturityLevels: indicator.levels.map((criterion, levelIndex) => ({ level: levelIndex + 1, criterion })),
    })),
  }))
}

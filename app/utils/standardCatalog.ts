// Domain and indicator weights, definitions, level names and criteria, and expected evidence follow the
// owner's instrument sheet (instrumen.xlsx, "Instrument Final"). Line breaks the sheet carried over from its
// source document are joined; lists stay one item per line so the guide renders them as lists.
// The sheet names domains only by number, so the names stay "Domain N" until the owner renames them.
// Levels 4 and 5 are the same for every indicator, so they are added once in buildStandardCatalog.
interface StandardLevel { title: string; criterion: string; evidenceGuide?: string }
interface StandardIndicator { title: string; weight: number; definition: string; levels: [StandardLevel, StandardLevel, StandardLevel] }
interface StandardDomain { name: string; weight: number; indicators: StandardIndicator[] }

const standardDomains: StandardDomain[] = [
  {
    name: 'Domain 1',
    weight: 25,
    indicators: [
      {
        title: 'Standar Data Statistik',
        weight: 50,
        definition: 'Penerapan Standar Data Statistik yang dimaksud yaitu: Standar Data adalah standar yang mendasari data tertentu yang terdiri dari lima komponen yaitu konsep, definisi, klasifikasi, ukuran dan satuan; data yang dihasilkan oleh produsen data harus memenuhi standar data.\n\nKonsep "Telah Menerapkan Standar Data Statistik":\n- Adanya regulasi/kebijakan mengenai kegiatan statistik yang dilakukan\n- Panduan pengumpulan data, dimana konten variabel yang dikumpulkan dan/atau indikator yang dihasilkan sesuai dengan standar data\n- Publikasi statistik, dimana kontennya sesuai dengan standar data\n- Bukti konsultasi dengan Walidata terkait penyusunan/pengusulan standar data',
        levels: [
          { title: 'Belum Dilaksanakan', criterion: 'Belum terdapat upaya identifikasi maupun penerapan standar data statistik dalam publikasi.' },
          { title: 'Tersedia Landasan Kebijakan', criterion: 'Telah tersedia kebijakan atau regulasi sebagai dasar pelaksanaan kegiatan statistik.', evidenceGuide: 'Memiliki kebijakan/regulasi sebagai dasar pelaksanaan kegiatan statistik.' },
          { title: 'Koordinasi dan Kolaborasi', criterion: 'Telah dilakukan identifikasi kebutuhan serta koordinasi dengan Walidata untuk memastikan kesesuaian standar data statistik/menyusun standar data statistik.', evidenceGuide: 'Bukti konsultasi/kolaborasi dengan Walidata terkait penyusunan standar data (formal atau informal).' },
        ],
      },
      {
        title: 'Metadata Statistik',
        weight: 50,
        definition: 'Konsep "Telah Menerapkan Metadata Statistik", yaitu: data yang dihasilkan oleh produsen data harus dilengkapi dengan metadata.\n\nYang diharapkan:\n1. Adanya KAK/juknis pelaksanaan kegiatan statistik\n2. Bukti konsultasi dengan Walidata terkait penyusunan metadata, instrumen, dan metodologi (bukti dapat berupa nota dinas ataupun diskusi secara informal)',
        levels: [
          { title: 'Belum Dilaksanakan', criterion: 'Belum tersedia dokumen atau mekanisme yang mendukung penyusunan dan penerapan metadata statistik sesuai ketentuan yang berlaku.' },
          { title: 'Tersedia Landasan Kebijakan', criterion: 'Telah tersedia Kerangka Acuan Kerja (KAK) atau petunjuk teknis (Juknis) kegiatan yang memuat informasi sebagai dasar penyusunan metadata statistik.', evidenceGuide: 'KAK, juknis kegiatan yang dilakukan.' },
          { title: 'Koordinasi dan Kolaborasi', criterion: 'Telah dilakukan pengajuan atau konsultasi kepada Walidata terkait penyusunan dan pemenuhan metadata statistik sesuai standar yang berlaku.', evidenceGuide: 'Bukti konsultasi/kolaborasi dengan Walidata terkait penyusunan metadata.' },
        ],
      },
    ],
  },
  {
    name: 'Domain 2',
    weight: 20,
    indicators: [
      {
        title: 'Aktualitas dan Ketepatan Waktu',
        weight: 50,
        definition: 'Ketepatan waktu (punctuality) mengacu pada apakah diseminasi dari data/informasi statistik sudah sesuai dengan jadwal rilis yang dijanjikan. Jadwal rilis tersebut harus diumumkan kepada pengguna data.\n\nKonsep "Telah Melakukan Penjaminan Aktualitas dan Ketepatan Waktu", yaitu:\n1. Aktualitas (timeliness) dari data statistik yang dihasilkan sesuai dengan kebutuhan pengguna yang sudah disepakati pada saat analisis kebutuhan\n2. Pemutakhiran data dilakukan sesuai dengan jadwal pemutakhiran yang telah ditetapkan bersama Walidata',
        levels: [
          { title: 'Belum Dilaksanakan', criterion: 'Belum tersedia jadwal perencanaan pemutakhiran dan publikasi data statistik.' },
          { title: 'Tersedia Jadwal Rilis Data', criterion: 'Telah tersedia jadwal perencanaan, tetapi pelaksanaannya belum sepenuhnya sesuai dengan jadwal.', evidenceGuide: 'Tersedia jadwal rilis (bisa dibuktikan dengan keterlibatan dalam Forum Satu Data).' },
          { title: 'Terlaksana Sesuai Rencana', criterion: 'Pemutakhiran dan publikasi data statistik telah dilaksanakan secara konsisten sesuai jadwal yang ditetapkan.', evidenceGuide: 'Data yang dipublikasikan sesuai dengan jadwal pemutakhiran yang ditetapkan (data yang dipublikasikan bisa di Portal Data ataupun portal lainnya).' },
        ],
      },
      {
        title: 'Keterbandingan',
        weight: 25,
        definition: 'Keterbandingan data mengacu pada kemampuan untuk melihat keterbandingan data, baik keterbandingan data antarwaktu maupun antarwilayah.',
        levels: [
          { title: 'Belum Memenuhi', criterion: 'Data statistik belum memiliki keterbandingan antarwilayah maupun antarperiode waktu.' },
          { title: 'Tersedia Perbandingan Antarwilayah', criterion: 'Data statistik telah dapat dibandingkan antarwilayah, tetapi belum memiliki keterbandingan antarperiode waktu.' },
          { title: 'Tersedia Perbandingan Antarwilayah dan Waktu', criterion: 'Data statistik telah dapat dibandingkan antarwilayah dan antarperiode waktu berdasarkan pelaksanaan kegiatan minimal dua tahun dengan metodologi yang konsisten.' },
        ],
      },
      {
        title: 'Konsistensi',
        weight: 25,
        definition: 'Konsistensi data mengacu pada kemampuan data untuk dapat konsisten ketika diperbandingkan dengan berbagai sumber data yang lain.',
        levels: [
          { title: 'Belum Memenuhi', criterion: 'Belum tersedia metodologi atau referensi yang menjadi acuan dalam pelaksanaan kegiatan statistik.' },
          { title: 'Tersedia dan Diterapkan Prosedur', criterion: 'Telah tersedia prosedur atau referensi metodologi yang digunakan dalam kegiatan statistik.', evidenceGuide: 'Metodologi yang digunakan, sumber referensi/framework.' },
          { title: 'Penjaminan Konsistensi Terlaksana', criterion: 'Telah dilakukan reviu terhadap metodologi atau referensi yang digunakan.', evidenceGuide: 'Reviu terhadap metodologi yang digunakan.' },
        ],
      },
    ],
  },
  {
    name: 'Domain 3',
    weight: 30,
    indicators: [
      {
        title: 'Perencanaan Data',
        weight: 25,
        definition: 'Perencanaan data mengacu pada proses identifikasi kebutuhan, desain statistik, dan instrumen kegiatan.',
        levels: [
          { title: 'Belum Memenuhi', criterion: 'Belum dilakukan identifikasi kebutuhan data statistik sebagai dasar perencanaan dan pelaksanaan kegiatan statistik.' },
          { title: 'Perencanaan Kegiatan Statistik', criterion: 'Telah tersedia dokumen perencanaan kegiatan statistik berupa instrumen kegiatan/desain kegiatan.', evidenceGuide: 'Instrumen kegiatan/desain kegiatan, rancangan tabulasi output, juknis kegiatan.' },
          { title: 'Konsultasi dan Kolaborasi', criterion: 'Telah dilakukan koordinasi atau konsultasi dengan Walidata terkait instrumen dan desain statistik, serta penyampaian informasi mengenai rencana pelaksanaan kegiatan statistik.', evidenceGuide: 'Dokumentasi koordinasi atau konsultasi dengan Walidata terkait instrumen, desain statistik, dan penyampaian rencana kegiatan statistik, berupa surat, notula, korespondensi resmi, atau dokumen hasil konsultasi.' },
        ],
      },
      {
        title: 'Pengumpulan Data',
        weight: 25,
        definition: 'Pengumpulan data/akuisisi data merupakan tahapan kegiatan mencari data/informasi di lapangan atau akuisisi dari sumber lain yang dilakukan pada proses statistik. Tahapan ini bertujuan untuk memperoleh informasi yang dibutuhkan dalam rangka mencapai tujuan kegiatan.',
        levels: [
          { title: 'Belum Memenuhi', criterion: 'Belum tersedia media atau instrumen yang digunakan untuk mengumpulkan data statistik.' },
          { title: 'Tersedia Media Pengumpulan Data', criterion: 'Telah tersedia media atau instrumen pengumpulan data, baik dalam bentuk formulir cetak, spreadsheet, maupun kuesioner digital.' },
          { title: 'Media Pengumpulan Data Terstandar', criterion: 'Media pengumpulan data telah dilengkapi aturan pengisian yang jelas, SOP, juknis, dan/atau alur pengumpulan data sehingga proses pengumpulan dapat dilakukan secara konsisten dan dapat ditelusuri.' },
        ],
      },
      {
        title: 'Pengolahan dan Analisis Data',
        weight: 25,
        definition: 'Tingkat pelaksanaan pengolahan dan analisis data statistik untuk menghasilkan informasi yang terstruktur, bermakna, dan dapat digunakan sebagai bahan evaluasi serta pengambilan keputusan.',
        levels: [
          { title: 'Belum Memenuhi', criterion: 'Belum ada proses pengolahan dan analisis terhadap data statistik yang dikumpulkan.' },
          { title: 'Tersedia Data Agregat', criterion: 'Data telah diolah menjadi bentuk agregat, tabulasi, rekapitulasi, tabel, atau grafik statistik, tetapi belum disertai interpretasi analitis yang memadai.' },
          { title: 'Tersedia Analisis dan Interpretasi Data', criterion: 'Data telah dianalisis dan diinterpretasikan sehingga menghasilkan informasi atau kesimpulan yang dapat digunakan untuk mendukung evaluasi dan pengambilan keputusan.' },
        ],
      },
      {
        title: 'Penyebarluasan Data',
        weight: 25,
        definition: 'Tingkat pelaksanaan penyebarluasan data statistik kepada pengguna data melalui berbagai media komunikasi dan kanal informasi, baik milik unit kerja maupun kanal resmi LAN, untuk meningkatkan aksesibilitas, transparansi, dan pemanfaatan data.',
        levels: [
          { title: 'Belum Memenuhi', criterion: 'Belum dilakukan penyebarluasan data hasil kegiatan statistik kepada pengguna data melalui media atau kanal informasi.' },
          { title: 'Penyebarluasan Melalui Media Unit Kerja', criterion: 'Penyebarluasan data dilakukan melalui media komunikasi milik unit kerja, seperti media sosial, poster, infografis, laporan, publikasi, atau media informasi lainnya.' },
          { title: 'Penyebarluasan Melalui Media Utama LAN', criterion: 'Penyebarluasan data dilakukan melalui kanal resmi LAN, seperti Portal Data LAN, IDC LAN, atau situs web LAN (lan.go.id).' },
        ],
      },
    ],
  },
  {
    name: 'Domain 4',
    weight: 15,
    indicators: [
      {
        title: 'SDM yang Memadai dan Kapabel',
        weight: 25,
        definition: 'Tingkat ketersediaan dan kapasitas sumber daya manusia yang mendukung penyelenggaraan kegiatan statistik, baik dari segi kompetensi literasi data, keterampilan teknis pengelolaan dan analisis data, maupun ketersediaan SDM dengan kualifikasi atau jabatan yang relevan.',
        levels: [
          { title: 'Belum Memenuhi', criterion: 'Belum ada SDM yang memiliki kompetensi atau kapasitas yang memadai untuk mendukung penyelenggaraan kegiatan statistik.' },
          { title: 'Terdapat SDM yang Pernah Mengikuti Pelatihan', criterion: 'Terdapat SDM yang pernah mengikuti pelatihan atau kegiatan peningkatan kompetensi terkait literasi data.' },
          { title: 'Terdapat SDM yang Memadai dan Kapabel', criterion: 'Terdapat peta jabatan Statistisi dan/atau Pranata Komputer, dan/atau SDM yang memiliki latar belakang pendidikan atau kompetensi di bidang teknologi informasi, statistik, atau data.' },
        ],
      },
      {
        title: 'Kolaborasi dengan Instansi Pusat/Daerah',
        weight: 25,
        definition: 'Tingkat keterlibatan dan kerja sama Produsen Data/unit kerja dengan instansi pemerintah pusat dan/atau daerah dalam penyelenggaraan kegiatan statistik melalui koordinasi, pertukaran informasi, berbagi data, atau kerja sama formal untuk mendukung peningkatan kualitas dan pemanfaatan data statistik.',
        levels: [
          { title: 'Belum Dilaksanakan', criterion: 'Belum ada kolaborasi atau koordinasi dengan instansi pemerintah lain dalam penyelenggaraan kegiatan statistik.' },
          { title: 'Terdapat Kolaborasi', criterion: 'Terdapat kolaborasi atau koordinasi dengan instansi pemerintah lain, baik secara formal maupun informal, untuk mendukung penyelenggaraan kegiatan statistik.' },
          { title: 'Terdapat Kerja Sama Formal', criterion: 'Terdapat kerja sama formal dengan instansi pemerintah lain yang dituangkan dalam Nota Kesepahaman (MoU), Perjanjian Kerja Sama (PKS), atau dokumen kerja sama resmi lainnya terkait penyelenggaraan kegiatan statistik.' },
        ],
      },
      {
        title: 'Kolaborasi dengan Walidata (Pusdatin LAN)',
        weight: 50,
        definition: 'Tingkat keterlibatan dan kolaborasi Produsen Data/unit kerja dengan Walidata dalam penyelenggaraan statistik sektoral, melalui koordinasi, konsultasi, dan pendampingan untuk meningkatkan kualitas serta kesesuaian data dengan prinsip Satu Data Indonesia.',
        levels: [
          { title: 'Belum Dilaksanakan', criterion: 'Belum ada kolaborasi atau koordinasi dengan Walidata terkait penyelenggaraan kegiatan statistik.' },
          { title: 'Berpartisipasi dalam Forum Satu Data', criterion: 'Produsen data menghadiri atau berpartisipasi dalam Forum Satu Data LAN sebagai bentuk koordinasi dengan Walidata.' },
          { title: 'Berpartisipasi Aktif', criterion: 'Produsen Data/unit kerja secara aktif berkolaborasi dengan Walidata dalam kegiatan teknis, seperti pengajuan rekomendasi kegiatan statistik melalui Romantik, reviu instrumen pengumpulan data, dan lainnya.' },
        ],
      },
    ],
  },
  {
    name: 'Domain 5',
    weight: 10,
    indicators: [
      {
        title: 'Pengelolaan Kegiatan Statistik (Romantik)',
        weight: 100,
        definition: 'Tingkat pemenuhan pengelolaan kegiatan statistik sektoral melalui penyediaan dokumen perencanaan dan pengajuan rekomendasi kegiatan statistik kepada Badan Pusat Statistik (BPS) atau kepada Walidata, untuk memastikan kegiatan statistik direncanakan dan dilaksanakan sesuai dengan ketentuan yang berlaku.',
        levels: [
          { title: 'Belum Dilaksanakan', criterion: 'Belum ada upaya pengajuan rekomendasi kegiatan statistik melalui Pusdatin dan/atau BPS, serta belum tersedia Kerangka Acuan Kerja (KAK), petunjuk teknis (juknis), atau dokumen perencanaan lain yang berkaitan dengan kegiatan statistik yang dilaksanakan.' },
          { title: 'Tersedia Landasan Kebijakan', criterion: 'Telah tersedia Kerangka Acuan Kerja (KAK), petunjuk teknis (Juknis), atau dokumen perencanaan lainnya yang memuat informasi mengenai tujuan, ruang lingkup, metode, dan pelaksanaan kegiatan statistik, tetapi belum terdapat bukti pengajuan rekomendasi kegiatan statistik melalui Pusdatin dan/atau BPS.' },
          { title: 'Telah Mengajukan Romantik', criterion: 'Telah mengajukan kegiatan statistik melalui Romantik kepada BPS atau Walidata, dibuktikan dengan nomor registrasi atau status pengajuan. Status pengajuan tidak harus sudah disetujui untuk memenuhi kriteria level ini.' },
        ],
      },
    ],
  },
]

const sharedUpperLevels: StandardLevel[] = [
  { title: 'Reviu dan Evaluasi Berkala', criterion: 'Telah dilakukan reviu dan evaluasi secara berkala.' },
  { title: 'Pemutakhiran Bersama Walidata', criterion: 'Telah dilakukan pemutakhiran oleh Produsen Data bersama Walidata dalam rangka peningkatan kualitas.' },
]

export function buildStandardCatalog() {
  return standardDomains.map((domain, domainIndex) => ({
    code: `D${domainIndex + 1}`,
    name: domain.name,
    weight: domain.weight,
    indicators: domain.indicators.map((indicator, indicatorIndex) => ({
      code: `${domainIndex + 1}.${indicatorIndex + 1}`,
      title: indicator.title,
      criterion: indicator.definition,
      weight: indicator.weight,
      requiresEvidence: false,
      maturityLevels: [...indicator.levels, ...sharedUpperLevels].map(({ title, criterion, evidenceGuide }, levelIndex) => ({ level: levelIndex + 1, title, criterion, evidenceGuide: evidenceGuide ?? '' })),
    })),
  }))
}

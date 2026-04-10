export const LABELS = {
  // KPI
  totalSite:          'Total Site',
  selesai:            'Selesai',
  dalamProses:        'Dalam Proses',
  tertunda:           'Tertunda',
  belumMulai:         'Belum Mulai',
  melewatiJadwal:     'Melewati Jadwal',
  tingkatSelesai:     'Tingkat Selesai',
  lewatTanggal:       'lewat tanggal rencana',

  // Chart titles
  progresPerRegional:       'Progres per Regional',
  rencanaVsRealisasi:       'Rencana vs Realisasi',
  distribusiProgres:        'Distribusi Progres (Nilai Asli)',
  performaVendor:           'Performa Vendor',
  bebanKerjaPIC:            'Beban Kerja PIC (Top 15)',
  penyebabKeterlambatan:    'Penyebab Keterlambatan',
  petaSite:                 'Peta Site',
  petaRegion:               'Peta Regional',

  // Chart descriptions
  descProgresRegional:   'Perbandingan status pekerjaan di setiap regional. Klik batang untuk filter.',
  descRencanaRealisasi:  'Perbandingan jumlah site yang direncanakan dan yang sudah selesai per bulan.',
  descDistribusi:        'Sebaran nilai progres aktual site. Rentang kosong menunjukkan gap dalam pipeline.',
  descVendor:            'Membandingkan performa vendor berdasarkan status pekerjaan. Klik untuk filter.',
  descPIC:               'Jumlah site yang ditangani oleh masing-masing PIC.',
  descKeterlambatan:     'Faktor utama keterlambatan pekerjaan berdasarkan kategori kendala.',
  descPetaSite:          'Setiap titik mewakili satu site. Warna menunjukkan status. Klik kluster untuk memperbesar.',
  descPetaRegion:        'Ukuran gelembung = jumlah site. Warna = tingkat penyelesaian (hijau ≥75%, biru ≥50%, kuning ≥25%, merah <25%).',

  // Legend / bar names
  rencana:    'Rencana',
  realisasi:  'Realisasi',
  total:      'Total',

  // Tabs
  ikhtisar:   'Ikhtisar',
  performa:   'Performa',
  kendala:    'Kendala',
  peta:       'Peta',

  // Filter / search
  cari:             'Cari Site ID, PIC, Regional, Vendor...',
  semuaRegional:    'Semua Regional',
  semuaVendor:      'Semua Vendor',
  semuaStatus:      'Semua Status',
  hapusFilter:      'Hapus',
  filter:           'Filter',
  tutup:            'Tutup',
  dariTanggal:      'Dari tanggal',
  sampaiTanggal:    'Sampai tanggal',

  // Validation
  valid:            'VALID',
  tidakValid:       'TIDAK VALID',
  siteRekonsiliasi: 'site direkonsiliasi',
  kepercayaan:      'kepercayaan',

  // Empty / misc
  tidakAdaData:     'Tidak ada data tersedia',
  tidakAdaFilter:   'Tidak ada data yang sesuai filter',
  memuat:           'Memuat...',
  cobLagi:          'Coba lagi',
  siteDitampilkan:  'site ditampilkan',
  difilter:         '(difilter)',
  baris:            'baris',
  pemantauan:       'Pemantauan Rollout Jaringan',
  ringkasanOtomatis:'Ringkasan Otomatis',
};

export const STATUS_ID = {
  completed:   'Selesai',
  on_progress: 'Dalam Proses',
  delayed:     'Tertunda',
  not_started: 'Belum Mulai',
};

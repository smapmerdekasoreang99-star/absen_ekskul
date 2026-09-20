// Data contoh untuk MODE CONTOH (dipakai saat Supabase belum dihubungkan).
// Nama pembina & jadwal diambil dari daftar hadir sekolah.
// Nama siswa di bawah ini BUKAN data asli - hanya untuk melihat tampilan.

export const PEMBINA = [
  { id: 'P01', nama: 'Dedi Sopandi, S.Pd', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P02', nama: 'Ade Ervint', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P03', nama: 'Neng Rina, S.Sn', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P04', nama: 'Piki Permana, S.Pd', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P05', nama: 'Rian Herdiansah, S.Pd', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P06', nama: 'Divia Zhawa Pixtiresa, S.Pd', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P07', nama: 'Farista Finishari, S.Pd', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P08', nama: 'Cecep Saepulman', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P09', nama: 'Jajang Sutisna', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P10', nama: 'Moh. Ilham', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P11', nama: 'Silvi Lestari', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P12', nama: 'Linda Melyansari, S.Pd', no_hp: '', status: 'Aktif', kode_akses: '1234' },
  { id: 'P13', nama: 'Arya Wiranata, S.Pd', no_hp: '', status: 'Aktif', kode_akses: '1234' }
];

export const EKSKUL = [
  { id: 'E01', nama: 'Karate',       pembina_id: 'P01', hari: 'Senin',  jam_mulai: '15:30', jam_selesai: '17:30', tempat: '', aktif: true },
  { id: 'E02', nama: 'Basket',       pembina_id: 'P02', hari: 'Senin',  jam_mulai: '15:30', jam_selesai: '17:30', tempat: '', aktif: true },
  { id: 'E03', nama: 'Tari',         pembina_id: 'P03', hari: 'Selasa', jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E04', nama: 'Pelarus',      pembina_id: 'P04', hari: 'Selasa', jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E05', nama: 'Softball',     pembina_id: 'P05', hari: 'Selasa', jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E06', nama: 'Teater',       pembina_id: 'P06', hari: 'Selasa', jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E07', nama: 'Paduan Suara', pembina_id: 'P07', hari: 'Rabu',   jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E08', nama: 'PMR',          pembina_id: 'P08', hari: 'Rabu',   jam_mulai: '15:45', jam_selesai: '17:30', tempat: '', aktif: true },
  { id: 'E09', nama: 'Paskibra',     pembina_id: 'P09', hari: 'Rabu',   jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E10', nama: 'Taekwondo',    pembina_id: 'P10', hari: 'Rabu',   jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E11', nama: 'Karawitan',    pembina_id: 'P03', hari: 'Rabu',   jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E12', nama: 'Pramuka',      pembina_id: 'P11', hari: 'Kamis',  jam_mulai: '15:45', jam_selesai: '17:30', tempat: '', aktif: true },
  { id: 'E13', nama: 'English Club', pembina_id: 'P12', hari: 'Kamis',  jam_mulai: '15:30', jam_selesai: '17:00', tempat: '', aktif: true },
  { id: 'E14', nama: 'Futsal',       pembina_id: 'P13', hari: 'Jumat',  jam_mulai: '16:00', jam_selesai: '18:00', tempat: '', aktif: true },
  { id: 'E15', nama: 'Tahfidz',      pembina_id: 'P12', hari: 'Jumat',  jam_mulai: '13:30', jam_selesai: '15:00', tempat: 'Masjid sekolah', aktif: true, kategori: 'Pembinaan Imtaq' }
];
// Baris tanpa kolom kategori dianggap Ekstrakurikuler, sama seperti data
// sungguhan yang dibuat sebelum kolom itu ada.

// ---- Siswa contoh -----------------------------------------------------
const DEPAN = ['Aisyah','Rizki','Nabila','Fajar','Salma','Dimas','Zahra','Bayu','Intan','Rafi',
               'Alya','Gilang','Nadia','Ilham','Syifa','Reza','Kirana','Arka','Melati','Yusuf',
               'Putri','Hafiz','Anisa','Galih','Laras','Fikri'];
const BELAKANG = ['Ramadhan','Nuraini','Pratama','Safitri','Maulana','Wijaya','Hasanah','Saputra',
                  'Lestari','Kurnia','Ardiansyah','Permata'];
const KELAS = ['X-1','X-2','X-3','XI-1','XI-2','XI-3','XII-1','XII-2'];

export const SISWA = [];
export const PESERTA = [];
let n = 0;
EKSKUL.forEach((e, idx) => {
  const jumlah = 9 + ((idx * 5) % 14); // 9 - 22 peserta
  for (let i = 0; i < jumlah; i++) {
    n++;
    const id = '00' + String(26000000 + n * 7);   // menyerupai NISN
    SISWA.push({
      id,
      nis: '2026' + String(n).padStart(4, '0'),
      nama: DEPAN[(n * 7) % DEPAN.length] + ' ' + BELAKANG[(n * 3) % BELAKANG.length],
      kelas: KELAS[(n * 5) % KELAS.length]
    });
    PESERTA.push({
      ekskul_id: e.id, siswa_id: id, aktif: true,
      nama_siswa: SISWA[SISWA.length - 1].nama, kelas: SISWA[SISWA.length - 1].kelas
    });
  }
});


// Beberapa sesi contoh 4 minggu terakhir supaya halaman Rekap tidak kosong.
export const SESI = [];
export const KEHADIRAN = [];
const HARI_KE = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6 };
let sesiId = 0;
(function buatSesiContoh() {
  const hariIni = new Date();
  for (let w = 4; w >= 1; w--) {
    EKSKUL.forEach((e, idx) => {
      const d = new Date(hariIni);
      d.setDate(d.getDate() - d.getDay() + HARI_KE[e.hari] - w * 7);
      const acak = (idx * 13 + w * 7) % 10;
      const status = acak === 0 ? 'TH' : acak === 1 ? 'DG' : acak === 2 ? 'KG' : 'H';
      sesiId++;
      SESI.push({
        id: sesiId, ekskul_id: e.id,
        tanggal: d.toISOString().slice(0, 10),
        minggu_ke: Math.ceil(d.getDate() / 7),
        status_pembina: status,
        pengganti: status === 'DG' ? 'Pelatih pendamping' : '',
        tempat: '', materi: '', catatan: '',
        foto: '', dicatat_oleh: 'Contoh'
      });
      if (status === 'KG') return;
      const peserta = PESERTA.filter(p => p.ekskul_id === e.id);
      peserta.forEach((p, i) => {
        const r = (i * 3 + w * 5 + idx) % 10;
        KEHADIRAN.push({
          sesi_id: sesiId, siswa_id: p.siswa_id,
          status: r < 7 ? 'H' : r === 7 ? 'S' : r === 8 ? 'I' : 'A'
        });
      });
    });
  }
})();
// Penghitung id sesi dibungkus objek supaya nilainya bisa dinaikkan
// dari modul lain (binding impor bersifat hanya-baca).
export const SESI_ID_TERAKHIR_REF = { v: sesiId };

// ---- Periode penilaian contoh ----------------------------------------
export const PERIODE = [
  { id: 1, tahun_ajaran: '2026/2027', semester: 'Ganjil',
    tanggal_mulai: '2026-07-13', tanggal_selesai: '2026-12-18',
    dibuka: true, catatan: 'Pengisian nilai dibuka sampai 20 Desember.' }
];
export const NILAI = [];
export const PERIODE_ID_TERAKHIR_REF = { v: 1 };

// Daftar guru contoh, berdiri sendiri seperti tabel guru milik aplikasi
// Kehadiran Guru. Pembina yang tertaut ke salah satunya dianggap internal.
// TMT dibuat berbeda-beda supaya urutan menurut masa kerja terlihat di mode
// contoh, lalu daftarnya langsung disusun seperti di aplikasi sungguhan:
// masa kerja terlama lebih dulu.
export const GURU = PEMBINA
  .filter(p => !['P02', 'P08', 'P09', 'P10', 'P11'].includes(p.id))
  .map((p, i) => ({ id: 'G' + String(i + 1).padStart(2, '0'), nama: p.nama,
                    tmt_sekolah: `${2004 + ((i * 5) % 19)}-07-13` }))
  .sort((a, b) => (a.tmt_sekolah < b.tmt_sekolah ? -1 : a.tmt_sekolah > b.tmt_sekolah ? 1
                   : a.nama.localeCompare(b.nama, 'id')));

// Pembina yang namanya ada di daftar guru ditautkan; sisanya eksternal.
PEMBINA.forEach(p => {
  const g = GURU.find(x => x.nama === p.nama);
  p.id_guru = g ? g.id : null;
});

// ---- Tarif transport contoh ------------------------------------------
export const TARIF = [
  { id: 1, jenis: 'Internal',  min_peserta: 10, maks_peserta: 20,   besaran: 60000 },
  { id: 2, jenis: 'Internal',  min_peserta: 21, maks_peserta: 30,   besaran: 80000 },
  { id: 3, jenis: 'Internal',  min_peserta: 31, maks_peserta: null, besaran: 100000 },
  { id: 4, jenis: 'Eksternal', min_peserta: 5,  maks_peserta: 9,    besaran: 70000 },
  { id: 5, jenis: 'Eksternal', min_peserta: 10, maks_peserta: 20,   besaran: 100000 },
  { id: 6, jenis: 'Eksternal', min_peserta: 21, maks_peserta: 30,   besaran: 125000 },
  { id: 7, jenis: 'Eksternal', min_peserta: 31, maks_peserta: null, besaran: 150000 }
];
export const TARIF_ID_TERAKHIR_REF = { v: 7 };

export const PENGATURAN = {
  nama: 'SMA Plus "Merdeka" Soreang',
  alamat: 'Jl. Citaliktik-Sindang Wargi Soreang Kab. Bandung',
  tahunAjaran: '2026/2027',
  kota: 'Soreang',
  kepalaSekolah: 'Mohamad Gunawan, S.Si',
  bendahara: 'Dra. Ida Susana',
  kesiswaan: 'Devy Resmisari, S.Pd.'
};

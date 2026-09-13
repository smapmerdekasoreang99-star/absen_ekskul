// =====================================================================
// Koneksi ke Supabase.
//
// Susunan saat ini: DUA project yang sudah ada.
//   - Kehadiran_Guru -> tabel ekskul, peserta, sesi, dan bucket foto
//   - Tryout_guru    -> public.tka_siswa, hanya dibaca
//
// Bila suatu saat keduanya digabung ke satu project, cukup kosongkan
// url & key pada SUMBER_SISWA. Tidak ada perubahan kode lain.
//
// Selama SUPABASE_URL belum diisi alamat sungguhan, aplikasi berjalan dalam
// MODE CONTOH: data palsu dan tidak tersimpan.
// =====================================================================

// --- Project Kehadiran_Guru (tempat tabel ekskul) --------------------
export const SUPABASE_URL = 'ISI_URL_KEHADIRAN_GURU';
export const SUPABASE_ANON_KEY = 'ISI_ANON_KEHADIRAN_GURU';

// --- Project Tryout_guru (sumber data siswa) -------------------------
export const SUMBER_SISWA = {
  url:   'ISI_URL_TRYOUT',   // kosongkan '' bila satu project dengan ekskul
  key:   'ISI_ANON_TRYOUT',
  tabel: 'tka_siswa_ekskul', // tampilan terbatas dari db/akses_siswa.sql
                             // ganti 'tka_siswa' bila ingin langsung ke tabelnya
  id:    'nisn',
  nis:   'nis',
  nama:  'nama',
  kelas: 'kelas',
  kolomAktif: 'aktif'        // hanya siswa aktif; kosongkan '' bila tidak dipakai
};

// --- Nama tabel di project Kehadiran_Guru ----------------------------
// Awalan ae_ (absensi ekstrakurikuler) dipakai supaya tidak bertabrakan
// dengan tabel milik aplikasi lain di project yang sama. Bila suatu saat
// awalannya diubah, cukup berkas ini yang disunting.
export const TABEL = {
  pembina:   'ae_pembina',
  ekskul:    'ae_ekskul',
  peserta:   'ae_peserta',
  sesi:      'ae_sesi',
  kehadiran: 'ae_kehadiran'
};

export const BUCKET_FOTO = 'foto-ekskul';

export const terhubung =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

const punyaSumberTerpisah = () =>
  SUMBER_SISWA.url.startsWith('http') && SUMBER_SISWA.key.length > 20;

let _klien = null, _klienSiswa = null;

async function buat(url, key) {
  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
  );
  return createClient(url, key);
}

export async function klien() {
  if (!terhubung) return null;
  if (!_klien) _klien = await buat(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _klien;
}

// Koneksi untuk membaca data siswa. Sama dengan klien() bila satu project.
export async function klienSiswa() {
  if (!punyaSumberTerpisah()) return klien();
  if (!_klienSiswa) _klienSiswa = await buat(SUMBER_SISWA.url, SUMBER_SISWA.key);
  return _klienSiswa;
}

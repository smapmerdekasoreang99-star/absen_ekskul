// =====================================================================
// Koneksi ke Supabase.
//
// Susunan saat ini: SATU project, yaitu Tryout_guru. Tabel ekskul
// dipasang di sana, berdampingan dengan tka_siswa.
//
// Bila suatu saat tabel ekskul dipindahkan ke project tersendiri, isi
// url & key pada SUMBER_SISWA dengan project Tryout_guru; aplikasi akan
// membuka koneksi kedua khusus untuk membaca siswa. Tidak ada perubahan
// lain yang diperlukan.
//
// Selama SUPABASE_URL masih "ISI_DI_SINI", aplikasi berjalan dalam
// MODE CONTOH: data palsu dan tidak tersimpan.
// =====================================================================

// --- Project Tryout_guru ---------------------------------------------
export const SUPABASE_URL = 'https://jzxcnfetpjkltjjbglxz.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_9pl5IOJl-Vx0KEnHtCs3nA_ioZOkacq';

// --- Sumber data siswa -----------------------------------------------
export const SUMBER_SISWA = {
  url:   '',                 // kosong = satu project dengan tabel ekskul
  key:   '',                 // isi hanya bila project-nya dipisah
  tabel: 'siswa_ekskul',     // tampilan terbatas dari db/akses_siswa.sql
                             // ganti 'tka_siswa' bila ingin langsung ke tabelnya
  id:    'nisn',
  nis:   'nis',
  nama:  'nama',
  kelas: 'kelas',
  kolomAktif: 'aktif'        // hanya siswa aktif; kosongkan '' bila tidak dipakai
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

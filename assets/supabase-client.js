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
export const SUPABASE_URL = 'https://xgtoneyvzfvfbidicotq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_rjHVGT0ULc03TC2ljIytSA_2X54xzR1';

// --- Project Tryout_guru (sumber data siswa) -------------------------
export const SUMBER_SISWA = {
  url:   '',   // kosongkan '' bila satu project dengan ekskul
  key:   '',
  tabel: 'v_siswa_aktif', // tampilan ringkas: id, nama, kelas, tingkat, tahun_ajaran

  // Penanda peserta memakai id siswa, BUKAN NISN.
  // Alasannya dua: NISN bisa berubah bila ada koreksi Dapodik sehingga
  // rujukan peserta putus diam-diam, sedangkan id tidak pernah berubah;
  // dan NISN termasuk data pribadi yang tidak dibuka ke halaman publik,
  // jadi kolomnya memang tidak ada lagi pada v_siswa_aktif.
  id:    'id',
  nis:   '',    // dikosongkan: kolom NIS tidak dipakai halaman ekskul
  nama:  'nama',
  kelas: 'kelas',
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
  kehadiran: 'ae_kehadiran',
  periode:   'ae_periode',
  nilai:     'ae_nilai'
};

export const BUCKET_FOTO = 'foto-ekskul';

export const terhubung =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

const punyaSumberTerpisah = () =>
  SUMBER_SISWA.url.startsWith('http') && SUMBER_SISWA.key.length > 20;

let _klien = null, _klienSiswa = null;

// Pustaka Supabase dimuat dari salinan lokal (satu berkas, server yang sama
// dengan halamannya). Dari CDN, berkas ini menarik delapan berkas lain
// dalam tiga tingkat berurutan di domain ketiga — di HP dengan sinyal
// pas-pasan itulah yang membuat halaman masuk tertahan di "Memuat…".
// CDN tetap dicoba sebagai cadangan bila salinan lokal gagal dimuat.
const PUSTAKA_LOKAL = './vendor/supabase-js-2.117.0.js';
const PUSTAKA_CDN   = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.0/+esm';

async function buat(url, key) {
  let modul;
  try { modul = await import(PUSTAKA_LOKAL); }
  catch (e) {
    console.warn('Pustaka Supabase lokal gagal dimuat, memakai CDN:', e.message);
    modul = await import(PUSTAKA_CDN);
  }
  return modul.createClient(url, key);
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

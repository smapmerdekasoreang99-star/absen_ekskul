// =====================================================================
// Koneksi ke Supabase.
//
// A. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan Project URL dan anon
//    key project tempat tabel ekskul dipasang. Selama masih "ISI_DI_SINI",
//    aplikasi berjalan dalam MODE CONTOH.
//
// B. SUMBER_SISWA menunjuk ke data siswa milik aplikasi Tryout & Asesmen.
//    - Bila tabel ekskul dipasang di project yang SAMA (dianjurkan),
//      biarkan url & key kosong.
//    - Bila project-nya berbeda, isi url & key project Tryout_guru.
//      Aplikasi akan membuka koneksi kedua khusus untuk membaca siswa.
// =====================================================================
export const SUPABASE_URL = 'ISI_DI_SINI';
export const SUPABASE_ANON_KEY = 'ISI_DI_SINI';

export const SUMBER_SISWA = {
  url:   '',                 // kosongkan bila satu project dengan tabel ekskul
  key:   '',
  tabel: 'siswa_ekskul',     // tampilan (view) yang dibuat db/akses_siswa.sql
                             // ganti jadi 'tka_siswa' bila ingin langsung ke tabelnya
  id:    'nisn',             // kunci utama tka_siswa
  nis:   'nis',
  nama:  'nama',
  kelas: 'kelas',
  kolomAktif: 'aktif'        // hanya siswa aktif yang dicari; kosongkan '' bila tidak dipakai
};

export const BUCKET_FOTO = 'foto-ekskul';

export const terhubung =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

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
  const s = SUMBER_SISWA;
  if (!s.url || !s.key) return klien();
  if (!_klienSiswa) _klienSiswa = await buat(s.url, s.key);
  return _klienSiswa;
}

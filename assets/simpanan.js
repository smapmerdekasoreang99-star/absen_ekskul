// =====================================================================
// Simpanan rujukan di browser — Absensi Ekskul
// =====================================================================
// Daftar kegiatan, pembina, dan pembimbingnya (master), daftar kelas, guru
// yang boleh menjadi pembina, periode penilaian, dan identitas dokumen dibaca
// hampir setiap halaman, dan berubah paling-paling beberapa kali setahun.
// Sebelum berkas ini ada, tiap halaman memintanya ulang ke Supabase setiap
// kali dibuka — dan dari sekolah, satu perjalanan ke API Supabase terukur
// 0,6 sampai 48 detik untuk permintaan yang sama persis.
//
// Cara kerjanya — "pakai yang ada, perbarui di belakang":
//   1. Bila sudah ada di simpanan, nilainya dikembalikan seketika.
//   2. Versi terbarunya tetap diminta di latar; bila berbeda, simpanan
//      ditulis ulang dan halaman diberi tahu lewat saatBerubah (bila ada).
//   3. Bila belum ada, jaringan ditunggu seperti biasa, lalu disimpan.
//
// Yang berubah setiap hari — sesi, kehadiran, nilai — sengaja tidak lewat
// sini. Peserta juga tidak: di halaman absensi ia diminta serentak dengan
// sesi hari itu, jadi menyimpannya tidak menghemat satu perjalanan pun.
//
// Halaman yang mengubah salah satu rujukan (Kesiswaan mengubah pembina dan
// kegiatan, Nilai mengubah periode) memanggil lupakanRujukan() lebih dulu,
// supaya bacaan berikutnya di browser yang sama langsung segar. Browser lain
// menerimanya lewat pembaruan latar pada kunjungan berikutnya.
//
// Simpanan yang gagal ditulis atau terbaca (penyimpanan penuh, mode
// penyamaran) tidak menjatuhkan apa pun: jalannya kembali lewat jaringan.
// =====================================================================

const AWALAN = 'ae.rujukan.v1.';

function baca(nama) {
  try {
    const isi = JSON.parse(localStorage.getItem(AWALAN + nama) || 'null');
    return isi && 'data' in isi ? isi.data : undefined;
  } catch { return undefined; }
}

function tulis(nama, data) {
  try { localStorage.setItem(AWALAN + nama, JSON.stringify({ waktu: Date.now(), data })); }
  catch { /* abaikan — jaringan tetap ada */ }
}

const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// pakaiRujukan('master', ambilDariJaringan, saatBerubah)
//   ambilDariJaringan : fungsi async yang mengembalikan nilai segar
//   saatBerubah       : dipanggil dengan nilai baru bila pembaruan latar
//                       mendapati isi yang berbeda (boleh kosong)
export async function pakaiRujukan(nama, ambilDariJaringan, saatBerubah) {
  const lama = baca(nama);
  if (lama === undefined) {
    const baru = await ambilDariJaringan();
    tulis(nama, baru);
    return baru;
  }
  ambilDariJaringan().then(baru => {
    if (sama(baru, lama)) return;
    tulis(nama, baru);
    if (typeof saatBerubah === 'function') saatBerubah(baru);
  }).catch(e => console.warn(`Pembaruan ${nama} di latar gagal:`, e.message || e));
  return lama;
}

// Dipanggil sebelum menulis sesuatu yang mengubah rujukan itu.
export function lupakanRujukan(nama) {
  try { localStorage.removeItem(AWALAN + nama); } catch { /* abaikan */ }
}

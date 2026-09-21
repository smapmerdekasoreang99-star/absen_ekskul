// Fungsi bersama untuk semua halaman: sesi masuk, format, pesan, foto.
import { MODE } from './db.js?v=20260921b';

export const PIN_PENGELOLA = 'merdeka2026';

// ------------------------------------------------------------ sesi masuk
// Disimpan di sessionStorage: hilang begitu peramban ditutup.
// Selalu ada cadangan di memori bila sessionStorage diblokir.
let memori = null;
const KUNCI = 'ekskul_sesi';

export function sesiMasuk() {
  if (memori) return memori;
  try {
    const isi = sessionStorage.getItem(KUNCI);
    if (isi) { memori = JSON.parse(isi); return memori; }
  } catch {}
  return null;
}
export function masukSebagai(obj) {
  memori = obj;
  try { sessionStorage.setItem(KUNCI, JSON.stringify(obj)); } catch {}
}
export function keluar() {
  memori = null;
  try { sessionStorage.removeItem(KUNCI); } catch {}
  location.href = 'masuk.html';
}
export function adalahPengelola() {
  const s = sesiMasuk();
  return !!s && s.peran === 'pengelola';
}

// Dipanggil paling awal di tiap halaman. Mengembalikan sesi masuk,
// atau melempar ke halaman masuk bila belum.
export function wajibMasuk(pengelolaSaja) {
  const s = sesiMasuk();
  if (!s) { location.href = 'masuk.html'; return null; }
  if (pengelolaSaja && s.peran !== 'pengelola') {
    location.href = 'index.html';
    return null;
  }
  const nama = document.getElementById('namaPengguna');
  if (nama) nama.textContent = s.peran === 'pengelola' ? 'Pengelola' : s.nama;
  const tombol = document.getElementById('tombolKeluar');
  if (tombol) tombol.addEventListener('click', keluar);
  document.querySelectorAll('[data-pengelola]').forEach(el => {
    if (s.peran !== 'pengelola') el.classList.add('sembunyi');
  });
  return s;
}

/* Siapa saja yang membimbing sebuah kegiatan.

   Dua keadaan, sama seperti yang ditetapkan di database:
     * ada daftar pembimbing  -> daftar itulah seluruhnya, termasuk
       penanggung jawabnya, yang memang ikut didaftarkan di dalamnya;
     * tidak ada daftar       -> pembimbingnya cukup pembina_id.

   Seluruh layar bertanya lewat fungsi ini, tidak ada yang membaca
   pembina_id sendiri lagi — kalau ada, pembimbing kedua sampai kelima akan
   terkunci di luar tanpa pesan apa pun. */
export function pembimbingDari(e) {
  if (!e) return [];
  if (Array.isArray(e.pembimbing) && e.pembimbing.length) return e.pembimbing;
  return e.pembina_id ? [e.pembina_id] : [];
}

export const dibimbingBersama = e => pembimbingDari(e).length > 1;

// Menyaring daftar ekskul sesuai hak pengguna.
export function ekskulBoleh(s, daftar) {
  if (!s) return [];
  if (s.peran === 'pengelola') return daftar;
  return daftar.filter(e => pembimbingDari(e).includes(s.pembina_id));
}

export function tandaiMode() {
  document.querySelectorAll('[data-mode-contoh]').forEach(el =>
    el.classList.toggle('sembunyi', MODE !== 'contoh'));
}

// --------------------------------------------------------------- tampilan
export function laporError(e) {
  const kotak = document.getElementById('kotakPesan');
  const teks = (e && e.message) ? e.message : String(e);
  if (kotak) {
    kotak.className = 'pesan p-salah';
    kotak.textContent = teks;
    kotak.classList.remove('sembunyi');
    kotak.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else alert(teks);
  console.error(e);
}
export function sukses(teks) {
  const kotak = document.getElementById('kotakPesan');
  if (!kotak) return;
  kotak.className = 'pesan p-sukses';
  kotak.textContent = teks;
  kotak.classList.remove('sembunyi');
}
export function bersihkanPesan() {
  const kotak = document.getElementById('kotakPesan');
  if (kotak) kotak.classList.add('sembunyi');
}

// ------------------------------------------------------------- kategori
// Pemisah pelaporan, bukan pemisah mesin: ketiganya memakai pendaftaran
// peserta, laporan pertemuan, rekap, dan nilai yang sama persis. Yang berbeda
// ada di luar aplikasi ini, dan keduanya ditentukan oleh kategori:
//   * nilai rapor hanya mengambil 'Ekstrakurikuler';
//   * penghonoran di Induk Pembiayaan — 'Ekstrakurikuler' dan 'Pembinaan
//     Imtaq' per pertemuan menurut siswa hadir (tarif Imtaq tersendiri),
//     sedangkan 'Pembinaan Kesiswaan' flat per bulan dan tidak dihitung dari
//     pertemuan sama sekali. Pertemuannya tetap dicatat di sini, hanya bukan
//     itu dasar pembayarannya.
export const KATEGORI = ['Ekstrakurikuler', 'Pembinaan Imtaq', 'Pembinaan Kesiswaan'];
export const KATEGORI_BAWAAN = 'Ekstrakurikuler';
// Baris lama (sebelum kolom kategori ada) dianggap Ekstrakurikuler.
export const kategoriDari = e => (e && e.kategori) || KATEGORI_BAWAAN;

// Mengelompokkan daftar kegiatan menurut kategori, urut seperti KATEGORI.
export function perKategori(daftar) {
  return KATEGORI
    .map(k => [k, daftar.filter(e => kategoriDari(e) === k)])
    .filter(([, isi]) => isi.length);
}

// ----------------------------------------------------------------- format
export const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
               'Juli','Agustus','September','Oktober','November','Desember'];

export function hariIni() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
export function namaHari(iso) { return HARI[new Date(iso + 'T00:00:00').getDay()]; }
export function tanggalPanjang(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
export function tanggalPendek(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`;
}
export function mingguKe(iso) { return Math.ceil(new Date(iso + 'T00:00:00').getDate() / 7); }
export function jam(t) { return t ? String(t).slice(0, 5) : ''; }
export function persen(a, b) { return b ? Math.round(a / b * 100) : 0; }

// -------------------------------------------------------------------- foto
// Memperkecil foto sebelum diunggah: sisi terpanjang 1280 piksel, JPEG 72%.
// Foto HP 4 MB biasanya turun ke sekitar 150-300 KB.
export function kompresGambar(berkas, maksSisi = 1280, mutu = 0.72) {
  return new Promise((selesai, gagal) => {
    const gbr = new Image();
    const url = URL.createObjectURL(berkas);
    gbr.onload = () => {
      const skala = Math.min(1, maksSisi / Math.max(gbr.width, gbr.height));
      const kanvas = document.createElement('canvas');
      kanvas.width = Math.round(gbr.width * skala);
      kanvas.height = Math.round(gbr.height * skala);
      kanvas.getContext('2d').drawImage(gbr, 0, 0, kanvas.width, kanvas.height);
      URL.revokeObjectURL(url);
      kanvas.toBlob(b => b ? selesai(b) : gagal(new Error('Foto gagal diproses.')),
                    'image/jpeg', mutu);
    };
    gbr.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Berkas itu bukan gambar.')); };
    gbr.src = url;
  });
}

// --------------------------------------------------------------- unduhan
export function unduhCSV(namaBerkas, barisBaris) {
  const isi = barisBaris.map(r => r.map(sel => {
    const s = sel === null || sel === undefined ? '' : String(sel);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + isi], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function rupiah(n) {
  if (!n) return 'Rp0';
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

// Perhitungan tarif transport pembina pindah ke Induk Pembiayaan
// (f_ip_transport_pembina), bersama besarannya yang kini berversi menurut
// tanggal berlaku. Tidak ditinggalkan salinan di sini supaya tidak ada dua
// rumus yang bisa menyimpang.

// Pembuat dokumen: XLSX (ExcelJS) dan PNG (canvas).
//
// Prinsip tampilan: hemat tinta printer. Latar putih, garis tipis abu-abu,
// tanpa blok warna lebar. Hanya baris judul tabel yang diberi abu sangat
// muda, dan aksen emas dipakai tipis sebagai garis, bukan bidang.
import { SEKOLAH } from './sekolah.js?v=20260923b';

// Identitas yang dipakai pada kop dan blok tanda tangan. Nilai bawaan
// berasal dari sekolah.js dan ditimpa oleh pengaturan dari database
// lewat pakaiIdentitas().
const ID = { ...SEKOLAH };
export function pakaiIdentitas(obj) {
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') ID[k] = v;
  });
}

const EMAS = 'FFB2861F';
const TINTA = 'FF241F17';
const GARIS = 'FFBFB8A8';
const ABU_MUDA = 'FFF5F2EA';

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
               'Juli','Agustus','September','Oktober','November','Desember'];
export function tanggalCetak() {
  const t = new Date();
  return `${t.getDate()} ${BULAN[t.getMonth()]} ${t.getFullYear()}`;
}

let _ExcelJS = null;
async function excel() {
  if (_ExcelJS) return _ExcelJS;
  if (!window.ExcelJS) {
    await new Promise((selesai, gagal) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.onload = selesai;
      s.onerror = () => gagal(new Error('Gagal memuat pustaka Excel. Periksa sambungan internet.'));
      document.head.appendChild(s);
    });
  }
  _ExcelJS = window.ExcelJS;
  return _ExcelJS;
}
// Dipakai juga oleh pembaca berkas unggahan (unggah-peserta.js), supaya
// pustakanya dimuat sekali saja dari satu tempat.
export const pustakaExcel = excel;

async function logoBase64() {
  try {
    const res = await fetch(ID.logo);
    const blob = await res.blob();
    return await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result.split(',')[1]);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function simpan(blob, namaBerkas) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const tepi = { style: 'thin', color: { argb: GARIS } };
const semuaTepi = { top: tepi, left: tepi, bottom: tepi, right: tepi };

/* Penjaga: bila assets/kop-dokumen.js tidak termuat, unduhan gagal dengan
   pesan yang bisa ditindaklanjuti, bukan "undefined". */
function kopBersama() {
  if (!window.KopDokumen) throw new Error(
    'Berkas assets/kop-dokumen.js belum termuat, sehingga kop dokumen tidak bisa dibuat. '
    + 'Muat ulang halaman; bila tetap gagal, laporkan ke operator.');
  return window.KopDokumen;
}

/* Identitas sekolah apa adanya dari v_penanda_tangan, termasuk tata letak
   kopnya. Bila belum termuat — mode contoh, atau Data Induk tidak terbaca —
   disusun seadanya dari nilai bawaan di sekolah.js supaya kop tetap jadi. */
function profilKop() {
  return ID.profil || { nama_sekolah: ID.nama, alamat: ID.alamat, kota: ID.kota };
}

/* Kop surat. Susunan dan letaknya tidak ditentukan di sini melainkan di
   assets/kop-dokumen.js — berkas yang sama persis di keempat aplikasi dan
   membaca tata letak yang diatur operator di Data Induk → Profil Dokumen.
   Mengembalikan nomor baris kosong pertama sesudah kop. */
async function kop(ws, wb, judul, subjudul, lebarKolom) {
  const logo = await logoBase64();
  return kopBersama().kopExcel(ws, {
    wb, logo: logo ? { base64: logo } : null,
    profil: profilKop(), judul, sub: subjudul,
    kolomAkhir: lebarKolom, warnaGaris: EMAS
  });
}

function barisJudulTabel(ws, baris, judulKolom) {
  judulKolom.forEach((t, i) => {
    const sel = ws.getCell(baris, i + 1);
    sel.value = t;
    sel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: TINTA } };
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABU_MUDA } };
    sel.border = semuaTepi;
    sel.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.getRow(baris).height = 28;
}

function selIsi(ws, r, k, nilai, opsi = {}) {
  const sel = ws.getCell(r, k);
  sel.value = nilai;
  sel.font = { name: 'Calibri', size: 10, bold: !!opsi.tebal, color: { argb: TINTA } };
  sel.border = semuaTepi;
  sel.alignment = { vertical: 'middle', horizontal: opsi.rata || 'left', wrapText: !!opsi.bungkus };
  if (opsi.rupiah) sel.numFmt = '#,##0';
  return sel;
}

// =====================================================================
// B. NILAI EKSTRAKURIKULER PER KELAS
// baris: [{ nama, ekskul, predikat, keterangan, deskripsi }]
// =====================================================================
export async function unduhNilaiKelasXLSX({ kelas, periode, baris, namaBerkas, judulKategori }) {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(kelas.replace(/[\\/*?:[\]]/g, '-'), {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1,
                 margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  });
  ws.columns = [{ width: 5 }, { width: 28 }, { width: 20 },
                { width: 9 }, { width: 16 }, { width: 36 }];
  // Baris awal tabel mengikuti tinggi kop, yang berubah bila operator
  // memperbesar logo atau tulisannya.
  let r = await kop(ws, wb, `NILAI ${judulKategori || "EKSTRAKURIKULER"} — KELAS ${kelas}`,
                    periode, 6);
  barisJudulTabel(ws, r, ['No.', 'Nama Siswa', 'Kegiatan',
                          'Predikat', 'Keterangan', 'Deskripsi']);
  r++;
  baris.forEach((b, i) => {
    selIsi(ws, r, 1, i + 1, { rata: 'center' });
    selIsi(ws, r, 2, b.nama);
    selIsi(ws, r, 3, b.ekskul);
    selIsi(ws, r, 4, b.predikat || '', { rata: 'center', tebal: true });
    selIsi(ws, r, 5, b.keterangan || '');
    selIsi(ws, r, 6, b.deskripsi || '', { bungkus: true });
    r++;
  });
  r += 2;
  const biasa = { name: 'Calibri', size: 10, color: { argb: TINTA } };
  const tebalGaris = { name: 'Calibri', size: 10, bold: true, color: { argb: TINTA } };

  // Yang menandatangani adalah pejabat yang berwenang atas isi dokumen —
  // untuk ekstrakurikuler itu Wakasek Kesiswaan — dan Kepala Sekolah
  // mengetahui. Nama pembina tidak lagi menjadi kolom tanda tangan karena
  // satu berkas kelas memuat banyak kegiatan dengan pembina berbeda-beda.
  ws.getCell(r, 2).value = 'Mengetahui,';
  ws.getCell(r + 1, 2).value = 'Kepala Sekolah,';
  ws.getCell(r + 5, 2).value = ID.kepalaSekolah || '..................................................';
  [r, r + 1].forEach(x => { ws.getCell(x, 2).font = biasa; });
  ws.getCell(r + 5, 2).font = tebalGaris;

  ws.getCell(r, 5).value = `${ID.kota}, ${tanggalCetak()}`;
  ws.getCell(r + 1, 5).value = 'Wakasek Kesiswaan,';
  ws.getCell(r + 5, 5).value = ID.kesiswaan || '..................................................';
  [r, r + 1].forEach(x => { ws.getCell(x, 5).font = biasa; });
  ws.getCell(r + 5, 5).font = tebalGaris;

  const buf = await wb.xlsx.writeBuffer();
  simpan(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
         namaBerkas);
}

// ---- PNG: digambar langsung di canvas, tanpa pustaka luar ------------
export async function unduhNilaiKelasPNG({ kelas, periode, baris, namaBerkas, judulKategori }) {
  const skala = 2;                    // supaya tajam di layar HP
  const lebar = 1000;
  const padding = 40;
  const judulKop = `NILAI ${judulKategori || "EKSTRAKURIKULER"} — KELAS ${kelas}`;
  // Tinggi kop mengikuti tata letak yang diatur operator, bukan angka tetap.
  const tinggiKop = kopBersama().tinggiKopKanvas(profilKop(), judulKop, periode);
  const tinggiJudul = 44;
  const tinggiBaris = 40;
  const tinggi = tinggiKop + tinggiJudul + baris.length * tinggiBaris + 230;

  const kanvas = document.createElement('canvas');
  kanvas.width = lebar * skala;
  kanvas.height = tinggi * skala;
  const g = kanvas.getContext('2d');
  g.scale(skala, skala);

  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, lebar, tinggi);

  const logo = await new Promise(r => {
    const im = new Image();
    im.onload = () => r(im);
    im.onerror = () => r(null);
    im.src = ID.logo;
  });

  // Kop digambar oleh modul yang sama dengan yang menulis berkas Excel,
  // jadi gambar PNG dan xlsx tidak bisa berbeda tata letaknya.
  kopBersama().kopKanvas(g, {
    logo, profil: profilKop(), judul: judulKop, sub: periode, padding, lebar
  });

  const kolom = [
    { t: 'No.', w: 44, rata: 'center' },
    { t: 'Nama Siswa', w: 250 },
    { t: 'Kegiatan', w: 190 },
    { t: 'Predikat', w: 80, rata: 'center' },
    { t: 'Keterangan', w: 156 },
    { t: 'Deskripsi', w: 200 }
  ];
  // tinggiKop sudah memuat jarak renggang di bawah garis kop.
  let y = tinggiKop;
  let x = padding;

  g.fillStyle = '#F5F2EA';
  g.fillRect(padding, y, lebar - padding * 2, tinggiJudul - 8);
  g.fillStyle = '#241F17';
  g.font = 'bold 13px Arial, sans-serif';
  kolom.forEach(k => {
    const tx = k.rata === 'center' ? x + k.w / 2 : x + 10;
    g.textAlign = k.rata === 'center' ? 'center' : 'left';
    g.fillText(k.t, tx, y + 24);
    x += k.w;
  });
  y += tinggiJudul - 8;

  g.strokeStyle = '#D8D0BF';
  g.lineWidth = 1;
  g.font = '13px Arial, sans-serif';
  baris.forEach((b, i) => {
    const isi = [String(i + 1), b.nama, b.ekskul, b.predikat || '—',
                 b.keterangan || '', b.deskripsi || ''];
    x = padding;
    g.fillStyle = '#241F17';
    kolom.forEach((k, j) => {
      g.textAlign = k.rata === 'center' ? 'center' : 'left';
      const tx = k.rata === 'center' ? x + k.w / 2 : x + 10;
      g.font = (j === 3 ? 'bold ' : '') + '13px Arial, sans-serif';
      g.fillText(potong(g, isi[j], k.w - 18), tx, y + 25);
      x += k.w;
    });
    g.beginPath();
    g.moveTo(padding, y + tinggiBaris);
    g.lineTo(lebar - padding, y + tinggiBaris);
    g.stroke();
    y += tinggiBaris;
  });

  // Blok tanda tangan
  g.textAlign = 'left';
  const yTtd = y + 44;
  const xKanan = lebar - padding - 300;
  g.fillStyle = '#241F17';
  g.font = '14px Arial, sans-serif';
  g.fillText('Mengetahui,', padding, yTtd);
  g.fillText('Kepala Sekolah,', padding, yTtd + 22);
  g.fillText(`${ID.kota}, ${tanggalCetak()}`, xKanan, yTtd);
  g.fillText('Wakasek Kesiswaan,', xKanan, yTtd + 22);
  g.font = 'bold 14px Arial, sans-serif';
  g.fillText(ID.kepalaSekolah || '..................................................', padding, yTtd + 118);
  g.fillText(ID.kesiswaan || '..................................................', xKanan, yTtd + 118);

  g.fillStyle = '#6B6252';
  g.font = '11px Arial, sans-serif';
  g.fillText('Dicetak dari Aplikasi Absensi Ekstrakurikuler SMA Plus Merdeka Soreang',
             padding, yTtd + 152);

  const blob = await new Promise(r => kanvas.toBlob(r, 'image/png'));
  simpan(blob, namaBerkas);
}

function potong(g, teks, maks) {
  let t = String(teks || '');
  if (g.measureText(t).width <= maks) return t;
  while (t.length > 3 && g.measureText(t + '…').width > maks) t = t.slice(0, -1);
  return t + '…';
}

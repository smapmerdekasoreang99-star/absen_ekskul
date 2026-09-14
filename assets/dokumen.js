// Pembuat dokumen: XLSX (ExcelJS) dan PNG (canvas).
//
// Prinsip tampilan: hemat tinta printer. Latar putih, garis tipis abu-abu,
// tanpa blok warna lebar. Hanya baris judul tabel yang diberi abu sangat
// muda, dan aksen emas dipakai tipis sebagai garis, bukan bidang.
import { SEKOLAH } from './sekolah.js?v=20260913e';

const EMAS = 'FFB2861F';
const TINTA = 'FF241F17';
const GARIS = 'FFBFB8A8';
const ABU_MUDA = 'FFF5F2EA';

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

async function logoBase64() {
  try {
    const res = await fetch(SEKOLAH.logo);
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

// Kop surat: logo di kiri, nama sekolah, lalu garis emas tipis.
async function kop(ws, wb, judul, subjudul, lebarKolom) {
  const logo = await logoBase64();
  if (logo) {
    const id = wb.addImage({ base64: logo, extension: 'png' });
    ws.addImage(id, { tl: { col: 0.15, row: 0.15 }, ext: { width: 54, height: 54 } });
  }
  ws.mergeCells(1, 2, 1, lebarKolom);
  const a = ws.getCell(1, 2);
  a.value = SEKOLAH.nama;
  a.font = { name: 'Calibri', size: 14, bold: true, color: { argb: TINTA } };
  a.alignment = { vertical: 'middle' };

  ws.mergeCells(2, 2, 2, lebarKolom);
  const b = ws.getCell(2, 2);
  b.value = SEKOLAH.alamat;
  b.font = { name: 'Calibri', size: 9, color: { argb: 'FF6B6252' } };

  ws.mergeCells(3, 2, 3, lebarKolom);
  const c = ws.getCell(3, 2);
  c.value = judul;
  c.font = { name: 'Calibri', size: 12, bold: true, color: { argb: TINTA } };

  ws.mergeCells(4, 2, 4, lebarKolom);
  const d = ws.getCell(4, 2);
  d.value = subjudul;
  d.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B6252' } };

  // Garis emas tipis sebagai pembatas kop
  for (let k = 1; k <= lebarKolom; k++) {
    ws.getCell(5, k).border = { bottom: { style: 'medium', color: { argb: EMAS } } };
  }
  ws.getRow(1).height = 20;
  ws.getRow(5).height = 6;
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
// A. DAFTAR TRANSPORT PEMBINA
// baris: [{ pembina, jenis, ekskul, tanggal, hadir, besaran }]
// =====================================================================
export async function unduhTransportXLSX({ baris, tarif, dari, sampai, namaBerkas }) {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Transport', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1,
                 margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  });
  ws.columns = [
    { width: 5 }, { width: 26 }, { width: 12 }, { width: 20 },
    { width: 22 }, { width: 10 }, { width: 14 }
  ];
  await kop(ws, wb,
    'DAFTAR TRANSPORT PEMBINA EKSTRAKURIKULER',
    `Periode ${dari} sampai ${sampai}`, 7);

  let r = 7;
  barisJudulTabel(ws, r, ['No.', 'Nama Pembina', 'Status', 'Ekstrakurikuler',
                          'Pertemuan', 'Hadir', 'Transport (Rp)']);
  r++;

  let no = 0, total = 0;
  // Dikelompokkan per pembina; nama hanya ditulis pada baris pertama.
  const perPembina = {};
  baris.forEach(b => (perPembina[b.pembina] || (perPembina[b.pembina] = [])).push(b));

  Object.entries(perPembina).forEach(([nama, daftar]) => {
    no++;
    const awal = r;
    daftar.forEach((b, i) => {
      selIsi(ws, r, 1, i === 0 ? no : '', { rata: 'center' });
      selIsi(ws, r, 2, i === 0 ? nama : '', { tebal: i === 0 });
      selIsi(ws, r, 3, i === 0 ? b.jenis : '', { rata: 'center' });
      selIsi(ws, r, 4, b.ekskul);
      selIsi(ws, r, 5, b.pertemuan);
      selIsi(ws, r, 6, b.hadir, { rata: 'center' });
      selIsi(ws, r, 7, b.besaran, { rata: 'right', rupiah: true });
      total += b.besaran;
      r++;
    });
    // Subtotal per pembina
    ws.mergeCells(r, 1, r, 6);
    selIsi(ws, r, 1, `Jumlah ${nama} (${daftar.length} pertemuan)`, { rata: 'right', tebal: true });
    selIsi(ws, r, 7, daftar.reduce((a, b) => a + b.besaran, 0),
           { rata: 'right', rupiah: true, tebal: true });
    r++;
    if (awal) { /* penanda kelompok */ }
  });

  ws.mergeCells(r, 1, r, 6);
  const t = selIsi(ws, r, 1, 'JUMLAH SELURUHNYA', { rata: 'right', tebal: true });
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABU_MUDA } };
  const tv = selIsi(ws, r, 7, total, { rata: 'right', rupiah: true, tebal: true });
  tv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABU_MUDA } };
  r += 3;

  // ---- Blok tanda tangan ----
  const kiri = r, kanan = r;
  ws.getCell(kiri, 2).value = 'Setuju dibayar,';
  ws.getCell(kiri + 1, 2).value = 'Kepala Sekolah,';
  ws.getCell(kiri + 5, 2).value = SEKOLAH.kepalaSekolah;
  ws.getCell(kiri + 5, 2).font = { name: 'Calibri', size: 10, bold: true, underline: true };

  ws.getCell(kanan, 5).value = 'Lunas dibayar,';
  ws.getCell(kanan + 1, 5).value = `${SEKOLAH.kota}, .................................`;
  ws.getCell(kanan + 2, 5).value = 'Bendahara,';
  ws.getCell(kanan + 5, 5).value = SEKOLAH.bendahara;
  ws.getCell(kanan + 5, 5).font = { name: 'Calibri', size: 10, bold: true, underline: true };
  for (let i = 0; i <= 5; i++) {
    [2, 5].forEach(k => {
      const sel = ws.getCell(r + i, k);
      if (!sel.font || !sel.font.bold) sel.font = { name: 'Calibri', size: 10, color: { argb: TINTA } };
    });
  }
  r += 7;

  // ---- Tabel sistem pembayaran ----
  ws.getCell(r, 2).value = 'Sistem pembayaran transport';
  ws.getCell(r, 2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: TINTA } };
  r++;
  ['Internal', 'Eksternal'].forEach(jenis => {
    const isi = tarif.filter(x => x.jenis === jenis)
                     .sort((a, b) => a.min_peserta - b.min_peserta);
    if (!isi.length) return;
    barisJudulTabel(ws, r, ['', `Pembina ${jenis} — Jumlah peserta`, '', '',
                            'Besaran transport per pertemuan', '', '']);
    ws.mergeCells(r, 2, r, 4);
    ws.mergeCells(r, 5, r, 7);
    r++;
    isi.forEach(t2 => {
      ws.mergeCells(r, 2, r, 4);
      selIsi(ws, r, 2, t2.maks_peserta
        ? `${t2.min_peserta} – ${t2.maks_peserta} siswa`
        : `lebih dari ${t2.min_peserta - 1} siswa`);
      ws.mergeCells(r, 5, r, 7);
      selIsi(ws, r, 5, Number(t2.besaran), { rata: 'right', rupiah: true });
      r++;
    });
    r++;
  });

  const buf = await wb.xlsx.writeBuffer();
  simpan(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
         namaBerkas);
}

// =====================================================================
// B. NILAI EKSTRAKURIKULER PER KELAS
// baris: [{ nis, nama, ekskul, predikat, keterangan, deskripsi }]
// =====================================================================
export async function unduhNilaiKelasXLSX({ kelas, periode, baris, namaBerkas }) {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(kelas.replace(/[\\/*?:[\]]/g, '-'), {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1,
                 margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  });
  ws.columns = [{ width: 5 }, { width: 13 }, { width: 26 }, { width: 20 },
                { width: 9 }, { width: 15 }, { width: 34 }];
  await kop(ws, wb, `NILAI EKSTRAKURIKULER — KELAS ${kelas}`, periode, 7);

  let r = 7;
  barisJudulTabel(ws, r, ['No.', 'NIS', 'Nama Siswa', 'Ekstrakurikuler',
                          'Predikat', 'Keterangan', 'Deskripsi']);
  r++;
  baris.forEach((b, i) => {
    selIsi(ws, r, 1, i + 1, { rata: 'center' });
    selIsi(ws, r, 2, b.nis || '');
    selIsi(ws, r, 3, b.nama);
    selIsi(ws, r, 4, b.ekskul);
    selIsi(ws, r, 5, b.predikat || '', { rata: 'center', tebal: true });
    selIsi(ws, r, 6, b.keterangan || '');
    selIsi(ws, r, 7, b.deskripsi || '', { bungkus: true });
    r++;
  });
  r += 2;
  ws.getCell(r, 5).value = `${SEKOLAH.kota}, .................................`;
  ws.getCell(r + 1, 5).value = 'Wali Kelas,';
  ws.getCell(r + 5, 5).value = '(.............................................)';
  [r, r + 1, r + 5].forEach(x => {
    ws.getCell(x, 5).font = { name: 'Calibri', size: 10, color: { argb: TINTA } };
  });

  const buf = await wb.xlsx.writeBuffer();
  simpan(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
         namaBerkas);
}

// ---- PNG: digambar langsung di canvas, tanpa pustaka luar ------------
export async function unduhNilaiKelasPNG({ kelas, periode, baris, namaBerkas }) {
  const skala = 2;                    // supaya tajam di layar HP
  const lebar = 1000;
  const padding = 40;
  const tinggiKop = 130;
  const tinggiJudul = 44;
  const tinggiBaris = 40;
  const tinggi = tinggiKop + tinggiJudul + baris.length * tinggiBaris + 120;

  const kanvas = document.createElement('canvas');
  kanvas.width = lebar * skala;
  kanvas.height = tinggi * skala;
  const g = kanvas.getContext('2d');
  g.scale(skala, skala);

  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, lebar, tinggi);

  // Logo
  const logo = await new Promise(r => {
    const im = new Image();
    im.onload = () => r(im);
    im.onerror = () => r(null);
    im.src = SEKOLAH.logo;
  });
  if (logo) g.drawImage(logo, padding, 26, 72, 72);

  g.fillStyle = '#241F17';
  g.font = 'bold 24px Georgia, serif';
  g.fillText(SEKOLAH.nama, padding + 92, 50);
  g.fillStyle = '#6B6252';
  g.font = '14px Arial, sans-serif';
  g.fillText(SEKOLAH.alamat, padding + 92, 72);
  g.fillStyle = '#241F17';
  g.font = 'bold 17px Arial, sans-serif';
  g.fillText(`NILAI EKSTRAKURIKULER — KELAS ${kelas}`, padding + 92, 96);
  g.fillStyle = '#6B6252';
  g.font = '13px Arial, sans-serif';
  g.fillText(periode, padding + 92, 114);

  g.strokeStyle = '#C99A2E';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(padding, tinggiKop - 6);
  g.lineTo(lebar - padding, tinggiKop - 6);
  g.stroke();

  const kolom = [
    { t: 'No.', w: 44, rata: 'center' },
    { t: 'Nama Siswa', w: 250 },
    { t: 'Ekstrakurikuler', w: 190 },
    { t: 'Predikat', w: 80, rata: 'center' },
    { t: 'Keterangan', w: 156 },
    { t: 'Deskripsi', w: 200 }
  ];
  let y = tinggiKop + 8;
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

  g.textAlign = 'left';
  g.fillStyle = '#6B6252';
  g.font = '12px Arial, sans-serif';
  g.fillText(`Dicetak dari Aplikasi Absensi Ekstrakurikuler · ${new Date().toLocaleDateString('id-ID')}`,
             padding, y + 34);

  const blob = await new Promise(r => kanvas.toBlob(r, 'image/png'));
  simpan(blob, namaBerkas);
}

function potong(g, teks, maks) {
  let t = String(teks || '');
  if (g.measureText(t).width <= maks) return t;
  while (t.length > 3 && g.measureText(t + '…').width > maks) t = t.slice(0, -1);
  return t + '…';
}

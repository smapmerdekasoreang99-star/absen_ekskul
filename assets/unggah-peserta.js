// Unggah daftar peserta dari berkas XLSX atau CSV — halaman Data peserta.
//
// Prinsip halaman itu — tidak ada nama yang diketik ulang — tetap berlaku.
// Berkas dari luar hanyalah cara memilih banyak siswa sekaligus: setiap
// barisnya dicocokkan ke data siswa sekolah, dan yang tidak ditemukan di
// sana tidak didaftarkan. Yang tersimpan tetap id siswa dari data sekolah,
// bukan tulisan di berkas.
//
// Tiga bagian:
//   1. unduhFormatPeserta  — membuat berkas format kosong (XLSX);
//   2. bacaBerkasPeserta   — membaca XLSX/CSV menjadi baris {nama, kelas};
//   3. cocokkanPeserta     — memutuskan nasib tiap baris tanpa menyentuh
//                            jaringan, supaya mudah diuji.
import { pustakaExcel } from './dokumen.js?v=20260921d';

export const KOLOM = { nama: 'Nama siswa', kelas: 'Kelas' };

// ------------------------------------------------------------- 1. format
export async function unduhFormatPeserta(daftarKelas, namaEkskul) {
  const ExcelJS = await pustakaExcel();
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('Peserta', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: KOLOM.nama,  key: 'nama',  width: 36 },
    { header: KOLOM.kelas, key: 'kelas', width: 14 }
  ];
  const judul = ws.getRow(1);
  judul.font = { bold: true, color: { argb: 'FF241F17' } };
  judul.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F2EA' } };
  judul.border = { bottom: { style: 'thin', color: { argb: 'FFBFB8A8' } } };

  // Kelas dipilih dari daftar supaya ejaannya sama dengan data sekolah.
  // Daftarnya ditaruh di lembar sendiri agar lembar isian tetap bersih.
  if (daftarKelas && daftarKelas.length) {
    const wk = wb.addWorksheet('Daftar kelas');
    wk.columns = [{ header: 'Kelas', width: 14 }];
    wk.getRow(1).font = { bold: true };
    daftarKelas.forEach(k => wk.addRow([k]));
    ws.dataValidations.add('B2:B1000', {
      type: 'list', allowBlank: true, showErrorMessage: false,
      formulae: [`'Daftar kelas'!$A$2:$A$${daftarKelas.length + 1}`]
    });
  }

  const wp = wb.addWorksheet('Petunjuk');
  wp.columns = [{ width: 96 }];
  [
    `Format daftar peserta${namaEkskul ? ' — ' + namaEkskul : ''}`,
    '',
    '1. Isi lembar "Peserta": satu siswa satu baris, mulai baris kedua.',
    `2. Kolom "${KOLOM.nama}" wajib. Tulis sesuai data sekolah; huruf besar-kecil dan tanda baca tidak dipersoalkan.`,
    `3. Kolom "${KOLOM.kelas}" dianjurkan, supaya siswa yang namanya sama tidak tertukar. Bila kosong, dicocokkan dari nama saja selama namanya hanya satu.`,
    '4. Baris judul jangan diubah. Kolom lain, kalau ada, diabaikan.',
    '5. Sebelum disimpan, aplikasi menampilkan hasil pencocokan tiap baris. Siswa yang tidak ditemukan di data sekolah tidak didaftarkan — periksa ejaannya lewat kotak pencarian.',
    '6. Berkas CSV hasil "Unduh daftar peserta" juga bisa diunggah, misalnya untuk menyalin peserta ke kegiatan lain.'
  ].forEach((t, i) => {
    const sel = wp.getCell(i + 1, 1);
    sel.value = t;
    sel.alignment = { wrapText: true, vertical: 'top' };
    if (i === 0) sel.font = { bold: true, size: 12 };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `format_peserta${namaEkskul ? '_' + namaEkskul.replace(/\s+/g, '_') : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ------------------------------------------------------------ 2. membaca
// Mengembalikan { adaKelas, baris: [{ nomor, nama, kelas }] }.
// nomor = nomor baris di lembar, supaya pengguna bisa mencarinya kembali.
export async function bacaBerkasPeserta(berkas) {
  const nama = (berkas.name || '').toLowerCase();
  let tabel;
  if (/\.(csv|txt)$/.test(nama)) tabel = uraiCSV(await berkas.text());
  else if (/\.(xlsx|xlsm)$/.test(nama)) tabel = await uraiXLSX(await berkas.arrayBuffer());
  else if (/\.xls$/.test(nama))
    throw new Error('Berkas .xls (Excel lama) belum didukung. Buka di Excel lalu simpan sebagai .xlsx.');
  else throw new Error('Berkas harus .xlsx atau .csv.');
  return ambilBaris(tabel);
}

async function uraiXLSX(buf) {
  const ExcelJS = await pustakaExcel();
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); }
  catch { throw new Error('Berkas tidak terbaca sebagai Excel. Pastikan berkasnya .xlsx yang utuh.'); }
  // Lembar pertama yang berisi sesuatu; lembar Petunjuk/Daftar kelas dari
  // berkas format ada di belakangnya, jadi tidak ikut terbaca.
  const ws = wb.worksheets.find(w => w.rowCount > 0);
  if (!ws) throw new Error('Berkas Excel itu kosong.');
  const tabel = [];
  ws.eachRow({ includeEmpty: false }, row => {
    const sel = [];
    row.eachCell({ includeEmpty: true }, (c, i) => { sel[i - 1] = teksSel(c.value); });
    tabel.push(Array.from(sel, x => x === undefined ? '' : x));
  });
  return tabel;
}

// Nilai sel ExcelJS bisa berupa teks, angka, tanggal, teks kaya, tautan,
// atau rumus beserta hasilnya. Semuanya diratakan jadi teks.
function teksSel(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('').trim();
    if ('result' in v) return teksSel(v.result);
    if ('text' in v) return teksSel(v.text);
    if ('error' in v) return '';
    return '';
  }
  return String(v).trim();
}

// CSV: pemisah ; (keluaran aplikasi ini dan Excel Indonesia), koma, atau tab.
// Tanda kutip ganda mengikuti aturan lazim, termasuk "" di dalam teks.
export function uraiCSV(teks) {
  const isi = teks.replace(/^﻿/, '');
  const awal = isi.split(/\r?\n/, 1)[0] || '';
  const pemisah = [';', ',', '\t']
    .map(p => [p, (awal.match(new RegExp(p === '\t' ? '\t' : '\\' + p, 'g')) || []).length])
    .sort((a, b) => b[1] - a[1])[0][0];

  const tabel = [];
  let baris = [], sel = '', dalamKutip = false;
  for (let i = 0; i < isi.length; i++) {
    const ch = isi[i];
    if (dalamKutip) {
      if (ch === '"') {
        if (isi[i + 1] === '"') { sel += '"'; i++; }
        else dalamKutip = false;
      } else sel += ch;
    } else if (ch === '"') dalamKutip = true;
    else if (ch === pemisah) { baris.push(sel.trim()); sel = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && isi[i + 1] === '\n') i++;
      baris.push(sel.trim()); sel = '';
      tabel.push(baris); baris = [];
    } else sel += ch;
  }
  baris.push(sel.trim());
  tabel.push(baris);
  return tabel.filter(b => b.some(x => x !== ''));
}

// Mencari baris judul, lalu mengambil kolom nama dan kelas dari bawahnya.
// Judulnya dikenali dari isinya, bukan dari nomor barisnya, jadi berkas
// yang diberi judul dokumen di atas tabel tetap terbaca.
export function ambilBaris(tabel) {
  const kunci = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  let iJudul = -1, kNama = -1, kKelas = -1;
  for (let i = 0; i < Math.min(tabel.length, 30) && iJudul < 0; i++) {
    const k = tabel[i].map(kunci);
    let n = k.findIndex(x => x === 'namasiswa' || x === 'nama');
    if (n < 0) n = k.findIndex(x => x.includes('nama'));
    if (n < 0) continue;
    iJudul = i; kNama = n;
    kKelas = k.findIndex(x => x === 'kelas' || x === 'rombel');
    if (kKelas < 0) kKelas = k.findIndex((x, j) => j !== n && x.includes('kelas'));
  }
  if (iJudul < 0)
    throw new Error(`Baris judul tidak ditemukan. Baris pertama tabel harus memuat kolom "${KOLOM.nama}" ` +
                    `(dan sebaiknya "${KOLOM.kelas}"). Unduh formatnya bila ragu.`);
  const baris = [];
  for (let i = iJudul + 1; i < tabel.length; i++) {
    const nama = (tabel[i][kNama] || '').trim();
    if (!nama) continue;
    baris.push({ nomor: i + 1, nama, kelas: kKelas >= 0 ? (tabel[i][kKelas] || '').trim() : '' });
  }
  if (!baris.length) throw new Error('Tidak ada nama siswa di bawah baris judul.');
  return { adaKelas: kKelas >= 0, baris };
}

// --------------------------------------------------------- 3. mencocokkan
// Huruf besar-kecil, tanda baca, dan spasi ganda tidak membedakan nama.
// Kelas dibandingkan tanpa pemisah: "X-1", "X 1", dan "X.1" dianggap sama.
export const kunciNama  = s => String(s || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export const kunciKelas = s => String(s || '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');

// baris        : hasil bacaBerkasPeserta().baris
// siswaSekolah : seluruh siswa aktif [{ id, nama, kelas }]
// idTerdaftar  : id siswa yang sudah jadi peserta kegiatan ini
// Mengembalikan baris yang sama ditambah status dan, bila cocok, siswa-nya:
//   baru   akan didaftarkan
//   sudah  sudah terdaftar — dilewati
//   ulang  siswa yang sama ditulis lagi di baris sebelumnya — dilewati
//   ganda  lebih dari satu siswa cocok — perlu kelas, atau lewat pencarian
//   tidak  tidak ada di data sekolah
export function cocokkanPeserta(baris, siswaSekolah, idTerdaftar) {
  const perNama = new Map();
  siswaSekolah.forEach(s => {
    const k = kunciNama(s.nama);
    if (!perNama.has(k)) perNama.set(k, []);
    perNama.get(k).push(s);
  });
  const terdaftar = new Set(idTerdaftar || []);
  const dipilih = new Set();

  return baris.map(b => {
    const kandidat = perNama.get(kunciNama(b.nama)) || [];
    const kk = kunciKelas(b.kelas);
    let cocok = kk ? kandidat.filter(s => kunciKelas(s.kelas) === kk) : kandidat;
    let keterangan = '';

    // Kelas di berkas tidak cocok, tetapi nama itu hanya milik satu siswa:
    // kemungkinan besar berkasnya dari tahun lalu atau siswanya pindah
    // kelas. Diterima, dengan catatan supaya terlihat.
    if (kk && !cocok.length && kandidat.length === 1) {
      cocok = kandidat;
      keterangan = `Di data sekolah kelas ${kandidat[0].kelas}`;
    }

    if (!cocok.length)
      return { ...b, status: 'tidak',
               keterangan: kandidat.length ? 'Nama ada, tetapi kelasnya tidak cocok' : 'Tidak ada di data siswa' };
    if (cocok.length > 1)
      return { ...b, status: 'ganda',
               keterangan: `${cocok.length} siswa bernama sama` + (kk ? ' di kelas itu' : ' — isi kelasnya') };

    const s = cocok[0];
    if (terdaftar.has(s.id)) return { ...b, siswa: s, status: 'sudah', keterangan: 'Sudah terdaftar' };
    if (dipilih.has(s.id))   return { ...b, siswa: s, status: 'ulang', keterangan: 'Ditulis dua kali di berkas' };
    dipilih.add(s.id);
    return { ...b, siswa: s, status: 'baru', keterangan };
  });
}

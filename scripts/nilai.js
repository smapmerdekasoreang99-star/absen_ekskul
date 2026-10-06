import { ambilMaster, pesertaEkskul, daftarPeriode, simpanPeriode, ubahStatusPeriode,
         ambilNilai, simpanNilai, kehadiranPerSiswa,
         nilaiSeluruhPeriode, ambilPengaturan } from '../assets/db.js?v=20260928d';
import { wajibMasuk, ekskulBoleh, adalahPengelola, tandaiMode, laporError, sukses,
         bersihkanPesan, tanggalPanjang, persen,
         kategoriDari, perKategori, urutKelasNama, pembimbingDari } from '../assets/ui.js?v=20260929f';
import { unduhNilaiKelasXLSX, gambarNilaiKelas, kanvasKeBlob, simpanKanvasPNG,
         pakaiIdentitas, unduhTabelXLSX, ttdKegiatan } from '../assets/dokumen.js?v=20261006a';

const el = id => document.getElementById(id);
const PREDIKAT = { A: 'Sangat Baik', B: 'Baik', C: 'Cukup', D: 'Perlu Bimbingan' };

let AKUN = null, EKSKUL = [], PEMBINA_NAMA = {}, PERIODE = [], aktif = null;
let SISWA = [], HADIR = {}, NILAI = {};

AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    PEMBINA_NAMA = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    EKSKUL = ekskulBoleh(AKUN, m.ekskul.filter(e => e.aktif !== false));
    if (!EKSKUL.length) {
      laporError('Belum ada ekstrakurikuler atas nama Anda.');
      return;
    }
    // Dikelompokkan supaya pembina tidak keliru mengisi nilai Tahfidz sebagai
    // nilai ekskul, dan sebaliknya.
    el('pilihEkskul').innerHTML = perKategori(EKSKUL).map(([kategori, isi]) =>
      `<optgroup label="${kategori}">` + isi.map(e =>
        `<option value="${e.id}">${e.nama} — ${e.hari}</option>`).join('') + '</optgroup>').join('');
    el('pilihEkskul').addEventListener('change', muatSiswa);
    el('tombolSimpan').addEventListener('click', simpan);
    el('terapkan').addEventListener('click', terapkanMassal);
    el('unduhNilai').addEventListener('click', unduh);
    if (adalahPengelola()) {
      el('tabNilai').classList.remove('sembunyi');
      el('tabNilai').addEventListener('click', gantiTab);
      el('pilihKelas').addEventListener('change', gambarKelas);
      el('kategoriKelas').addEventListener('change', gambarKelas);
      el('unduhKelasXlsx').addEventListener('click', unduhKelas);
      pasangKirimWali();
      el('unduhSemuaKelas').addEventListener('click', unduhSemuaKelas);
    }

    if (adalahPengelola()) {
      el('pilihPeriode').addEventListener('change', isiFormPeriode);
      el('simpanPeriode').addEventListener('click', simpanFormPeriode);
      el('tombolBuka').addEventListener('click', bukaTutup);
    }

    // Identitas dokumen dan periode tidak saling bergantung: serentak.
    const [pengaturan] = await Promise.all([
      ambilPengaturan().catch(e => { console.warn('Pengaturan dokumen belum terbaca:', e.message); return null; }),
      muatPeriode()
    ]);
    if (pengaturan) pakaiIdentitas(pengaturan);
    await muatSiswa();
  } catch (e) { laporError(e); }
})();

// -------------------------------------------------------------- periode
async function muatPeriode() {
  PERIODE = await daftarPeriode();
  aktif = PERIODE.find(p => p.dibuka) || PERIODE[0] || null;

  if (adalahPengelola()) {
    el('pilihPeriode').innerHTML = '<option value="">— periode baru —</option>' +
      PERIODE.map(p => `<option value="${p.id}">${p.tahun_ajaran} · ${p.semester}` +
        `${p.dibuka ? ' (dibuka)' : ''}</option>`).join('');
    if (aktif) { el('pilihPeriode').value = aktif.id; isiFormPeriode(); }
  }
  gambarInfoPeriode();
}

function isiFormPeriode() {
  const p = PERIODE.find(x => String(x.id) === el('pilihPeriode').value);
  el('tahunAjaran').value = p ? p.tahun_ajaran : '';
  el('semester').value = p ? p.semester : 'Ganjil';
  el('mulai').value = p ? p.tanggal_mulai : '';
  el('selesai').value = p ? p.tanggal_selesai : '';
  el('catatanPeriode').value = p ? (p.catatan || '') : '';
  el('tombolBuka').textContent = p && p.dibuka ? 'Tutup pengisian' : 'Buka pengisian';
  el('tombolBuka').disabled = !p;
}

function gambarInfoPeriode() {
  const info = el('infoPeriode');
  if (!aktif) {
    info.innerHTML = '<span class="lencana l-tidak">Belum ada periode</span> ' +
      'Kesiswaan belum menyiapkan periode penilaian.';
  } else {
    info.innerHTML =
      `<strong>${aktif.tahun_ajaran} · Semester ${aktif.semester}</strong> · ` +
      `${tanggalPanjang(aktif.tanggal_mulai)} – ${tanggalPanjang(aktif.tanggal_selesai)}<br>` +
      (aktif.dibuka
        ? '<span class="lencana l-hadir">Pengisian dibuka</span>'
        : '<span class="lencana l-tidak">Pengisian ditutup</span>') +
      (aktif.catatan ? ' ' + aktif.catatan : '');
  }
  const bisa = !!aktif && aktif.dibuka;
  el('barSimpan').style.display = bisa ? 'flex' : 'none';
  el('alatMassal').querySelectorAll('select,button').forEach(x => {
    if (x.id !== 'unduhNilai') x.disabled = !bisa;
  });
  document.body.classList.toggle('ada-bar', bisa);
}

async function simpanFormPeriode() {
  bersihkanPesan();
  const baris = {
    tahun_ajaran: el('tahunAjaran').value.trim(),
    semester: el('semester').value,
    tanggal_mulai: el('mulai').value,
    tanggal_selesai: el('selesai').value,
    catatan: el('catatanPeriode').value.trim()
  };
  if (!baris.tahun_ajaran || !baris.tanggal_mulai || !baris.tanggal_selesai) {
    laporError('Tahun ajaran serta tanggal mulai dan selesai wajib diisi.'); return;
  }
  if (baris.tanggal_mulai > baris.tanggal_selesai) {
    laporError('Tanggal mulai melewati tanggal selesai.'); return;
  }
  try {
    const lama = PERIODE.find(x => String(x.id) === el('pilihPeriode').value);
    if (lama) baris.dibuka = lama.dibuka;
    await simpanPeriode(baris);
    try { pakaiIdentitas(await ambilPengaturan()); }
    catch (e) { console.warn('Pengaturan dokumen belum terbaca:', e.message); }

    await muatPeriode();
    await muatSiswa();
    sukses('Periode penilaian tersimpan.');
  } catch (e) { laporError(e); }
}

async function bukaTutup() {
  bersihkanPesan();
  const p = PERIODE.find(x => String(x.id) === el('pilihPeriode').value);
  if (!p) { laporError('Simpan periodenya dulu.'); return; }
  const jadi = !p.dibuka;
  if (!confirm(jadi
    ? `Buka pengisian nilai ${p.tahun_ajaran} semester ${p.semester}? Pembina akan bisa mengisi.`
    : `Tutup pengisian nilai ${p.tahun_ajaran} semester ${p.semester}? Pembina tidak bisa mengubah lagi.`)) return;
  try {
    await ubahStatusPeriode(p.id, jadi);
    await muatPeriode();
    sukses(jadi ? 'Pengisian nilai dibuka.' : 'Pengisian nilai ditutup.');
  } catch (e) { laporError(e); }
}

// ---------------------------------------------------------------- siswa
async function muatSiswa() {
  bersihkanPesan();
  const id = el('pilihEkskul').value;
  if (!id) return;
  el('daftarNilai').innerHTML = '<p class="kosong">Memuat…</p>';
  try {
    // Ketiganya hanya butuh kegiatan dan periode — diminta serentak.
    [SISWA, HADIR, NILAI] = await Promise.all([
      pesertaEkskul(id, { cepat: true }),
      aktif ? kehadiranPerSiswa(id, aktif.tanggal_mulai, aktif.tanggal_selesai) : {},
      aktif ? ambilNilai(aktif.id, id) : {}
    ]);
    gambar();
  } catch (e) { laporError(e); }
}

function gambar() {
  const kotak = el('daftarNilai');
  if (!SISWA.length) {
    kotak.innerHTML = '<p class="kosong">Belum ada peserta terdaftar di ekstrakurikuler ini.</p>';
    hitung(); return;
  }
  const bisa = !!aktif && aktif.dibuka;
  kotak.innerHTML = SISWA.map(s => {
    const h = HADIR[s.id] || { H: 0, total: 0 };
    const p = persen(h.H, h.total);
    const warna = h.total === 0 ? 'l-libur' : p >= 80 ? 'l-hadir' : p >= 60 ? 'l-ganti' : 'l-tidak';
    const n = NILAI[s.id] || {};
    return `
      <div class="nilai-siswa" data-siswa="${s.id}">
        <div class="nilai-kepala">
          <span class="nama">${s.nama}<small>${s.kelas || ''}</small></span>
          <span class="lencana ${warna}">${h.total ? p + '%' : 'belum ada data'}</span>
        </div>
        <div class="nilai-isian">
          <select class="predikat" ${bisa ? '' : 'disabled'} aria-label="Nilai ${s.nama}">
            <option value="">Nilai…</option>
            ${Object.entries(PREDIKAT).map(([k, v]) =>
              `<option value="${k}"${n.predikat === k ? ' selected' : ''}>${k} — ${v}</option>`).join('')}
          </select>
          <input class="deskripsi" type="text" ${bisa ? '' : 'disabled'}
            placeholder="Deskripsi singkat untuk rapor"
            aria-label="Deskripsi ${s.nama}" value="${(n.deskripsi || '').replace(/"/g, '&quot;')}">
        </div>
      </div>`;
  }).join('');

  kotak.querySelectorAll('.nilai-siswa').forEach(baris => {
    baris.querySelector('.predikat').addEventListener('change', hitung);
    baris.querySelector('.deskripsi').addEventListener('input', hitung);
  });
  hitung();
}

function kumpulkan() {
  return [...document.querySelectorAll('.nilai-siswa')].map(b => ({
    siswa_id: b.dataset.siswa,
    predikat: b.querySelector('.predikat').value,
    deskripsi: b.querySelector('.deskripsi').value.trim()
  }));
}

function hitung() {
  const isi = kumpulkan();
  const terisi = isi.filter(x => x.predikat).length;
  el('hitungTerisi').textContent = terisi + ' terisi';
  el('hitungDari').textContent = `dari ${isi.length} siswa`;
}

function terapkanMassal() {
  const nilai = el('predikatMassal').value;
  if (!nilai) { laporError('Pilih dulu nilai yang mau diterapkan.'); return; }
  document.querySelectorAll('.nilai-siswa .predikat').forEach(s => {
    if (!s.value) s.value = nilai;
  });
  hitung();
}

async function simpan() {
  bersihkanPesan();
  if (!aktif || !aktif.dibuka) { laporError('Pengisian nilai sedang ditutup.'); return; }
  const isi = kumpulkan().filter(x => x.predikat || x.deskripsi);
  if (!isi.length) { laporError('Belum ada nilai yang diisi.'); return; }
  const tombol = el('tombolSimpan');
  tombol.disabled = true;
  tombol.textContent = 'Menyimpan…';
  try {
    await simpanNilai(aktif.id, el('pilihEkskul').value, isi, AKUN.nama);
    NILAI = await ambilNilai(aktif.id, el('pilihEkskul').value);
    sukses(`${isi.filter(x => x.predikat).length} nilai tersimpan.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Simpan nilai';
  }
}

/* Daftar nilai satu kegiatan, berkop Profil Dokumen dan ditandatangani
   pembinanya. Isinya yang tampak di layar, termasuk yang belum disimpan. */
async function unduh() {
  bersihkanPesan();
  if (!SISWA.length) { laporError('Belum ada peserta untuk diunduh.'); return; }
  const e = EKSKUL.find(x => x.id === el('pilihEkskul').value);
  if (!e) return;
  const isi = Object.fromEntries(kumpulkan().map(x => [x.siswa_id, x]));
  // Semua pembimbing kegiatan (kegiatan bersama bisa lebih dari satu); nama
  // akun dipakai bila daftar namanya tidak termuat.
  const daftarPembina = pembimbingDari(e).map(id => PEMBINA_NAMA[id]).filter(Boolean);
  if (!daftarPembina.length && AKUN.peran === 'pembina') daftarPembina.push(AKUN.nama);
  const pembina = daftarPembina.join(', ');
  const periode = aktif ? `Tahun Pelajaran ${aktif.tahun_ajaran} · Semester ${aktif.semester}` : '';
  const tombol = el('unduhNilai'), semula = tombol.textContent;
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    await unduhTabelXLSX({
      judul: `DAFTAR NILAI ${kategoriDari(e).toUpperCase()}`,
      sub: [e.nama, periode].filter(Boolean).join(' · '),
      lembar: 'Daftar Nilai',
      melintang: true,
      keterangan: [['Kegiatan', `${e.nama} (${kategoriDari(e)})`], ['Pembina', pembina || '—'],
                   ...(aktif ? [['Periode', `${tanggalPanjang(aktif.tanggal_mulai)} – ${tanggalPanjang(aktif.tanggal_selesai)}`]] : [])],
      kolom: [
        { t: 'No.', w: 5, rata: 'center' }, { t: 'Nama Siswa', w: 30 }, { t: 'Kelas', w: 9, rata: 'center' },
        { t: 'Pertemuan', w: 11, rata: 'center' }, { t: 'Hadir', w: 8, rata: 'center' },
        { t: '% Kehadiran', w: 12, rata: 'center' }, { t: 'Nilai', w: 8, rata: 'center' },
        { t: 'Keterangan', w: 16 }, { t: 'Deskripsi', w: 44, bungkus: true }
      ],
      baris: [...SISWA].sort(urutKelasNama).map((s, i) => {
        const h = HADIR[s.id] || { H: 0, total: 0 };
        const n = isi[s.id] || {};
        return [i + 1, s.nama, s.kelas || '', h.total, h.H, h.total ? persen(h.H, h.total) + '%' : '—',
                n.predikat || '', PREDIKAT[n.predikat] || '', n.deskripsi || ''];
      }),
      ttd: ttdKegiatan(e.nama, daftarPembina, { jabatan: `Pembina ${e.nama},` }),
      namaBerkas: `daftar_nilai_${String(e.nama).replace(/[^\w-]+/g, '_')}${
        aktif ? '_' + aktif.tahun_ajaran.replace('/', '-') + '_' + aktif.semester : ''}.xlsx`
    });
  } catch (err) { laporError(err); }
  finally { tombol.disabled = false; tombol.textContent = semula; }
}

// ================================================= REKAP NILAI PER KELAS
let KELAS = {};          // { kelas: [ {nama,ekskul,predikat,keterangan,deskripsi} ] }
let kelasSiap = false;

function gantiTab(ev) {
  const b = ev.target.closest('button');
  if (!b) return;
  [...el('tabNilai').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  const keKelas = b.dataset.tab === 'kelas';
  el('layarIsi').classList.toggle('sembunyi', keKelas);
  el('layarKelas').classList.toggle('sembunyi', !keKelas);
  el('barSimpan').style.display = keKelas ? 'none' : (aktif && aktif.dibuka ? 'flex' : 'none');
  document.body.classList.toggle('ada-bar', !keKelas && !!aktif && aktif.dibuka);
  if (keKelas && !kelasSiap) susunKelas();
}

async function susunKelas() {
  bersihkanPesan();
  if (!aktif) { laporError('Belum ada periode penilaian.'); return; }
  el('tabelKelas').innerHTML = '<tbody><tr><td class="kosong">Menyusun data…</td></tr></tbody>';
  try {
    const nilaiSemua = await nilaiSeluruhPeriode(aktif.id);
    KELAS = {};
    // Peserta seluruh kegiatan diminta serentak — dulu satu per satu,
    // enam belas perjalanan bergiliran untuk enam belas kegiatan.
    const pesertaPer = await Promise.all(EKSKUL.map(e => pesertaEkskul(e.id, { cepat: true })));
    for (const [i, e] of EKSKUL.entries()) {
      const peserta = pesertaPer[i];
      const nilai = nilaiSemua[e.id] || {};
      peserta.forEach(s => {
        const k = s.kelas || 'Tanpa kelas';
        const n = nilai[s.id] || {};
        (KELAS[k] || (KELAS[k] = [])).push({
          pembina: PEMBINA_NAMA[e.pembina_id] || '',
          nama: s.nama, ekskul: e.nama, kategori: kategoriDari(e),
          predikat: n.predikat || '', keterangan: PREDIKAT[n.predikat] || '',
          deskripsi: n.deskripsi || ''
        });
      });
    }
    Object.values(KELAS).forEach(d => d.sort((a, b) =>
      String(a.nama).localeCompare(String(b.nama), 'id') || a.ekskul.localeCompare(b.ekskul, 'id')));
    const daftar = Object.keys(KELAS).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    // Jumlah barisnya tergantung kategori yang sedang dipilih, jadi angkanya
    // ditampilkan di keterangan tabel, bukan di nama kelas.
    el('pilihKelas').innerHTML = daftar.length
      ? daftar.map(k => `<option value="${k}">${k}</option>`).join('')
      : '<option value="">Belum ada peserta</option>';
    kelasSiap = true;
    gambarKelas();
  } catch (e) { laporError(e); }
}

// Baris satu kelas sesudah disaring kategori. Rapor hanya memakai kategori
// Ekstrakurikuler, jadi penyaringnya bawaan ke situ.
function kategoriKelas() { return el('kategoriKelas').value; }
function barisKelas() {
  const isi = KELAS[el('pilihKelas').value] || [];
  const k = kategoriKelas();
  return k ? isi.filter(x => x.kategori === k) : isi;
}

function gambarKelas() {
  const k = el('pilihKelas').value;
  const isi = barisKelas();
  const kat = kategoriKelas();
  el('judulKelas').textContent = k ? `Kelas ${k}` : 'Daftar';
  const belum = isi.filter(x => !x.predikat).length;
  el('ketKelas').textContent = isi.length
    ? `${kat || 'Semua kategori'} · ${isi.length} baris nilai${belum ? ` · ${belum} belum diisi pembina` : ' · seluruhnya sudah diisi'}`
    : `Belum ada peserta ${kat ? `berkategori ${kat} ` : ''}pada kelas ini.`;
  const t = el('tabelKelas');
  if (!isi.length) {
    t.innerHTML = '<tbody><tr><td class="kosong">Belum ada data.</td></tr></tbody>';
    return;
  }
  t.innerHTML = `
    <thead><tr><th class="angka">No.</th><th>Nama Siswa</th>
      <th>Kegiatan</th><th class="angka">Nilai</th><th>Keterangan</th><th>Deskripsi</th></tr></thead>
    <tbody>${isi.map((x, i) => `<tr>
      <td class="angka">${i + 1}</td><td>${x.nama}</td>
      <td>${x.ekskul}${kat ? '' : `<small class="ket">${x.kategori}</small>`}</td>
      <td class="angka">${x.predikat
        ? '<span class="lencana l-hadir">' + x.predikat + '</span>'
        : '<span class="lencana l-tidak">—</span>'}</td>
      <td>${x.keterangan}</td><td>${x.deskripsi}</td></tr>`).join('')}</tbody>`;
}

function labelPeriode() {
  return `${aktif.tahun_ajaran} · Semester ${aktif.semester}`;
}

async function unduhKelas() {
  bersihkanPesan();
  const k = el('pilihKelas').value;
  const isi = barisKelas();
  if (!isi.length) { laporError('Belum ada data pada kelas ini.'); return; }
  const judulKategori = (kategoriKelas() || 'Kegiatan').toUpperCase();
  const berkas = 'nilai_' + (kategoriKelas() || 'kegiatan').toLowerCase().replace(/\s+/g, '_');
  const tombol = el('unduhKelasXlsx');
  const semula = tombol.textContent;
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    const pembina = [...new Set(isi.map(x => x.pembina).filter(Boolean))];
    const arg = { kelas: k, periode: labelPeriode(), baris: isi, judulKategori,
                  pembina: pembina.length === 1 ? pembina[0] : '' };
    await unduhNilaiKelasXLSX({ ...arg, namaBerkas: `${berkas}_${k}.xlsx` });
    sukses('Berkas diunduh.');
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = semula;
  }
}

async function unduhSemuaKelas() {
  bersihkanPesan();
  const kat = kategoriKelas();
  const saring = (rows) => kat ? rows.filter(x => x.kategori === kat) : rows;
  const judulKategori = (kat || 'Kegiatan').toUpperCase();
  const berkas = 'nilai_' + (kat || 'kegiatan').toLowerCase().replace(/\s+/g, '_');
  // Kelas yang tidak punya peserta pada kategori ini dilewati, supaya tidak
  // terunduh berkas kosong.
  const daftar = Object.keys(KELAS).filter(k => saring(KELAS[k]).length);
  if (!daftar.length) { laporError('Belum ada data pada kategori ini.'); return; }
  const tombol = el('unduhSemuaKelas');
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    for (const k of daftar) {
      const isi = saring(KELAS[k]);
      const p = [...new Set(isi.map(x => x.pembina).filter(Boolean))];
      await unduhNilaiKelasXLSX({
        kelas: k, periode: labelPeriode(), baris: isi, judulKategori,
        pembina: p.length === 1 ? p[0] : '',
        namaBerkas: `${berkas}_${k}.xlsx`
      });
      await new Promise(r => setTimeout(r, 400));   // jeda agar unduhan tidak diblokir
    }
    sukses(`${daftar.length} berkas kelas diunduh.`);
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Unduh semua kelas';
  }
}

// ============================================ KIRIM KE WALI KELAS (WhatsApp)
// Mengikuti "Bagikan ke WhatsApp" di Kehadiran Guru: pratinjau gambar, lalu
// dibagikan langsung (HP) atau diunduh (komputer). Kelas dan kategorinya
// sama dengan pilihan di atas tabel.
let WA = { kanvas: null, teks: '', berkas: '' };

function pasangKirimWali() {
  const d = el('dialogWA');
  el('kirimWali').addEventListener('click', bukaKirimWali);
  el('tutupWA').addEventListener('click', () => d.close());
  // Ketuk di luar panel menutupnya.
  d.addEventListener('click', ev => { if (ev.target === d) d.close(); });
  el('waBagikan').addEventListener('click', bagikanGambar);
  el('unduhKelasPng').addEventListener('click', async () => {
    try { await simpanKanvasPNG(WA.kanvas, WA.berkas); catatanWA('Gambar diunduh.'); }
    catch (e) { catatanWA('Gagal mengunduh gambar: ' + (e.message || e), true); }
  });
  el('waSalin').addEventListener('click', async ev => {
    const b = ev.currentTarget;
    try {
      await navigator.clipboard.writeText(WA.teks);
      b.textContent = 'Teks tersalin ✓';
      setTimeout(() => (b.textContent = 'Salin teks'), 1800);
    } catch (e) { catatanWA('Teks tidak bisa disalin di peramban ini.', true); }
  });
  el('waTeks').addEventListener('click', () =>
    window.open('https://wa.me/?text=' + encodeURIComponent(WA.teks), '_blank'));
}

async function bukaKirimWali() {
  bersihkanPesan();
  const k = el('pilihKelas').value;
  const isi = barisKelas();
  if (!k || !isi.length) { laporError('Belum ada data pada kelas ini.'); return; }
  const kat = kategoriKelas();
  const belum = isi.filter(x => !x.predikat).length;
  el('judulWA').textContent = `Kirim ke Wali Kelas ${k}`;
  const info = el('infoWA');
  info.textContent = `${kat || 'Semua kategori'} · ${isi.length} baris nilai` +
    (belum ? ` · ${belum} belum diisi pembina` : ' · seluruhnya sudah diisi');
  info.classList.toggle('peringatan', belum > 0);
  el('catatanWA').hidden = true;
  WA = { kanvas: null, teks: teksWA(k, kat, isi),
         berkas: `nilai_${(kat || 'kegiatan').toLowerCase().replace(/\s+/g, '_')}_${k}.png` };

  const tombol = el('kirimWali'), semula = tombol.textContent;
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    WA.kanvas = await gambarNilaiKelas({ kelas: k, periode: labelPeriode(), baris: isi,
                                         judulKategori: (kat || 'Kegiatan').toUpperCase() });
    const v = el('kanvasWA');
    v.width = WA.kanvas.width; v.height = WA.kanvas.height;
    v.getContext('2d').drawImage(WA.kanvas, 0, 0);
    el('dialogWA').showModal();
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = semula;
  }
}

// Teks cadangan bila gambar tidak bisa dilampirkan: per siswa, kegiatannya
// berderet di bawah namanya.
function teksWA(kelas, kat, isi) {
  const baris = [`*NILAI ${(kat || 'Kegiatan').toUpperCase()} — KELAS ${kelas}*`,
                 `Tahun Pelajaran ${labelPeriode()}`, ''];
  let no = 0, nama = null;
  isi.forEach(x => {
    if (x.nama !== nama) { nama = x.nama; baris.push(`${++no}. ${x.nama}`); }
    baris.push(`    ${x.ekskul}: ${x.predikat ? `*${x.predikat}*` + (x.keterangan ? ` (${x.keterangan})` : '') : 'belum dinilai'}`);
  });
  baris.push('', '_Dikirim oleh Admin Kesiswaan, sah untuk digunakan sebagai nilai rapor._');
  return baris.join('\n');
}

async function bagikanGambar() {
  try {
    const berkas = new File([await kanvasKeBlob(WA.kanvas)], WA.berkas, { type: 'image/png' });
    const bisa = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [berkas] });
    if (bisa) {
      await navigator.share({ files: [berkas], title: el('judulWA').textContent });
    } else {
      await simpanKanvasPNG(WA.kanvas, WA.berkas);
      catatanWA('Peramban ini belum bisa membagikan gambar langsung, jadi gambarnya diunduh. ' +
        'Lampirkan berkas tersebut di chat wali kelas. (Di HP, tombol ini biasanya langsung membuka WhatsApp.)');
    }
  } catch (e) {
    if (e && e.name !== 'AbortError') catatanWA('Gagal membagikan gambar: ' + (e.message || e), true);
  }
}

function catatanWA(teks, salah = false) {
  const c = el('catatanWA');
  c.textContent = teks;
  c.classList.toggle('peringatan', salah);
  c.hidden = false;
}

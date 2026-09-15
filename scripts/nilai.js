import { ambilMaster, pesertaEkskul, daftarPeriode, simpanPeriode, ubahStatusPeriode,
         ambilNilai, simpanNilai, kehadiranPerSiswa, kehadiranSemua,
         nilaiSeluruhPeriode, ambilPengaturan } from '../assets/db.js?v=20260913h';
import { wajibMasuk, ekskulBoleh, adalahPengelola, tandaiMode, laporError, sukses,
         bersihkanPesan, tanggalPanjang, persen, unduhCSV } from '../assets/ui.js?v=20260913h';
import { unduhNilaiKelasXLSX, unduhNilaiKelasPNG, pakaiIdentitas }
  from '../assets/dokumen.js?v=20260913h';

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
    el('pilihEkskul').innerHTML = EKSKUL.map(e =>
      `<option value="${e.id}">${e.nama} — ${e.hari}</option>`).join('');
    el('pilihEkskul').addEventListener('change', muatSiswa);
    el('tombolSimpan').addEventListener('click', simpan);
    el('terapkan').addEventListener('click', terapkanMassal);
    el('unduhNilai').addEventListener('click', unduh);
    if (adalahPengelola()) {
      el('unduhSemua').addEventListener('click', unduhSemua);
      el('tabNilai').classList.remove('sembunyi');
      el('tabNilai').addEventListener('click', gantiTab);
      el('pilihKelas').addEventListener('change', gambarKelas);
      el('unduhKelasXlsx').addEventListener('click', () => unduhKelas('xlsx'));
      el('unduhKelasPng').addEventListener('click', () => unduhKelas('png'));
      el('unduhSemuaKelas').addEventListener('click', unduhSemuaKelas);
    }

    if (adalahPengelola()) {
      el('pilihPeriode').addEventListener('change', isiFormPeriode);
      el('simpanPeriode').addEventListener('click', simpanFormPeriode);
      el('tombolBuka').addEventListener('click', bukaTutup);
    }

    try { pakaiIdentitas(await ambilPengaturan()); }
    catch (e) { console.warn('Pengaturan dokumen belum terbaca:', e.message); }

    await muatPeriode();
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
    if (x.id !== 'unduhNilai' && x.id !== 'unduhSemua') x.disabled = !bisa;
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
    SISWA = await pesertaEkskul(id);
    HADIR = aktif ? await kehadiranPerSiswa(id, aktif.tanggal_mulai, aktif.tanggal_selesai) : {};
    NILAI = aktif ? await ambilNilai(aktif.id, id) : {};
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
          <select class="predikat" ${bisa ? '' : 'disabled'} aria-label="Predikat ${s.nama}">
            <option value="">Predikat…</option>
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
  if (!nilai) { laporError('Pilih dulu predikat yang mau diterapkan.'); return; }
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

function unduh() {
  if (!SISWA.length) { laporError('Belum ada peserta untuk diunduh.'); return; }
  const e = EKSKUL.find(x => x.id === el('pilihEkskul').value);
  const isi = Object.fromEntries(kumpulkan().map(x => [x.siswa_id, x]));
  unduhCSV(`nilai_${(e ? e.nama : 'ekskul').replace(/\s+/g, '_')}.csv`, [
    ['NIS', 'Nama siswa', 'Kelas', 'Pertemuan', 'Hadir', '% Kehadiran', 'Predikat', 'Keterangan', 'Deskripsi'],
    ...SISWA.map(s => {
      const h = HADIR[s.id] || { H: 0, total: 0 };
      const n = isi[s.id] || {};
      return [s.nis || '', s.nama, s.kelas || '', h.total, h.H, persen(h.H, h.total),
              n.predikat || '', PREDIKAT[n.predikat] || '', n.deskripsi || ''];
    })
  ]);
}

// Rekap nilai seluruh ekstrakurikuler dalam satu berkas, untuk kesiswaan.
async function unduhSemua() {
  bersihkanPesan();
  if (!aktif) { laporError('Belum ada periode penilaian.'); return; }
  const tombol = el('unduhSemua');
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    const [hadirSemua, nilaiSemua] = await Promise.all([
      kehadiranSemua(aktif.tanggal_mulai, aktif.tanggal_selesai),
      nilaiSeluruhPeriode(aktif.id)
    ]);
    const baris = [];
    for (const e of EKSKUL) {
      const peserta = await pesertaEkskul(e.id);
      const hadir = hadirSemua[e.id] || {};
      const nilai = nilaiSemua[e.id] || {};
      peserta.forEach(s => {
        const h = hadir[s.id] || { H: 0, total: 0 };
        const n = nilai[s.id] || {};
        baris.push([e.nama, PEMBINA_NAMA[e.pembina_id] || '', s.nis || '', s.nama, s.kelas || '',
                    h.total, h.H, persen(h.H, h.total), n.predikat || '',
                    PREDIKAT[n.predikat] || '', n.deskripsi || '']);
      });
    }
    if (!baris.length) { laporError('Belum ada peserta yang terdaftar.'); return; }
    unduhCSV(`nilai_semua_ekskul_${aktif.tahun_ajaran.replace('/', '-')}_${aktif.semester}.csv`, [
      ['Ekstrakurikuler', 'Pembina', 'NIS', 'Nama siswa', 'Kelas', 'Pertemuan', 'Hadir',
       '% Kehadiran', 'Predikat', 'Keterangan', 'Deskripsi'],
      ...baris
    ]);
    sukses(`${baris.length} baris nilai diunduh.`);
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Unduh semua ekskul (CSV)';
  }
}


// ================================================= REKAP NILAI PER KELAS
let KELAS = {};          // { kelas: [ {nis,nama,ekskul,predikat,keterangan,deskripsi} ] }
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
    for (const e of EKSKUL) {
      const peserta = await pesertaEkskul(e.id);
      const nilai = nilaiSemua[e.id] || {};
      peserta.forEach(s => {
        const k = s.kelas || 'Tanpa kelas';
        const n = nilai[s.id] || {};
        (KELAS[k] || (KELAS[k] = [])).push({
          // Bila kolom NIS kosong di data sekolah, NISN yang dipakai.
          nis: s.nis || s.id || '',
          pembina: PEMBINA_NAMA[e.pembina_id] || '',
          nama: s.nama, ekskul: e.nama,
          predikat: n.predikat || '', keterangan: PREDIKAT[n.predikat] || '',
          deskripsi: n.deskripsi || ''
        });
      });
    }
    Object.values(KELAS).forEach(d => d.sort((a, b) =>
      String(a.nama).localeCompare(String(b.nama), 'id') || a.ekskul.localeCompare(b.ekskul, 'id')));
    const daftar = Object.keys(KELAS).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    el('pilihKelas').innerHTML = daftar.length
      ? daftar.map(k => `<option value="${k}">${k} — ${KELAS[k].length} baris</option>`).join('')
      : '<option value="">Belum ada peserta</option>';
    kelasSiap = true;
    gambarKelas();
  } catch (e) { laporError(e); }
}

function gambarKelas() {
  const k = el('pilihKelas').value;
  const isi = KELAS[k] || [];
  el('judulKelas').textContent = k ? `Kelas ${k}` : 'Daftar';
  const belum = isi.filter(x => !x.predikat).length;
  el('ketKelas').textContent = isi.length
    ? `${isi.length} baris nilai${belum ? ` · ${belum} belum diisi pembina` : ' · seluruhnya sudah diisi'}`
    : 'Belum ada peserta pada kelas ini.';
  const t = el('tabelKelas');
  if (!isi.length) {
    t.innerHTML = '<tbody><tr><td class="kosong">Belum ada data.</td></tr></tbody>';
    return;
  }
  t.innerHTML = `
    <thead><tr><th class="angka">No.</th><th>NIS</th><th>Nama Siswa</th>
      <th>Ekstrakurikuler</th><th class="angka">Predikat</th><th>Keterangan</th><th>Deskripsi</th></tr></thead>
    <tbody>${isi.map((x, i) => `<tr>
      <td class="angka">${i + 1}</td><td>${x.nis}</td><td>${x.nama}</td>
      <td>${x.ekskul}</td>
      <td class="angka">${x.predikat
        ? '<span class="lencana l-hadir">' + x.predikat + '</span>'
        : '<span class="lencana l-tidak">—</span>'}</td>
      <td>${x.keterangan}</td><td>${x.deskripsi}</td></tr>`).join('')}</tbody>`;
}

function labelPeriode() {
  return `${aktif.tahun_ajaran} · Semester ${aktif.semester}`;
}

async function unduhKelas(bentuk) {
  bersihkanPesan();
  const k = el('pilihKelas').value;
  const isi = KELAS[k] || [];
  if (!isi.length) { laporError('Belum ada data pada kelas ini.'); return; }
  const tombol = el(bentuk === 'png' ? 'unduhKelasPng' : 'unduhKelasXlsx');
  const semula = tombol.textContent;
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    const pembina = [...new Set(isi.map(x => x.pembina).filter(Boolean))];
    const arg = { kelas: k, periode: labelPeriode(), baris: isi,
                  pembina: pembina.length === 1 ? pembina[0] : '' };
    if (bentuk === 'png') {
      await unduhNilaiKelasPNG({ ...arg, namaBerkas: `nilai_ekskul_${k}.png` });
    } else {
      await unduhNilaiKelasXLSX({ ...arg, namaBerkas: `nilai_ekskul_${k}.xlsx` });
    }
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
  const daftar = Object.keys(KELAS);
  if (!daftar.length) { laporError('Belum ada data.'); return; }
  const tombol = el('unduhSemuaKelas');
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    for (const k of daftar) {
      const p = [...new Set(KELAS[k].map(x => x.pembina).filter(Boolean))];
      await unduhNilaiKelasXLSX({
        kelas: k, periode: labelPeriode(), baris: KELAS[k],
        pembina: p.length === 1 ? p[0] : '',
        namaBerkas: `nilai_ekskul_${k}.xlsx`
      });
      await new Promise(r => setTimeout(r, 400));   // jeda agar unduhan tidak diblokir
    }
    sukses(`${daftar.length} berkas kelas diunduh.`);
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Unduh semua kelas (XLSX)';
  }
}

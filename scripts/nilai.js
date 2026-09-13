import { ambilMaster, pesertaEkskul, daftarPeriode, simpanPeriode, ubahStatusPeriode,
         ambilNilai, simpanNilai, kehadiranPerSiswa } from '../assets/db.js?v=20260913b';
import { wajibMasuk, ekskulBoleh, adalahPengelola, tandaiMode, laporError, sukses,
         bersihkanPesan, tanggalPanjang, persen, unduhCSV } from '../assets/ui.js?v=20260913b';

const el = id => document.getElementById(id);
const PREDIKAT = { A: 'Sangat Baik', B: 'Baik', C: 'Cukup', D: 'Perlu Bimbingan' };

let AKUN = null, EKSKUL = [], PERIODE = [], aktif = null;
let SISWA = [], HADIR = {}, NILAI = {};

AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
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
      el('pilihPeriode').addEventListener('change', isiFormPeriode);
      el('simpanPeriode').addEventListener('click', simpanFormPeriode);
      el('tombolBuka').addEventListener('click', bukaTutup);
    }

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

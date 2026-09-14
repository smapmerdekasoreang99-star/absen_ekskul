import { ambilMaster, pesertaEkskul, cariSiswaSekolah, daftarKelas,
         daftarkanPeserta, hapusPeserta } from '../assets/db.js?v=20260913f';
import { wajibMasuk, tandaiMode, laporError, sukses, bersihkanPesan, unduhCSV, jam }
  from '../assets/ui.js?v=20260913f';

const el = id => document.getElementById(id);
let AKUN = null, EKSKUL = [], PEMBINA = {}, PESERTA = [], HASIL = [], jeda = null;

AKUN = wajibMasuk(true);           // hanya pengelola
try { tandaiMode(); } catch (e) { console.error(e); }

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    EKSKUL = m.ekskul.filter(e => e.aktif !== false);
    PEMBINA = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    el('pilihEkskul').innerHTML = EKSKUL.map(e =>
      `<option value="${e.id}">${e.nama} — ${e.hari}</option>`).join('');
    el('pilihEkskul').addEventListener('change', muat);
    el('cariSiswa').addEventListener('input', () => {
      clearTimeout(jeda);
      jeda = setTimeout(cari, 350);
    });
    el('filterKelas').addEventListener('change', cari);
    el('unduhPeserta').addEventListener('click', unduh);

    try {
      const kelas = await daftarKelas();
      el('filterKelas').innerHTML = '<option value="">Semua kelas</option>' +
        kelas.map(k => `<option value="${k}">${k}</option>`).join('');
    } catch (e) {
      console.warn('Daftar kelas tidak terbaca:', e.message);
    }
    await muat();
  } catch (e) { laporError(e); }
})();

async function muat() {
  bersihkanPesan();
  const id = el('pilihEkskul').value;
  const e = EKSKUL.find(x => x.id === id);
  if (!e) return;
  el('infoEkskul').innerHTML = `Pembina: <strong>${PEMBINA[e.pembina_id] || 'belum diisi'}</strong> · ` +
    `${e.hari} ${jam(e.jam_mulai)}–${jam(e.jam_selesai)}`;
  el('daftarPeserta').innerHTML = '<p class="kosong">Memuat…</p>';
  try {
    PESERTA = await pesertaEkskul(id);
    gambarPeserta();
    gambarHasil();
  } catch (err) { laporError(err); }
}

function gambarPeserta() {
  const kotak = el('daftarPeserta');
  el('jumlahPeserta').textContent = PESERTA.length
    ? `${PESERTA.length} siswa terdaftar.`
    : 'Belum ada siswa terdaftar.';
  if (!PESERTA.length) {
    kotak.innerHTML = '<p class="kosong">Tambahkan peserta lewat pencarian di bawah.</p>';
    return;
  }
  kotak.innerHTML = PESERTA.map(s => `
    <div class="siswa">
      <span class="nama">${s.nama}<small>${s.kelas || ''}${s.nis ? ' · ' + s.nis : ''}</small></span>
      <button class="tbl tbl-kecil tbl-hapus" data-hapus="${s.id}" type="button">Keluarkan</button>
    </div>`).join('');
  kotak.querySelectorAll('[data-hapus]').forEach(b =>
    b.addEventListener('click', () => keluarkan(b.dataset.hapus)));
}

async function keluarkan(siswaId) {
  const s = PESERTA.find(x => x.id === siswaId);
  if (!confirm(`Keluarkan ${s ? s.nama : 'siswa ini'} dari ekstrakurikuler? ` +
               'Catatan kehadiran yang lalu tetap tersimpan.')) return;
  try {
    await hapusPeserta(el('pilihEkskul').value, siswaId);
    PESERTA = PESERTA.filter(x => x.id !== siswaId);
    gambarPeserta();
    gambarHasil();
    sukses('Peserta dikeluarkan.');
  } catch (e) { laporError(e); }
}

// --------------------------------------------------------- cari & daftar
async function cari() {
  const kata = el('cariSiswa').value.trim();
  const kelas = el('filterKelas').value;
  if (!kata && !kelas) {
    HASIL = [];
    el('hasilCari').innerHTML = '<p class="kosong">Pilih kelas atau ketik nama untuk mencari.</p>';
    return;
  }
  el('hasilCari').innerHTML = '<p class="kosong">Mencari…</p>';
  try {
    HASIL = await cariSiswaSekolah(kata, kelas);
    gambarHasil();
  } catch (e) { laporError(e); }
}

function gambarHasil() {
  const kotak = el('hasilCari');
  if (!HASIL.length) {
    if (el('cariSiswa').value.trim() || el('filterKelas').value)
      kotak.innerHTML = '<p class="kosong">Tidak ada siswa yang cocok.</p>';
    return;
  }
  const sudah = new Set(PESERTA.map(p => p.id));
  kotak.innerHTML = `<p class="ket">${HASIL.length} siswa ditemukan.</p>` + HASIL.map(s => `
    <div class="siswa">
      <span class="nama">${s.nama}<small>${s.kelas || ''}${s.nis ? ' · ' + s.nis : ''}</small></span>
      ${sudah.has(s.id)
        ? '<span class="lencana l-hadir">Sudah terdaftar</span>'
        : `<button class="tbl tbl-kecil" data-daftar="${s.id}" type="button">Daftarkan</button>`}
    </div>`).join('');
  kotak.querySelectorAll('[data-daftar]').forEach(b =>
    b.addEventListener('click', () => daftarkan(b.dataset.daftar)));
}

async function daftarkan(siswaId) {
  const s = HASIL.find(x => x.id === siswaId);
  if (!s) return;
  try {
    await daftarkanPeserta(el('pilihEkskul').value, s);
    PESERTA = await pesertaEkskul(el('pilihEkskul').value);
    gambarPeserta();
    gambarHasil();
    sukses(`${s.nama} terdaftar sebagai peserta.`);
  } catch (e) { laporError(e); }
}

function unduh() {
  if (!PESERTA.length) { laporError('Belum ada peserta untuk diunduh.'); return; }
  const e = EKSKUL.find(x => x.id === el('pilihEkskul').value);
  unduhCSV(`peserta_${(e ? e.nama : 'ekskul').replace(/\s+/g, '_')}.csv`, [
    ['NIS', 'Nama siswa', 'Kelas'],
    ...PESERTA.map(s => [s.nis || '', s.nama, s.kelas || ''])
  ]);
}

import { ambilMaster, pesertaEkskul, cariSiswaSekolah, daftarKelas, semuaSiswaSekolah,
         daftarkanPeserta, daftarkanPesertaBanyak, hapusPeserta } from '../assets/db.js?v=20260923b';
import { wajibMasuk, ekskulBoleh, tandaiMode, laporError, sukses, bersihkanPesan, unduhCSV, jam, perKategori }
  from '../assets/ui.js?v=20260923b';
import { unduhFormatPeserta, bacaBerkasPeserta, cocokkanPeserta }
  from '../assets/unggah-peserta.js?v=20260923b';

const el = id => document.getElementById(id);
let AKUN = null, EKSKUL = [], PEMBINA = {}, PESERTA = [], HASIL = [], jeda = null;
let KELAS = [], UNGGAHAN = null;   // UNGGAHAN: hasil pencocokan berkas yang sedang dipratinjau

// Pembina boleh mengurus peserta kegiatannya sendiri, termasuk unggah massal;
// pengelola semua kegiatan.
AKUN = wajibMasuk();
try { tandaiMode(); } catch (e) { console.error(e); }

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    EKSKUL = ekskulBoleh(AKUN, m.ekskul.filter(e => e.aktif !== false));
    if (!EKSKUL.length) {
      el('pilihEkskul').innerHTML = '<option value="">Belum ada kegiatan yang Anda bimbing</option>';
      el('daftarPeserta').innerHTML = '<p class="kosong">Hubungi Wakasek Kesiswaan bila nama Anda belum tercatat sebagai pembimbing.</p>';
      return;
    }
    PEMBINA = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    el('pilihEkskul').innerHTML = perKategori(EKSKUL).map(([kategori, isi]) =>
      `<optgroup label="${kategori}">` + isi.map(e =>
        `<option value="${e.id}">${e.nama} — ${e.hari}</option>`).join('') + '</optgroup>').join('');
    el('pilihEkskul').addEventListener('change', muat);
    el('cariSiswa').addEventListener('input', () => {
      clearTimeout(jeda);
      jeda = setTimeout(cari, 350);
    });
    el('filterKelas').addEventListener('change', cari);
    el('unduhPeserta').addEventListener('click', unduh);
    el('unduhFormat').addEventListener('click', unduhFormat);
    el('berkasPeserta').addEventListener('change', bacaUnggahan);

    try {
      KELAS = await daftarKelas();
      el('filterKelas').innerHTML = '<option value="">Semua kelas</option>' +
        KELAS.map(k => `<option value="${k}">${k}</option>`).join('');
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
  // Pratinjau unggahan dihitung terhadap peserta kegiatan yang dipilih saat
  // itu; begitu kegiatannya berganti, pratinjau lama tidak berlaku lagi.
  tutupUnggahan();
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

// ------------------------------------------------------- unggah berkas
const LENCANA = {
  baru:  ['l-hadir', 'Akan didaftarkan'],
  sudah: ['l-libur', 'Sudah terdaftar'],
  ulang: ['l-libur', 'Dilewati'],
  ganda: ['l-ganti', 'Perlu dipastikan'],
  tidak: ['l-tidak', 'Tidak ditemukan']
};
const ekskulTerpilih = () => EKSKUL.find(x => x.id === el('pilihEkskul').value);
// Isi berkas datang dari luar aplikasi, jadi tidak ditulis mentah ke HTML.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function unduhFormat() {
  bersihkanPesan();
  const e = ekskulTerpilih();
  try { await unduhFormatPeserta(KELAS, e ? e.nama : ''); }
  catch (err) { laporError(err); }
}

async function bacaUnggahan() {
  const masukan = el('berkasPeserta');
  const berkas = masukan.files && masukan.files[0];
  if (!berkas) return;
  bersihkanPesan();
  const kotak = el('pratinjauUnggah');
  kotak.className = 'pratinjau-unggah';
  kotak.innerHTML = '<p class="kosong">Membaca berkas dan mencocokkan nama…</p>';
  try {
    const [hasilBaca, semuaSiswa] = await Promise.all([bacaBerkasPeserta(berkas), semuaSiswaSekolah()]);
    UNGGAHAN = {
      berkas: berkas.name,
      adaKelas: hasilBaca.adaKelas,
      baris: cocokkanPeserta(hasilBaca.baris, semuaSiswa, PESERTA.map(p => p.id))
    };
    gambarUnggahan();
  } catch (err) {
    tutupUnggahan();
    laporError(err);
  }
}

function gambarUnggahan() {
  const kotak = el('pratinjauUnggah');
  const u = UNGGAHAN;
  const jumlah = {};
  u.baris.forEach(b => { jumlah[b.status] = (jumlah[b.status] || 0) + 1; });
  const baru = jumlah.baru || 0;
  const e = ekskulTerpilih();

  const ringkas = Object.entries(LENCANA)
    .filter(([k]) => jumlah[k])
    .map(([k, [kelas, teks]]) => `<span class="lencana ${kelas}">${jumlah[k]} ${teks.toLowerCase()}</span>`)
    .join('');

  kotak.innerHTML = `
    <p class="ket"><strong>${esc(u.berkas)}</strong> · ${u.baris.length} baris dibaca${
      u.adaKelas ? '' : ' · kolom Kelas tidak ada, dicocokkan dari nama saja'}</p>
    <div class="ringkas-unggah">${ringkas}</div>
    <div class="gulir"><table>
      <thead><tr><th>Baris</th><th>Nama di berkas</th><th>Hasil</th></tr></thead>
      <tbody>${u.baris.map(b => {
        const [kelas, teks] = LENCANA[b.status];
        const masalah = b.status === 'ganda' || b.status === 'tidak';
        const cocok = b.siswa && (b.siswa.nama !== b.nama || b.siswa.kelas !== b.kelas)
          ? `${esc(b.siswa.nama)} · ${esc(b.siswa.kelas)}` : '';
        return `<tr class="${masalah ? 'masalah' : ''}">
          <td class="nomor">${b.nomor}</td>
          <td class="nama-berkas">${esc(b.nama)}<small>${esc(b.kelas) || '—'}</small></td>
          <td class="hasil"><span class="lencana ${kelas}">${teks}</span>${
            b.keterangan || cocok ? `<small>${[esc(b.keterangan), cocok].filter(Boolean).join(' · ')}</small>` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    <div class="deret-tombol">
      <button class="tbl tbl-utama" id="simpanUnggahan" type="button" ${baru ? '' : 'disabled'}>
        Daftarkan ${baru} siswa${e ? ' ke ' + e.nama : ''}</button>
      <button class="tbl" id="batalUnggahan" type="button">Batal</button>
    </div>`;
  el('simpanUnggahan').addEventListener('click', simpanUnggahan);
  el('batalUnggahan').addEventListener('click', tutupUnggahan);
  kotak.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

async function simpanUnggahan() {
  if (!UNGGAHAN) return;
  const daftar = UNGGAHAN.baris.filter(b => b.status === 'baru').map(b => b.siswa);
  const e = ekskulTerpilih();
  if (!daftar.length || !e) return;
  const tombol = el('simpanUnggahan');
  tombol.disabled = true;
  tombol.textContent = 'Menyimpan…';
  try {
    await daftarkanPesertaBanyak(e.id, daftar);
    PESERTA = await pesertaEkskul(e.id);
    gambarPeserta();
    gambarHasil();
    tutupUnggahan();
    sukses(`${daftar.length} siswa didaftarkan ke ${e.nama}.`);
  } catch (err) {
    tombol.disabled = false;
    tombol.textContent = `Daftarkan ${daftar.length} siswa ke ${e.nama}`;
    laporError(err);
  }
}

function tutupUnggahan() {
  UNGGAHAN = null;
  const kotak = el('pratinjauUnggah');
  kotak.className = 'sembunyi';
  kotak.innerHTML = '';
  el('berkasPeserta').value = '';   // supaya berkas yang sama bisa dipilih lagi
}

function unduh() {
  if (!PESERTA.length) { laporError('Belum ada peserta untuk diunduh.'); return; }
  const e = EKSKUL.find(x => x.id === el('pilihEkskul').value);
  unduhCSV(`peserta_${(e ? e.nama : 'ekskul').replace(/\s+/g, '_')}.csv`, [
    ['Nama siswa', 'Kelas'],
    ...PESERTA.map(s => [s.nama, s.kelas || ''])
  ]);
}

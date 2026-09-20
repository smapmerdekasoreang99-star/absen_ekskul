import { ambilMaster, simpanPembina, hapusPembina, nomorPembinaBaru, daftarGuru,
         simpanEkskul, hapusEkskul, nomorEkskulBaru } from '../assets/db.js?v=20260920j';
import { wajibMasuk, tandaiMode, laporError, sukses, bersihkanPesan,
         jam, kategoriDari, perKategori, KATEGORI_BAWAAN } from '../assets/ui.js?v=20260920j';

// Halaman ini mengelola DATA INDUK ekskul: pembina dan kegiatan. Aturan tarif
// transport, daftar pembayarannya, dan identitas dokumen sudah pindah —
// tarif dan daftar bayar ke Induk Pembiayaan, identitas ke Data Induk.
const el = id => document.getElementById(id);
let AKUN = null, PEMBINA = [], EKSKUL = [], GURU = [];
let sedangUbah = null, sedangUbahEkskul = null, tab = 'pembina';

AKUN = wajibMasuk(true);      // hanya pengelola
try { tandaiMode(); } catch (e) { console.error(e); }

el('tabKesiswaan').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  [...el('tabKesiswaan').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  el('layarPembina').classList.toggle('sembunyi', tab !== 'pembina');
  el('layarEkskul').classList.toggle('sembunyi', tab !== 'ekskul');
  bersihkanPesan();
});

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    PEMBINA = m.pembina;
    EKSKUL = m.ekskul;
    try {
      GURU = await daftarGuru();
    } catch (e) {
      GURU = [];
      console.warn('Data guru tidak terbaca:', e.message);
      laporError('Data guru tidak terbaca, jadi pembina baru hanya bisa dicatat ' +
                 'sebagai eksternal. Periksa SUMBER_GURU di supabase-client.js. (' + e.message + ')');
    }
    isiPilihanGuru('');
    el('pGuru').addEventListener('change', saatPilihGuru);
    gambarPembina();
    gambarEkskul();

    el('simpanPembina').addEventListener('click', simpanFormPembina);
    el('batalPembina').addEventListener('click', kosongkanFormPembina);
    el('simpanEkskul').addEventListener('click', simpanFormEkskul);
    el('batalEkskul').addEventListener('click', kosongkanFormEkskul);
  } catch (e) { laporError(e); }
})();

// ====================================================== DATA PEMBINA
function gambarPembina() {
  const kotak = el('daftarPembina');
  if (!PEMBINA.length) {
    kotak.innerHTML = '<p class="kosong">Belum ada pembina terdaftar.</p>';
    return;
  }
  const jumlahEkskul = id => EKSKUL.filter(e => e.pembina_id === id).length;
  kotak.innerHTML = [...PEMBINA]
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
    .map(p => `
      <div class="siswa">
        <span class="nama">${p.nama}
          <small>${p.id} · ${jumlahEkskul(p.id)} ekskul${p.no_hp ? ' · ' + p.no_hp : ''}
            ${p.status === 'Nonaktif' ? ' · nonaktif' : ''}</small></span>
        <span class="lencana ${p.jenis === 'Eksternal' ? 'l-ganti' : 'l-hadir'}">${p.jenis}</span>
        <button class="tbl tbl-kecil" data-ubah="${p.id}" type="button">Ubah</button>
        <button class="tbl tbl-kecil tbl-hapus" data-hapus="${p.id}" type="button">Hapus</button>
      </div>`).join('');
  kotak.querySelectorAll('[data-ubah]').forEach(b =>
    b.addEventListener('click', () => isiFormPembina(b.dataset.ubah)));
  kotak.querySelectorAll('[data-hapus]').forEach(b =>
    b.addEventListener('click', () => hapus(b.dataset.hapus)));
}

function isiPilihanGuru(terpilih) {
  // Guru yang sudah dipakai pembina lain tidak ditawarkan lagi.
  const dipakai = new Set(PEMBINA.filter(p => p.id !== sedangUbah && p.id_guru).map(p => p.id_guru));
  el('pGuru').innerHTML = '<option value="">— Pelatih eksternal (bukan guru sekolah) —</option>' +
    GURU.filter(g => !dipakai.has(g.id) || g.id === terpilih)
        .map(g => `<option value="${g.id}"${g.id === terpilih ? ' selected' : ''}>${g.nama}</option>`)
        .join('');
}

function saatPilihGuru() {
  const g = GURU.find(x => x.id === el('pGuru').value);
  el('ketStatus').innerHTML = g
    ? 'Berstatus <strong>Internal</strong> karena tertaut ke data guru. ' +
      'Namanya mengikuti data guru supaya penulisannya tidak berbeda.'
    : 'Berstatus <strong>Eksternal</strong>. Nama diisi sendiri di bawah.';
  if (g) {
    el('pNama').value = g.nama;
    el('pNama').readOnly = true;
  } else {
    el('pNama').readOnly = false;
  }
}

function isiFormPembina(id) {
  const p = PEMBINA.find(x => x.id === id);
  if (!p) return;
  sedangUbah = id;
  el('judulFormPembina').textContent = 'Ubah data ' + p.nama;
  isiPilihanGuru(p.id_guru || '');
  el('pGuru').value = p.id_guru || '';
  el('pNama').value = p.nama;
  el('pHp').value = p.no_hp || '';
  /* PIN tidak diisikan kembali: kolomnya memang tidak lagi terbaca dari
     peramban. Isian dibiarkan kosong dan artinya "biarkan seperti semula";
     yang perlu diketahui pengelola hanyalah sudah ada PIN-nya atau belum. */
  el('pPin').value = '';
  el('pPin').placeholder = p.ada_pin ? 'sudah ada — isi untuk mengganti' : 'belum ada PIN';
  el('ketPin').textContent = p.ada_pin
    ? 'PIN sudah diatur. Kosongkan bila tidak ingin mengubahnya.'
    : 'Pembina ini belum bisa melapor sebelum diberi PIN.';
  el('ketPin').classList.toggle('perlu-pin', !p.ada_pin);
  el('pAktif').value = p.status || 'Aktif';
  saatPilihGuru();
  el('judulFormPembina').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function kosongkanFormPembina() {
  sedangUbah = null;
  el('judulFormPembina').textContent = 'Tambah pembina';
  ['pNama', 'pHp', 'pPin'].forEach(k => { el(k).value = ''; });
  el('pPin').placeholder = '4 angka';
  el('ketPin').textContent = 'Wajib diisi supaya pembina bisa melapor.';
  el('ketPin').classList.remove('perlu-pin');
  el('pAktif').value = 'Aktif';
  isiPilihanGuru('');
  el('pGuru').value = '';
  saatPilihGuru();
}

async function simpanFormPembina() {
  bersihkanPesan();
  const nama = el('pNama').value.trim();
  if (!nama) { laporError('Nama pembina wajib diisi.'); return; }
  const pin = el('pPin').value.trim();
  if (pin && !/^\d{4,6}$/.test(pin)) { laporError('PIN diisi 4 sampai 6 angka.'); return; }
  const idGuru = el('pGuru').value || null;
  const baris = {
    id: sedangUbah || nomorPembinaBaru(PEMBINA),
    nama,
    id_guru: idGuru,
    no_hp: el('pHp').value.trim(),
    status: el('pAktif').value
  };
  /* PIN hanya disertakan bila memang diisi. Kalau kolomnya dikirim kosong,
     PIN yang sudah ada akan terhapus — dan pembinanya tidak bisa melapor
     lagi tanpa ada yang menyadari penyebabnya. */
  if (pin) baris.kode_akses = pin;
  try {
    await simpanPembina(baris);
    const m = await ambilMaster();
    PEMBINA = m.pembina;
    gambarPembina();
    gambarEkskul();
    kosongkanFormPembina();
    sukses(`Data ${nama} tersimpan.`);
  } catch (e) { laporError(e); }
}

async function hapus(id) {
  const p = PEMBINA.find(x => x.id === id);
  const dipakai = EKSKUL.filter(e => e.pembina_id === id);
  if (dipakai.length) {
    laporError(`${p.nama} masih memegang ${dipakai.map(e => e.nama).join(', ')}. ` +
               'Pindahkan pembinanya dulu lewat menu Data.');
    return;
  }
  if (!confirm(`Hapus ${p.nama} dari data induk? Riwayat laporan yang lalu tetap tersimpan.`)) return;
  try {
    await hapusPembina(id);
    PEMBINA = PEMBINA.filter(x => x.id !== id);
    gambarPembina();
    sukses('Pembina dihapus.');
  } catch (e) { laporError(e); }
}

// ====================================================== DATA EKSKUL
function pilihanPembina(terpilih) {
  return [...PEMBINA]
    .filter(p => p.status !== 'Nonaktif' || p.id === terpilih)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
    .map(p => `<option value="${p.id}"${p.id === terpilih ? ' selected' : ''}>` +
              `${p.nama} — ${p.jenis || 'Internal'}</option>`).join('');
}

function gambarEkskul() {
  const kotak = el('daftarEkskul');
  el('ePembina').innerHTML = pilihanPembina(el('ePembina').value);
  if (!EKSKUL.length) {
    kotak.innerHTML = '<p class="kosong">Belum ada kegiatan.</p>';
    return;
  }
  const nama = Object.fromEntries(PEMBINA.map(p => [p.id, p.nama]));
  const URUT = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6 };
  // Dikelompokkan per kategori supaya jelas mana yang masuk rapor sebagai
  // nilai ekskul dan mana yang direkap terpisah.
  kotak.innerHTML = perKategori(EKSKUL).map(([kategori, isi]) => `
      <h3 class="kelompok-judul">${kategori} <small>${isi.length} kegiatan</small></h3>` +
    [...isi]
      .sort((a, b) => (URUT[a.hari] || 9) - (URUT[b.hari] || 9) ||
                      String(a.jam_mulai).localeCompare(String(b.jam_mulai)))
      .map(e => `
      <div class="siswa">
        <span class="nama">${e.nama}
          <small>${e.hari} ${jam(e.jam_mulai)}–${jam(e.jam_selesai)} ·
            ${nama[e.pembina_id] || 'pembina belum diisi'}${e.tempat ? ' · ' + e.tempat : ''}</small></span>
        ${e.aktif === false ? '<span class="lencana l-libur">Nonaktif</span>' : ''}
        <button class="tbl tbl-kecil" data-ubah-e="${e.id}" type="button">Ubah</button>
        <button class="tbl tbl-kecil tbl-hapus" data-hapus-e="${e.id}" type="button">Hapus</button>
      </div>`).join('')).join('');
  kotak.querySelectorAll('[data-ubah-e]').forEach(b =>
    b.addEventListener('click', () => isiFormEkskul(b.dataset.ubahE)));
  kotak.querySelectorAll('[data-hapus-e]').forEach(b =>
    b.addEventListener('click', () => buangEkskul(b.dataset.hapusE)));
}

function isiFormEkskul(id) {
  const e = EKSKUL.find(x => x.id === id);
  if (!e) return;
  sedangUbahEkskul = id;
  el('judulFormEkskul').textContent = 'Ubah ' + e.nama;
  el('eNama').value = e.nama;
  el('ePembina').innerHTML = pilihanPembina(e.pembina_id);
  el('eHari').value = e.hari || 'Senin';
  el('eMulai').value = jam(e.jam_mulai);
  el('eSelesai').value = jam(e.jam_selesai);
  el('eTempat').value = e.tempat || '';
  el('eKategori').value = kategoriDari(e);
  el('eAktif').value = e.aktif === false ? 'Nonaktif' : 'Aktif';
  el('judulFormEkskul').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function kosongkanFormEkskul() {
  sedangUbahEkskul = null;
  el('judulFormEkskul').textContent = 'Tambah kegiatan';
  ['eNama', 'eTempat'].forEach(k => { el(k).value = ''; });
  el('ePembina').innerHTML = pilihanPembina('');
  el('eKategori').value = KATEGORI_BAWAAN;
  el('eHari').value = 'Senin';
  el('eMulai').value = '15:30';
  el('eSelesai').value = '17:00';
  el('eAktif').value = 'Aktif';
}

async function simpanFormEkskul() {
  bersihkanPesan();
  const nama = el('eNama').value.trim();
  if (!nama) { laporError('Nama kegiatan wajib diisi.'); return; }
  if (!el('ePembina').value) { laporError('Pilih pembinanya dulu. Tambahkan di tab Data pembina bila belum ada.'); return; }
  const mulai = el('eMulai').value, selesai = el('eSelesai').value;
  if (mulai && selesai && selesai <= mulai) { laporError('Jam selesai harus setelah jam mulai.'); return; }
  const baris = {
    id: sedangUbahEkskul || nomorEkskulBaru(EKSKUL),
    nama,
    pembina_id: el('ePembina').value,
    hari: el('eHari').value,
    jam_mulai: mulai || null,
    jam_selesai: selesai || null,
    tempat: el('eTempat').value.trim(),
    kategori: el('eKategori').value,
    aktif: el('eAktif').value === 'Aktif'
  };
  try {
    await simpanEkskul(baris);
    const m = await ambilMaster();
    EKSKUL = m.ekskul;
    gambarEkskul();
    gambarPembina();
    kosongkanFormEkskul();
    sukses(`${nama} tersimpan.`);
  } catch (e) { laporError(e); }
}

async function buangEkskul(id) {
  const e = EKSKUL.find(x => x.id === id);
  if (!confirm(`Hapus ${e.nama} dari data induk? Hanya bisa dilakukan bila belum ada ` +
               'peserta dan belum ada laporan latihan.')) return;
  try {
    await hapusEkskul(id);
    EKSKUL = EKSKUL.filter(x => x.id !== id);
    gambarEkskul();
    gambarPembina();
    sukses('Ekstrakurikuler dihapus.');
  } catch (err) { laporError(err); }
}



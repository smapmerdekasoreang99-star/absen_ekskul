import { ambilMaster, muatPeriode, simpanPembina, hapusPembina, nomorPembinaBaru, daftarGuru,
         simpanEkskul, hapusEkskul, nomorEkskulBaru,
         daftarTarif, simpanTarif, hapusTarif,
         ambilPengaturan, simpanPengaturan } from '../assets/db.js?v=20260920b';
import { wajibMasuk, tandaiMode, laporError, sukses, bersihkanPesan, hariIni,
         tanggalPanjang, tanggalPendek, rupiah, tarifUntuk, rentangTarif,
         unduhCSV, jam, kategoriDari, perKategori, KATEGORI_BAWAAN } from '../assets/ui.js?v=20260920b';
import { unduhTransportXLSX, pakaiIdentitas } from '../assets/dokumen.js?v=20260920b';

const el = id => document.getElementById(id);
let AKUN = null, PEMBINA = [], EKSKUL = [], TARIF = [], GURU = [], BARIS = [];
let sedangUbah = null, sedangUbahEkskul = null, tab = 'pembina';

AKUN = wajibMasuk(true);      // hanya pengelola
try { tandaiMode(); } catch (e) { console.error(e); }

function iso(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }

el('tabKesiswaan').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  [...el('tabKesiswaan').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  el('layarPembina').classList.toggle('sembunyi', tab !== 'pembina');
  el('layarEkskul').classList.toggle('sembunyi', tab !== 'ekskul');
  el('layarTarif').classList.toggle('sembunyi', tab !== 'tarif');
  el('layarLaporan').classList.toggle('sembunyi', tab !== 'laporan');
  bersihkanPesan();
});

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    PEMBINA = m.pembina;
    EKSKUL = m.ekskul;
    TARIF = await daftarTarif();
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
    await muatIdentitas();
    gambarPembina();
    gambarEkskul();
    gambarTarif();

    el('simpanPembina').addEventListener('click', simpanFormPembina);
    el('batalPembina').addEventListener('click', kosongkanFormPembina);
    el('simpanEkskul').addEventListener('click', simpanFormEkskul);
    el('batalEkskul').addEventListener('click', kosongkanFormEkskul);
    el('simpanTarif').addEventListener('click', simpanFormTarif);
    el('simpanIdentitas').addEventListener('click', simpanFormIdentitas);
    el('hitung').addEventListener('click', hitungTransport);
    el('unduhInternal').addEventListener('click', () => unduhXlsx('Internal'));
    el('unduhEksternal').addEventListener('click', () => unduhXlsx('Eksternal'));
    el('unduhCsvTransport').addEventListener('click', unduhCsv);
    document.querySelectorAll('[data-cepat]').forEach(b =>
      b.addEventListener('click', () => { pasangPeriode(b.dataset.cepat); hitungTransport(); }));
    pasangPeriode('bulan-ini');
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
  el('pPin').value = p.kode_akses || '';
  el('pAktif').value = p.status || 'Aktif';
  saatPilihGuru();
  el('judulFormPembina').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function kosongkanFormPembina() {
  sedangUbah = null;
  el('judulFormPembina').textContent = 'Tambah pembina';
  ['pNama', 'pHp', 'pPin'].forEach(k => { el(k).value = ''; });
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
    kode_akses: pin,
    status: el('pAktif').value
  };
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

// ====================================================== ATURAN TARIF
function gambarTarif() {
  const t = el('tabelTarif');
  if (!TARIF.length) {
    t.innerHTML = '<tbody><tr><td class="kosong">Belum ada lapisan tarif.</td></tr></tbody>';
    return;
  }
  const urut = [...TARIF].sort((a, b) =>
    a.jenis.localeCompare(b.jenis) || a.min_peserta - b.min_peserta);
  t.innerHTML = `
    <thead><tr><th>Pembina</th><th>Jumlah peserta hadir</th>
      <th class="angka">Transport per pertemuan</th><th></th></tr></thead>
    <tbody>${urut.map(x => `<tr>
      <td><span class="lencana ${x.jenis === 'Eksternal' ? 'l-ganti' : 'l-hadir'}">${x.jenis}</span></td>
      <td>${rentangTarif(x)}</td>
      <td class="angka">${rupiah(x.besaran)}</td>
      <td><button class="tbl tbl-kecil tbl-hapus" data-hapus-tarif="${x.id}" type="button">Hapus</button></td>
    </tr>`).join('')}</tbody>`;
  t.querySelectorAll('[data-hapus-tarif]').forEach(b =>
    b.addEventListener('click', () => buangTarif(Number(b.dataset.hapusTarif))));
}

async function simpanFormTarif() {
  bersihkanPesan();
  const min = Number(el('tMin').value);
  const maks = el('tMaks').value ? Number(el('tMaks').value) : null;
  const besaran = Number(el('tBesaran').value);
  if (!min || !besaran) { laporError('Peserta minimal dan besaran wajib diisi.'); return; }
  if (maks && maks < min) { laporError('Batas maksimal lebih kecil daripada minimal.'); return; }
  try {
    await simpanTarif({ jenis: el('tJenis').value, min_peserta: min, maks_peserta: maks, besaran });
    TARIF = await daftarTarif();
    gambarTarif();
    ['tMin', 'tMaks', 'tBesaran'].forEach(k => { el(k).value = ''; });
    sukses('Lapisan tarif tersimpan.');
  } catch (e) { laporError(e); }
}

async function buangTarif(id) {
  if (!confirm('Hapus lapisan tarif ini?')) return;
  try {
    await hapusTarif(id);
    TARIF = await daftarTarif();
    gambarTarif();
    sukses('Lapisan tarif dihapus.');
  } catch (e) { laporError(e); }
}

// ====================================================== DAFTAR TRANSPORT
function pasangPeriode(jenis) {
  const now = new Date();
  if (jenis === 'bulan-lalu') {
    el('dari').value = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    el('sampai').value = iso(new Date(now.getFullYear(), now.getMonth(), 0));
  } else {
    el('dari').value = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    el('sampai').value = hariIni();
  }
}

async function hitungTransport() {
  bersihkanPesan();
  const dari = el('dari').value, sampai = el('sampai').value;
  if (!dari || !sampai) { laporError('Isi tanggal awal dan akhir.'); return; }
  if (dari > sampai) { laporError('Tanggal awal melewati tanggal akhir.'); return; }
  try {
    const { sesi } = await muatPeriode(dari, sampai);
    const namaPembina = Object.fromEntries(PEMBINA.map(p => [p.id, p]));
    BARIS = [];
    sesi.filter(s => s.status_pembina === 'H' || s.status_pembina === 'DG')
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        .forEach(s => {
      const e = EKSKUL.find(x => x.id === s.ekskul_id);
      if (!e) return;
      const p = namaPembina[e.pembina_id];
      const jenis = (p && p.jenis) || 'Internal';
      const { besaran, lapisan } = tarifUntuk(TARIF, jenis, s.H);
      BARIS.push({
        pembina: p ? p.nama : 'Pembina belum diisi',
        pembina_id: e.pembina_id, jenis,
        ekskul: e.nama, tanggal: s.tanggal,
        pertemuan: tanggalPanjang(s.tanggal),
        pengganti: s.status_pembina === 'DG' ? (s.pengganti || 'pelatih pengganti') : '',
        hadir: s.H, besaran, dibawahAmbang: !lapisan
      });
    });
    gambarTransport(dari, sampai);
  } catch (e) { laporError(e); }
}

function gambarTransport(dari, sampai) {
  const total = BARIS.reduce((a, b) => a + b.besaran, 0);
  const kurang = BARIS.filter(b => b.dibawahAmbang).length;
  const perJenis = j => BARIS.filter(b => b.jenis === j).reduce((a, b) => a + b.besaran, 0);
  const orang = new Set(BARIS.map(b => b.pembina_id)).size;

  el('ringkasTransport').innerHTML = `
    <p class="ket" style="margin-bottom:10px">${tanggalPanjang(dari)} – ${tanggalPanjang(sampai)}</p>
    ${bar(`${BARIS.length} pertemuan dibayar`, `${orang} pembina`)}
    ${bar(`Internal ${rupiah(perJenis('Internal'))}`, 'jumlah transport pembina internal')}
    ${bar(`Eksternal ${rupiah(perJenis('Eksternal'))}`, 'jumlah transport pembina eksternal')}
    ${bar(`Total ${rupiah(total)}`, 'seluruh pembina pada periode ini')}
    ${kurang ? bar(`${kurang} pertemuan di bawah ambang`, 'jumlah hadir kurang dari lapisan tarif terendah, dihitung Rp0') : ''}`;

  const t = el('tabelTransport');
  if (!BARIS.length) {
    t.innerHTML = '<tbody><tr><td class="kosong">Tidak ada pertemuan yang berjalan pada periode ini.</td></tr></tbody>';
    return;
  }
  const kelompok = {};
  BARIS.forEach(b => (kelompok[b.pembina] || (kelompok[b.pembina] = [])).push(b));
  let no = 0, isi = '';
  Object.entries(kelompok).forEach(([nama, daftar]) => {
    no++;
    daftar.forEach((b, i) => {
      isi += `<tr${i === 0 ? ' class="awal-kelompok"' : ''}>
        <td class="angka">${i === 0 ? no : ''}</td>
        <td${i === 0 ? ' class="kelompok"' : ''}>${i === 0 ? nama : ''}</td>
        <td>${i === 0 ? `<span class="lencana ${b.jenis === 'Eksternal' ? 'l-ganti' : 'l-hadir'}">${b.jenis}</span>` : ''}</td>
        <td>${b.ekskul}</td>
        <td>${b.pertemuan}${b.pengganti ? '<br><small>digantikan ' + b.pengganti + '</small>' : ''}</td>
        <td class="angka">${b.hadir}</td>
        <td class="angka">${b.dibawahAmbang ? '<span class="lencana l-tidak">Rp0</span>' : rupiah(b.besaran)}</td></tr>`;
    });
    isi += `<tr><td colspan="6" style="text-align:right;font-weight:700">Jumlah ${nama}</td>
      <td class="angka" style="font-weight:700">${rupiah(daftar.reduce((a, b) => a + b.besaran, 0))}</td></tr>`;
  });
  t.innerHTML = `
    <thead><tr><th class="angka">No.</th><th>Nama Pembina</th><th>Status</th>
      <th>Ekstrakurikuler</th><th>Pertemuan</th><th class="angka">Hadir</th>
      <th class="angka">Transport</th></tr></thead>
    <tbody>${isi}</tbody>
    <tfoot><tr><td colspan="6" style="text-align:right">JUMLAH SELURUHNYA</td>
      <td class="angka">${rupiah(BARIS.reduce((a, b) => a + b.besaran, 0))}</td></tr></tfoot>`;
}

function bar(a, b) {
  return `<div class="jadwal-hari"><span class="isi"><strong>${a}</strong><small>${b}</small></span></div>`;
}

async function unduhXlsx(jenis) {
  bersihkanPesan();
  if (!BARIS.length) { laporError('Hitung dulu transportnya.'); return; }
  const isi = BARIS.filter(b => b.jenis === jenis);
  if (!isi.length) { laporError(`Tidak ada pertemuan pembina ${jenis} pada periode ini.`); return; }
  const tombol = el(jenis === 'Internal' ? 'unduhInternal' : 'unduhEksternal');
  const semula = tombol.textContent;
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan berkas…';
  try {
    await unduhTransportXLSX({
      baris: isi, tarif: TARIF, jenis,
      dari: tanggalPanjang(el('dari').value),
      sampai: tanggalPanjang(el('sampai').value),
      namaBerkas: `transport_${jenis.toLowerCase()}_${el('dari').value}_sd_${el('sampai').value}.xlsx`
    });
    sukses(`Daftar transport ${jenis} diunduh.`);
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = semula;
  }
}

function unduhCsv() {
  if (!BARIS.length) { laporError('Hitung dulu transportnya.'); return; }
  unduhCSV(`transport_mentah_${el('dari').value}_sd_${el('sampai').value}.csv`, [
    ['Nama Pembina', 'Status', 'Ekstrakurikuler', 'Tanggal', 'Pertemuan',
     'Digantikan oleh', 'Siswa hadir', 'Transport'],
    ...BARIS.map(b => [b.pembina, b.jenis, b.ekskul, b.tanggal, b.pertemuan,
                       b.pengganti, b.hadir, b.besaran])
  ]);
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


// ====================================================== IDENTITAS DOKUMEN
const PETA_IDENTITAS = {
  idNama: 'nama', idAlamat: 'alamat', idTahun: 'tahunAjaran', idKota: 'kota',
  idKepala: 'kepalaSekolah', idBendahara: 'bendahara', idKesiswaan: 'kesiswaan'
};

async function muatIdentitas() {
  try {
    const p = await ambilPengaturan();
    pakaiIdentitas(p);
    Object.entries(PETA_IDENTITAS).forEach(([kotak, kunci]) => {
      if (p[kunci] !== undefined && p[kunci] !== null) el(kotak).value = p[kunci];
    });
  } catch (e) {
    console.warn('Pengaturan dokumen belum terbaca:', e.message);
  }
}

async function simpanFormIdentitas() {
  bersihkanPesan();
  const isi = {};
  Object.entries(PETA_IDENTITAS).forEach(([kotak, kunci]) => {
    isi[kunci] = el(kotak).value.trim();
  });
  if (!isi.nama) { laporError('Nama sekolah wajib diisi.'); return; }
  try {
    await simpanPengaturan(isi);
    pakaiIdentitas(isi);
    sukses('Pengaturan dokumen tersimpan. Berkas yang diunduh berikutnya memakai identitas ini.');
  } catch (e) { laporError(e); }
}

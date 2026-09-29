import { ambilMaster, muatPeriode, namaSiswa, jumlahPeserta, ambilPengaturan }
  from '../assets/db.js?v=20260928d';
import { wajibMasuk, ekskulBoleh, tandaiMode, laporError, bersihkanPesan, hariIni,
         tanggalPanjang, tanggalPendek, persen, jam,
         kategoriDari, KATEGORI, urutKelasNama } from '../assets/ui.js?v=20260929f';
import { unduhTabelXLSX, ttdPembina, ttdKesiswaan, pakaiIdentitas }
  from '../assets/dokumen.js?v=20260929c';

const el = id => document.getElementById(id);
const LABEL = { H: 'Hadir', TH: 'Tidak hadir', KG: 'Ditiadakan' };
const LKELAS = { H: 'l-hadir', TH: 'l-tidak', KG: 'l-libur' };

// SEMUA berisi seluruh kegiatan yang boleh dilihat akun ini; EKSKUL adalah
// hasil penyaringan kategori, dan seluruh perhitungan di bawah memakai EKSKUL.
let AKUN = null, SEMUA = [], EKSKUL = [], PEMBINA = {}, SESI = [], KEHADIRAN = [], NAMA = {};
let PESERTA = { per: {}, unik: 0 };
let tab = 'ekskul';

AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

function iso(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
const tgl = s => new Date(s + 'T00:00:00');

/* Rentang cepat (28 September 2026), meniru pemilih pekan Induk
   Pembiayaan: pilih Mingguan (Senin–Minggu) atau Bulanan (tanggal 1 sampai
   akhir bulan), lalu geser ◀ ▶. Label di tengah menyebut rentangnya dan
   mengembalikan ke minggu/bulan ini bila diketuk. */
let JENIS = 'bulan';
function rentang(jenis, acuan) {
  const d = tgl(acuan);
  if (jenis === 'minggu') {
    const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { dari: iso(s), sampai: iso(e) };
  }
  return { dari: iso(new Date(d.getFullYear(), d.getMonth(), 1)),
           sampai: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}
// Jenis yang tepat sama dengan tanggal terisi, atau null bila rentangnya bebas.
function jenisBerlaku() {
  const dari = el('dari').value, sampai = el('sampai').value;
  if (!dari || !sampai) return null;
  return ['minggu', 'bulan'].find(j => {
    const r = rentang(j, dari);
    return r.dari === dari && r.sampai === sampai;
  }) || null;
}
function pasangRentang(r) { el('dari').value = r.dari; el('sampai').value = r.sampai; }
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function gambarRentang() {
  const j = jenisBerlaku();
  if (j) JENIS = j;
  document.querySelectorAll('[data-jenis]').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.jenis === j)));
  const lbl = el('rentangLabel');
  lbl.classList.toggle('aktif', !!j);
  if (!j) { lbl.innerHTML = 'Rentang bebas <small>ketuk untuk kembali ke ' +
    (JENIS === 'minggu' ? 'minggu' : 'bulan') + ' ini</small>'; return; }
  const kini = rentang(j, hariIni());
  const dari = el('dari').value, sampai = el('sampai').value;
  if (j === 'minggu') {
    const lalu = rentang('minggu', iso(new Date(tgl(kini.dari).getTime() - 7 * 864e5)));
    const nama = dari === kini.dari ? 'Minggu ini' : dari === lalu.dari ? 'Minggu lalu' : '';
    const teks = `${tanggalPendek(dari)} – ${tanggalPendek(sampai)} ${tgl(sampai).getFullYear()}`;
    lbl.innerHTML = nama ? `${nama} <small>${teks}</small>` : teks;
  } else {
    const d = tgl(dari), k = tgl(kini.dari);
    const selisih = (k.getFullYear() - d.getFullYear()) * 12 + k.getMonth() - d.getMonth();
    const nama = selisih === 0 ? 'Bulan ini' : selisih === 1 ? 'Bulan lalu' : '';
    lbl.innerHTML = nama ? `${nama} <small>${BULAN[d.getMonth()]} ${d.getFullYear()}</small>`
                         : `${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  }
}
function geserRentang(arah) {
  const acuan = el('dari').value || hariIni();
  const d = tgl(acuan);
  if (JENIS === 'minggu') d.setDate(d.getDate() + 7 * arah);
  else d.setMonth(d.getMonth() + arah, 1);
  pasangRentang(rentang(JENIS, iso(d)));
  gambarRentang(); muat();
}

document.querySelectorAll('[data-jenis]').forEach(b => b.addEventListener('click', () => {
  JENIS = b.dataset.jenis;
  pasangRentang(rentang(JENIS, hariIni()));
  gambarRentang(); muat();
}));
el('rentangMundur').addEventListener('click', () => geserRentang(-1));
el('rentangMaju').addEventListener('click', () => geserRentang(1));
el('rentangLabel').addEventListener('click', () => {
  pasangRentang(rentang(JENIS, hariIni()));
  gambarRentang(); muat();
});
['dari', 'sampai'].forEach(k => el(k).addEventListener('change', gambarRentang));
el('muat').addEventListener('click', muat);
el('saringKategori').addEventListener('change', muat);
el('unduh').addEventListener('click', unduh);
el('tabRekap').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  [...el('tabRekap').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  gambarTabel();
});

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    PEMBINA = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    SEMUA = ekskulBoleh(AKUN, m.ekskul);
    kunciKategori();
    saringKategori();
    pasangRentang(rentang('bulan', hariIni()));
    gambarRentang();
    // Identitas kop untuk unduhan; tidak ditunggu.
    ambilPengaturan().then(pakaiIdentitas)
      .catch(e => console.warn('Pengaturan dokumen belum terbaca:', e.message));
    await muat();
  } catch (e) { laporError(e); }
})();

/* Pembina hanya melihat kegiatan yang dibimbingnya (ekskulBoleh), jadi
   pilihan kategori baginya dikunci pada kategori kegiatannya sendiri —
   bila kegiatannya lintas kategori, terkunci pada "Semua kegiatan saya".
   Hanya akses Kesiswaan (pengelola) yang bebas memilih kategori. */
function kunciKategori() {
  if (AKUN.peran === 'pengelola') return;
  const milik = KATEGORI.filter(k => SEMUA.some(e => kategoriDari(e) === k));
  const s = el('saringKategori');
  s.innerHTML = milik.length === 1
    ? `<option>${milik[0]}</option>`
    : '<option value="">Semua kegiatan saya</option>';
  s.disabled = true;
  el('ketKategori').classList.remove('sembunyi');
}

function saringKategori() {
  const k = el('saringKategori').value;
  EKSKUL = k ? SEMUA.filter(e => kategoriDari(e) === k) : SEMUA;
}

async function muat() {
  bersihkanPesan();
  saringKategori();
  const dari = el('dari').value, sampai = el('sampai').value;
  if (!dari || !sampai) { laporError('Isi tanggal awal dan tanggal akhir.'); return; }
  if (dari > sampai) { laporError('Tanggal awal melewati tanggal akhir.'); return; }
  try {
    const boleh = new Set(EKSKUL.map(e => e.id));
    // Peserta terdaftar untuk Ringkasan; bila gagal, rekap tetap tampil tanpa angka itu.
    const [hasil, peserta] = await Promise.all([
      muatPeriode(dari, sampai),
      jumlahPeserta(EKSKUL.filter(e => e.aktif !== false).map(e => e.id))
        .catch(e => { console.warn(e.message); return null; })
    ]);
    PESERTA = peserta;
    SESI = hasil.sesi.filter(s => boleh.has(s.ekskul_id));
    const idSesi = new Set(SESI.map(s => s.id));
    KEHADIRAN = hasil.kehadiran.filter(k => idSesi.has(k.sesi_id));
    NAMA = await namaSiswa([...new Set(KEHADIRAN.map(k => k.siswa_id))]);
    gambarRingkasan(dari, sampai);
    gambarTabel();
  } catch (e) { laporError(e); }
}

// ------------------------------------------------------------- perhitungan
function barisEkskul() {
  return EKSKUL.map(e => {
    const s = SESI.filter(x => x.ekskul_id === e.id);
    const terlaksana = s.filter(x => x.status_pembina !== 'KG');
    const hadir = terlaksana.reduce((a, x) => a + x.H, 0);
    const slot = terlaksana.reduce((a, x) => a + x.H + x.S + x.I + x.A, 0);
    return {
      id: e.id, nama: e.nama, kategori: kategoriDari(e), pembina: PEMBINA[e.pembina_id] || '—',
      jadwal: `${e.hari} ${jam(e.jam_mulai)}`,
      pertemuan: s.length, terlaksana: terlaksana.length,
      pHadir: s.filter(x => x.status_pembina === 'H').length,
      pTidak: s.filter(x => x.status_pembina === 'TH').length,
      pLibur: s.filter(x => x.status_pembina === 'KG').length,
      hadirSiswa: hadir, slot,
      rata: terlaksana.length ? Math.round(hadir / terlaksana.length) : 0,
      tingkat: persen(hadir, slot),
      foto: s.filter(x => x.foto).length
    };
  }).filter(b => b.pertemuan > 0);
}

function barisSiswa() {
  const perEkskul = {};
  SESI.forEach(s => { perEkskul[s.id] = s.ekskul_id; });
  const nama = Object.fromEntries(EKSKUL.map(e => [e.id, e.nama]));
  const kunci = {};
  KEHADIRAN.forEach(k => {
    const ek = perEkskul[k.sesi_id];
    const id = k.siswa_id + '|' + ek;
    const b = kunci[id] || (kunci[id] = {
      siswa_id: k.siswa_id,
      nama: (NAMA[k.siswa_id] || {}).nama || k.siswa_id,
      kelas: (NAMA[k.siswa_id] || {}).kelas || '',
      ekskul: nama[ek] || ek, H: 0, S: 0, I: 0, A: 0
    });
    if (b[k.status] !== undefined) b[k.status]++;
  });
  return Object.values(kunci).map(b => {
    const total = b.H + b.S + b.I + b.A;
    return { ...b, total, persen: persen(b.H, total) };
  }).sort((a, b) => a.persen - b.persen || String(a.nama).localeCompare(String(b.nama), 'id'));
}

// Satu baris satu pertemuan yang berjalan, dikelompokkan per ekstrakurikuler.
// Hanya pertemuan yang dihadiri pembinanya (H) yang menimbulkan hak
// transport. Ekstrakurikuler tidak mengenal penggantian: bila pembinanya
// berhalangan, pertemuan itu tidak berjalan.
function barisPembina() {
  const hasil = [];
  let no = 0;
  // Diurutkan menurut nama pembina, supaya ekstrakurikuler yang dipegang
  // pembina yang sama berdekatan.
  const urut = [...EKSKUL].sort((a, b) =>
    String(PEMBINA[a.pembina_id] || '').localeCompare(String(PEMBINA[b.pembina_id] || ''), 'id') ||
    a.nama.localeCompare(b.nama, 'id'));
  urut.forEach(e => {
    const s = SESI.filter(x => x.ekskul_id === e.id && x.status_pembina === 'H')
                  .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    if (!s.length) return;
    no++;
    s.forEach((x, i) => {
      const total = x.H + x.S + x.I + x.A;
      hasil.push({
        no: i === 0 ? no : '',
        ekskul: i === 0 ? e.nama : '',
        pembina: i === 0 ? (PEMBINA[e.pembina_id] || '—') : '',
        ekskulPenuh: e.nama,
        pembinaPenuh: PEMBINA[e.pembina_id] || '—',
        awal: i === 0,
        tanggal: x.tanggal,
        pertemuan: tanggalPanjang(x.tanggal),
        hadir: x.H,
        peserta: total,
        persen: persen(x.H, total)
      });
    });
  });
  return hasil;
}

// --------------------------------------------------------------- tampilan
function gambarRingkasan(dari, sampai) {
  const b = barisEkskul();
  const total = b.reduce((a, x) => a + x.pertemuan, 0);
  const terlaksana = b.reduce((a, x) => a + x.terlaksana, 0);
  const pHadir = b.reduce((a, x) => a + x.pHadir, 0);
  const hadirS = b.reduce((a, x) => a + x.hadirSiswa, 0);
  const slot = b.reduce((a, x) => a + x.slot, 0);
  const berfoto = b.reduce((a, x) => a + x.foto, 0);
  /* Kehadiran siswa dibandingkan dengan pesertanya: "dari" = jumlah
     peserta tercatat pada latihan yang berjalan (hadir + sakit + izin +
     alfa), dan peserta terdaftar = siswa aktif di kegiatan yang tampil. */
  const rataHadir = terlaksana ? Math.round(hadirS / terlaksana) : 0;
  const rataPeserta = terlaksana ? Math.round(slot / terlaksana) : 0;
  const nKeg = EKSKUL.filter(e => e.aktif !== false).length;
  const terdaftar = PESERTA
    ? `peserta terdaftar ${PESERTA.unik} siswa di ${nKeg} kegiatan · `
    : '';
  const belum = EKSKUL.filter(e => e.aktif !== false && !b.some(x => x.id === e.id)).length;

  const kategori = el('saringKategori').value;
  el('ringkasan').innerHTML = `
    <p class="ket" style="margin-bottom:10px">${tanggalPanjang(dari)} – ${tanggalPanjang(sampai)}${
      kategori ? ` · hanya ${kategori}` : ''}</p>
    ${baris(`${total} pertemuan tercatat`, `${terlaksana} terlaksana · ${total - terlaksana} ditiadakan`)}
    ${baris(`Kehadiran pembina ${persen(pHadir, total)}%`, `${pHadir} dari ${total} pertemuan dihadiri pembina sendiri`)}
    ${baris(`${hadirS} kehadiran siswa dari ${slot} peserta latihan (${persen(hadirS, slot)}%)`,
      `${terdaftar}rata-rata ${rataHadir} dari ${rataPeserta} siswa hadir per latihan`)}
    ${baris(`${berfoto} pertemuan berfoto`, `${total - berfoto} laporan belum melampirkan foto`)}
    ${belum ? baris(`${belum} kegiatan tanpa catatan`, 'tidak ada satu pun laporan pada rentang ini') : ''}`;
}
function baris(a, b) {
  return `<div class="jadwal-hari"><span class="isi"><strong>${a}</strong><small>${b}</small></span></div>`;
}

function gambarTabel() {
  const t = el('tabel');
  const judul = { ekskul: 'Rekap per kegiatan', pertemuan: 'Rincian tiap pertemuan',
                  siswa: 'Kehadiran tiap siswa', pembina: 'Rekap pertemuan per pembina' };
  const ket = {
    ekskul: 'Jumlah pertemuan, kehadiran pembina, dan kehadiran siswa pada rentang tanggal yang dipilih.',
    pertemuan: 'Urut menurut tanggal, lengkap dengan foto kegiatan yang dilampirkan pembina.',
    siswa: 'Diurutkan dari persentase kehadiran terendah, supaya siswa yang jarang datang langsung terlihat.',
    pembina: 'Satu baris satu pertemuan yang benar-benar berjalan, diurutkan menurut nama pembina. ' +
             'Pertemuan yang ditiadakan dan yang pembinanya tidak hadir tidak ikut dihitung. ' +
             'Bentuk inilah yang dipakai untuk perhitungan transport.'
  };
  el('judulTabel').textContent = judul[tab];
  el('ketTabel').textContent = ket[tab];

  if (!SESI.length) {
    t.innerHTML = '<tbody><tr><td class="kosong">Tidak ada pertemuan pada rentang ini.</td></tr></tbody>';
    return;
  }
  if (tab === 'ekskul') return tabelEkskul(t);
  if (tab === 'pertemuan') return tabelPertemuan(t);
  if (tab === 'pembina') return tabelPembina(t);
  return tabelSiswa(t);
}

function tabelEkskul(t) {
  const b = barisEkskul();
  t.innerHTML = `
    <thead><tr><th>Ekstrakurikuler</th><th>Pembina</th><th>Jadwal</th>
      <th class="angka">Pertemuan</th><th class="angka">Terlaksana</th>
      <th class="angka">Pembina hadir</th><th class="angka">Tidak hadir</th>
      <th class="angka">Siswa hadir</th><th class="angka">Rata-rata</th>
      <th class="angka">Tingkat hadir</th><th class="angka">Berfoto</th></tr></thead>
    <tbody>${b.map(x => `<tr>
      <td><strong>${x.nama}</strong>${x.kategori !== 'Ekstrakurikuler'
        ? `<small class="ket">${x.kategori}</small>` : ''}</td><td>${x.pembina}</td><td>${x.jadwal}</td>
      <td class="angka">${x.pertemuan}</td><td class="angka">${x.terlaksana}</td>
      <td class="angka">${x.pHadir}</td><td class="angka">${x.pTidak}</td>
      <td class="angka">${x.hadirSiswa}</td><td class="angka">${x.rata}</td>
      <td class="angka">${x.tingkat}%</td><td class="angka">${x.foto}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="3">Jumlah</td>
      <td class="angka">${b.reduce((a, x) => a + x.pertemuan, 0)}</td>
      <td class="angka">${b.reduce((a, x) => a + x.terlaksana, 0)}</td>
      <td class="angka">${b.reduce((a, x) => a + x.pHadir, 0)}</td>
      <td class="angka">${b.reduce((a, x) => a + x.pTidak, 0)}</td>
      <td class="angka">${b.reduce((a, x) => a + x.hadirSiswa, 0)}</td>
      <td class="angka">—</td><td class="angka">—</td>
      <td class="angka">${b.reduce((a, x) => a + x.foto, 0)}</td></tr></tfoot>`;
}

function tabelPertemuan(t) {
  const nama = Object.fromEntries(EKSKUL.map(e => [e.id, e.nama]));
  t.innerHTML = `
    <thead><tr><th>Tanggal</th><th>Ekstrakurikuler</th><th>Pembina</th>
      <th class="angka">Hadir</th><th class="angka">S</th><th class="angka">I</th><th class="angka">A</th>
      <th>Foto</th><th>Materi</th></tr></thead>
    <tbody>${SESI.map(s => `<tr>
      <td>${tanggalPendek(s.tanggal)}</td>
      <td>${nama[s.ekskul_id] || s.ekskul_id}</td>
      <td><span class="lencana ${LKELAS[s.status_pembina] || ''}">${LABEL[s.status_pembina] || s.status_pembina}</span>${
        s.alasan_tiada ? `<br><small style="color:var(--tinta-2)">${String(s.alasan_tiada).replace(/[<>&]/g, '')}</small>` : ''}</td>
      <td class="angka">${s.H}</td><td class="angka">${s.S}</td>
      <td class="angka">${s.I}</td><td class="angka">${s.A}</td>
      <td>${s.foto
        ? `<a href="${s.foto}" target="_blank" rel="noopener"><img class="foto-mini" src="${s.foto}" alt="Foto latihan"></a>`
        : '<small style="color:var(--tinta-2)">—</small>'}</td>
      <td>${s.materi || ''}</td></tr>`).join('')}</tbody>`;
}

function tabelPembina(t) {
  const b = barisPembina();
  if (!b.length) {
    t.innerHTML = '<tbody><tr><td class="kosong">Tidak ada pertemuan yang berjalan pada rentang ini.</td></tr></tbody>';
    return;
  }
  t.innerHTML = `
    <thead><tr><th class="angka">No.</th><th>Ekstrakurikuler</th><th>Pembina</th>
      <th>Pertemuan</th><th class="angka">Kehadiran Siswa</th><th class="angka">% Kehadiran</th></tr></thead>
    <tbody>${b.map(x => `<tr${x.awal ? ' class="awal-kelompok"' : ''}>
      <td class="angka">${x.no}</td>
      <td${x.ekskul ? ' class="kelompok"' : ''}>${x.ekskul}</td>
      <td>${x.pembina}</td>
      <td>${x.pertemuan}</td>
      <td class="angka">${x.hadir}</td>
      <td class="angka">${x.persen}%</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="3">Jumlah</td>
      <td>${b.length} pertemuan</td>
      <td class="angka">${b.reduce((a, x) => a + x.hadir, 0)}</td>
      <td class="angka">—</td></tr></tfoot>`;
}

function tabelSiswa(t) {
  const b = barisSiswa();
  if (!b.length) {
    t.innerHTML = '<tbody><tr><td class="kosong">Belum ada kehadiran siswa yang tercatat.</td></tr></tbody>';
    return;
  }
  t.innerHTML = `
    <thead><tr><th>Nama siswa</th><th>Kelas</th><th>Ekstrakurikuler</th>
      <th class="angka">Hadir</th><th class="angka">Sakit</th><th class="angka">Izin</th>
      <th class="angka">Alfa</th><th class="angka">Pertemuan</th><th class="angka">Kehadiran</th></tr></thead>
    <tbody>${b.map(x => `<tr>
      <td>${x.nama}</td><td>${x.kelas}</td><td>${x.ekskul}</td>
      <td class="angka">${x.H}</td><td class="angka">${x.S}</td>
      <td class="angka">${x.I}</td><td class="angka">${x.A}</td>
      <td class="angka">${x.total}</td>
      <td class="angka"><span class="lencana ${x.persen >= 80 ? 'l-hadir' : x.persen >= 60 ? 'l-ganti' : 'l-tidak'}">${x.persen}%</span></td>
    </tr>`).join('')}</tbody>`;
}

// --------------------------------------------------------------- unduhan
/* Penanda tangan berkas rekap. Pembina menandatangani rekapnya sendiri;
   bila isi rekap memuat kegiatan satu pembina saja (dibuka Kesiswaan),
   pembina itulah yang menandatangani. Rekap yang mencakup beberapa pembina
   tidak mungkin ditandatangani satu pembina, jadi Wakasek Kesiswaan. */
function penandaTangan() {
  const tampil = EKSKUL.filter(e => SESI.some(s => s.ekskul_id === e.id));
  const jabatan = tampil.length === 1 ? `Pembina ${tampil[0].nama},` : 'Pembina Ekskul,';
  if (AKUN.peran === 'pembina') return ttdPembina(AKUN.nama, jabatan);
  const pembina = [...new Set(tampil.map(e => e.pembina_id).filter(Boolean))];
  if (pembina.length === 1) return ttdPembina(PEMBINA[pembina[0]] || '', jabatan);
  return ttdKesiswaan();
}

function isiUnduhan() {
  const nama = Object.fromEntries(EKSKUL.map(e => [e.id, e.nama]));
  const C = 'center';
  const jumlahKolom = (b, k) => b.reduce((a, x) => a + (x[k] || 0), 0);
  if (tab === 'ekskul') {
    const b = barisEkskul();
    return {
      judul: 'REKAP KEHADIRAN PER KEGIATAN', berkas: 'rekap_kegiatan', melintang: true,
      kolom: [{ t: 'No.', w: 5, rata: C }, { t: 'Kegiatan', w: 24 }, { t: 'Kategori', w: 16 },
              { t: 'Pembina', w: 24 }, { t: 'Jadwal', w: 12 }, { t: 'Pertemuan', w: 10, rata: C },
              { t: 'Terlaksana', w: 10, rata: C }, { t: 'Pembina hadir', w: 10, rata: C },
              { t: 'Ditiadakan', w: 10, rata: C }, { t: 'Siswa hadir', w: 10, rata: C },
              { t: 'Rata-rata', w: 9, rata: C }, { t: 'Tingkat hadir', w: 10, rata: C },
              { t: 'Berfoto', w: 9, rata: C }],
      baris: b.map((x, i) => [i + 1, x.nama, x.kategori, x.pembina, x.jadwal, x.pertemuan, x.terlaksana,
                              x.pHadir, x.pLibur, x.hadirSiswa, x.rata, x.tingkat + '%', x.foto]),
      jumlah: ['', 'Jumlah', '', '', '', jumlahKolom(b, 'pertemuan'), jumlahKolom(b, 'terlaksana'),
               jumlahKolom(b, 'pHadir'), jumlahKolom(b, 'pLibur'), jumlahKolom(b, 'hadirSiswa'), '—', '—',
               jumlahKolom(b, 'foto')]
    };
  }
  if (tab === 'pertemuan') {
    return {
      judul: 'RINCIAN TIAP PERTEMUAN', berkas: 'rincian_pertemuan', melintang: true,
      kolom: [{ t: 'No.', w: 5, rata: C }, { t: 'Tanggal', w: 24 }, { t: 'Kegiatan', w: 22 },
              { t: 'Status pembina', w: 14, rata: C }, { t: 'Hadir', w: 7, rata: C }, { t: 'Sakit', w: 7, rata: C },
              { t: 'Izin', w: 7, rata: C }, { t: 'Alfa', w: 7, rata: C }, { t: 'Foto', w: 7, rata: C },
              { t: 'Materi / alasan', w: 30, bungkus: true }, { t: 'Dicatat oleh', w: 20 }],
      baris: SESI.map((s, i) => [i + 1, tanggalPanjang(s.tanggal), nama[s.ekskul_id] || s.ekskul_id,
        LABEL[s.status_pembina] || s.status_pembina, s.H, s.S, s.I, s.A, s.foto ? 'Ada' : '—',
        s.status_pembina === 'KG' ? (s.alasan_tiada || '') : (s.materi || ''), s.dicatat_oleh || ''])
    };
  }
  if (tab === 'pembina') {
    const b = barisPembina();
    return {
      judul: 'REKAP PERTEMUAN PER PEMBINA', berkas: 'rekap_per_pembina', melintang: false,
      kolom: [{ t: 'No.', w: 5, rata: C }, { t: 'Kegiatan', w: 22 }, { t: 'Pembina', w: 24 },
              { t: 'Pertemuan', w: 26 }, { t: 'Kehadiran Siswa', w: 11, rata: C },
              { t: 'Peserta', w: 9, rata: C }, { t: '% Kehadiran', w: 11, rata: C }],
      baris: b.map(x => [x.no, x.ekskul, x.pembina, x.pertemuan, x.hadir, x.peserta, x.persen + '%']),
      jumlah: ['', 'Jumlah', '', `${b.length} pertemuan`, jumlahKolom(b, 'hadir'), jumlahKolom(b, 'peserta'), '—']
    };
  }
  return {
    judul: 'KEHADIRAN TIAP SISWA', berkas: 'kehadiran_siswa', melintang: false,
    kolom: [{ t: 'No.', w: 5, rata: C }, { t: 'Nama Siswa', w: 28 }, { t: 'Kelas', w: 8, rata: C },
            { t: 'Kegiatan', w: 20 }, { t: 'Hadir', w: 7, rata: C }, { t: 'Sakit', w: 7, rata: C },
            { t: 'Izin', w: 7, rata: C }, { t: 'Alfa', w: 7, rata: C }, { t: 'Pertemuan', w: 10, rata: C },
            { t: 'Kehadiran', w: 10, rata: C }],
    // Di layar diurutkan dari kehadiran terendah; berkasnya per kelas lalu nama.
    baris: barisSiswa().sort((a, b) => urutKelasNama(a, b) || a.ekskul.localeCompare(b.ekskul, 'id')).map((x, i) => [i + 1, x.nama, x.kelas, x.ekskul, x.H, x.S, x.I, x.A, x.total, x.persen + '%'])
  };
}

async function unduh() {
  bersihkanPesan();
  const dari = el('dari').value, sampai = el('sampai').value;
  if (!SESI.length) { laporError('Belum ada data untuk diunduh.'); return; }
  const isi = isiUnduhan();
  if (!isi.baris.length) { laporError('Tabel ini kosong pada rentang yang dipilih.'); return; }
  // Berkas yang disaring diberi penanda kategori di namanya, supaya tidak
  // tertukar dengan berkas yang berisi semua kegiatan.
  const k = el('saringKategori').value;
  const sufiks = k ? '_' + k.toLowerCase().replace(/\s+/g, '_') : '';
  const tombol = el('unduh'), semula = tombol.textContent;
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    await unduhTabelXLSX({
      judul: isi.judul,
      sub: `${k || 'Semua kategori'} · ${tanggalPanjang(dari)} – ${tanggalPanjang(sampai)}`,
      lembar: isi.judul.toLowerCase().replace(/^\w/, c => c.toUpperCase()),
      melintang: isi.melintang, kolom: isi.kolom, baris: isi.baris, jumlah: isi.jumlah,
      ttd: [penandaTangan()],
      namaBerkas: `${isi.berkas}${sufiks}_${dari}_sd_${sampai}.xlsx`
    });
  } catch (e) { laporError(e); }
  finally { tombol.disabled = false; tombol.textContent = semula; }
}

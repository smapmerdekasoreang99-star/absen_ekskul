import { ambilMaster, muatPeriode, namaSiswa } from '../assets/db.js?v=20260921d';
import { wajibMasuk, ekskulBoleh, tandaiMode, laporError, bersihkanPesan, hariIni,
         tanggalPanjang, tanggalPendek, persen, unduhCSV, jam,
         kategoriDari } from '../assets/ui.js?v=20260921d';

const el = id => document.getElementById(id);
const LABEL = { H: 'Hadir', TH: 'Tidak hadir', KG: 'Ditiadakan' };
const LKELAS = { H: 'l-hadir', TH: 'l-tidak', KG: 'l-libur' };

// SEMUA berisi seluruh kegiatan yang boleh dilihat akun ini; EKSKUL adalah
// hasil penyaringan kategori, dan seluruh perhitungan di bawah memakai EKSKUL.
let AKUN = null, SEMUA = [], EKSKUL = [], PEMBINA = {}, SESI = [], KEHADIRAN = [], NAMA = {};
let tab = 'ekskul';

AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

function iso(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }

function pasangPeriode(jenis) {
  const now = new Date();
  if (jenis === 'bulan-ini') {
    el('dari').value = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    el('sampai').value = hariIni();
  } else if (jenis === 'bulan-lalu') {
    el('dari').value = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    el('sampai').value = iso(new Date(now.getFullYear(), now.getMonth(), 0));
  } else {
    const s = new Date(now); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    el('dari').value = iso(s); el('sampai').value = hariIni();
  }
}

document.querySelectorAll('[data-cepat]').forEach(b =>
  b.addEventListener('click', () => { pasangPeriode(b.dataset.cepat); muat(); }));
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
    saringKategori();
    pasangPeriode('bulan-ini');
    await muat();
  } catch (e) { laporError(e); }
})();

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
    const hasil = await muatPeriode(dari, sampai);
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
      hadirSiswa: hadir,
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
  const berfoto = b.reduce((a, x) => a + x.foto, 0);
  const belum = EKSKUL.filter(e => e.aktif !== false && !b.some(x => x.id === e.id)).length;

  const kategori = el('saringKategori').value;
  el('ringkasan').innerHTML = `
    <p class="ket" style="margin-bottom:10px">${tanggalPanjang(dari)} – ${tanggalPanjang(sampai)}${
      kategori ? ` · hanya ${kategori}` : ''}</p>
    ${baris(`${total} pertemuan tercatat`, `${terlaksana} terlaksana · ${total - terlaksana} ditiadakan`)}
    ${baris(`Kehadiran pembina ${persen(pHadir, total)}%`, `${pHadir} dari ${total} pertemuan dihadiri pembina sendiri`)}
    ${baris(`${hadirS} kehadiran siswa`, `rata-rata ${terlaksana ? Math.round(hadirS / terlaksana) : 0} siswa per latihan`)}
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
      <td><span class="lencana ${LKELAS[s.status_pembina] || ''}">${LABEL[s.status_pembina] || s.status_pembina}</span>
</td>
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
function unduh() {
  const dari = el('dari').value, sampai = el('sampai').value;
  if (!SESI.length) { laporError('Belum ada data untuk diunduh.'); return; }
  const nama = Object.fromEntries(EKSKUL.map(e => [e.id, e.nama]));
  // Berkas yang disaring diberi penanda kategori di namanya, supaya tidak
  // tertukar dengan berkas yang berisi semua kegiatan.
  const k = el('saringKategori').value;
  const sufiks = k ? '_' + k.toLowerCase().replace(/\s+/g, '_') : '';
  if (tab === 'ekskul') {
    const b = barisEkskul();
    unduhCSV(`rekap_kegiatan${sufiks}_${dari}_sd_${sampai}.csv`, [
      ['Kegiatan', 'Kategori', 'Pembina', 'Jadwal', 'Pertemuan', 'Terlaksana', 'Pembina hadir',
       'Tidak hadir', 'Ditiadakan', 'Total siswa hadir', 'Rata-rata siswa',
       'Tingkat kehadiran siswa (%)', 'Pertemuan berfoto'],
      ...b.map(x => [x.nama, x.kategori, x.pembina, x.jadwal, x.pertemuan, x.terlaksana, x.pHadir,
                     x.pTidak, x.pLibur, x.hadirSiswa, x.rata, x.tingkat, x.foto])
    ]);
  } else if (tab === 'pertemuan') {
    unduhCSV(`rincian_pertemuan${sufiks}_${dari}_sd_${sampai}.csv`, [
      ['Tanggal', 'Ekstrakurikuler', 'Status pembina', 'Hadir', 'Sakit', 'Izin', 'Alfa',
       'Materi', 'Catatan', 'Foto', 'Dicatat oleh'],
      ...SESI.map(s => [s.tanggal, nama[s.ekskul_id] || s.ekskul_id,
        LABEL[s.status_pembina] || s.status_pembina,
        s.H, s.S, s.I, s.A, s.materi || '', s.catatan || '',
        s.foto || '', s.dicatat_oleh || ''])
    ]);
  } else if (tab === 'pembina') {
    unduhCSV(`rekap_per_pembina${sufiks}_${dari}_sd_${sampai}.csv`, [
      ['No.', 'Ekstrakurikuler', 'Pembina', 'Pertemuan', 'Tanggal',
       'Kehadiran Siswa', 'Peserta terdaftar', '% Kehadiran'],
      ...barisPembina().map((x, i) => [i + 1, x.ekskulPenuh, x.pembinaPenuh, x.pertemuan,
        x.tanggal, x.hadir, x.peserta, x.persen])
    ]);
  } else {
    unduhCSV(`kehadiran_siswa${sufiks}_${dari}_sd_${sampai}.csv`, [
      ['Nama siswa', 'Kelas', 'Ekstrakurikuler', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Pertemuan', 'Kehadiran (%)'],
      ...barisSiswa().map(x => [x.nama, x.kelas, x.ekskul, x.H, x.S, x.I, x.A, x.total, x.persen])
    ]);
  }
}

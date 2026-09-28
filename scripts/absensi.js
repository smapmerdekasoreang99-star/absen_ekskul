import { ambilMaster, pesertaEkskul, ambilSesi, simpanSesi, unggahFoto }
  from '../assets/db.js?v=20260923b';
import { wajibMasuk, ekskulBoleh, tandaiMode, laporError, sukses, bersihkanPesan,
         kompresGambar, hariIni, namaHari, tanggalPanjang, mingguKe, jam, kategoriDari,
         pembimbingDari, dibimbingBersama }
  from '../assets/ui.js?v=20260923b';

const el = id => document.getElementById(id);
let AKUN = null, EKSKUL = [], PEMBINA = {}, SISWA = [], STATUS = {};
// Kehadiran tiap pembimbing pada pertemuan yang sedang diisi: { pembina_id: 'H' | 'TH' }.
// Kosong berarti kegiatannya berpembina tunggal.
let PEMBIMBING = {};
let statusPembina = 'H';
let foto = '';

/* Keadaan simpan (28 September 2026). Tombol menyesuaikan diri:
     belum pernah disimpan           → "Simpan daftar hadir"
     tersimpan, tak ada perubahan    → "✓ Tersimpan · 14.05" (hijau)
     tersimpan lalu diperbaiki       → "Simpan perubahan" + "Ada perubahan yang belum disimpan"
   Pembandingnya potret isian (status pembina, alasan, siswa, pembimbing,
   tempat, materi, catatan, pencatat, foto) sesaat sesudah dimuat atau disimpan.
   Meninggalkan halaman dengan perubahan yang belum disimpan ditanyakan dulu. */
let ACUAN = null, SUDAH_TERSIMPAN = false, WAKTU_SIMPAN = null, MEMUAT = false, MENYIMPAN = false;
/* Terkunci (28 September 2026): catatan yang sudah tersimpan dibuka dalam
   keadaan terkunci — isian tampil tetapi tidak bisa disentuh — supaya
   sentuhan tak sengaja saat menggulir di ponsel tidak mengubahnya. Ubah
   membuka kunci; Batal memuat ulang yang tersimpan; Simpan perubahan
   menyimpan lalu mengunci lagi. Catatan baru selalu terbuka. */
let TERKUNCI = false;
function aturKunci() {
  const kunci = TERKUNCI && SUDAH_TERSIMPAN;
  // Semua kartu isian kecuali kartu pertama (pilihan kegiatan dan tanggal).
  [...document.querySelectorAll('main.wadah > section.kartu')].slice(1).forEach(sec => {
    sec.classList.toggle('terkunci', kunci);
    sec.querySelectorAll('input, select, textarea, button').forEach(x => {
      if (kunci) { if (!x.disabled) { x.disabled = true; x.dataset.dikunci = '1'; } }
      else if (x.dataset.dikunci) { x.disabled = false; delete x.dataset.dikunci; }
    });
  });
  const pita = el('pitaKunci');
  pita.hidden = !kunci;
  if (kunci) pita.innerHTML = `<b>Tersimpan${WAKTU_SIMPAN ? ' ' + waktuTeks(WAKTU_SIMPAN) : ''}.</b>
    Isian terkunci supaya tidak berubah tanpa sengaja — ketuk <b>Ubah</b> untuk memperbaiki.`;
}
const potret = () => JSON.stringify([statusPembina, statusPembina === 'KG' ? susunAlasan() : '',
  el('tempatLatihan').value.trim(), el('materiLatihan').value.trim(), el('catatanSesi').value.trim(),
  el('pencatat').value.trim(), foto, STATUS, PEMBIMBING]);
const jamMenit = d => `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
// Hari ini: jamnya; hari lain: tanggalnya (catatan lama).
const waktuTeks = d => d.toDateString() === new Date().toDateString() ? jamMenit(d) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
function tandaiAcuan(tersimpan, waktu) {
  ACUAN = potret(); SUDAH_TERSIMPAN = tersimpan; WAKTU_SIMPAN = waktu || null;
  perbaruiTombol();
}
const adaPerubahan = () => ACUAN != null && potret() !== ACUAN;
function perbaruiTombol() {
  if (MEMUAT || MENYIMPAN || ACUAN == null) return;
  const t = el('tombolSimpan'), st = el('statusSimpan');
  const berubah = adaPerubahan();
  // Terkunci: "✓ Tersimpan" hanya penanda, di sebelahnya Ubah. Sedang mengubah: Batal + Simpan perubahan.
  const kunci = TERKUNCI && SUDAH_TERSIMPAN;
  el('tombolUbah').hidden = !kunci;
  el('tombolBatal').hidden = !(SUDAH_TERSIMPAN && !TERKUNCI);
  t.disabled = kunci;
  t.classList.toggle('tbl-tersimpan', SUDAH_TERSIMPAN && !berubah);
  if (SUDAH_TERSIMPAN && (kunci || !berubah)) {
    t.textContent = '✓ Tersimpan' + (WAKTU_SIMPAN ? ' · ' + waktuTeks(WAKTU_SIMPAN) : '');
    t.title = 'Catatan tanggal ini sudah tersimpan. Ubah isian bila ada perbaikan.';
  } else {
    t.textContent = SUDAH_TERSIMPAN ? 'Simpan perubahan' : 'Simpan daftar hadir';
    t.title = '';
  }
  st.hidden = !(SUDAH_TERSIMPAN && berubah);
  st.textContent = 'Ada perubahan yang belum disimpan';
}
// Semua isian memicu pemeriksaan; ditunda sejenak supaya penangan lain selesai lebih dulu.
['input', 'change', 'click'].forEach(ev => document.addEventListener(ev, () => setTimeout(perbaruiTombol, 0)));
window.addEventListener('beforeunload', e => {
  if (!MENYIMPAN && adaPerubahan()) { e.preventDefault(); e.returnValue = ''; }
});

AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

(async function mulai() {
  if (!AKUN) return;
  try {
    // Master dari simpanan browser — seketika. Bila versi terbarunya
    // ternyata berbeda, daftar kegiatan disusun ulang tanpa mengganggu
    // yang sedang dipilih.
    const m = await ambilMaster(masterBerubah);
    PEMBINA = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    EKSKUL = ekskulBoleh(AKUN, m.ekskul.filter(e => e.aktif !== false));
    if (!EKSKUL.length) {
      laporError('Belum ada kegiatan yang terdaftar atas nama Anda. Hubungi Wakasek Kesiswaan.');
      return;
    }

    const url = new URLSearchParams(location.search);
    const tgl = url.get('tanggal') || hariIni();
    el('pilihTanggal').value = tgl;

    isiPilihanEkskul(tgl);

    const diminta = url.get('ekskul');
    if (diminta && EKSKUL.some(e => e.id === diminta)) el('pilihEkskul').value = diminta;

    if (AKUN.peran === 'pembina') el('pencatat').value = AKUN.nama;

    el('pilihEkskul').addEventListener('change', muatSesi);
    el('pilihTanggal').addEventListener('change', muatSesi);
    el('cariSiswa').addEventListener('input', gambarSiswa);
    el('semuaHadir').addEventListener('click', () => ubahSemua('H'));
    el('semuaAlfa').addEventListener('click', () => ubahSemua('A'));
    el('tombolSimpan').addEventListener('click', simpan);
    el('berkasFoto').addEventListener('change', pilihFoto);

    el('statusPembina').addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      statusPembina = b.dataset.nilai;
      [...el('statusPembina').children].forEach(x =>
        x.setAttribute('aria-pressed', String(x === b)));
      el('kartuSiswa').classList.toggle('sembunyi', statusPembina === 'KG');
      el('kartuFoto').classList.toggle('sembunyi', statusPembina === 'KG');
      el('kartuAlasan').classList.toggle('sembunyi', statusPembina !== 'KG');
      // Pertemuan yang ditiadakan tidak punya pembimbing yang hadir.
      el('kartuPembimbing').classList.toggle(
        'sembunyi', statusPembina === 'KG' || !Object.keys(PEMBIMBING).length);
      hitung();
    });

    el('tombolUbah').addEventListener('click', () => {
      TERKUNCI = false; aturKunci(); perbaruiTombol();
      bersihkanPesan();
    });
    el('tombolBatal').addEventListener('click', async () => {
      if (adaPerubahan() && !confirm('Batalkan perbaikan? Isian kembali seperti yang tersimpan.')) return;
      await muatSesi();   // memuat ulang yang tersimpan, lalu terkunci lagi
    });
    el('alasanJenis').addEventListener('change', aturPindah);
    el('tanggalPindah').addEventListener('change', aturPindah);

    await muatSesi();
  } catch (e) { laporError(e); }
})();

/* Alasan ditiadakan (28 September 2026). Disimpan sebagai satu teks di
   ae_sesi.alasan_tiada: "<alasan>[ ke <tanggal>] — <keterangan>". Bila
   jadwalnya dipindah, pertemuan penggantinya dicatat pada tanggal barunya
   seperti biasa (halaman ini menandainya "di luar jadwal rutin"). */
const ALASAN = ['Pembina berhalangan', 'Dipindah ke tanggal lain', 'Libur atau kegiatan sekolah',
                'Cuaca atau tempat tidak bisa dipakai', 'Lainnya'];
function aturPindah() {
  const pindah = el('alasanJenis').value === 'Dipindah ke tanggal lain';
  el('kotakPindah').classList.toggle('sembunyi', !pindah);
  const t = el('tanggalPindah').value;
  el('petunjukPindah').innerHTML = pindah
    ? (t ? `Sesudah menyimpan, catat pertemuan penggantinya pada <b>${tanggalPanjang(t)}</b>:
             pilih tanggal itu di atas, lalu isi kehadiran seperti biasa.`
         : 'Isi tanggal penggantinya.')
    : '';
}
function susunAlasan() {
  const jenis = el('alasanJenis').value, ket = el('alasanKet').value.trim(), t = el('tanggalPindah').value;
  if (!jenis) return '';
  const pokok = jenis === 'Dipindah ke tanggal lain' && t ? `Dipindah ke ${tanggalPanjang(t)}` : jenis;
  return ket ? `${pokok} — ${ket}` : pokok;
}
function isiAlasan(teks) {
  const t = teks || '';
  const jenis = t.startsWith('Dipindah ke') ? 'Dipindah ke tanggal lain' : ALASAN.find(a => t.startsWith(a)) || (t ? 'Lainnya' : '');
  el('alasanJenis').value = jenis;
  const pisah = t.indexOf(' — ');
  el('alasanKet').value = jenis === 'Lainnya' && !t.startsWith('Lainnya') ? t : pisah >= 0 ? t.slice(pisah + 3) : '';
  el('tanggalPindah').value = '';
  aturPindah();
}

// Tetap diurutkan "hari ini dulu" — itu yang menolong saat melapor. Kategori
// cukup ditempelkan pada kegiatan yang bukan ekstrakurikuler.
function isiPilihanEkskul(tgl) {
  const hariNama = namaHari(tgl);
  const urut = [...EKSKUL].sort((a, b) =>
    (b.hari === hariNama) - (a.hari === hariNama) || a.nama.localeCompare(b.nama, 'id'));
  el('pilihEkskul').innerHTML = urut.map(e =>
    `<option value="${e.id}">${e.nama} — ${e.hari}${
      kategoriDari(e) !== 'Ekstrakurikuler' ? ` · ${kategoriDari(e)}` : ''}</option>`).join('');
}

// Pembaruan latar mendapati master yang berbeda (kegiatan atau pembina
// berubah di Kesiswaan). Daftarnya disusun ulang; pilihan yang sedang
// dibuka dipertahankan bila masih ada.
function masterBerubah(m) {
  PEMBINA = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
  EKSKUL = ekskulBoleh(AKUN, m.ekskul.filter(e => e.aktif !== false));
  const dipilih = el('pilihEkskul').value;
  isiPilihanEkskul(el('pilihTanggal').value || hariIni());
  if (EKSKUL.some(e => e.id === dipilih)) el('pilihEkskul').value = dipilih;
}

// ---------------------------------------------------------------- memuat
async function muatSesi() {
  bersihkanPesan();
  MEMUAT = true;
  const id = el('pilihEkskul').value;
  const tgl = el('pilihTanggal').value;
  const e = EKSKUL.find(x => x.id === id);
  if (!e || !tgl) return;

  const cocok = e.hari === namaHari(tgl);
  el('infoJadwal').innerHTML =
    `Pembina: <strong>${PEMBINA[e.pembina_id] || 'belum diisi'}</strong> · jadwal ${e.hari} ` +
    `${jam(e.jam_mulai)}–${jam(e.jam_selesai)} · ${tanggalPanjang(tgl)}` +
    (cocok ? '' : ' <span class="lencana l-ganti">di luar jadwal rutin</span>');

  el('daftarSiswa').innerHTML = '<p class="kosong">Memuat peserta…</p>';
  try {
    // Peserta dan catatan hari itu diminta serentak — keduanya hanya butuh
    // kegiatan dan tanggal. Dulu bergiliran, dan tiap giliran satu perjalanan.
    const [siswa, lama] = await Promise.all([
      pesertaEkskul(id, { cepat: true }),
      ambilSesi(id, tgl)
    ]);
    SISWA = siswa;
    STATUS = {};
    SISWA.forEach(s => { STATUS[s.id] = 'A'; });
    foto = '';

    if (lama) {
      // Catatan lama "Tidak hadir" tidak ada lagi; bila tersisa, dibaca sebagai Ditiadakan.
      statusPembina = lama.sesi.status_pembina === 'TH' ? 'KG' : (lama.sesi.status_pembina || 'H');
      isiAlasan(lama.sesi.alasan_tiada);
      el('tempatLatihan').value = lama.sesi.tempat || '';
      el('materiLatihan').value = lama.sesi.materi || '';
      el('catatanSesi').value = lama.sesi.catatan || '';
      el('pencatat').value = lama.sesi.dicatat_oleh || el('pencatat').value;
      foto = lama.sesi.foto || '';
      Object.entries(lama.kehadiran).forEach(([sid, st]) => {
        if (STATUS[sid] !== undefined) STATUS[sid] = st;
      });
      sukses('Catatan tanggal ini sudah tersimpan. Bila ada perbaikan, ubah isiannya lalu ketuk Simpan perubahan.');
    } else {
      statusPembina = 'H';
      isiAlasan('');
      ['materiLatihan', 'catatanSesi'].forEach(k => { el(k).value = ''; });
      el('tempatLatihan').value = e.tempat || '';
    }

    /* Kehadiran pembimbing hanya berlaku bagi kegiatan yang dibimbing lebih
       dari satu orang. Bawaannya semua hadir, karena itu yang umum terjadi;
       yang tidak datang tinggal dilepas centangnya. Catatan lama, bila ada,
       menimpa bawaan itu. */
    PEMBIMBING = {};
    if (dibimbingBersama(e)) {
      pembimbingDari(e).forEach(pid => { PEMBIMBING[pid] = 'H'; });
      if (lama) Object.entries(lama.pembimbing || {}).forEach(([pid, st]) => {
        if (PEMBIMBING[pid] !== undefined) PEMBIMBING[pid] = st;
      });
    }

    [...el('statusPembina').children].forEach(x =>
      x.setAttribute('aria-pressed', String(x.dataset.nilai === statusPembina)));
    el('kartuSiswa').classList.toggle('sembunyi', statusPembina === 'KG');
    el('kartuFoto').classList.toggle('sembunyi', statusPembina === 'KG');
    el('kartuAlasan').classList.toggle('sembunyi', statusPembina !== 'KG');

    gambarPembimbing(e);
    gambarFoto();
    gambarSiswa();
    MEMUAT = false;
    TERKUNCI = !!lama;
    tandaiAcuan(!!lama, lama && lama.sesi.dibuat_pada ? new Date(lama.sesi.dibuat_pada) : null);
    aturKunci();
  } catch (err) { laporError(err); }
  finally { MEMUAT = false; }
}

// ------------------------------------------------------------------ foto
async function pilihFoto(ev) {
  const berkas = ev.target.files && ev.target.files[0];
  if (!berkas) return;
  bersihkanPesan();
  const slot = el('slotFoto');
  const teks = slot.querySelector('span');
  teks.textContent = 'Memproses…';
  try {
    const kecil = await kompresGambar(berkas);
    teks.textContent = 'Mengunggah…';
    foto = await unggahFoto(kecil, el('pilihEkskul').value, el('pilihTanggal').value, 'kegiatan');
    gambarFoto();
    sukses('Foto siap. Jangan lupa ketuk Simpan daftar hadir.');
  } catch (e) {
    gambarFoto();
    laporError(e);
  } finally {
    ev.target.value = '';
  }
}

/* Daftar centang pembimbing yang hadir.

   Tidak ditampilkan sama sekali untuk kegiatan berpembina tunggal: di situ
   kehadirannya sudah dijawab tombol "Hadir / Tidak hadir / Ditiadakan" di
   atas, dan dua tempat untuk satu jawaban hanya membuat orang ragu mana yang
   berlaku. */
function gambarPembimbing(e) {
  const kotak = el('daftarPembimbing');
  const ada = Object.keys(PEMBIMBING).length > 0;
  el('kartuPembimbing').classList.toggle('sembunyi', !ada || statusPembina === 'KG');
  if (!ada) { kotak.innerHTML = ''; return; }
  kotak.innerHTML = pembimbingDari(e).map(pid => `
    <label class="pilih-satu">
      <input type="checkbox" data-pembimbing="${pid}"${PEMBIMBING[pid] === 'H' ? ' checked' : ''}>
      <span>${PEMBINA[pid] || pid}</span>
    </label>`).join('');
  kotak.querySelectorAll('[data-pembimbing]').forEach(b =>
    b.addEventListener('change', () => {
      PEMBIMBING[b.dataset.pembimbing] = b.checked ? 'H' : 'TH';
    }));
}

function gambarFoto() {
  const slot = el('slotFoto');
  slot.querySelectorAll('img,.hapus-foto').forEach(x => x.remove());
  slot.querySelector('span').textContent = foto ? 'Foto kegiatan' : 'Ambil atau pilih foto';
  slot.classList.toggle('terisi', !!foto);
  if (!foto) return;
  const img = document.createElement('img');
  img.src = foto;
  img.alt = 'Foto kegiatan';
  slot.prepend(img);
  const ganti = document.createElement('button');
  ganti.type = 'button';
  ganti.className = 'hapus-foto';
  ganti.textContent = 'Ganti';
  ganti.addEventListener('click', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    foto = '';
    gambarFoto();
  });
  slot.appendChild(ganti);
}

// -------------------------------------------------------------- tampilan
function gambarSiswa() {
  const cari = (el('cariSiswa').value || '').toLowerCase().trim();
  const tampil = SISWA.filter(s =>
    !cari || String(s.nama).toLowerCase().includes(cari) ||
    String(s.kelas || '').toLowerCase().includes(cari));
  const kotak = el('daftarSiswa');

  if (!SISWA.length) {
    kotak.innerHTML = '<p class="kosong">Belum ada siswa terdaftar di ekstrakurikuler ini. ' +
      'Pengelola dapat mendaftarkannya lewat menu Data.</p>';
    hitung(); return;
  }
  if (!tampil.length) { kotak.innerHTML = '<p class="kosong">Tidak ada nama yang cocok.</p>'; return; }

  kotak.innerHTML = tampil.map(s => `
    <div class="siswa">
      <span class="nama">${s.nama}<small>${s.kelas || ''}</small></span>
      <span class="status-pil" data-siswa="${s.id}">
        ${['H', 'S', 'I', 'A'].map(k =>
          `<button type="button" data-s="${k}" aria-pressed="${STATUS[s.id] === k}"
            aria-label="${s.nama} ${k}">${k}</button>`).join('')}
      </span>
    </div>`).join('');

  kotak.querySelectorAll('.status-pil').forEach(grup => {
    grup.addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      STATUS[grup.dataset.siswa] = b.dataset.s;
      [...grup.children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      hitung();
    });
  });
  hitung();
}

function ubahSemua(nilai) {
  SISWA.forEach(s => { STATUS[s.id] = nilai; });
  gambarSiswa();
}

function hitung() {
  if (statusPembina === 'KG') {
    el('hitungHadir').textContent = 'Kegiatan ditiadakan';
    el('hitungDari').textContent = 'kehadiran siswa tidak dihitung';
    return;
  }
  const hadir = SISWA.filter(s => STATUS[s.id] === 'H').length;
  const s = SISWA.filter(x => STATUS[x.id] === 'S').length;
  const i = SISWA.filter(x => STATUS[x.id] === 'I').length;
  el('hitungHadir').textContent = hadir + ' hadir';
  el('hitungDari').textContent = `dari ${SISWA.length} peserta · ${s} sakit · ${i} izin`;
}

// ------------------------------------------------------------- menyimpan
async function simpan() {
  bersihkanPesan();
  const id = el('pilihEkskul').value;
  const tgl = el('pilihTanggal').value;
  if (!id || !tgl) { laporError('Ekstrakurikuler dan tanggal wajib diisi.'); return; }
  const alasan = statusPembina === 'KG' ? susunAlasan() : null;
  if (statusPembina === 'KG' && !alasan) { laporError('Pilih alasan kegiatan ditiadakan.'); el('alasanJenis').focus(); return; }
  if (statusPembina === 'KG' && el('alasanJenis').value === 'Dipindah ke tanggal lain' && !el('tanggalPindah').value) {
    laporError('Isi tanggal penggantinya.'); el('tanggalPindah').focus(); return;
  }
  if (statusPembina === 'KG' && el('alasanJenis').value === 'Lainnya' && !el('alasanKet').value.trim()) {
    laporError('Tulis keterangan alasannya.'); el('alasanKet').focus(); return;
  }
  if (statusPembina !== 'KG' && !foto) {
    if (!confirm('Belum ada foto kegiatan. Simpan tanpa foto?')) return;
  }
  const tombol = el('tombolSimpan');
  const perbaikan = SUDAH_TERSIMPAN;
  tombol.disabled = true;
  MENYIMPAN = true;
  tombol.textContent = 'Menyimpan…';
  try {
    await simpanSesi({
      ekskul_id: id,
      tanggal: tgl,
      minggu_ke: mingguKe(tgl),
      status_pembina: statusPembina,
      alasan_tiada: alasan,
      tempat: el('tempatLatihan').value.trim(),
      materi: el('materiLatihan').value.trim(),
      catatan: el('catatanSesi').value.trim(),
      foto: foto || null,
      dicatat_oleh: el('pencatat').value.trim(),
      kehadiran: statusPembina === 'KG' ? {} : STATUS,
      pembimbing: statusPembina === 'KG' ? {} : PEMBIMBING
    });
    const hadir = SISWA.filter(s => STATUS[s.id] === 'H').length;
    MENYIMPAN = false;
    TERKUNCI = true;
    tandaiAcuan(true, new Date());
    aturKunci();
    sukses((perbaikan ? 'Perbaikan tersimpan. ' : '') + (statusPembina === 'KG'
      ? `Tersimpan. Pertemuan ditandai ditiadakan: ${alasan}.`
      : `Tersimpan. ${hadir} siswa hadir pada ${tanggalPanjang(tgl)}.`));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    MENYIMPAN = false;
    if (ACUAN == null) tombol.textContent = 'Simpan daftar hadir';
    perbaruiTombol();
  }
}

import { ambilMaster, pesertaEkskul, ambilSesi, simpanSesi, unggahFoto }
  from '../assets/db.js?v=20260913h';
import { wajibMasuk, ekskulBoleh, tandaiMode, laporError, sukses, bersihkanPesan,
         kompresGambar, hariIni, namaHari, tanggalPanjang, mingguKe, jam }
  from '../assets/ui.js?v=20260913h';

const el = id => document.getElementById(id);
let AKUN = null, EKSKUL = [], PEMBINA = {}, SISWA = [], STATUS = {};
let statusPembina = 'H';
let foto = '';

AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

(async function mulai() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    PEMBINA = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    EKSKUL = ekskulBoleh(AKUN, m.ekskul.filter(e => e.aktif !== false));
    if (!EKSKUL.length) {
      laporError('Belum ada ekstrakurikuler yang terdaftar atas nama Anda. Hubungi Wakasek Kesiswaan.');
      return;
    }

    const url = new URLSearchParams(location.search);
    const tgl = url.get('tanggal') || hariIni();
    el('pilihTanggal').value = tgl;

    const hariNama = namaHari(tgl);
    const urut = [...EKSKUL].sort((a, b) =>
      (b.hari === hariNama) - (a.hari === hariNama) || a.nama.localeCompare(b.nama, 'id'));
    el('pilihEkskul').innerHTML = urut.map(e =>
      `<option value="${e.id}">${e.nama} — ${e.hari}</option>`).join('');

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
      el('kotakPengganti').classList.toggle('sembunyi', statusPembina !== 'DG');
      el('kartuSiswa').classList.toggle('sembunyi', statusPembina === 'KG');
      el('kartuFoto').classList.toggle('sembunyi', statusPembina === 'KG');
      hitung();
    });

    await muatSesi();
  } catch (e) { laporError(e); }
})();

// ---------------------------------------------------------------- memuat
async function muatSesi() {
  bersihkanPesan();
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
    SISWA = await pesertaEkskul(id);
    STATUS = {};
    SISWA.forEach(s => { STATUS[s.id] = 'A'; });
    foto = '';

    const lama = await ambilSesi(id, tgl);
    if (lama) {
      statusPembina = lama.sesi.status_pembina || 'H';
      el('namaPengganti').value = lama.sesi.pengganti || '';
      el('tempatLatihan').value = lama.sesi.tempat || '';
      el('materiLatihan').value = lama.sesi.materi || '';
      el('catatanSesi').value = lama.sesi.catatan || '';
      el('pencatat').value = lama.sesi.dicatat_oleh || el('pencatat').value;
      foto = lama.sesi.foto || '';
      Object.entries(lama.kehadiran).forEach(([sid, st]) => {
        if (STATUS[sid] !== undefined) STATUS[sid] = st;
      });
      sukses('Catatan tanggal ini sudah pernah diisi. Perubahan akan menimpa catatan lama.');
    } else {
      statusPembina = 'H';
      ['namaPengganti', 'materiLatihan', 'catatanSesi'].forEach(k => { el(k).value = ''; });
      el('tempatLatihan').value = e.tempat || '';
    }

    [...el('statusPembina').children].forEach(x =>
      x.setAttribute('aria-pressed', String(x.dataset.nilai === statusPembina)));
    el('kotakPengganti').classList.toggle('sembunyi', statusPembina !== 'DG');
    el('kartuSiswa').classList.toggle('sembunyi', statusPembina === 'KG');
    el('kartuFoto').classList.toggle('sembunyi', statusPembina === 'KG');

    gambarFoto();
    gambarSiswa();
  } catch (err) { laporError(err); }
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
  if (statusPembina === 'DG' && !el('namaPengganti').value.trim()) {
    laporError('Tulis nama pelatih yang menggantikan.'); return;
  }
  if (statusPembina !== 'KG' && !foto) {
    if (!confirm('Belum ada foto kegiatan. Simpan tanpa foto?')) return;
  }
  const tombol = el('tombolSimpan');
  tombol.disabled = true;
  tombol.textContent = 'Menyimpan…';
  try {
    await simpanSesi({
      ekskul_id: id,
      tanggal: tgl,
      minggu_ke: mingguKe(tgl),
      status_pembina: statusPembina,
      pengganti: el('namaPengganti').value.trim(),
      tempat: el('tempatLatihan').value.trim(),
      materi: el('materiLatihan').value.trim(),
      catatan: el('catatanSesi').value.trim(),
      foto: foto || null,
      dicatat_oleh: el('pencatat').value.trim(),
      kehadiran: statusPembina === 'KG' ? {} : STATUS
    });
    const hadir = SISWA.filter(s => STATUS[s.id] === 'H').length;
    sukses(statusPembina === 'KG'
      ? 'Tersimpan. Pertemuan ditandai ditiadakan.'
      : `Tersimpan. ${hadir} siswa hadir pada ${tanggalPanjang(tgl)}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    laporError(e);
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Simpan daftar hadir';
  }
}

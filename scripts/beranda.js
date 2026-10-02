import { ambilMaster, muatPeriode, jumlahPeserta } from '../assets/db.js?v=20260928d';
import { wajibMasuk, ekskulBoleh, tandaiMode, laporError, hariIni,
         tanggalPanjang, persen, jam, kategoriDari } from '../assets/ui.js?v=20260929f';

const AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

const el = id => document.getElementById(id);
// Isian laporan (tempat, materi, alasan) diketik pengguna, jadi tidak ditulis mentah ke HTML.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const hari = hariIni();
el('tanggalHariIni').textContent = tanggalPanjang(hari);

/* Sapaan (29 September 2026). "Pak"/"Bu" menurut jenis kelamin pembina —
   dari Data Induk untuk guru, dari isian Admin Kesiswaan untuk pelatih
   eksternal (view ae_pembina_aman). Bila belum diisi, "Bapak/Ibu": lebih
   baik netral daripada menebak dari nama. Gelar di belakang koma tidak ikut
   disebut. Sebelum data pembina termuat, sapaannya netral dulu. */
const jamNow = new Date().getHours();
const salam = jamNow < 11 ? 'Selamat pagi' : jamNow < 15 ? 'Selamat siang'
  : jamNow < 18 ? 'Selamat sore' : 'Selamat malam';
const pembina = AKUN && AKUN.peran === 'pembina';
const namaPendek = AKUN ? String(AKUN.nama || '').split(',')[0].trim() : '';
// SAPA dipakai di sapaan ("Pak Ervint"), SEBUT di dalam kalimat ("Bapak sebagai Pembina…").
let SAPA = 'Bapak/Ibu', SEBUT = 'Bapak/Ibu';
function pasangSapaan() {
  el('sapaan').textContent = pembina ? `${salam}, ${SAPA} ${namaPendek}` : `${salam}, Admin Kesiswaan`;
}
pasangSapaan();

function senin(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function tambahHari(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

(async function muat() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    const namaPembina = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    const ekskul = ekskulBoleh(AKUN, m.ekskul.filter(e => e.aktif !== false));
    if (pembina) {
      const jk = (m.pembina.find(p => p.id === AKUN.pembina_id) || {}).jenis_kelamin;
      if (jk === 'L') { SAPA = 'Pak'; SEBUT = 'Bapak'; }
      else if (jk === 'P') { SAPA = 'Bu'; SEBUT = 'Ibu'; }
      pasangSapaan();
    }

    el('peranKu').innerHTML = pembina
      ? (ekskul.length
          ? ekskul.map(e => `<span>${esc(e.nama)}</span>`).join('')
          : '<span>Belum ada kegiatan atas nama Anda</span>')
      : '<span>Admin Kesiswaan</span>';

    const awal = senin(hari);
    // Kesiswaan memuat beberapa pekan ke belakang untuk menghitung tunggakan
    // berturut-turut; pembina cukup pekan ini.
    const dari = pembina ? awal : tambahHari(awal, -7 * (PEKAN_TUNGGAKAN - 1));
    // Peserta terdaftar; bila gagal, beranda tetap tampil tanpa angka itu.
    const [{ sesi }, peserta] = await Promise.all([
      muatPeriode(dari, hari),
      jumlahPeserta(ekskul.map(e => e.id)).catch(e => { console.warn(e.message); return null; })
    ]);
    const boleh = new Set(ekskul.map(e => e.id));
    const semua = sesi.filter(s => boleh.has(s.ekskul_id));
    const minggu = semua.filter(s => s.tanggal >= awal);

    // Kotak "Latihan hari ini" dan "Minggu ini" dihapus (29 September 2026):
    // laporan minggu ini sudah memuat keduanya — yang sudah dan belum
    // melapor, beserta kehadiran siswanya. Ringkasan angka ada di Rekapitulasi.
    if (pembina) gambarLaporanKu(ekskul, minggu, peserta, awal);
    else gambarLaporanSemua(ekskul, minggu, peserta, awal, namaPembina, semua);
  } catch (e) { laporError(e); }
})();

/* Tanggal jadwal rutin sebuah kegiatan pada pekan yang dimulai `awal`. */
const URUT_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
function tanggalJadwal(e, awal) {
  const i = URUT_HARI.indexOf(e.hari);
  return i >= 0 ? tambahHari(awal, i) : null;
}
const nadaPersen = p => p >= 80 ? 'baik' : p >= 60 ? 'sedang' : 'kurang';

/* Tunggakan laporan berturut-turut (3 Oktober 2026). Kotak Belum laporan
   semula hanya melihat pekan ini, sehingga pembina yang tidak melapor tiga
   minggu tampak sama dengan yang baru terlambat sehari, dan tunggakannya
   hilang tiap Senin. Kini dihitung mundur dari pekan ini sampai
   PEKAN_TUNGGAKAN pekan (pekan ini ikut dihitung):
     - pekan yang ada laporannya memutus hitungan;
     - pekan ini yang jadwalnya belum tiba dilewati, tidak memutus;
     - pekan lalu yang sama sekali tanpa laporan dari kegiatan mana pun
       (libur sekolah, atau sebelum aplikasi dipakai) juga dilewati, supaya
       tidak semua kegiatan mendadak tampak menunggak.
   Hasilnya { n, tanggal }: jumlah pekan terlewat dan tanggal jadwal yang
   paling baru terlewat (tujuan tombol Isi laporan). */
const PEKAN_TUNGGAKAN = 4;
function hitungTunggakan(e, semua, awal) {
  const pekanDipakai = new Set(semua.map(s => senin(s.tanggal)));
  const lapor = new Set(semua.filter(s => s.ekskul_id === e.id).map(s => senin(s.tanggal)));
  let n = 0, tanggal = null;
  for (let k = 0; k < PEKAN_TUNGGAKAN; k++) {
    const pekan = tambahHari(awal, -7 * k);
    if (lapor.has(pekan)) break;
    const t = tanggalJadwal(e, pekan);
    if (k === 0 && t && t > hari) continue;
    if (k > 0 && !pekanDipakai.has(pekan)) continue;
    n++;
    if (!tanggal) tanggal = t || pekan;
  }
  return { n, tanggal };
}

/* Laporan minggu ini untuk Kesiswaan (29 September 2026), kotak kedua
   dari atas. Dua daftar:
     a. Sudah laporan — tiap pertemuan yang dilaporkan pekan ini: hari/
        tanggal, lokasi, dan siswa hadir dibanding seluruh peserta terdaftar.
        Pertemuan yang dilaporkan ditiadakan ikut di sini beserta alasannya.
     b. Belum laporan — kegiatan yang jadwal rutinnya pekan ini sudah lewat
        (termasuk hari ini) tetapi belum ada laporannya.
   Kegiatan yang jadwalnya belum tiba tidak dihitung terlambat; ia masuk
   kotak ketiga, Menunggu jadwal, dikelompokkan per hari. */
function gambarLaporanSemua(ekskul, minggu, peserta, awal, namaPembina, semua) {
  el('kartuLaporanSemua').classList.remove('sembunyi');
  el('ketLaporanSemua').textContent = `${tanggalPanjang(awal)} sampai hari ini.`;
  const namaKeg = Object.fromEntries(ekskul.map(e => [e.id, e]));

  const sudah = [...minggu].sort((a, b) => a.tanggal.localeCompare(b.tanggal) ||
    String((namaKeg[a.ekskul_id] || {}).nama).localeCompare(String((namaKeg[b.ekskul_id] || {}).nama), 'id'));
  const melapor = new Set(minggu.map(s => s.ekskul_id));
  const belum = [], nanti = [];
  ekskul.forEach(e => {
    if (melapor.has(e.id)) return;
    const t = tanggalJadwal(e, awal);
    const tunggak = hitungTunggakan(e, semua, awal);
    // Jadwal pekan ini belum tiba tetapi pekan lalu sudah menunggak: tetap
    // masuk Belum laporan (dan tetap tampil di Menunggu jadwal).
    if (t && t > hari) nanti.push(e);
    if (!(t && t > hari) || tunggak.n) belum.push({ e, t, tunggak, lalu: !!(t && t > hari) });
  });
  // Tunggakan terpanjang di atas, lalu menurut tanggal jadwal dan nama.
  belum.sort((a, b) => b.tunggak.n - a.tunggak.n ||
    String(a.tunggak.tanggal || a.t).localeCompare(String(b.tunggak.tanggal || b.t)) ||
    a.e.nama.localeCompare(b.e.nama, 'id'));

  el('hitungSudah').textContent = sudah.length;
  el('hitungBelum').textContent = belum.length;

  el('daftarSudah').innerHTML = sudah.length ? sudah.map(s => {
    const e = namaKeg[s.ekskul_id] || { nama: s.ekskul_id };
    const kepala = `<div class="lp-kepala"><strong>${esc(e.nama)}</strong>
      <small>${esc(namaPembina[e.pembina_id] || 'Pembina belum diisi')}</small></div>`;
    /* Tiap laporan bisa dipilih (29 September 2026): membuka laporan
       kegiatan itu pada tanggalnya, dalam keadaan terkunci. */
    const buka = isi => `<a class="lp-tautan" href="absensi.html?ekskul=${encodeURIComponent(s.ekskul_id)}&tanggal=${s.tanggal}"
        aria-label="Buka laporan ${esc(e.nama)}, ${tanggalPanjang(s.tanggal)}">${isi}
        <span class="lp-lihat" aria-hidden="true">Lihat laporan ›</span></a>`;
    if (s.status_pembina === 'KG') return `
      <li class="lp-item lp-pilih lp-tiada">${buka(`${kepala}
        <div class="lp-baris"><span><em>Hari/Tanggal</em>${tanggalPanjang(s.tanggal)}</span>
          <span><em>Keterangan</em><b class="lencana l-libur">Ditiadakan</b> ${esc(s.alasan_tiada || '')}</span></div>`)}
      </li>`;
    const dasar = peserta ? (peserta.per[s.ekskul_id] || 0) : (s.H + s.S + s.I + s.A);
    const p = persen(s.H, dasar), nada = nadaPersen(p);
    return `
      <li class="lp-item lp-pilih">${buka(`${kepala}
        <div class="lp-baris">
          <span><em>Hari/Tanggal</em>${tanggalPanjang(s.tanggal)}</span>
          <span><em>Lokasi</em>${esc(s.tempat) || '<i class="redup">tidak diisi</i>'}</span>
        </div>
        <div class="lp-hadir">
          <span><em>Siswa hadir</em><b>${s.H}</b> dari seluruh peserta <b>${dasar}</b></span>
          <span class="lap-persen ${nada}">${p}%</span>
          <span class="lap-bilah ${nada}" aria-hidden="true"><i style="width:${Math.min(100, p)}%"></i></span>
        </div>`)}
      </li>`;
  }).join('') : '<li class="lp-kosong">Belum ada kegiatan yang melapor minggu ini.</li>';

  /* Lencana tunggakan: 2 pekan berturut-turut kuning, 3 pekan atau lebih
     merah dan kartunya ikut bergaris merah. Satu pekan tanpa lencana —
     itu keadaan Belum laporan yang biasa. */
  const lencanaTunggak = n => n < 2 ? ''
    : `<b class="lencana ${n >= 3 ? 'l-tidak' : 'l-ganti'}">${n >= PEKAN_TUNGGAKAN ? `${n} minggu atau lebih` : `${n} minggu`} berturut-turut</b>`;
  el('daftarBelum').innerHTML = belum.length ? belum.map(({ e, t, tunggak, lalu }) => {
    const tuju = tunggak.tanggal || (t && t <= hari ? t : hari);
    const jadwal = lalu
      ? `<span><em>Terlewat</em>${tanggalPanjang(tunggak.tanggal)}</span>
         <span><em>Pekan ini</em>${tanggalPanjang(t)}</span>`
      : `<span><em>Jadwal</em>${t ? tanggalPanjang(t) : esc(e.hari || '—')}${t === hari ? ' <b class="lencana l-ganti">hari ini</b>' : ''}
            · ${jam(e.jam_mulai)}–${jam(e.jam_selesai)}</span>`;
    return `
      <li class="lp-item${tunggak.n >= 3 ? ' lp-parah' : ''}">
        <div class="lp-kepala"><strong>${esc(e.nama)}</strong>
          <small>${esc(namaPembina[e.pembina_id] || 'Pembina belum diisi')}</small></div>
        ${tunggak.n >= 2 ? `<div class="lp-tunggak">${lencanaTunggak(tunggak.n)}</div>` : ''}
        <div class="lp-baris">
          ${jadwal}
          <a class="tbl tbl-kecil" href="absensi.html?ekskul=${e.id}&tanggal=${tuju}">Isi laporan</a>
        </div>
      </li>`;
  }).join('')
    : '<li class="lp-kosong lp-lengkap">✓ Semua kegiatan yang jadwalnya sudah lewat telah melapor.</li>';

  /* Menunggu jadwal: kotak tersendiri, dikelompokkan per hari supaya
     terbaca sekilas hari apa saja masih ada latihan pekan ini. */
  el('grupMenunggu').classList.toggle('sembunyi', !nanti.length);
  el('hitungMenunggu').textContent = nanti.length;
  const perHari = {};
  nanti.forEach(e => { const t = tanggalJadwal(e, awal); (perHari[t] || (perHari[t] = [])).push(e); });
  el('daftarMenunggu').innerHTML = Object.keys(perHari).sort().map(t => `
      <li class="lp-item lp-hari">
        <div class="lp-tanggal">${tanggalPanjang(t)}</div>
        <div class="lp-chip">${perHari[t]
          .sort((a, b) => String(a.jam_mulai).localeCompare(String(b.jam_mulai)) || a.nama.localeCompare(b.nama, 'id'))
          .map(e => `<span title="${esc(namaPembina[e.pembina_id] || '')}"><b>${esc(e.nama)}</b> ${jam(e.jam_mulai)}</span>`).join('')}</div>
      </li>`).join('');
}

/* Laporan minggu ini untuk pembina (29 September 2026): satu kotak per
   kegiatan yang dibimbingnya. Yang sudah melapor mendapat ucapan terima
   kasih beserta isi laporannya — hari/tanggal, tempat, materi, dan
   kehadiran siswa dibanding seluruh peserta terdaftar. Yang belum melapor
   mendapat pengingat dan tombol langsung ke pengisiannya. */
function gambarLaporanKu(ekskul, minggu, peserta, awal) {
  el('kartuLaporanKu').classList.remove('sembunyi');
  el('ketLaporanKu').textContent = `${tanggalPanjang(awal)} sampai hari ini.`;
  const kotak = el('laporanKu');
  if (!ekskul.length) {
    kotak.innerHTML = '<p class="kosong">Belum ada kegiatan yang terdaftar atas nama Anda. Hubungi Wakasek Kesiswaan.</p>';
    return;
  }
  kotak.innerHTML = ekskul.map(e => {
    const kat = kategoriDari(e);
    const sebutan = kat === 'Ekstrakurikuler'
      ? `Pembina Ekstrakurikuler <b>${esc(e.nama)}</b>`
      : `Pembina <b>${esc(e.nama)}</b> (${esc(kat)})`;
    const laporan = minggu.filter(s => s.ekskul_id === e.id).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const terdaftar = peserta ? (peserta.per[e.id] || 0) : null;
    const jadwal = `${e.hari}, ${jam(e.jam_mulai)}–${jam(e.jam_selesai)}`;

    if (!laporan.length) {
      // Tanggal jadwal pekan ini bila sudah lewat; bila belum tiba, hari ini.
      const urutan = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].indexOf(e.hari);
      const tglJadwal = urutan >= 0 ? tambahHari(awal, urutan) : hari;
      const tuju = tglJadwal <= hari ? tglJadwal : hari;
      // Jadwal pekan ini belum tiba: bukan terlambat, cukup diberi tahu kapan.
      if (tglJadwal > hari) return `
      <article class="lap lap-nanti">
        <header><h3>${esc(e.nama)}</h3><span class="lap-status">Menunggu jadwal</span></header>
        <p class="lap-kalimat">Latihan <b>${esc(e.nama)}</b> minggu ini dijadwalkan pada
          <b>${tanggalPanjang(tglJadwal)}</b>, pukul ${jam(e.jam_mulai)}–${jam(e.jam_selesai)}.
          Laporannya diisi sesudah latihan berlangsung.</p>
      </article>`;
      return `
      <article class="lap lap-belum">
        <header><h3>${esc(e.nama)}</h3><span class="lap-status">Belum melapor</span></header>
        <p class="lap-kalimat">Minggu ini ${SEBUT} sebagai ${sebutan} di SMA Plus Merdeka Soreang
          <b>belum melaporkan</b> pelaksanaan kegiatan. Jadwal rutin: ${esc(jadwal)}.</p>
        <a class="tbl tbl-utama tbl-kecil" href="absensi.html?ekskul=${e.id}&tanggal=${tuju}">Isi daftar hadir</a>
      </article>`;
    }

    const rincian = laporan.map(s => {
      const tanggal = tanggalPanjang(s.tanggal);
      if (s.status_pembina === 'KG') return `
        <dl class="lap-rinci">
          <div><dt>Hari/Tanggal</dt><dd>${tanggal}</dd></div>
          <div><dt>Keterangan</dt><dd><span class="lencana l-libur">Ditiadakan</span> ${esc(s.alasan_tiada || '')}</dd></div>
        </dl>`;
      const dasar = terdaftar ?? (s.H + s.S + s.I + s.A);
      const p = persen(s.H, dasar);
      const warna = p >= 80 ? 'baik' : p >= 60 ? 'sedang' : 'kurang';
      const lain = [s.S && `${s.S} sakit`, s.I && `${s.I} izin`, s.A && `${s.A} alfa`].filter(Boolean).join(' · ');
      return `
        <dl class="lap-rinci">
          <div><dt>Hari/Tanggal</dt><dd>${tanggal}</dd></div>
          <div><dt>Tempat latihan</dt><dd>${esc(s.tempat) || '<span class="redup">tidak diisi</span>'}</dd></div>
          <div><dt>Materi latihan</dt><dd>${esc(s.materi) || '<span class="redup">tidak diisi</span>'}</dd></div>
          <div><dt>Kehadiran siswa</dt><dd>
            <b class="lap-angka">${s.H}</b> hadir dari <b>${dasar}</b> peserta seluruhnya
            <span class="lap-persen ${warna}">${p}%</span>
            <span class="lap-bilah ${warna}" aria-hidden="true"><i style="width:${Math.min(100, p)}%"></i></span>
            ${lain ? `<small>${lain}</small>` : ''}</dd></div>
        </dl>`;
    }).join('');

    return `
      <article class="lap lap-sudah">
        <header><h3>${esc(e.nama)}</h3><span class="lap-status">✓ Sudah melapor</span></header>
        <p class="lap-kalimat"><b>Terima kasih.</b> Minggu ini ${SEBUT} sebagai ${sebutan} di
          SMA Plus Merdeka Soreang telah melaporkan pelaksanaan kegiatan pada:</p>
        ${rincian}
      </article>`;
  }).join('');
}

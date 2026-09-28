import { ambilMaster, muatPeriode, jumlahPeserta } from '../assets/db.js?v=20260928d';
import { wajibMasuk, ekskulBoleh, tandaiMode, laporError, hariIni, namaHari,
         tanggalPanjang, persen, jam } from '../assets/ui.js?v=20260928e';

const AKUN = wajibMasuk(false);
try { tandaiMode(); } catch (e) { console.error(e); }

const hari = hariIni();
document.getElementById('tanggalHariIni').textContent = tanggalPanjang(hari);

const jamNow = new Date().getHours();
document.getElementById('sapaan').textContent =
  jamNow < 11 ? 'Selamat pagi' : jamNow < 15 ? 'Selamat siang'
  : jamNow < 18 ? 'Selamat sore' : 'Selamat malam';

function senin(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function baris(a, b) {
  return `<div class="jadwal-hari"><span class="isi"><strong>${a}</strong><small>${b}</small></span></div>`;
}

(async function muat() {
  if (!AKUN) return;
  try {
    const m = await ambilMaster();
    const namaPembina = Object.fromEntries(m.pembina.map(p => [p.id, p.nama]));
    const ekskul = ekskulBoleh(AKUN, m.ekskul.filter(e => e.aktif !== false));
    const hariNama = namaHari(hari);

    const awal = senin(hari);
    // Peserta terdaftar untuk ringkasan; bila gagal, beranda tetap tampil tanpa angka itu.
    const [{ sesi }, peserta] = await Promise.all([
      muatPeriode(awal, hari),
      jumlahPeserta(ekskul.map(e => e.id)).catch(e => { console.warn(e.message); return null; })
    ]);
    const boleh = new Set(ekskul.map(e => e.id));
    const minggu = sesi.filter(s => boleh.has(s.ekskul_id));
    const sudah = new Set(minggu.filter(s => s.tanggal === hari).map(s => s.ekskul_id));

    const kotak = document.getElementById('jadwalHariIni');
    const list = ekskul.filter(e => e.hari === hariNama);
    if (!list.length) {
      kotak.innerHTML = `<p class="kosong">Tidak ada jadwal latihan pada hari ${hariNama}.` +
        ' Laporan susulan tetap bisa diisi lewat menu Absen Siswa.</p>';
    } else {
      kotak.innerHTML = list.map(e => `
        <a class="jadwal-hari" style="text-decoration:none;color:inherit"
           href="absensi.html?ekskul=${e.id}&tanggal=${hari}">
          <span class="jam">${jam(e.jam_mulai)}</span>
          <span class="isi"><strong>${e.nama}</strong>
            <small>${namaPembina[e.pembina_id] || 'Pembina belum diisi'} ·
              ${jam(e.jam_mulai)}–${jam(e.jam_selesai)}</small></span>
          <span style="font-weight:700;color:${sudah.has(e.id) ? 'var(--hadir)' : 'var(--emas)'}">
            ${sudah.has(e.id) ? 'Sudah' : 'Lapor'}</span>
        </a>`).join('');
    }

    const terlaksana = minggu.filter(s => s.status_pembina !== 'KG');
    const hadirSiswa = terlaksana.reduce((a, s) => a + s.H, 0);
    // Sama seperti Ringkasan di Rekap: "dari" = peserta tercatat pada latihan
    // yang berjalan (H+S+I+A); peserta terdaftar = siswa aktif berbeda.
    const slot = terlaksana.reduce((a, s) => a + s.H + s.S + s.I + s.A, 0);
    const n = terlaksana.length;
    const terdaftar = peserta ? `peserta terdaftar ${peserta.unik} siswa di ${ekskul.length} kegiatan · ` : '';
    const berfoto = minggu.filter(s => s.foto).length;
    const belum = ekskul.filter(e => !minggu.some(s => s.ekskul_id === e.id)).length;

    document.getElementById('ringkasMinggu').innerHTML =
      baris(`${minggu.length} laporan minggu ini`,
            `${terlaksana.length} terlaksana · ${minggu.length - terlaksana.length} ditiadakan`) +
      baris(`${hadirSiswa} kehadiran siswa dari ${slot} peserta latihan (${persen(hadirSiswa, slot)}%)`,
            `${terdaftar}rata-rata ${n ? Math.round(hadirSiswa / n) : 0} dari ${n ? Math.round(slot / n) : 0} siswa hadir per latihan`) +
      baris(`${berfoto} laporan berfoto`,
            `${persen(berfoto, minggu.length)}% laporan melampirkan foto kegiatan`) +
      (belum ? baris(`${belum} ekstrakurikuler belum melapor`,
            'sejak Senin sampai hari ini') : '');
  } catch (e) { laporError(e); }
})();

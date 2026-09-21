// Lapisan akses data. Semua halaman memanggil fungsi di sini, sehingga
// halaman tidak perlu tahu apakah datanya dari Supabase atau contoh.
// Konfigurasi diimpor sebagai satu kesatuan, bukan per nama, supaya
// berkas konfigurasi lama yang belum memuat seluruh pengaturan tetap
// bisa dimuat dan kekurangannya ditambal oleh nilai bawaan di bawah.
import * as CFG from './supabase-client.js?v=20260921d';
import { pakaiRujukan, lupakanRujukan } from './simpanan.js?v=20260921d';

const { klien, klienSiswa, terhubung, SUMBER_SISWA, BUCKET_FOTO } = CFG;
const G = CFG.SUMBER_GURU || { tabel: 'guru', id: 'id', nama: 'nama', tmt: 'tmt_sekolah' };

// Status pembina diturunkan dari keterkaitannya dengan data guru.
const berjenis = p => ({ ...p, jenis: p.id_guru ? 'Internal' : 'Eksternal' });
import * as D from './demo-data.js?v=20260921d';

export const MODE = terhubung ? 'supabase' : 'contoh';

const salin = x => JSON.parse(JSON.stringify(x));

async function sb() {
  const c = await klien();
  if (!c) throw new Error('Supabase belum terhubung.');
  return c;
}
function periksa(res, apa) {
  if (res.error) throw new Error(apa + ': ' + res.error.message);
  return res.data;
}

// Nama tabel bawaan. Nilai dari TABEL menimpanya, tetapi bila ada kunci
// yang belum tercantum di supabase-client.js, bawaan inilah yang dipakai.
// Ini mencegah galat "relation must be a non-empty string" ketika berkas
// konfigurasi lama masih terpakai.
const T = {
  pembina:   'ae_pembina',       // ditulisi
  pembinaBaca: 'ae_pembina_aman', // dibaca — tanpa kolom PIN
  ekskul:    'ae_ekskul',
  peserta:   'ae_peserta',
  sesi:      'ae_sesi',
  kehadiran: 'ae_kehadiran',
  periode:   'ae_periode',
  nilai:     'ae_nilai',
  pembimbing:     'ae_ekskul_pembimbing', // daftar pembimbing sebuah kegiatan
  sesiPembimbing: 'ae_sesi_pembimbing',   // siapa yang hadir membimbing tiap pertemuan
  ...(CFG.TABEL || {})
};

const K = SUMBER_SISWA;
const kolomSiswa = () => [K.id, K.nis, K.nama, K.kelas].filter(Boolean).join(',');
const rapikan = s => ({
  id: String(s[K.id]),
  nis: K.nis ? (s[K.nis] || '') : '',
  nama: s[K.nama],
  kelas: s[K.kelas] || ''
});
async function sbSiswa() {
  const c = await klienSiswa();
  if (!c) throw new Error('Sumber data siswa belum terhubung.');
  return c;
}

/* ---------------------------------------------------------------- master
   Daftar pembimbing ditempelkan ke tiap kegiatan sebagai `pembimbing`, supaya
   seluruh layar cukup bertanya sekali "siapa saja yang membimbing ini" lewat
   pembimbingDari() di ui.js. Kegiatan berpembina tunggal tidak punya baris di
   ae_ekskul_pembimbing, jadi larik ini kosong dan helper itu jatuh ke
   pembina_id — dua keadaan, seperti yang ditetapkan di database. */
export async function ambilMaster(saatBerubah) {
  if (MODE === 'contoh')
    return { ekskul: salin(D.EKSKUL), pembina: salin(D.PEMBINA).map(berjenis) };
  return pakaiRujukan('master', ambilMasterJaringan, saatBerubah);
}
async function ambilMasterJaringan() {
  const c = await sb();
  const [e, p, b] = await Promise.all([
    c.from(T.ekskul).select('*').order('id'),
    c.from(T.pembinaBaca).select('*').order('nama'),
    c.from(T.pembimbing).select('ekskul_id,pembina_id')
  ]);
  const ekskul = periksa(e, 'Gagal memuat ekstrakurikuler');
  const daftar = new Map();
  periksa(b, 'Gagal memuat daftar pembimbing').forEach(x => {
    if (!daftar.has(x.ekskul_id)) daftar.set(x.ekskul_id, []);
    daftar.get(x.ekskul_id).push(x.pembina_id);
  });
  ekskul.forEach(x => { x.pembimbing = daftar.get(x.id) || []; });
  return {
    ekskul,
    pembina: periksa(p, 'Gagal memuat pembina').map(berjenis)
  };
}

/* Mengganti seluruh daftar pembimbing sebuah kegiatan.
   Dihapus dulu lalu diisi ulang, bukan disisipkan satu-satu: daftar ini
   bermakna sebagai KESELURUHAN — siapa yang tidak ada di dalamnya berarti
   tidak lagi membimbing, dan itu harus ikut tersimpan.

   Larik kosong berarti kegiatan itu kembali berpembina tunggal. */
export async function simpanPembimbingKegiatan(ekskulId, daftarPembina) {
  lupakanRujukan('master');
  if (MODE === 'contoh') {
    const e = D.EKSKUL.find(x => x.id === ekskulId);
    if (e) e.pembimbing = [...daftarPembina];
    return;
  }
  const c = await sb();
  periksa(await c.from(T.pembimbing).delete().eq('ekskul_id', ekskulId),
          'Gagal memperbarui daftar pembimbing');
  if (!daftarPembina.length) return;
  periksa(await c.from(T.pembimbing).insert(
            daftarPembina.map(pembina_id => ({ ekskul_id: ekskulId, pembina_id }))),
          'Gagal menyimpan daftar pembimbing');
}

/* Memeriksa PIN pembina DI DATABASE, bukan di peramban.

   Sebelumnya halaman masuk mengunduh seluruh isi tabel pembina — termasuk
   kolom PIN — lalu membandingkannya di sini. Akibatnya PIN setiap pembina
   bisa dibaca siapa pun yang membuka peralatan pengembang, atau bahkan
   cukup memanggil API-nya dengan kunci publik yang memang tertulis di
   dalam kode ini. Kini PIN tidak pernah meninggalkan database: fungsi
   f_ae_masuk_pembina hanya menjawab cocok atau tidak. */
export async function cekPembina(pembinaId, pin) {
  if (MODE === 'contoh') {
    const p = D.PEMBINA.find(x => x.id === pembinaId);
    if (!p) throw new Error('Pembina tidak ditemukan.');
    if (!p.kode_akses) throw new Error('Pembina ini belum diberi PIN. Hubungi Wakasek Kesiswaan.');
    if (String(p.kode_akses).trim() !== String(pin).trim()) throw new Error('PIN salah.');
    return berjenis(p);
  }
  const c = await sb();
  const { data, error } = await c.rpc('f_ae_masuk_pembina', { p_id: pembinaId, p_pin: pin });
  // Pesan dari database sudah jelas bagi pembina ("PIN salah.", "Pembina ini
  // belum diberi PIN…"), jadi diteruskan apa adanya.
  if (error) throw new Error(error.message.replace(/^.*?:s*/, ''));
  const p = (data || [])[0];
  if (!p) throw new Error('PIN salah.');
  return berjenis(p);
}

// --------------------------------------------------------------- peserta
// Membaca peserta satu ekskul. Nama & kelas diambil dari tabel siswa
// milik aplikasi Tryout & Asesmen; bila tabel itu tidak terbaca, dipakai
// salinan nama yang tersimpan saat pendaftaran.
export async function pesertaEkskul(ekskulId, { cepat = false } = {}) {
  if (MODE === 'contoh') {
    return D.PESERTA.filter(p => p.ekskul_id === ekskulId && p.aktif)
      .map(p => {
        const s = D.SISWA.find(x => x.id === p.siswa_id) || {};
        return { id: p.siswa_id, nis: s.nis || '', nama: s.nama || p.nama_siswa, kelas: s.kelas || p.kelas };
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }
  const c = await sb();
  const baris = periksa(
    await c.from(T.peserta).select('siswa_id,nama_siswa,kelas')
      .eq('ekskul_id', ekskulId).eq('aktif', true),
    'Gagal memuat peserta'
  );
  if (!baris.length) return [];

  /* Jalur cepat untuk halaman yang hanya perlu nama untuk mengabsen atau
     menilai: salinan nama dan kelas yang dibuat saat pendaftaran sudah
     cukup, dan pencocokan ke tabel siswa sekolah — satu perjalanan lagi,
     bergiliran — dilewati. Halaman Data Peserta tetap memakai jalur penuh,
     karena di sanalah nama yang berubah perlu terlihat. */
  if (cepat)
    return baris.map(b => ({ id: b.siswa_id, nis: '', nama: b.nama_siswa || b.siswa_id, kelas: b.kelas || '' }))
      .sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id'));

  let terbaru = {};
  try {
    const cs = await sbSiswa();
    const data = periksa(
      await cs.from(K.tabel).select(kolomSiswa()).in(K.id, baris.map(b => b.siswa_id)),
      'Gagal membaca data siswa'
    );
    data.forEach(s => { terbaru[String(s[K.id])] = rapikan(s); });
  } catch (e) {
    console.warn('Data siswa tidak terbaca, memakai salinan nama:', e.message);
  }
  return baris.map(b => ({
    id: b.siswa_id,
    nis: (terbaru[b.siswa_id] || {}).nis || '',
    nama: (terbaru[b.siswa_id] || {}).nama || b.nama_siswa || b.siswa_id,
    kelas: (terbaru[b.siswa_id] || {}).kelas || b.kelas || ''
  })).sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id'));
}

// Mencari siswa di tabel sekolah untuk didaftarkan jadi peserta.
export async function cariSiswaSekolah(kata, kelas) {
  const q = (kata || '').trim();
  if (MODE === 'contoh') {
    return D.SISWA.filter(s =>
      (!q || s.nama.toLowerCase().includes(q.toLowerCase())) &&
      (!kelas || s.kelas === kelas)
    ).slice(0, 40);
  }
  const c = await sbSiswa();
  let permintaan = c.from(K.tabel).select(kolomSiswa()).order(K.nama).limit(50);
  if (K.kolomAktif) permintaan = permintaan.eq(K.kolomAktif, true);
  if (q) permintaan = permintaan.ilike(K.nama, `%${q}%`);
  if (kelas) permintaan = permintaan.eq(K.kelas, kelas);
  return periksa(await permintaan, 'Gagal mencari siswa').map(rapikan);
}

// Seluruh siswa aktif, untuk mencocokkan berkas unggahan di halaman Data.
// Diminta per 1000 baris karena PostgREST membatasi satu jawaban sebesar itu;
// sekolah ini punya beberapa ratus siswa, jadi biasanya cukup satu kali.
export async function semuaSiswaSekolah() {
  if (MODE === 'contoh') return salin(D.SISWA);
  const c = await sbSiswa();
  const semua = [];
  for (let awal = 0; ; awal += 1000) {
    let permintaan = c.from(K.tabel).select(kolomSiswa()).order(K.id).range(awal, awal + 999);
    if (K.kolomAktif) permintaan = permintaan.eq(K.kolomAktif, true);
    const bagian = periksa(await permintaan, 'Gagal membaca data siswa');
    semua.push(...bagian.map(rapikan));
    if (bagian.length < 1000) break;
  }
  return semua;
}

export async function daftarKelas() {
  if (MODE === 'contoh') return [...new Set(D.SISWA.map(s => s.kelas))].sort();
  return pakaiRujukan('kelas', daftarKelasJaringan);
}
async function daftarKelasJaringan() {
  const c = await sbSiswa();
  let permintaan = c.from(K.tabel).select(K.kelas).limit(5000);
  if (K.kolomAktif) permintaan = permintaan.eq(K.kolomAktif, true);
  const data = periksa(await permintaan, 'Gagal memuat daftar kelas');
  return [...new Set(data.map(s => s[K.kelas]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'id', { numeric: true }));
}

export async function daftarkanPeserta(ekskulId, siswa) {
  if (MODE === 'contoh') {
    if (!D.PESERTA.find(p => p.ekskul_id === ekskulId && p.siswa_id === siswa.id))
      D.PESERTA.push({ ekskul_id: ekskulId, siswa_id: siswa.id, aktif: true,
                       nama_siswa: siswa.nama, kelas: siswa.kelas });
    return;
  }
  const c = await sb();
  periksa(await c.from(T.peserta).upsert({
    ekskul_id: ekskulId, siswa_id: siswa.id, nama_siswa: siswa.nama,
    kelas: siswa.kelas, aktif: true
  }, { onConflict: 'ekskul_id,siswa_id' }), 'Gagal mendaftarkan peserta');
}

// Mendaftarkan banyak siswa sekaligus (dari berkas unggahan) dalam satu
// permintaan. Sama seperti satuan: yang sudah terdaftar tidak digandakan.
export async function daftarkanPesertaBanyak(ekskulId, daftar) {
  if (!daftar.length) return;
  if (MODE === 'contoh') {
    for (const s of daftar) await daftarkanPeserta(ekskulId, s);
    return;
  }
  const c = await sb();
  periksa(await c.from(T.peserta).upsert(daftar.map(s => ({
    ekskul_id: ekskulId, siswa_id: s.id, nama_siswa: s.nama,
    kelas: s.kelas, aktif: true
  })), { onConflict: 'ekskul_id,siswa_id' }), 'Gagal mendaftarkan peserta');
}

export async function hapusPeserta(ekskulId, siswaId) {
  if (MODE === 'contoh') {
    const i = D.PESERTA.findIndex(p => p.ekskul_id === ekskulId && p.siswa_id === siswaId);
    if (i >= 0) D.PESERTA.splice(i, 1);
    return;
  }
  const c = await sb();
  periksa(await c.from(T.peserta).delete().eq('ekskul_id', ekskulId).eq('siswa_id', siswaId),
          'Gagal mengeluarkan peserta');
}

// ------------------------------------------------------------------ foto
export async function unggahFoto(berkas, ekskulId, tanggal, jenis) {
  if (MODE === 'contoh') {
    return await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(berkas);
    });
  }
  const c = await sb();
  const jalur = `${ekskulId}/${tanggal}-${jenis}-${Date.now()}.jpg`;
  const { error } = await c.storage.from(BUCKET_FOTO)
    .upload(jalur, berkas, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error('Gagal mengunggah foto: ' + error.message);
  const { data } = c.storage.from(BUCKET_FOTO).getPublicUrl(jalur);
  return data.publicUrl;
}

// ------------------------------------------------------------------ sesi
export async function ambilSesi(ekskulId, tanggal) {
  if (MODE === 'contoh') {
    const s = D.SESI.find(x => x.ekskul_id === ekskulId && x.tanggal === tanggal);
    if (!s) return null;
    const k = {};
    D.KEHADIRAN.filter(x => x.sesi_id === s.id).forEach(x => { k[x.siswa_id] = x.status; });
    return { sesi: salin(s), kehadiran: k };
  }
  /* Sesi, kehadiran siswa, dan kehadiran pembimbing diminta dalam SATU
     permintaan — PostgREST menanam baris anak lewat relasi kuncinya. Dulu
     tiga permintaan bergiliran (sesi dulu, baru dua anaknya), dan tiap
     giliran adalah satu perjalanan ke Supabase. */
  const c = await sb();
  const baris = periksa(
    await c.from(T.sesi)
      .select(`*, ${T.kehadiran}(siswa_id,status), ${T.sesiPembimbing}(pembina_id,status)`)
      .eq('ekskul_id', ekskulId).eq('tanggal', tanggal).limit(1),
    'Gagal memeriksa catatan'
  );
  if (!baris.length) return null;
  const { [T.kehadiran]: kh, [T.sesiPembimbing]: bp, ...s } = baris[0];
  const k = {};
  (kh || []).forEach(x => { k[x.siswa_id] = x.status; });
  const pembimbing = {};
  (bp || []).forEach(x => { pembimbing[x.pembina_id] = x.status; });
  return { sesi: s, kehadiran: k, pembimbing };
}

/* `pembimbing` berisi { pembina_id: 'H' | 'TH' } dan HANYA dikirim untuk
   kegiatan yang dibimbing lebih dari satu orang. Untuk kegiatan berpembina
   tunggal ia dibiarkan kosong — bukan diisi satu baris — karena tidak adanya
   baris itulah yang menandai "kehadirannya ada di ae_sesi.status_pembina".
   Mengisinya juga untuk pembina tunggal akan memindahkan makna tanpa ada yang
   memintanya, dan dua penanda untuk satu hal selalu berakhir tidak sepakat. */
export async function simpanSesi(data) {
  const { kehadiran, pembimbing, ...sesi } = data;
  if (MODE === 'contoh') {
    let s = D.SESI.find(x => x.ekskul_id === sesi.ekskul_id && x.tanggal === sesi.tanggal);
    if (s) Object.assign(s, sesi);
    else { s = { id: ++D.SESI_ID_TERAKHIR_REF.v, ...sesi }; D.SESI.push(s); }
    for (let i = D.KEHADIRAN.length - 1; i >= 0; i--)
      if (D.KEHADIRAN[i].sesi_id === s.id) D.KEHADIRAN.splice(i, 1);
    Object.entries(kehadiran || {}).forEach(([siswa_id, status]) =>
      D.KEHADIRAN.push({ sesi_id: s.id, siswa_id, status }));
    return s.id;
  }
  const c = await sb();
  const baris = periksa(
    await c.from(T.sesi).upsert(sesi, { onConflict: 'ekskul_id,tanggal' }).select().single(),
    'Gagal menyimpan sesi'
  );
  const isi = Object.entries(kehadiran || {}).map(([siswa_id, status]) =>
    ({ sesi_id: baris.id, siswa_id, status }));
  if (isi.length)
    periksa(await c.from(T.kehadiran).upsert(isi, { onConflict: 'sesi_id,siswa_id' }),
            'Gagal menyimpan kehadiran siswa');

  /* Dihapus lebih dulu, SELALU — bukan hanya ketika ada yang mau ditulis.
     Dua keadaan memerlukannya: pembimbing yang dikeluarkan dari daftar
     kegiatan tidak boleh meninggalkan catatan kehadiran yang masih ikut
     membagi honor, dan pertemuan yang diubah menjadi "ditiadakan" harus
     kehilangan seluruh catatan pembimbingnya. Untuk kegiatan berpembina
     tunggal perintah ini tidak menyentuh baris apa pun. */
  const bp = Object.entries(pembimbing || {}).map(([pembina_id, status]) =>
    ({ sesi_id: baris.id, pembina_id, status }));
  periksa(await c.from(T.sesiPembimbing).delete().eq('sesi_id', baris.id),
          'Gagal memperbarui kehadiran pembimbing');
  if (bp.length)
    periksa(await c.from(T.sesiPembimbing).insert(bp),
            'Gagal menyimpan kehadiran pembimbing');
  return baris.id;
}

// ----------------------------------------------------------------- rekap
// Mengambil seluruh sesi dan kehadiran pada satu rentang tanggal.
export async function muatPeriode(dari, sampai) {
  let sesi, kehadiran;
  if (MODE === 'contoh') {
    sesi = salin(D.SESI.filter(s => s.tanggal >= dari && s.tanggal <= sampai));
    const ids = sesi.map(s => s.id);
    kehadiran = salin(D.KEHADIRAN.filter(k => ids.includes(k.sesi_id)));
  } else {
    // Kehadiran ditanam ke tiap sesi: satu permintaan, bukan sesi dulu
    // lalu kehadirannya menyusul.
    const c = await sb();
    const baris = periksa(
      await c.from(T.sesi).select(`*, ${T.kehadiran}(sesi_id,siswa_id,status)`)
        .gte('tanggal', dari).lte('tanggal', sampai).order('tanggal'),
      'Gagal memuat sesi'
    );
    kehadiran = baris.flatMap(s => s[T.kehadiran] || []);
    sesi = baris.map(({ [T.kehadiran]: _abaikan, ...s }) => s);
  }
  const hitung = {};
  kehadiran.forEach(k => {
    const h = hitung[k.sesi_id] || (hitung[k.sesi_id] = { H: 0, S: 0, I: 0, A: 0 });
    if (h[k.status] !== undefined) h[k.status]++;
  });
  sesi = sesi.map(s => ({ ...s, ...(hitung[s.id] || { H: 0, S: 0, I: 0, A: 0 }) }))
             .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  return { sesi, kehadiran };
}

// Nama siswa untuk sekumpulan id (dipakai rekap per siswa).
export async function namaSiswa(ids) {
  const hasil = {};
  if (!ids.length) return hasil;
  if (MODE === 'contoh') {
    D.SISWA.filter(s => ids.includes(s.id)).forEach(s => { hasil[s.id] = s; });
    return hasil;
  }
  // Tabel siswa sekolah dan salinan nama di peserta diminta serentak; salinan
  // mengisi dulu, lalu yang hidup menimpanya. Dulu bergiliran: yang hidup
  // dulu, baru salinan untuk yang tidak ketemu.
  const [hidup, salinan] = await Promise.all([
    (async () => {
      try {
        const cs = await sbSiswa();
        return periksa(await cs.from(K.tabel).select(kolomSiswa()).in(K.id, ids), 'Gagal membaca data siswa');
      } catch (e) { console.warn(e.message); return []; }
    })(),
    (async () => {
      const c = await sb();
      return periksa(await c.from(T.peserta).select('siswa_id,nama_siswa,kelas').in('siswa_id', ids),
                     'Gagal membaca salinan nama');
    })()
  ]);
  salinan.forEach(b => {
    hasil[b.siswa_id] = { id: b.siswa_id, nis: '', nama: b.nama_siswa || b.siswa_id, kelas: b.kelas || '' };
  });
  hidup.forEach(s => { hasil[String(s[K.id])] = rapikan(s); });
  return hasil;
}

// ------------------------------------------------------- periode & nilai
export async function daftarPeriode() {
  if (MODE === 'contoh') return salin(D.PERIODE);
  return pakaiRujukan('periode', daftarPeriodeJaringan);
}
async function daftarPeriodeJaringan() {
  const c = await sb();
  return periksa(
    await c.from(T.periode).select('*').order('tanggal_mulai', { ascending: false }),
    'Gagal memuat periode penilaian'
  );
}

export async function simpanPeriode(baris) {
  lupakanRujukan('periode');
  if (MODE === 'contoh') {
    const lama = D.PERIODE.find(p =>
      p.tahun_ajaran === baris.tahun_ajaran && p.semester === baris.semester);
    if (lama) Object.assign(lama, baris);
    else D.PERIODE.push({ id: ++D.PERIODE_ID_TERAKHIR_REF.v, ...baris });
    return;
  }
  const c = await sb();
  periksa(
    await c.from(T.periode).upsert(baris, { onConflict: 'tahun_ajaran,semester' }),
    'Gagal menyimpan periode penilaian'
  );
}

export async function ubahStatusPeriode(id, dibuka) {
  lupakanRujukan('periode');
  if (MODE === 'contoh') {
    const p = D.PERIODE.find(x => x.id === id);
    if (p) p.dibuka = dibuka;
    return;
  }
  const c = await sb();
  periksa(await c.from(T.periode).update({ dibuka }).eq('id', id),
          'Gagal mengubah status periode');
}

export async function ambilNilai(periodeId, ekskulId) {
  const hasil = {};
  if (MODE === 'contoh') {
    D.NILAI.filter(n => n.periode_id === periodeId && n.ekskul_id === ekskulId)
      .forEach(n => { hasil[n.siswa_id] = { predikat: n.predikat, deskripsi: n.deskripsi }; });
    return hasil;
  }
  const c = await sb();
  const data = periksa(
    await c.from(T.nilai).select('siswa_id,predikat,deskripsi')
      .eq('periode_id', periodeId).eq('ekskul_id', ekskulId),
    'Gagal memuat nilai'
  );
  data.forEach(n => { hasil[n.siswa_id] = { predikat: n.predikat, deskripsi: n.deskripsi }; });
  return hasil;
}

export async function simpanNilai(periodeId, ekskulId, daftar, diisiOleh) {
  const baris = daftar.map(n => ({
    periode_id: periodeId, ekskul_id: ekskulId, siswa_id: n.siswa_id,
    predikat: n.predikat || null, deskripsi: n.deskripsi || null, diisi_oleh: diisiOleh
  }));
  if (MODE === 'contoh') {
    baris.forEach(b => {
      const lama = D.NILAI.find(n => n.periode_id === b.periode_id &&
        n.ekskul_id === b.ekskul_id && n.siswa_id === b.siswa_id);
      if (lama) Object.assign(lama, b); else D.NILAI.push({ ...b });
    });
    return;
  }
  if (!baris.length) return;
  const c = await sb();
  periksa(
    await c.from(T.nilai).upsert(baris, { onConflict: 'periode_id,ekskul_id,siswa_id' }),
    'Gagal menyimpan nilai'
  );
}

// Rekap kehadiran satu ekskul pada rentang tanggal, dihitung per siswa.
export async function kehadiranPerSiswa(ekskulId, dari, sampai) {
  const { sesi, kehadiran } = await muatPeriode(dari, sampai);
  const milik = new Set(sesi.filter(s => s.ekskul_id === ekskulId).map(s => s.id));
  const hitung = {};
  kehadiran.filter(k => milik.has(k.sesi_id)).forEach(k => {
    const h = hitung[k.siswa_id] || (hitung[k.siswa_id] = { H: 0, S: 0, I: 0, A: 0, total: 0 });
    if (h[k.status] !== undefined) h[k.status]++;
    h.total++;
  });
  return hitung;
}

// Kehadiran seluruh ekstrakurikuler pada satu rentang, sekali ambil.
// Bentuk hasil: { ekskul_id: { siswa_id: {H,S,I,A,total} } }
export async function kehadiranSemua(dari, sampai) {
  const { sesi, kehadiran } = await muatPeriode(dari, sampai);
  const milikEkskul = {};
  sesi.forEach(s => { milikEkskul[s.id] = s.ekskul_id; });
  const hasil = {};
  kehadiran.forEach(k => {
    const ek = milikEkskul[k.sesi_id];
    if (!ek) return;
    const per = hasil[ek] || (hasil[ek] = {});
    const h = per[k.siswa_id] || (per[k.siswa_id] = { H: 0, S: 0, I: 0, A: 0, total: 0 });
    if (h[k.status] !== undefined) h[k.status]++;
    h.total++;
  });
  return hasil;
}

// Seluruh nilai pada satu periode: { ekskul_id: { siswa_id: {predikat,deskripsi} } }
export async function nilaiSeluruhPeriode(periodeId) {
  const hasil = {};
  const masukkan = n => {
    const per = hasil[n.ekskul_id] || (hasil[n.ekskul_id] = {});
    per[n.siswa_id] = { predikat: n.predikat, deskripsi: n.deskripsi };
  };
  if (MODE === 'contoh') {
    D.NILAI.filter(n => n.periode_id === periodeId).forEach(masukkan);
    return hasil;
  }
  const c = await sb();
  periksa(
    await c.from(T.nilai).select('ekskul_id,siswa_id,predikat,deskripsi').eq('periode_id', periodeId),
    'Gagal memuat nilai seluruh ekstrakurikuler'
  ).forEach(masukkan);
  return hasil;
}

/* --------------------------------------------------- data induk pembina
   PIN DISIMPAN TERPISAH, DAN ITU WAJIB — bukan pilihan gaya.

   Hak baca kolom kode_akses sudah dicabut dari anon (migrasi
   20260920100827, menutup kebocoran PIN). Hak tulisnya masih ada, jadi
   sekilas menyertakan kode_akses dalam upsert tampak tidak masalah.
   Ternyata masalah: upsert PostgREST menjadi

       INSERT ... ON CONFLICT (id) DO UPDATE SET kode_akses = excluded.kode_akses

   dan PostgreSQL MENUNTUT hak SELECT atas setiap kolom yang disentuh
   cabang DO UPDATE — termasuk lewat excluded. Akibatnya seluruh
   penyimpanan pembina ditolak "permission denied for table ae_pembina"
   begitu PIN ikut diisi, padahal INSERT biasa maupun UPDATE biasa atas
   kolom yang sama berjalan normal.

   Jebakannya halus: menyimpan pembina TANPA PIN tetap berhasil, jadi
   kesalahannya hanya muncul saat seseorang menetapkan PIN baru — persis
   pekerjaan yang paling jarang dilakukan dan paling sulit dikaitkan
   dengan migrasi hak akses berbulan-bulan sebelumnya.

   Karena itu barisnya disimpan tanpa kode_akses, lalu PIN-nya ditulis
   dengan UPDATE tersendiri. Bila langkah kedua gagal, pembinanya sudah
   tersimpan tetapi belum ber-PIN — keadaan yang terlihat di layar lewat
   penanda ada_pin, bukan kegagalan yang menghilang tanpa jejak. */
export async function simpanPembina(baris) {
  lupakanRujukan('master');
  if (MODE === 'contoh') {
    const lama = D.PEMBINA.find(p => p.id === baris.id);
    if (lama) Object.assign(lama, baris); else D.PEMBINA.push({ ...baris });
    return;
  }
  const { kode_akses: pin, ...tanpaPin } = baris;
  const c = await sb();
  periksa(await c.from(T.pembina).upsert(tanpaPin, { onConflict: 'id' }),
          'Gagal menyimpan data pembina');
  if (!pin) return;
  periksa(await c.from(T.pembina).update({ kode_akses: pin }).eq('id', tanpaPin.id),
          `Data ${tanpaPin.nama} tersimpan, tetapi PIN-nya gagal disimpan — ulangi pengisian PIN saja`);
}

export async function hapusPembina(id) {
  lupakanRujukan('master');
  if (MODE === 'contoh') {
    const i = D.PEMBINA.findIndex(p => p.id === id);
    if (i >= 0) D.PEMBINA.splice(i, 1);
    return;
  }
  const c = await sb();
  const dipakai = periksa(
    await c.from(T.ekskul).select('id').eq('pembina_id', id).limit(1),
    'Gagal memeriksa keterkaitan pembina'
  );
  if (dipakai.length)
    throw new Error('Pembina ini masih memegang ekstrakurikuler. Pindahkan dulu pembinanya.');
  periksa(await c.from(T.pembina).delete().eq('id', id), 'Gagal menghapus pembina');
}

// Nomor pembina berikutnya: P01, P02, ...
export function nomorPembinaBaru(daftar) {
  const angka = daftar.map(p => parseInt(String(p.id).replace(/\D/g, ''), 10) || 0);
  return 'P' + String(Math.max(0, ...angka) + 1).padStart(2, '0');
}

// Aturan tarif transport dan penyimpanan identitas dokumen pernah ada di
// sini. Tarifnya kini di Induk Pembiayaan (ip_tarif, berversi menurut
// tanggal berlaku), identitasnya di profil_dokumen milik Data Induk.


// ------------------------------------------------ data induk ekstrakurikuler
export async function simpanEkskul(baris) {
  lupakanRujukan('master');
  if (MODE === 'contoh') {
    const lama = D.EKSKUL.find(e => e.id === baris.id);
    if (lama) Object.assign(lama, baris); else D.EKSKUL.push({ ...baris });
    return;
  }
  const c = await sb();
  periksa(await c.from(T.ekskul).upsert(baris, { onConflict: 'id' }),
          'Gagal menyimpan ekstrakurikuler');
}

// Menghapus ekskul ikut menghapus peserta dan seluruh riwayat kehadirannya,
// jadi penghapusan ditolak bila jejaknya sudah ada.
export async function hapusEkskul(id) {
  lupakanRujukan('master');
  if (MODE === 'contoh') {
    if (D.SESI.some(s => s.ekskul_id === id) || D.PESERTA.some(p => p.ekskul_id === id))
      throw new Error('Ekstrakurikuler ini sudah punya peserta atau riwayat laporan. ' +
                      'Ubah keaktifannya menjadi Nonaktif saja.');
    const i = D.EKSKUL.findIndex(e => e.id === id);
    if (i >= 0) D.EKSKUL.splice(i, 1);
    return;
  }
  const c = await sb();
  const [sesi, peserta] = await Promise.all([
    c.from(T.sesi).select('id').eq('ekskul_id', id).limit(1),
    c.from(T.peserta).select('id').eq('ekskul_id', id).limit(1)
  ]);
  const adaSesi = periksa(sesi, 'Gagal memeriksa riwayat laporan');
  const adaPeserta = periksa(peserta, 'Gagal memeriksa peserta');
  if (adaSesi.length || adaPeserta.length)
    throw new Error('Ekstrakurikuler ini sudah punya peserta atau riwayat laporan. ' +
                    'Ubah keaktifannya menjadi Nonaktif saja supaya datanya tetap utuh.');
  periksa(await c.from(T.ekskul).delete().eq('id', id), 'Gagal menghapus ekstrakurikuler');
}

export function nomorEkskulBaru(daftar) {
  const angka = daftar.map(e => parseInt(String(e.id).replace(/\D/g, ''), 10) || 0);
  return 'E' + String(Math.max(0, ...angka) + 1).padStart(2, '0');
}

// ----------------------------------------------------- pengaturan dokumen
// Identitas kop dokumen dibaca dari profil_dokumen milik Data Induk — satu
// sumber untuk seluruh aplikasi. Sebelumnya disalin ke ae_pengaturan, dan
// salinan itu diam-diam bisa berbeda dari aplikasi lain tanpa ada yang tahu.
// Nama kuncinya dipetakan ke bentuk yang sudah dipakai dokumen.js supaya
// berkas yang dihasilkan tidak berubah.
export async function ambilPengaturan() {
  if (MODE === 'contoh') return { ...(D.PENGATURAN || {}) };
  return pakaiRujukan('pengaturan', ambilPengaturanJaringan);
}
async function ambilPengaturanJaringan() {
  const c = await sb();
  const [prof, ta] = await Promise.all([
    // Seluruh kolom diambil karena kop juga memerlukan npsn, catatan kaki,
    // dan tata letaknya: satu sumber untuk seluruh identitas dokumen.
    c.from('v_penanda_tangan').select('*').limit(1),
    c.from('tahun_ajaran').select('kode,aktif').eq('aktif', true).limit(1)
  ]);
  const p = (periksa(prof, 'Gagal memuat identitas dokumen dari Data Induk') || [])[0];
  if (!p) return {};
  const tahun = ((ta.data || [])[0] || {}).kode;
  const isi = {
    nama: p.nama_sekolah, alamat: p.alamat, kota: p.kota,
    kepalaSekolah: p.kepala_sekolah, kesiswaan: p.kesiswaan,
    tahunAjaran: tahun,
    // Baris apa adanya, dipakai penulis dokumen untuk kop dan tata letaknya.
    profil: p
  };
  // Yang kosong dibuang supaya pakaiIdentitas() tidak menimpa nilai bawaan.
  return Object.fromEntries(Object.entries(isi).filter(([, v]) => v));
}

// ------------------------------------------------------------ data guru
// Dibaca dari tabel guru milik aplikasi Kehadiran Guru, hanya untuk
// menautkan pembina internal supaya namanya tidak diketik ulang.
// Kebiasaan sekolah: daftar guru disusun menurut masa kerja, yang paling lama
// lebih dulu, dengan dasar TMT sekolah. Yang TMT-nya belum diisi jatuh ke
// akhir, dan nama menjadi pemecah seri karena satu TMT bisa dipakai beberapa
// guru. Urutan ini disamakan dengan Data Induk dan Kehadiran Guru.
/* Guru yang boleh ditautkan sebagai pembina.

   Bukan seluruh daftar guru, melainkan v_guru_pembina_ekskul: yang
   berstatus Aktif DAN sudah diberi tugas "Pembina Ekskul" di Data Induk.
   Dengan begitu yang belum memenuhi syarat tidak bisa dipilih sama sekali,
   bukan dipilih dulu lalu ditolak saat menyimpan.

   Database tetap menolaknya lewat pemicu, karena penyaringan di peramban
   saja bukan aturan: kunci publik aplikasi ini memberi hak tulis kepada
   siapa pun yang membuka kodenya. */
export async function daftarGuru() {
  if (MODE === 'contoh') return salin(D.GURU);
  return pakaiRujukan('guru', daftarGuruJaringan);
}
async function daftarGuruJaringan() {
  const c = await sb();
  const data = periksa(
    await c.from('v_guru_pembina_ekskul').select('id,nama,tmt_sekolah'),
    'Gagal memuat daftar guru yang boleh menjadi pembina'
  );
  return (data || []).map(g => ({ id: String(g.id), nama: g.nama, tmt_sekolah: g.tmt_sekolah }));
}

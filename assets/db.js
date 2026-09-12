// Lapisan akses data. Semua halaman memanggil fungsi di sini, sehingga
// halaman tidak perlu tahu apakah datanya dari Supabase atau contoh.
import { klien, klienSiswa, terhubung, SUMBER_SISWA, BUCKET_FOTO } from './supabase-client.js?v=20260912c';
import * as D from './demo-data.js?v=20260912c';

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

// ---------------------------------------------------------------- master
export async function ambilMaster() {
  if (MODE === 'contoh') return { ekskul: salin(D.EKSKUL), pembina: salin(D.PEMBINA) };
  const c = await sb();
  const [e, p] = await Promise.all([
    c.from('ekskul').select('*').order('id'),
    c.from('pembina').select('*').order('nama')
  ]);
  return {
    ekskul: periksa(e, 'Gagal memuat ekstrakurikuler'),
    pembina: periksa(p, 'Gagal memuat pembina')
  };
}

// Memeriksa PIN pembina. Mengembalikan data pembina bila cocok.
export async function cekPembina(pembinaId, pin) {
  const { pembina } = await ambilMaster();
  const p = pembina.find(x => x.id === pembinaId);
  if (!p) throw new Error('Pembina tidak ditemukan.');
  if (!p.kode_akses) throw new Error('Pembina ini belum diberi PIN. Hubungi Wakasek Kesiswaan.');
  if (String(p.kode_akses).trim() !== String(pin).trim()) throw new Error('PIN salah.');
  return p;
}

// --------------------------------------------------------------- peserta
// Membaca peserta satu ekskul. Nama & kelas diambil dari tabel siswa
// milik aplikasi Tryout & Asesmen; bila tabel itu tidak terbaca, dipakai
// salinan nama yang tersimpan saat pendaftaran.
export async function pesertaEkskul(ekskulId) {
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
    await c.from('peserta_ekskul').select('siswa_id,nama_siswa,kelas')
      .eq('ekskul_id', ekskulId).eq('aktif', true),
    'Gagal memuat peserta'
  );
  if (!baris.length) return [];

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

export async function daftarKelas() {
  if (MODE === 'contoh') return [...new Set(D.SISWA.map(s => s.kelas))].sort();
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
  periksa(await c.from('peserta_ekskul').upsert({
    ekskul_id: ekskulId, siswa_id: siswa.id, nama_siswa: siswa.nama,
    kelas: siswa.kelas, aktif: true
  }, { onConflict: 'ekskul_id,siswa_id' }), 'Gagal mendaftarkan peserta');
}

export async function hapusPeserta(ekskulId, siswaId) {
  if (MODE === 'contoh') {
    const i = D.PESERTA.findIndex(p => p.ekskul_id === ekskulId && p.siswa_id === siswaId);
    if (i >= 0) D.PESERTA.splice(i, 1);
    return;
  }
  const c = await sb();
  periksa(await c.from('peserta_ekskul').delete().eq('ekskul_id', ekskulId).eq('siswa_id', siswaId),
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
  const c = await sb();
  const baris = periksa(
    await c.from('sesi').select('*').eq('ekskul_id', ekskulId).eq('tanggal', tanggal).limit(1),
    'Gagal memeriksa catatan'
  );
  if (!baris.length) return null;
  const s = baris[0];
  const kh = periksa(
    await c.from('kehadiran_siswa').select('siswa_id,status').eq('sesi_id', s.id),
    'Gagal memuat kehadiran siswa'
  );
  const k = {};
  kh.forEach(x => { k[x.siswa_id] = x.status; });
  return { sesi: s, kehadiran: k };
}

export async function simpanSesi(data) {
  const { kehadiran, ...sesi } = data;
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
    await c.from('sesi').upsert(sesi, { onConflict: 'ekskul_id,tanggal' }).select().single(),
    'Gagal menyimpan sesi'
  );
  const isi = Object.entries(kehadiran || {}).map(([siswa_id, status]) =>
    ({ sesi_id: baris.id, siswa_id, status }));
  if (isi.length)
    periksa(await c.from('kehadiran_siswa').upsert(isi, { onConflict: 'sesi_id,siswa_id' }),
            'Gagal menyimpan kehadiran siswa');
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
    const c = await sb();
    sesi = periksa(
      await c.from('sesi').select('*').gte('tanggal', dari).lte('tanggal', sampai).order('tanggal'),
      'Gagal memuat sesi'
    );
    const ids = sesi.map(s => s.id);
    kehadiran = ids.length
      ? periksa(await c.from('kehadiran_siswa').select('sesi_id,siswa_id,status').in('sesi_id', ids),
                'Gagal memuat kehadiran')
      : [];
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
  try {
    const cs = await sbSiswa();
    const data = periksa(await cs.from(K.tabel).select(kolomSiswa()).in(K.id, ids),
                         'Gagal membaca data siswa');
    data.forEach(s => { hasil[String(s[K.id])] = rapikan(s); });
  } catch (e) {
    console.warn(e.message);
  }
  const c = await sb();
  const kurang = ids.filter(i => !hasil[i]);
  if (kurang.length) {
    const cad = periksa(
      await c.from('peserta_ekskul').select('siswa_id,nama_siswa,kelas').in('siswa_id', kurang),
      'Gagal membaca salinan nama'
    );
    cad.forEach(b => {
      if (!hasil[b.siswa_id])
        hasil[b.siswa_id] = { id: b.siswa_id, nis: '', nama: b.nama_siswa || b.siswa_id, kelas: b.kelas || '' };
    });
  }
  return hasil;
}

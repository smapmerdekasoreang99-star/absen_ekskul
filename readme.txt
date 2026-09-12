# Absensi Ekstrakurikuler — SMA Plus Merdeka Soreang

Aplikasi web untuk **pelaporan kegiatan ekstrakurikuler oleh pembina langsung
dari HP**: kehadiran pembina, kehadiran siswa peserta, dan foto kegiatan.
Rekapitulasinya bisa ditarik antara dua tanggal mana pun.

Semuanya dipasang di project Supabase **Tryout_guru**, berdampingan dengan
`public.tka_siswa`. Data siswa dibaca langsung dari sana dan tidak pernah
digandakan; peserta ekskul disimpan sebagai NISN.

Perhitungan honor sengaja belum dibuat. Rekap yang dihasilkan aplikasi ini
(jumlah pertemuan, kehadiran pembina, jumlah peserta tiap minggu) adalah bahan
mentahnya, jadi penambahannya nanti tidak perlu mengubah struktur data.

## Isi paket

```
app/
  masuk.html        Halaman masuk: pembina (PIN pribadi) atau pengelola
  index.html        Beranda: latihan hari ini + ringkasan tujuh hari terakhir
  absensi.html      Laporan satu pertemuan: status pembina, foto, kehadiran siswa
  rekap.html        Rekap rentang tanggal: per ekskul / per pertemuan / per siswa
  data.html         Pendaftaran peserta dari data siswa sekolah (pengelola saja)
  assets/           style.css, logo.png, db.js, ui.js, demo-data.js, supabase-client.js
  scripts/          masuk.js, beranda.js, absensi.js, rekap.js, data.js
db/
  schema.sql        Tabel ekskul, kebijakan akses, dan bucket foto
  akses_siswa.sql   Tampilan terbatas siswa dari tka_siswa
  seed_pembina.csv  13 pembina (dari daftar hadir sekolah)
  seed_ekskul.csv   14 ekstrakurikuler beserta hari & jam latihan
pratinjau_absensi_ekskul.html   Satu berkas mandiri untuk melihat tampilannya
```

## Hak akses

| Peran | Bisa melakukan |
|---|---|
| Pembina / pelatih | Melapor untuk ekstrakurikulernya sendiri, melihat rekap ekstrakurikulernya |
| Pengelola sekolah | Semua ekstrakurikuler, rekap penuh, pendaftaran peserta |

Pembina masuk dengan memilih namanya lalu mengisi PIN pribadi (kolom
`kode_akses` di tabel `pembina`). PIN pengelola ada di `app/assets/ui.js`
baris `PIN_PENGELOLA`, bawaannya `merdeka2026`.

PIN ini penghalang kesalahan pakai, **bukan keamanan**. Aplikasi memakai anon
key tanpa login Supabase, jadi siapa pun yang tahu alamat aplikasi secara
teknis masih bisa membaca datanya. Bila data siswa dianggap sensitif,
langkah berikutnya adalah mengaktifkan Supabase Auth.

## Pemasangan

Semua dikerjakan di project **Tryout_guru**.

**1. Buka akses data siswa.** SQL Editor → jalankan `db/akses_siswa.sql`.
Skrip itu membuat tampilan `public.siswa_ekskul` berisi nisn, nis, nama,
kelas — hanya siswa aktif — lalu memberi izin baca kepada anon key.
Kolom `tgl_lahir` sengaja tidak ikut terbuka, dan tabel `tka_siswa` sendiri
tetap tertutup seperti semula.

**2. Pasang tabel ekskul.** SQL Editor → jalankan seluruh `db/schema.sql`.
Semua tabel baru diberi nama yang tidak bertabrakan dengan tabel tryout:
`pembina`, `ekskul`, `peserta_ekskul`, `sesi`, `kehadiran_siswa`.
Skrip ini sekaligus membuat bucket foto `foto-ekskul`.

**3. Data awal.** Table Editor → impor `seed_pembina.csv` ke tabel `pembina`
dan `seed_ekskul.csv` ke tabel `ekskul`.

**4. PIN pembina.** Isi kolom `kode_akses` tiap pembina (4 angka, jangan sama semua).

**5. Sambungan.** Salin Project URL dan anon key Tryout_guru
(Settings → API) ke `app/assets/supabase-client.js`. Bagian `SUMBER_SISWA`
biarkan apa adanya — `url` dan `key` yang kosong berarti satu project.

**6. Unggah.** Isi folder `app/` ke akar repository GitHub → Settings → Pages →
Deploy from a branch → `main` → `/ (root)`.

Selama langkah 5 belum dilakukan, aplikasi berjalan dalam **mode contoh**:
data palsu, tidak tersimpan. PIN pembina mana pun di mode ini: `1234`.

Membuka berkas dengan klik dua kali (`file://`) tidak berfungsi karena
skripnya memakai modul ES. Pakai `python -m http.server` atau langsung deploy.

### Bila nanti ingin dipisah

Buat project baru, jalankan `db/schema.sql` di sana, pindahkan isi kelima
tabel ekskul, lalu di `supabase-client.js` isi `SUPABASE_URL`/`SUPABASE_ANON_KEY`
dengan project baru dan `SUMBER_SISWA.url`/`.key` dengan Tryout_guru.
Tidak ada perubahan kode lain. Foto lama perlu dipindahkan terpisah karena
tersimpan di bucket, bukan di tabel.

## Foto kegiatan

Satu foto per pertemuan: pembina bersama siswanya, diambil sebelum atau
sesudah latihan, langsung dari kamera HP. Foto diperkecil di HP menjadi
sisi terpanjang 1280 piksel, JPEG 72% — foto 4 MB biasanya turun ke
150–300 KB sebelum dikirim.

Perkiraan pemakaian penyimpanan: 14 ekskul × 40 minggu × 250 KB
≈ **140 MB per tahun ajaran**. Kuota gratis Supabase 1 GB, dipakai bersama
data tryout, jadi sisa kuotanya perlu sesekali diperiksa di
Storage → Usage. Bila mendekati batas, foto tahun ajaran lalu bisa diunduh
sebagai arsip lalu dihapus dari bucket.

Bucket foto bersifat publik supaya bisa ditampilkan tanpa login. Siapa pun
yang punya tautan foto bisa membukanya, walau alamatnya sulit ditebak.
Ini perlu disadari karena fotonya memuat wajah siswa.

## Rekapitulasi

Menu Rekap memakai rentang tanggal bebas, dengan pintasan Minggu ini,
Bulan ini, dan Bulan lalu. Tiga sudut pandang:

- **Per ekstrakurikuler** — jumlah pertemuan, terlaksana, kehadiran pembina
  (hadir / digantikan / tidak hadir), total dan rata-rata siswa hadir,
  tingkat kehadiran siswa, serta berapa pertemuan yang berfoto.
- **Per pertemuan** — satu baris satu tanggal, lengkap dengan foto dan materi.
- **Per siswa** — diurutkan dari kehadiran terendah, untuk bahan pembinaan
  dan nilai ekstrakurikuler di rapor.

Ketiganya bisa diunduh sebagai CSV dan dibuka di Excel.

## Yang belum ada

- Perhitungan honor pelatih (ditunda atas permintaan).
- Tanda tangan pembina. Formulir kertas memuat kolom tanda tangan;
  penggantinya perlu diputuskan: kertas tetap jadi berkas sah, atau rekap
  bulanan disahkan Wakasek Kesiswaan.
- Pengingat otomatis bagi pembina yang belum melapor.
- Halaman cetak rekap bulanan.

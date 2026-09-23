| Pengelola sekolah | Semua ekstrakurikuler, rekap penuh, pendaftaran peserta termasuk unggah massal || Pembina / pelatih | Melapor untuk ekstrakurikulernya sendiri, melihat rekapnya, menambah dan mengeluarkan pesertanya satu per satu |# Absensi Ekstrakurikuler — SMA Plus Merdeka Soreang

Aplikasi web untuk **pelaporan kegiatan ekstrakurikuler oleh pembina langsung
dari HP**: kehadiran pembina, kehadiran siswa peserta, dan foto kegiatan.
Rekapitulasinya bisa ditarik antara dua tanggal mana pun.

Tabel-tabelnya menumpang di project Supabase **Kehadiran_Guru**, bersama
aplikasi guru pengganti. Data siswa dibaca dari **Tryout_guru**
(`public.tka_siswa`) dan tidak pernah digandakan; peserta ekskul disimpan
sebagai NISN.

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
  data.html         Pendaftaran peserta: pembina untuk kegiatannya, pengelola semua
                    (unggah massal XLSX/CSV hanya pengelola)
  assets/           style.css, logo.png, db.js, ui.js, demo-data.js, supabase-client.js,
                    unggah-peserta.js (baca XLSX/CSV + pencocokan nama)
  scripts/          masuk.js, beranda.js, absensi.js, rekap.js, data.js
db/
  schema.sql            Tabel ae_*, kebijakan akses, bucket foto (Kehadiran_Guru)
  ganti_nama_tabel.sql  Untuk tabel lama yang belum berawalan ae_
  akses_siswa.sql       Tampilan tka_siswa_ekskul (Tryout_guru)
  seed_pembina.csv  13 pembina (dari daftar hadir sekolah)
  seed_ekskul.csv   14 ekstrakurikuler beserta hari & jam latihan
pratinjau_absensi_ekskul.html   Satu berkas mandiri untuk melihat tampilannya
```

## Hak akses

| Peran | Bisa melakukan |
|---|---|
| Pembina / pelatih | Melapor untuk ekstrakurikulernya sendiri, melihat rekapnya, menambah dan mengeluarkan pesertanya satu per satu |
| Pengelola sekolah | Semua ekstrakurikuler, rekap penuh, pendaftaran peserta termasuk unggah massal |

Pembina masuk dengan memilih namanya lalu mengisi PIN pribadi (kolom
`kode_akses` di tabel `pembina`). PIN pengelola ada di `app/assets/ui.js`
baris `PIN_PENGELOLA`, bawaannya `merdeka2026`.

PIN ini penghalang kesalahan pakai, **bukan keamanan**. Aplikasi memakai anon
key tanpa login Supabase, jadi siapa pun yang tahu alamat aplikasi secara
teknis masih bisa membaca datanya. Bila data siswa dianggap sensitif,
langkah berikutnya adalah mengaktifkan Supabase Auth.

## Pemasangan

Memakai dua project yang sudah ada, tanpa membuat project baru.

| Project | Peran |
|---|---|
| **Kehadiran_Guru** | tabel ekskul, peserta, sesi, dan bucket foto — dibaca & ditulis |
| **Tryout_guru** | `public.tka_siswa` — hanya dibaca |

Seluruh tabel aplikasi ini memakai awalan **`ae_`** (absensi
ekstrakurikuler): `ae_pembina`, `ae_ekskul`, `ae_peserta`, `ae_sesi`,
`ae_kehadiran`. Di project yang melayani banyak aplikasi, awalan ini
mencegah tabrakan nama yang sulit terlacak — nama seperti `sesi` atau
`pembina` terlalu umum untuk dibiarkan tanpa penanda.

**1. Periksa bentrok nama tabel.** Di SQL Editor project Kehadiran_Guru:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'ae\_%';
```

Kosong berarti aman. Kalau tabel ekskul sudah terlanjur dibuat tanpa
awalan, jalankan `db/ganti_nama_tabel.sql` lebih dulu — perintah `rename`
di dalamnya memindahkan nama tanpa menyalin atau menghilangkan data.

**2. Pasang tabel ekskul.** SQL Editor project Kehadiran_Guru → jalankan
seluruh `db/schema.sql`. Skrip ini sekaligus membuat bucket `foto-ekskul`.

**3. Data awal.** Table Editor project Kehadiran_Guru → impor
`seed_pembina.csv` ke tabel `ae_pembina` dan `seed_ekskul.csv` ke `ae_ekskul`.
Lewati langkah ini bila datanya dipindahkan dari project lama.

**4. PIN pembina.** Isi kolom `kode_akses` di `ae_pembina` (4 angka, jangan sama semua).

**5. Buka akses data siswa.** SQL Editor project **Tryout_guru** → jalankan
`db/akses_siswa.sql`. Skrip itu membuat tampilan `public.tka_siswa_ekskul`
berisi nisn, nis, nama, kelas — hanya siswa aktif — lalu memberi izin baca
kepada anon key. Kolom `tgl_lahir` tidak ikut terbuka dan `tka_siswa` tetap
tertutup. Namanya mengikuti kebiasaan di project itu, bukan awalan `ae_`,
karena ia turunan dari `tka_siswa`.

**6. Sambungan.** Isi empat nilai di `app/assets/supabase-client.js`:

```js
// Settings > API project Kehadiran_Guru
export const SUPABASE_URL = 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = '...';

// Settings > API project Tryout_guru
export const SUMBER_SISWA = {
  url: 'https://yyyy.supabase.co',
  key: '...',
  tabel: 'tka_siswa_ekskul',
  id: 'nisn', nis: 'nis', nama: 'nama', kelas: 'kelas',
  kolomAktif: 'aktif'
};
```

Di berkas yang sama ada blok `TABEL` berisi kelima nama tabel. Bila suatu
saat awalannya diubah lagi, cukup blok itu yang disunting — tidak ada nama
tabel yang tertulis di tempat lain dalam kode.

**7. Unggah.** Isi folder `app/` ke repository GitHub aplikasi ekskul →
Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
Gunakan repository tersendiri, terpisah dari `Kehadiran_guru`, supaya kedua
aplikasi bisa diperbarui tanpa saling mengganggu.

**8. Uji.** Buka alamatnya, masuk sebagai Pengelola, lalu:
Data → pilih satu ekskul → cari nama siswa (harus muncul dari tka_siswa) →
Daftarkan; Absensi → ambil foto → Simpan; Rekap → Minggu ini.

Selama langkah 6 belum dilakukan, aplikasi berjalan dalam **mode contoh**:
data palsu, tidak tersimpan. PIN pembina mana pun di mode ini: `1234`.

Membuka berkas dengan klik dua kali (`file://`) tidak berfungsi karena
skripnya memakai modul ES. Pakai `python -m http.server` atau langsung deploy.

### Bila tabel ekskul sudah terlanjur dibuat di Tryout_guru

Pindahkan isinya, jangan dibuat ulang:

1. Di Tryout_guru, Table Editor → ekspor CSV lima tabel ekskul
   (nama lamanya: `pembina`, `ekskul`, `peserta_ekskul`, `sesi`,
   `kehadiran_siswa`).
2. Di Kehadiran_Guru, impor ke tabel berawalan `ae_` dengan urutan yang sama
   (induk dulu, baru anaknya): `ae_pembina` → `ae_ekskul` → `ae_peserta` →
   `ae_sesi` → `ae_kehadiran`.
3. Setelah impor, setel ulang penomoran otomatis di SQL Editor Kehadiran_Guru:
   ```sql
   select setval(pg_get_serial_sequence('ae_peserta','id'), coalesce(max(id),1)) from ae_peserta;
   select setval(pg_get_serial_sequence('ae_sesi','id'), coalesce(max(id),1)) from ae_sesi;
   select setval(pg_get_serial_sequence('ae_kehadiran','id'), coalesce(max(id),1)) from ae_kehadiran;
   ```
   Tanpa langkah ini, penyimpanan sesi baru akan gagal karena nomornya bentrok.
4. Foto lama tetap tersimpan di bucket Tryout_guru dan tautannya tetap hidup,
   karena kolom `foto` menyimpan alamat lengkap. Selama bucket itu tidak
   dihapus, foto lama tetap tampil. Foto baru masuk ke Kehadiran_Guru.
5. Setelah rekapnya dipastikan cocok, baru hapus tabel ekskul di Tryout_guru:
   ```sql
   drop table if exists kehadiran_siswa, sesi, peserta_ekskul, ekskul, pembina cascade;
   -- (nama lama, karena di Tryout_guru belum sempat diberi awalan)
   ```
   Jangan dijalankan sebelum data di tempat baru diperiksa.

## Unggah daftar peserta

Di menu Data, selain mencari satu per satu, pengelola bisa mendaftarkan
banyak siswa sekaligus dari berkas **.xlsx** atau **.csv**. Kolom yang
dibaca hanya dua: `Nama siswa` (wajib) dan `Kelas` (dianjurkan); judulnya
dikenali dari isinya, jadi boleh ada judul dokumen di atas tabel, dan kolom
lain diabaikan. Tombol **Unduh format** memberi berkas kosong dengan pilihan
kelas dari data sekolah dan lembar petunjuk.

Berkas tidak pernah dipercaya apa adanya. Tiap baris dicocokkan ke data
siswa sekolah (huruf besar-kecil, tanda baca, dan cara menulis kelas
seperti `X-1` / `X 1` tidak dipersoalkan), lalu hasilnya ditampilkan dulu:
akan didaftarkan, sudah terdaftar, ditulis dua kali, perlu dipastikan
(dua siswa bernama sama tanpa kelas), atau tidak ditemukan. Hanya yang
cocok yang disimpan, dan yang tersimpan tetap id siswa dari data sekolah —
bukan tulisan di berkas. Berkas CSV hasil "Unduh daftar peserta" bisa
diunggah kembali, misalnya untuk menyalin peserta ke kegiatan lain.

## Foto kegiatan

Satu foto per pertemuan: pembina bersama siswanya, diambil sebelum atau
sesudah latihan, langsung dari kamera HP. Foto diperkecil di HP menjadi
sisi terpanjang 1280 piksel, JPEG 72% — foto 4 MB biasanya turun ke
150–300 KB sebelum dikirim.

Perkiraan pemakaian penyimpanan: 14 ekskul × 40 minggu × 250 KB
≈ **140 MB per tahun ajaran**. Kuota gratis Supabase 1 GB per project,
dipakai bersama data aplikasi guru pengganti yang hampir seluruhnya teks,
jadi praktis foto ekskul-lah pemakai utamanya. Periksa sesekali di
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

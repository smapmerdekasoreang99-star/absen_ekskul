/* Pembuat Panduan Absensi Ekstrakurikuler (15 Okt 2026) — mesin sama dengan Tryout_Guru/alat/buat-panduan.js
   ---------------------------------------------------------------
   Satu sumber isi (ISI di bawah) → dua berkas di akar proyek, dibuka lewat tombol 📘 Panduan di kepala halaman:
     Panduan_Absensi_Ekstrakurikuler.pdf   (dicetak Chrome/Edge tanpa jendela, lewat DevTools Protocol)
     Panduan_Absensi_Ekstrakurikuler.docx  (paket npm "docx")
   Jalankan dari akar proyek (paket docx dipinjam dari Tryout_Guru, tidak perlu node_modules di sini):
     NODE_PATH=../Tryout_Guru/node_modules node alat/buat-panduan.js
   (atau: npm i --no-save --no-package-lock docx@9 lalu node alat/buat-panduan.js)
   Ubah isi panduan di sini bila tampilan atau aturan aplikasi berubah, lalu jalankan ulang. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");

const SUBJUDUL = "Melaporkan kegiatan, mengelola peserta, mengisi nilai, dan membaca rekap", UNTUK = "pembina/pelatih ekstrakurikuler dan Admin Kesiswaan";
const AKAR = path.join(__dirname, ".."), NAMA = "Panduan_Absensi_Ekstrakurikuler";
const JUDUL = "Panduan Absensi Ekstrakurikuler", VERSI = "15 Oktober 2026", MEREK = "ABSENSI EKSTRAKURIKULER · SMA PLUS MERDEKA SOREANG";

/* ================= Isi panduan =================
   Blok: H1/H2/H3 (judul, dinomori otomatis), P (paragraf), UL/OL (daftar), TB (tabel: kepala, baris, lebar relatif),
   KOTAK (jenis: info | saran | awas | bahaya), STAT (kotak angka contoh). Teks boleh memakai **tebal**. */
const H1 = s => ({ t: "h1", s }), H2 = s => ({ t: "h2", s }), H3 = s => ({ t: "h3", s }), P = s => ({ t: "p", s });
const UL = (...a) => ({ t: "ul", a }), OL = (...a) => ({ t: "ol", a });
const TB = (kepala, baris, lebar) => ({ t: "tb", kepala, baris, lebar: lebar || kepala.map(() => 1) });
const KOTAK = (jenis, judul, ...isi) => ({ t: "kotak", jenis, judul, isi });
const STAT = (ket, ...a) => ({ t: "stat", a, ket });

const ISI = [
  /* ============================ 1 ============================ */
  H1("Mengenal Absensi Ekstrakurikuler"),
  P("Absensi Ekstrakurikuler adalah aplikasi web sekolah untuk mencatat setiap pertemuan ekstrakurikuler: siapa yang hadir, materi latihan, dan satu foto kegiatan. Dari catatan itu aplikasi menyusun rekap kehadiran, bahan perhitungan transport pembina, dan nilai ekstrakurikuler untuk rapor."),
  P("Panduan ini untuk **pembina / pelatih** (melapor tiap pertemuan, mengelola peserta, mengisi nilai) dan **Admin Kesiswaan** (Wakasek Kesiswaan, staf, dan pimpinan: memantau laporan, mengatur data pembina dan kegiatan, membuka periode nilai, membagikan nilai ke wali kelas)."),
  H2("Alur kerja sepekan"),
  OL("**Latihan berlangsung** sesuai jadwal kegiatan.",
    "**Pembina melapor** di **Laporan Kegiatan**: tandai siswa yang hadir, isi materi latihan, ambil satu foto, lalu **Simpan daftar hadir**. Cukup beberapa menit di HP, sebelum atau sesudah latihan.",
    "**Admin Kesiswaan memantau** di **Beranda**: kegiatan mana yang sudah dan belum melapor pekan ini.",
    "**Akhir bulan / semester**: **Rekapitulasi** untuk kehadiran dan transport, **Nilai Siswa** untuk rapor."),
  H2("Menu aplikasi"),
  P("Menu ada di bilah bawah layar HP (di komputer menjadi bilah samping kiri). Nama pengguna dan tombol **Keluar** ada di kanan atas."),
  TB(["Menu", "Isi", "Untuk"], [
    ["**Beranda**", "Sapaan, laporan minggu ini, pintasan ke menu lain.", "semua"],
    ["**Laporan Kegiatan**", "Mencatat satu pertemuan: kehadiran pembina dan siswa, materi, foto.", "semua"],
    ["**Rekapitulasi**", "Rekap per kegiatan, per pertemuan, per pembina, per siswa; unduh Excel.", "semua (pembina: kegiatannya sendiri)"],
    ["**Nilai Siswa**", "Mengisi predikat dan deskripsi rapor; rekap per kelas.", "semua (periode & rekap kelas: Admin)"],
    ["**Data Peserta**", "Mendaftarkan dan mengeluarkan peserta, unggah daftar peserta dari Excel.", "semua"],
    ["**Admin Kesiswaan**", "Data pembina (termasuk PIN) dan data kegiatan.", "Admin Kesiswaan"],
  ], [1.4, 3.6, 1.6]),
  H2("Kategori kegiatan"),
  TB(["Kategori", "Keterangan"], [
    ["**Ekstrakurikuler**", "Kegiatan ekstrakurikuler biasa. **Hanya kategori ini yang masuk nilai rapor.**"],
    ["**Pembinaan Imtaq**", "Mis. Tahfidz. Dicatat dan direkap sama seperti ekstrakurikuler."],
    ["**Pembinaan Kesiswaan**", "Pembinaan lain di bawah kesiswaan."],
  ], [1.4, 4.6]),
  KOTAK("info", "Honor dan transport tidak dihitung di sini",
    "Aplikasi ini menyediakan rekap pertemuan per pembina sebagai bahan. Besaran honor/transport diatur di aplikasi **Induk Pembiayaan**."),
  H2("Istilah yang dipakai"),
  TB(["Istilah", "Arti"], [
    ["**Kegiatan**", "Satu ekstrakurikuler atau pembinaan, dengan pembina, hari, jam, dan tempat latihan."],
    ["**Pertemuan / laporan**", "Catatan satu kegiatan pada satu tanggal. **Satu kegiatan hanya punya satu laporan per tanggal.**"],
    ["**Penanggung jawab / pembimbing lain**", "Pembina utama kegiatan, dan pembina pendamping bila dibimbing bersama."],
    ["**Internal / Eksternal**", "Pembina yang guru sekolah (tertaut ke Data Induk) / pelatih dari luar sekolah."],
    ["**Hadir / Ditiadakan**", "Status pembina pada pertemuan itu. Ditiadakan berarti latihan tidak berjalan."],
    ["**H / S / I / A**", "Kehadiran siswa: Hadir, Sakit, Izin, Alfa."],
    ["**Blanko daftar hadir**", "Lembar Excel berkop untuk paraf siswa di kertas."],
    ["**Periode penilaian**", "Tahun ajaran + semester + tanggal mulai dan selesai pengisian nilai."],
    ["**Predikat**", "Nilai siswa: A Sangat Baik, B Baik, C Cukup, D Perlu Bimbingan."],
  ], [1.7, 4.3]),

  /* ============================ 2 ============================ */
  H1("Masuk dan Hak Akses"),
  H2("Masuk sebagai pembina / pelatih"),
  OL("Buka alamat aplikasi. Bila belum masuk, halaman masuk tampil otomatis.",
    "Ketuk **Pembina / pelatih**.",
    "Pilih nama di daftar **Nama Anda**. Daftar hanya memuat pembina yang membimbing minimal satu kegiatan aktif.",
    "Ketik **PIN** (4–6 angka) dari Admin Kesiswaan, lalu ketuk **Masuk** (atau tekan Enter)."),
  H2("Masuk sebagai Admin Kesiswaan"),
  P("Ketuk **Admin Kesiswaan**, ketik **PIN Admin Kesiswaan**, lalu **Masuk**. PIN ini hanya untuk Wakasek Kesiswaan, staf, dan pimpinan."),
  KOTAK("awas", "Jaga PIN",
    "Sesi masuk berakhir saat peramban ditutup. **Jangan bagikan PIN kepada siswa.** Di HP bersama, ketuk **Keluar** setelah selesai.",
    "Lupa PIN? PIN pembina tidak bisa dilihat lagi oleh siapa pun — mintalah Admin Kesiswaan membuatkan PIN baru (bagian 8)."),
  H2("Yang boleh dilakukan tiap peran"),
  TB(["Fitur", "Pembina / pelatih", "Admin Kesiswaan"], [
    ["Kegiatan yang tampil", "Hanya kegiatan yang dibimbingnya", "Semua kegiatan"],
    ["Laporan Kegiatan", "Ya", "Ya (juga mengisi laporan yang tertunggak)"],
    ["Rekapitulasi", "Ya, hanya kegiatannya sendiri", "Ya, semua kategori dan kegiatan"],
    ["Nilai Siswa", "Mengisi nilai **selama pengisian dibuka**", "Mengatur periode, membuka/menutup pengisian, rekap per kelas, kirim ke wali kelas"],
    ["Data Peserta", "Ya, untuk kegiatannya", "Ya, semua kegiatan"],
    ["Admin Kesiswaan", "Tidak", "Data pembina dan data kegiatan"],
  ], [1.4, 2.2, 2.8]),
  H2("Bila tidak bisa masuk"),
  TB(["Pesan", "Artinya / yang dilakukan"], [
    ["Pilih nama Anda dulu.", "Nama belum dipilih di daftar **Nama Anda**."],
    ["PIN salah.", "Periksa lagi angkanya. Bila tetap salah, minta PIN baru ke Admin Kesiswaan."],
    ["Pembina ini belum diberi PIN.", "Admin Kesiswaan perlu mengisi PIN pelaporan untuk Anda."],
    ["Daftar nama belum terbaca. Jaringan sedang lambat…", "Tunggu sebentar atau ketuk **Coba lagi**."],
    ["Nama saya tidak ada di daftar", "Anda belum tercatat sebagai pembina kegiatan aktif. Hubungi Wakasek Kesiswaan."],
  ], [2.4, 3.6]),

  /* ============================ 3 ============================ */
  H1("Beranda"),
  P("Beranda menyapa pengguna (\"Selamat pagi, Pak/Bu …\"), menampilkan tanggal hari ini, kegiatan yang dibimbing, dan ringkasan **laporan minggu ini** (sejak Senin sampai hari ini). Di bawahnya ada pintasan ke menu lain."),
  H2("Kartu pembina: Laporan minggu ini"),
  TB(["Tanda", "Artinya"], [
    ["**✓ Sudah melapor**", "Laporan pekan ini sudah masuk. Tampil hari/tanggal, tempat, materi, dan kehadiran siswa (mis. \"18 hadir dari 24 peserta seluruhnya\", persen, serta jumlah sakit/izin/alfa)."],
    ["**Belum melapor**", "Jadwal sudah lewat tetapi laporan belum ada. Ketuk **Isi daftar hadir**."],
    ["**Menunggu jadwal**", "Jadwal pekan ini belum tiba. Laporan diisi sesudah latihan berlangsung."],
  ], [1.5, 4.5]),
  P("Warna persen kehadiran: hijau bila 80% atau lebih, kuning 60–79%, merah di bawah 60%."),
  H2("Kartu Admin Kesiswaan: Laporan kegiatan minggu ini"),
  TB(["Kelompok", "Isi"], [
    ["**Sudah laporan**", "Ketuk **Lihat laporan ›** untuk membuka laporannya (terbuka terkunci, aman dari perubahan tak sengaja). Pertemuan yang ditiadakan diberi tanda **Ditiadakan** beserta alasannya."],
    ["**Belum laporan**", "Kegiatan yang jadwalnya sudah lewat tanpa laporan, dengan tombol **Isi laporan**. Tanda tunggakan: **2 minggu berturut-turut** (kuning), **3 minggu** atau **4 minggu atau lebih berturut-turut** (merah). Pekan libur tidak dihitung."],
    ["**Menunggu jadwal**", "Kegiatan yang jadwalnya belum tiba pekan ini, dikelompokkan per hari."],
  ], [1.4, 4.6]),
  KOTAK("saran", "Pantau tiap Jumat/Sabtu",
    "Bila muncul \"✓ Semua kegiatan yang jadwalnya sudah lewat telah melapor\", pekan ini beres. Kegiatan bertanda merah perlu diingatkan langsung ke pembinanya."),

  /* ============================ 4 ============================ */
  H1("Mengisi Laporan Kegiatan"),
  P("Satu laporan = satu kegiatan pada satu tanggal. Isi sebelum atau sesudah latihan; laporan bisa diperbaiki kapan saja sesudahnya."),
  H2("Langkah singkat"),
  OL("Buka **Laporan Kegiatan** (atau ketuk **Isi daftar hadir** di Beranda).",
    "Pilih **Ekstrakurikuler** (yang jadwalnya hari ini ada di paling atas) dan periksa **Tanggal latihan** (bawaannya hari ini).",
    "Di **Kehadiran pembina** pilih **Hadir**, periksa **Tempat latihan**, dan isi **Materi latihan (opsional)**.",
    "Di **Kehadiran siswa** tandai siswa yang datang (**H**), yang sakit (**S**), dan yang izin (**I**).",
    "Di **Foto kegiatan** ketuk **Ambil foto atau pilih dari galeri**, tunggu sampai \"Foto siap\".",
    "Bila perlu, tulis **Catatan (opsional)**: kendala, kejadian penting, rencana minggu depan.",
    "Ketuk **Simpan daftar hadir** di bilah bawah. Tunggu pesan \"Tersimpan. … siswa hadir pada …\"."),
  KOTAK("info", "Bawaannya alfa",
    "Setiap siswa bertanda **A (alfa)** sampai ditandai lain, jadi cukup tandai yang datang. Untuk kelompok besar, ketuk **Tandai semua hadir** lalu ubah yang tidak datang. **Kosongkan tanda** mengembalikan semua ke A. Kotak **Cari nama atau kelas** membantu menemukan siswa."),
  P("Bila tanggal tidak sesuai hari jadwal kegiatan, muncul tanda **di luar jadwal rutin**. Tanda ini hanya pengingat; laporan tetap bisa disimpan (mis. latihan tambahan atau pertemuan pengganti)."),
  H2("Kegiatan dibimbing lebih dari satu pembina"),
  P("Muncul daftar centang **Pembimbing yang hadir**, semuanya tercentang. **Lepas centang pembimbing yang tidak datang.** Transport pertemuan itu dibagi rata kepada yang tercentang, sehingga bagian yang tidak datang ikut ke yang hadir."),
  H2("Bila latihan tidak berjalan: Ditiadakan"),
  P("Pilih **Ditiadakan** di **Kehadiran pembina**, lalu isi **Alasan ditiadakan** (wajib):"),
  TB(["Alasan", "Isian tambahan"], [
    ["Pembina berhalangan", "—"],
    ["Dipindah ke tanggal lain", "**Dipindah ke tanggal** (wajib). Sesudah menyimpan, catat pertemuan penggantinya: pilih tanggal pengganti di atas, lalu isi kehadiran seperti biasa."],
    ["Libur atau kegiatan sekolah", "—"],
    ["Cuaca atau tempat tidak bisa dipakai", "—"],
    ["Lainnya", "**Keterangan** (wajib)."],
  ], [2.2, 3.8]),
  P("Selama Ditiadakan, isian siswa dan foto disembunyikan dan kehadiran siswa tidak dihitung. Pesan sesudah menyimpan: \"Tersimpan. Pertemuan ditandai ditiadakan: …\"."),
  KOTAK("saran", "Mengapa perlu melaporkan pertemuan yang ditiadakan?",
    "Supaya Beranda tidak menghitungnya sebagai tunggakan, dan rekap menunjukkan alasan yang jelas, bukan sekadar \"tidak ada catatan\"."),
  H2("Foto kegiatan"),
  UL("Satu foto per pertemuan: pembina bersama siswanya, diambil sebelum atau sesudah latihan.",
    "Ukuran foto diperkecil otomatis di HP sebelum dikirim (foto 4 MB menjadi ±150–300 KB), jadi hemat kuota.",
    "Foto diunggah begitu dipilih (\"Memproses…\" lalu \"Mengunggah…\"). Setelah muncul **\"Foto siap. Jangan lupa ketuk Simpan daftar hadir.\"**, laporan tetap harus disimpan.",
    "Salah foto? Ketuk **Ganti** di atas foto, lalu pilih lagi.",
    "Menyimpan tanpa foto boleh, tetapi aplikasi akan bertanya \"Belum ada foto kegiatan. Simpan tanpa foto?\"."),
  H2("Memperbaiki laporan yang sudah tersimpan"),
  OL("Pilih kegiatan dan tanggal yang sama. Laporan lama terbuka **terkunci** dengan pita \"Tersimpan … Isian terkunci supaya tidak berubah tanpa sengaja\".",
    "Ketuk **Ubah**, lalu perbaiki isian.",
    "Ketuk **Simpan perubahan**. Untuk membatalkan, ketuk **Batal** (isian kembali seperti yang tersimpan)."),
  P("Selama ada perubahan yang belum disimpan, tampil tulisan \"Ada perubahan yang belum disimpan\" dan peramban memperingatkan bila halaman hendak ditinggalkan."),
  KOTAK("awas", "Laporan tidak bisa dihapus",
    "Aplikasi sengaja tidak menyediakan hapus laporan. Bila salah tanggal atau salah kegiatan: ubah laporan yang salah menjadi **Ditiadakan** dengan alasan **Lainnya** dan keterangan \"salah input\", lalu buat laporan yang benar. Bila laporan memang harus dihapus, minta bantuan operator data sekolah."),
  H2("Blanko daftar hadir (kertas)"),
  P("Tombol **Unduh blanko daftar hadir** (di Laporan Kegiatan dan Data Peserta) menghasilkan lembar Excel berkop: nama kegiatan, pembina, jadwal, tempat, daftar peserta dengan kolom tanda tangan, 3 baris cadangan, dan tempat tanda tangan pembina. Cocok untuk paraf siswa di lapangan; catatannya tetap dimasukkan ke aplikasi."),

  /* ============================ 5 ============================ */
  H1("Data Peserta"),
  P("Pilih kegiatan di **Pilih ekstrakurikuler**. Bagian **Peserta terdaftar** menampilkan jumlah dan daftar peserta saat ini."),
  H2("Mendaftarkan satu per satu"),
  OL("Di **Tambah peserta**, pilih **Kelas** (atau biarkan \"Semua kelas\") dan ketik sebagian nama di **Cari nama**.",
    "Ketuk **Daftarkan** di samping nama siswa. Siswa yang sudah menjadi peserta bertanda **Sudah terdaftar**."),
  KOTAK("info", "Nama diambil dari data siswa sekolah",
    "Tidak ada pengetikan nama ulang: daftar siswa sama dengan yang dipakai aplikasi Tryout & Asesmen (Data Induk). Siswa yang belum ada di sana perlu ditambahkan dulu oleh operator data."),
  H2("Mengunggah daftar peserta dari Excel"),
  OL("Ketuk **Unduh template berkas**. Berkas berisi lembar **Peserta**, **Daftar kelas** (pilihan kelas), dan **Petunjuk**.",
    "Isi kolom **Nama siswa** (wajib) dan **Kelas** (dianjurkan). Judul kolom di baris pertama; kolom lain diabaikan.",
    "Simpan sebagai **.xlsx** (atau .csv), lalu ketuk **Pilih berkas…**.",
    "Periksa pratinjau, lalu ketuk **Daftarkan N siswa ke …**. Ketuk **Batal** bila ingin memperbaiki berkas dulu."),
  TB(["Tanda di pratinjau", "Artinya"], [
    ["**Akan didaftarkan**", "Cocok dengan satu siswa di data sekolah."],
    ["**Sudah terdaftar**", "Sudah menjadi peserta; tidak didaftarkan ulang."],
    ["**Dilewati**", "Nama ditulis dua kali di berkas."],
    ["**Perlu dipastikan**", "Ada beberapa siswa bernama sama — isi kolom kelasnya."],
    ["**Tidak ditemukan**", "Tidak ada di data siswa, atau nama ada tetapi kelasnya tidak cocok. Periksa ejaan dan kelas."],
  ], [1.6, 4.4]),
  KOTAK("saran", "Penulisan bebas",
    "Huruf besar-kecil dan tanda baca diabaikan; \"X-1\", \"X 1\", dan \"X.1\" dianggap sama. Berkas **.xls** (Excel lama) belum didukung: buka di Excel lalu simpan sebagai .xlsx."),
  H2("Mengeluarkan dan memindahkan peserta"),
  UL("Ketuk **Keluarkan** di samping nama peserta, lalu konfirmasi. **Catatan kehadiran yang lalu tetap tersimpan.** Peserta yang dikeluarkan bisa didaftarkan lagi kapan saja.",
    "Seorang siswa boleh mengikuti beberapa kegiatan sekaligus.",
    "Pindah kegiatan: keluarkan dari kegiatan lama, lalu daftarkan di kegiatan baru."),

  /* ============================ 6 ============================ */
  H1("Nilai Siswa"),
  H2("Periode penilaian (Admin Kesiswaan)"),
  P("Pembina hanya bisa mengisi nilai selama **pengisian dibuka**. Sebelum masa rapor, Admin Kesiswaan menyiapkan periodenya di kartu **Periode penilaian**:"),
  OL("Pilih **— periode baru —** di **Periode tersimpan** (atau pilih periode yang sudah ada untuk diubah).",
    "Isi **Tahun ajaran** (mis. 2026/2027), **Semester** (Ganjil/Genap), **Mulai**, **Selesai**, dan bila perlu **Catatan untuk pembina**.",
    "Ketuk **Simpan periode**, lalu **Buka pengisian**.",
    "Setelah batas waktu, ketuk **Tutup pengisian**. Selama tertutup, pembina hanya bisa melihat."),
  H2("Mengisi nilai (pembina)"),
  OL("Buka **Nilai Siswa**, pilih **Kegiatan**. Pastikan bertanda **Pengisian dibuka**.",
    "Untuk tiap siswa pilih predikat dan tulis **deskripsi singkat untuk rapor**.",
    "Ketuk **Simpan nilai** di bilah bawah. Tunggu pesan \"… nilai tersimpan\"."),
  TB(["Predikat", "Arti"], [["**A**", "Sangat Baik"], ["**B**", "Baik"], ["**C**", "Cukup"], ["**D**", "Perlu Bimbingan"]], [1, 4]),
  P("Kolom **Kehadiran** dihitung otomatis dari laporan latihan sepanjang semester, sebagai bahan pertimbangan — tidak perlu diisi. Tanda \"belum ada data\" berarti belum ada laporan untuk siswa itu."),
  KOTAK("saran", "Isi cepat",
    "Pilih \"Semua A — Sangat Baik\" (atau B/C) di **Terapkan ke yang kosong…**, ketuk **Terapkan**, lalu ubah siswa yang berbeda. Hanya siswa yang belum bernilai yang terisi; jangan lupa **Simpan nilai**."),
  P("Tombol **Unduh daftar nilai** menghasilkan daftar nilai berkop untuk ditandatangani pembina (isinya mengikuti yang tampak di layar)."),
  H2("Rekap per kelas dan kirim ke wali kelas (Admin Kesiswaan)"),
  OL("Di tab **Rekap per kelas**, pilih **Kelas** dan **Kategori**. Nilai rapor hanya memakai kategori **Ekstrakurikuler**.",
    "**Unduh daftar kelas** (satu kelas) atau **Unduh semua kelas** (satu berkas per kelas), bertanda tangan Kepala Sekolah dan Wakasek Kesiswaan.",
    "**Kirim ke Wali Kelas** membuka pratinjau gambar dengan pilihan **Bagikan gambar ke WhatsApp**, **Unduh gambar**, **Salin teks**, atau **Kirim sebagai teks**. Di komputer, berbagi gambar diganti dengan unduh gambar."),

  /* ============================ 7 ============================ */
  H1("Rekapitulasi"),
  H2("Memilih periode"),
  UL("Pilih **Mingguan** atau **Bulanan**, geser dengan ◀ ▶. Label tengah (mis. \"Bulan ini\", \"Minggu lalu\") bisa diketuk untuk kembali ke periode sekarang.",
    "Atau isi **Dari tanggal** dan **Sampai tanggal** sendiri, lalu ketuk **Tampilkan rekap**.",
    "Admin Kesiswaan dapat memilih **Kategori kegiatan**; pembina hanya melihat kegiatan yang dibimbingnya."),
  H2("Ringkasan dan tab rekap"),
  P("Kartu **Ringkasan** menampilkan jumlah pertemuan tercatat, terlaksana, dan ditiadakan, kehadiran pembina, kehadiran siswa, rata-rata per latihan, jumlah pertemuan berfoto, dan kegiatan tanpa catatan."),
  TB(["Tab", "Isi", "Dipakai untuk"], [
    ["**Per kegiatan**", "Rekap kehadiran tiap kegiatan.", "Laporan bulanan kesiswaan"],
    ["**Per pertemuan**", "Rincian tiap pertemuan beserta foto mini (ketuk untuk memperbesar) dan pencatatnya.", "Bukti kegiatan"],
    ["**Per pembina**", "Jumlah pertemuan per pembina; hanya pertemuan berstatus Hadir.", "**Perhitungan transport**"],
    ["**Per siswa**", "Kehadiran tiap siswa, diurutkan dari yang terendah.", "Pembinaan siswa yang jarang hadir"],
  ], [1.3, 3.2, 1.8]),
  P("**Unduh tabel** menghasilkan Excel berkop untuk tab yang sedang dibuka. Penanda tangan dipilih otomatis: pembina kegiatan itu, Koordinator Tahfidz untuk Tahfidz, atau Wakasek Kesiswaan bila berisi beberapa pembina."),

  /* ============================ 8 ============================ */
  H1("Halaman Admin Kesiswaan"),
  H2("Data pembina"),
  OL("Di tab **Data pembina**, isi formulir **Tambah pembina**: **Tautkan ke data guru** (pilih guru, atau \"Pelatih eksternal\"), **Nama lengkap**, **Jenis kelamin** (menentukan sapaan Pak/Bu), **Nomor HP**, **PIN pelaporan** (4–6 angka; **Acak** untuk membuat otomatis), dan **Keaktifan**.",
    "Ketuk **Simpan**. Catat dan sampaikan PIN kepada pembina saat itu juga — **PIN tidak bisa dilihat lagi** setelah disimpan.",
    "Untuk mengubah, ketuk **Ubah**. Kosongkan **PIN pelaporan** bila PIN tidak ingin diganti; isi angka baru untuk mengganti PIN yang terlupa."),
  P("Tanda merah \"nonaktif di Data Induk\" atau \"tanpa tugas di Data Induk\" berarti data guru tersebut perlu diperiksa di aplikasi Data Induk. Pembina yang masih memegang kegiatan tidak bisa dihapus; nonaktifkan saja."),
  H2("Data kegiatan"),
  P("Di tab **Data ekskul**, isi **Nama kegiatan**, **Pembina penanggung jawab**, **Pembimbing lain** (bila dibimbing bersama; transport dibagi rata), **Kategori**, **Hari latihan**, **Jam mulai** / **Jam selesai**, **Tempat latihan**, dan **Keaktifan**, lalu **Simpan**."),
  KOTAK("awas", "Nonaktifkan, jangan hapus",
    "Kegiatan yang sudah punya peserta atau laporan tidak bisa dihapus. Ubah **Keaktifan** menjadi **Nonaktif**: kegiatan hilang dari menu Laporan Kegiatan, tetapi seluruh riwayatnya tetap utuh."),

  /* ============================ 9 ============================ */
  H1("Dokumen dan Masalah Umum"),
  H2("Dokumen yang bisa diunduh"),
  TB(["Dokumen", "Dari", "Bentuk"], [
    ["Blanko daftar hadir", "Laporan Kegiatan, Data Peserta", "Excel berkop, A4"],
    ["Daftar nilai satu kegiatan", "Nilai Siswa → Unduh daftar nilai", "Excel berkop"],
    ["Nilai per kelas", "Nilai Siswa → Rekap per kelas (Admin)", "Excel berkop, atau gambar untuk WhatsApp"],
    ["Rekap per kegiatan / pertemuan / pembina / siswa", "Rekapitulasi → Unduh tabel", "Excel berkop"],
  ], [2.4, 2.4, 1.6]),
  P("Kop dokumen (nama sekolah, alamat, logo) dan tahun pelajaran diambil dari **Data Induk → Profil Dokumen**. Bila kop salah, perbaiki di sana, bukan di aplikasi ini. Mengunduh dokumen memerlukan sambungan internet."),
  H2("Pesan yang mungkin muncul"),
  TB(["Pesan", "Yang dilakukan"], [
    ["Ekstrakurikuler dan tanggal wajib diisi.", "Pilih kegiatan dan tanggal di kartu Kegiatan."],
    ["Pilih alasan kegiatan ditiadakan. / Isi tanggal penggantinya. / Tulis keterangan alasannya.", "Lengkapi isian Ditiadakan (bagian 4)."],
    ["Berkas itu bukan gambar. / Foto gagal diproses. / Gagal mengunggah foto…", "Ambil ulang foto, atau pilih foto lain dari galeri. Periksa sinyal."],
    ["Gagal menyimpan …", "Sambungan terputus saat menyimpan. **Laporan belum tersimpan** — tunggu sinyal, lalu ketuk simpan lagi. Isian di layar tidak hilang selama halaman tidak ditutup."],
    ["Pengisian nilai sedang ditutup.", "Tunggu Admin Kesiswaan membuka periode penilaian."],
    ["Gagal memuat pustaka Excel. Periksa sambungan internet.", "Unduhan Excel butuh internet; coba lagi saat sinyal baik."],
    ["Berkas harus .xlsx atau .csv. / Baris judul tidak ditemukan…", "Pakai template dari **Unduh template berkas**, simpan sebagai .xlsx."],
  ], [2.8, 3.2]),
  KOTAK("awas", "Simpan selagi ada sinyal",
    "Aplikasi tidak menyimpan laporan di HP untuk dikirim belakangan. Laporan baru benar-benar tersimpan setelah muncul pesan **\"Tersimpan…\"**. Bila sinyal di lapangan buruk, isi laporan di tempat bersinyal atau pakai blanko kertas lalu masukkan belakangan."),
  H2("Tips"),
  UL("Tambahkan aplikasi ke layar utama HP (menu peramban → **Tambahkan ke layar utama**) supaya mudah dibuka tiap latihan.",
    "Isi laporan pada hari latihan juga, supaya tidak menjadi tunggakan di Beranda.",
    "Bila tampilan terasa lama atau tidak berubah setelah pembaruan aplikasi, muat ulang halaman (tarik layar ke bawah di HP, atau Ctrl+F5 di komputer)."),
];

/* ================= Penomoran judul ================= */
(function nomori() { const n = [0, 0, 0];
  ISI.forEach(b => { if (!/^h[123]$/.test(b.t)) return; const k = +b.t[1] - 1; n[k]++; for (let i = k + 1; i < 3; i++) n[i] = 0;
    b.no = k === 0 ? `${n[0]}.` : n.slice(0, k + 1).join("."); b.id = "b" + n.slice(0, k + 1).join("-"); }); })();
const DAFTAR = ISI.filter(b => b.t === "h1" || b.t === "h2");

/* ================= HTML untuk PDF ================= */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sebaris = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const WARNA_KOTAK = { info: ["#2F7FD8", "#E8F1FC"], saran: ["#2E9E5B", "#E7F5EC"], awas: ["#C98A12", "#FDF4E1"], bahaya: ["#D9534F", "#FBE9E8"] };
function htmlBlok(b) {
  if (b.t === "h1") return `<h1 id="${b.id}">${b.no} ${sebaris(b.s)}</h1>`;
  if (b.t === "h2") return `<h2 id="${b.id}">${b.no} ${sebaris(b.s)}</h2>`;
  if (b.t === "h3") return `<h3 id="${b.id}">${b.no} ${sebaris(b.s)}</h3>`;
  if (b.t === "p") return `<p>${sebaris(b.s)}</p>`;
  if (b.t === "ul" || b.t === "ol") return `<${b.t}>${b.a.map(x => `<li>${sebaris(x)}</li>`).join("")}</${b.t}>`;
  if (b.t === "tb") { const tot = b.lebar.reduce((a, x) => a + x, 0);
    return `<table><colgroup>${b.lebar.map(w => `<col style="width:${(w / tot * 100).toFixed(1)}%">`).join("")}</colgroup><thead><tr>${b.kepala.map(k => `<th>${sebaris(k)}</th>`).join("")}</tr></thead>
      <tbody>${b.baris.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="pertama"' : ""}>${sebaris(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`; }
  if (b.t === "kotak") { const [w, l] = WARNA_KOTAK[b.jenis];
    return `<div class="kotak" style="border-color:${w};background:${l}"><div class="kotak-judul" style="color:${w}">${sebaris(b.judul)}</div>${b.isi.map(x => `<p>${sebaris(x)}</p>`).join("")}</div>`; }
  if (b.t === "stat") return `<div class="stat">${b.a.map(([a, k]) => `<div><b>${esc(a)}</b><span>${esc(k)}</span></div>`).join("")}</div><p class="stat-ket">${esc(b.ket)}</p>`;
  throw new Error("Blok tidak dikenal: " + b.t);
}
function buatHTML() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${JUDUL}</title><style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Calibri, "Segoe UI", Carlito, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1F2633; }
  b { font-weight: 700; }
  .sampul { height: 247mm; display: flex; flex-direction: column; justify-content: center; break-after: page; }
  .sampul .atas { font-size: 11pt; font-weight: 700; letter-spacing: .08em; color: #8F6B1A; }
  .sampul h1 { break-before: auto; font-size: 34pt; color: #1D2A3A; margin: 10px 0 6px; border: 0; padding: 0; }
  .sampul .sub { font-size: 15pt; color: #33445A; }
  .sampul .garis { height: 4px; background: linear-gradient(90deg, #1D2A3A 0 70%, #F2B92E 70%); margin: 34px 0 22px; border-radius: 2px; }
  .sampul ul { margin: 8px 0 0; } .sampul .kaki { margin-top: 70px; color: #556070; font-size: 9.5pt; }
  .daftar { break-after: page; } .daftar h1 { break-before: auto; }
  .daftar a { color: inherit; text-decoration: none; display: block; padding: 3px 0; border-bottom: 1px dotted #C9D2DE; }
  .daftar .d1 { font-weight: 700; margin-top: 8px; } .daftar .d2 { padding-left: 18px; color: #33445A; }
  h1 { break-before: page; font-size: 19pt; color: #1D2A3A; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2.5px solid #1D2A3A; }
  h2 { font-size: 13.5pt; color: #1D2A3A; margin: 20px 0 6px; break-after: avoid; }
  h3 { font-size: 11.5pt; color: #2F6FB8; margin: 14px 0 4px; break-after: avoid; }
  p { margin: 0 0 8px; } ul, ol { margin: 0 0 10px; padding-left: 22px; } li { margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 9.5pt; }
  th { background: #1D2A3A; color: #fff; text-align: left; padding: 6px 8px; font-weight: 700; }
  td { padding: 6px 8px; border-bottom: 1px solid #D5DCE6; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #F6F8FB; } tr { break-inside: avoid; } td.pertama { font-weight: 400; }
  .kotak { border-left: 5px solid; border-radius: 4px; padding: 10px 14px; margin: 8px 0 14px; break-inside: avoid; font-size: 9.8pt; }
  .kotak-judul { font-weight: 700; margin-bottom: 3px; } .kotak p { margin: 0 0 4px; }
  .stat { display: flex; gap: 6px; margin: 8px 0 2px; break-inside: avoid; }
  .stat div { flex: 1; background: #EEF2F7; border-radius: 6px; padding: 8px 6px; text-align: center; }
  .stat b { display: block; font-size: 17pt; color: #1D2A3A; line-height: 1.1; } .stat span { font-size: 8.5pt; color: #556070; }
  .stat-ket { text-align: center; font-size: 8.5pt; font-style: italic; color: #8A93A3; margin-bottom: 12px; }
  </style></head><body>
  <section class="sampul"><div class="atas">${MEREK}</div><h1>${JUDUL}</h1>
    <div class="sub">${SUBJUDUL}</div><div class="garis"></div>
    <p>Isi panduan ini:</p><ul>${ISI.filter(b => b.t === "h1").map(b => `<li><b>${esc(b.s)}</b></li>`).join("")}</ul>
    <div class="kaki">Untuk: ${UNTUK}<br>Versi: ${VERSI} (sesuai tampilan aplikasi per tanggal tersebut)</div></section>
  <section class="daftar"><h1>Daftar Isi</h1>${DAFTAR.map(b => `<a class="d${b.t[1]}" href="#${b.id}">${b.no} ${sebaris(b.s)}</a>`).join("")}</section>
  ${ISI.map(htmlBlok).join("\n")}
  </body></html>`;
}

/* ================= Cetak PDF lewat Chrome/Edge (DevTools Protocol) ================= */
function cariPeramban() {
  const calon = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  const ada = calon.find(p => p && fs.existsSync(p)); if (!ada) throw new Error("Chrome/Edge tidak ditemukan. Atur variabel CHROME ke lokasi chrome.exe."); return ada;
}
const tunggu = ms => new Promise(r => setTimeout(r, ms));
async function cetakPDF(berkasHTML, keluaran) {
  const port = 9300 + Math.floor(Math.random() * 500), profil = fs.mkdtempSync(path.join(os.tmpdir(), "panduan-"));
  const p = spawn(cariPeramban(), ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
  try {
    let daftar;
    for (let i = 0; i < 100 && !daftar; i++) { try { daftar = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch (e) { await tunggu(150); } }
    const hal = daftar && daftar.find(x => x.type === "page"); if (!hal) throw new Error("Peramban tidak merespons.");
    const ws = new WebSocket(hal.webSocketDebuggerUrl); await new Promise((ok, gagal) => { ws.onopen = ok; ws.onerror = gagal; });
    let id = 0; const janji = new Map(), acara = [];
    ws.onmessage = m => { const x = JSON.parse(m.data); if (x.id && janji.has(x.id)) { janji.get(x.id)(x); janji.delete(x.id); } else if (x.method) acara.push(x.method); };
    const kirim = (method, params = {}) => new Promise(ok => { const k = ++id; janji.set(k, ok); ws.send(JSON.stringify({ id: k, method, params })); });
    await kirim("Page.enable");
    await kirim("Page.navigate", { url: "file:///" + berkasHTML.replace(/\\/g, "/") });
    for (let i = 0; i < 100 && !acara.includes("Page.loadEventFired"); i++) await tunggu(100);
    await kirim("Runtime.evaluate", { expression: "document.fonts.ready.then(() => 1)", awaitPromise: true });
    const gaya = "font-family:Calibri,'Segoe UI',sans-serif;font-size:8px;color:#8A93A3;width:100%;padding:0 18mm;";
    const opsi = { printBackground: true, displayHeaderFooter: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.75, marginBottom: 0.7, marginLeft: 0.71, marginRight: 0.71,
      headerTemplate: `<div style="${gaya}text-align:right">${JUDUL}</div>`,
      footerTemplate: `<div style="${gaya}text-align:center">Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>`,
      generateDocumentOutline: true, generateTaggedPDF: true };
    let r = await kirim("Page.printToPDF", opsi);
    if (r.error) { delete opsi.generateDocumentOutline; delete opsi.generateTaggedPDF; r = await kirim("Page.printToPDF", opsi); }   // Chrome lama
    if (r.error) throw new Error(r.error.message);
    fs.writeFileSync(keluaran, Buffer.from(r.result.data, "base64")); ws.close();
  } finally { p.kill(); await tunggu(400); try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) { /* biarkan */ } }
}

/* ================= Word (.docx) ================= */
async function buatDOCX(keluaran) {
  const D = require("docx");
  const LEBAR = 9638;   // lebar isi A4 dengan margin 2 cm (twip)
  const lari = (s, o = {}) => String(s).split(/(\*\*.+?\*\*)/).filter(Boolean).map(x => /^\*\*.+\*\*$/.test(x) ? new D.TextRun({ text: x.slice(2, -2), bold: true, ...o }) : new D.TextRun({ text: x, ...o }));
  const par = (s, o = {}, r = {}) => new D.Paragraph({ children: lari(s, r), spacing: { after: 120 }, ...o });
  const garis = { style: D.BorderStyle.SINGLE, size: 4, color: "D5DCE6" }, kosong = { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const sel = (isi, lebar, o = {}) => new D.TableCell({ width: { size: lebar, type: D.WidthType.DXA }, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: isi, ...o });
  let nomorDaftar = 0;
  const blok = b => {
    if (b.t === "h1") return [new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, pageBreakBefore: true, children: lari(`${b.no} ${b.s}`) })];
    if (b.t === "h2") return [new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, children: lari(`${b.no} ${b.s}`) })];
    if (b.t === "h3") return [new D.Paragraph({ heading: D.HeadingLevel.HEADING_3, children: lari(`${b.no} ${b.s}`) })];
    if (b.t === "p") return [par(b.s)];
    if (b.t === "ul") return b.a.map(x => par(x, { bullet: { level: 0 }, spacing: { after: 60 } }));
    if (b.t === "ol") { const n = ++nomorDaftar; return b.a.map(x => par(x, { numbering: { reference: "angka", level: 0, instance: n }, spacing: { after: 60 } })); }
    if (b.t === "tb") { const tot = b.lebar.reduce((a, x) => a + x, 0), w = b.lebar.map(x => Math.round(x / tot * LEBAR));
      return [new D.Table({ width: { size: LEBAR, type: D.WidthType.DXA }, columnWidths: w,
        borders: { top: garis, bottom: garis, left: kosong, right: kosong, insideHorizontal: garis, insideVertical: kosong },
        rows: [new D.TableRow({ tableHeader: true, cantSplit: true, children: b.kepala.map((k, i) => sel([par(k, { spacing: { after: 0 } }, { bold: true, color: "FFFFFF", size: 19 })], w[i], { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "1D2A3A" } })) }),
          ...b.baris.map((r, j) => new D.TableRow({ cantSplit: true, children: r.map((c, i) => sel([par(c, { spacing: { after: 0 } }, { size: 19 })], w[i], j % 2 ? { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "F6F8FB" } } : {})) }))] }),
        new D.Paragraph({ spacing: { after: 120 }, children: [] })]; }
    if (b.t === "kotak") { const [w, l] = WARNA_KOTAK[b.jenis].map(x => x.slice(1));
      return [new D.Table({ width: { size: LEBAR, type: D.WidthType.DXA }, columnWidths: [LEBAR],
        borders: { top: kosong, bottom: kosong, right: kosong, left: { style: D.BorderStyle.SINGLE, size: 30, color: w }, insideHorizontal: kosong, insideVertical: kosong },
        rows: [new D.TableRow({ cantSplit: true, children: [sel([par(b.judul, { spacing: { after: 40 } }, { bold: true, color: w, size: 20 }), ...b.isi.map(x => par(x, { spacing: { after: 40 } }, { size: 19 }))], LEBAR,
          { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: l }, margins: { top: 120, bottom: 120, left: 200, right: 160 } })] })] }),
        new D.Paragraph({ spacing: { after: 120 }, children: [] })]; }
    if (b.t === "stat") { const w = Math.floor(LEBAR / b.a.length), putih = { style: D.BorderStyle.SINGLE, size: 24, color: "FFFFFF" };
      return [new D.Table({ width: { size: LEBAR, type: D.WidthType.DXA }, columnWidths: b.a.map(() => w),
        borders: { top: putih, bottom: putih, left: putih, right: putih, insideHorizontal: putih, insideVertical: putih },
        rows: [new D.TableRow({ cantSplit: true, children: b.a.map(([a, k]) => sel([
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: a, bold: true, size: 34, color: "1D2A3A" })] }),
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: k, size: 16, color: "556070" })] })], w, { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "EEF2F7" } })) })] }),
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 40, after: 160 }, children: [new D.TextRun({ text: b.ket, italics: true, size: 16, color: "8A93A3" })] })]; }
    throw new Error("Blok tidak dikenal: " + b.t);
  };
  const sampul = [
    new D.Paragraph({ spacing: { before: 3200, after: 120 }, children: [new D.TextRun({ text: MEREK, bold: true, size: 22, color: "8F6B1A" })] }),
    new D.Paragraph({ spacing: { after: 120 }, children: [new D.TextRun({ text: JUDUL, bold: true, size: 64, color: "1D2A3A" })] }),
    new D.Paragraph({ spacing: { after: 400 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 24, color: "1D2A3A", space: 18 } },
      children: [new D.TextRun({ text: SUBJUDUL, size: 30, color: "33445A" })] }),
    par("Isi panduan ini:"),
    ...ISI.filter(b => b.t === "h1").map(b => par(`**${b.s}**`, { bullet: { level: 0 }, spacing: { after: 40 } })),
    new D.Paragraph({ spacing: { before: 1400, after: 0 }, children: [new D.TextRun({ text: "Untuk: " + UNTUK, size: 19, color: "556070" })] }),
    new D.Paragraph({ children: [new D.TextRun({ text: `Versi: ${VERSI} (sesuai tampilan aplikasi per tanggal tersebut)`, size: 19, color: "556070" })] }),
  ];
  const daftarIsi = [new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: [new D.TextRun("Daftar Isi")] }),
    ...DAFTAR.map(b => new D.Paragraph({ spacing: { after: 50, before: b.t === "h1" ? 140 : 0 }, indent: { left: b.t === "h1" ? 0 : 360 },
      children: lari(`${b.no} ${b.s}`, { bold: b.t === "h1", color: b.t === "h1" ? "1F2633" : "33445A" }) }))];
  const kepala = new D.Header({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: JUDUL, size: 16, color: "8A93A3" })] })] });
  const kaki = new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ children: ["Halaman ", D.PageNumber.CURRENT], size: 16, color: "8A93A3" })] })] });
  const halaman = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } };
  const doc = new D.Document({
    creator: "Absensi Ekstrakurikuler", title: JUDUL, description: SUBJUDUL,
    styles: { default: { document: { run: { font: "Calibri", size: 21, color: "1F2633" }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: "1D2A3A" },
          paragraph: { spacing: { before: 0, after: 200 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 18, color: "1D2A3A", space: 6 } } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 27, bold: true, color: "1D2A3A" }, paragraph: { spacing: { before: 320, after: 100 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: "2F6FB8" }, paragraph: { spacing: { before: 220, after: 80 }, keepNext: true } }] },
    numbering: { config: [{ reference: "angka", levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: "%1.", alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{ properties: halaman, children: sampul },
      { properties: halaman, headers: { default: kepala }, footers: { default: kaki }, children: [...daftarIsi, ...ISI.flatMap(blok)] }],
  });
  fs.writeFileSync(keluaran, await D.Packer.toBuffer(doc));
}

(async () => {
  const html = path.join(os.tmpdir(), NAMA + ".html"); fs.writeFileSync(html, buatHTML());
  if (process.argv.includes("--html")) { fs.copyFileSync(html, path.join(AKAR, NAMA + ".html")); console.log("HTML →", NAMA + ".html"); }
  await cetakPDF(html, path.join(AKAR, NAMA + ".pdf")); console.log("PDF  →", NAMA + ".pdf");
  await buatDOCX(path.join(AKAR, NAMA + ".docx")); console.log("DOCX →", NAMA + ".docx");
})().catch(e => { console.error("Gagal:", e.message); process.exit(1); });

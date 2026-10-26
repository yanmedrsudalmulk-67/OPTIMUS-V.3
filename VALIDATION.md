# Laporan implementasi dan verifikasi

Tanggal: **26 Oktober 2026**. Semua hasil berikut dijalankan pada cloud machine ini menggunakan Node.js 24.19.0, Next.js 16.4.3, PostgreSQL 16 dalam Docker, dan Chromium sistem dengan renderer grafis perangkat lunak.

## Hasil akhir

| Pemeriksaan                                       | Hasil aktual                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`                     | Lulus, instalasi memakai lockfile tanpa perubahan dependensi        |
| `npm run setup:local` berulang                    | Lulus; migrasi idempoten, bank soal dan admin dipertahankan         |
| `npm run typecheck` / `npm run lint`              | Lulus                                                               |
| `npm run db:validate`                             | Schema Prisma valid                                                 |
| `RUN_INTEGRATION=1 RUN_RESTART=1 npm test`        | **47 lulus, 0 gagal, 0 dilewati**                                   |
| `npm run test:e2e` pada mode produksi             | **4 lulus, 0 gagal**, sekitar 1,3 menit                             |
| `npm run build`                                   | Lulus; semua route publik/admin/pemain/display berhasil dikompilasi |
| `npm start`                                       | Frontend 3000 dan API 4001 aktif, health check database tersambung  |
| `npm audit --audit-level=low`                     | **0 kerentanan yang dilaporkan**                                    |
| `git diff --check`                                | Lulus                                                               |
| `npm run db:backup` + pemulihan database terpisah | Lulus; lima paket, 25 soal, dan admin ditemukan setelah restore     |

47 pengujian Vitest terdiri dari **33 scoring**, **9 spreadsheet**, **4 integrasi backend/keamanan**, dan **1 restart proses nyata**. `npm test` tanpa environment flag menjalankan 42 unit dan sengaja melewati lima pengujian yang membutuhkan layanan/database; seluruhnya benar-benar dijalankan dengan flag pada verifikasi akhir di atas.

## Alur yang terbukti


- Enam konteks browser HP independen bergabung melalui UI, memilih karakter/tim, READY, dan menerima soal yang sama. Reload memulihkan ID pemain yang sama.
- Host memulai pertandingan setelah enam slot siap, melakukan pause/resume, dan server menolak jawaban ketika dijeda, ganda, atau melewati deadline.
- Tim A menjawab tiga benar sedangkan Tim B salah: power 30 vs 0, posisi akhir **−45**, pemenang A. Browser pemain menampilkan hasil dan display merender arena WebGL nyata. Tidak ada `pageerror` pada pengujian pertandingan tersebut.
- Login/logout/login ulang memulihkan otorisasi socket host; kontrol kunci lobby tetap berfungsi dengan session cookie baru.
- REST dan socket menolak akses admin yang tidak berhak; kunci soal tersembunyi sebelum reveal. Perubahan bank soal tidak mengubah snapshot pertandingan.
- Satu proses API uji benar-benar dihentikan dan dimulai kembali dua kali, memakai database PostgreSQL terpisah. Timer pause, enam ID/token pemain, jawaban yang diterima, bank soal yang diedit, snapshot, penilaian, dan riwayat tetap tersimpan. Database uji dihapus setelah pengujian.
- Browser audio mengukur keluaran WebAudio: belum ada AudioContext sebelum interaksi, musik menghasilkan waveform, volume diterapkan, mute menghasilkan diam, sound=false menonaktifkan efek, dan cleanup menghentikan scheduler.
- Impor membaca CSV/XLSX sungguhan; menolak formula, file palsu/terlalu besar, header tidak sesuai, dan ekspansi ZIP berlebihan. Validasi baris invalid tidak menyimpan impor parsial.

Pemeriksaan browser tambahan mencakup semua halaman admin, CRUD paket/soal, preview, duplikasi, impor CSV melalui preview lalu commit, pengaturan, pembuatan room/QR, kontrol host hingga kemenangan, serta layout/menu pada lebar 390 px tanpa overflow horizontal.

## Lingkungan yang disimpan

`install_script` dan `start_skill` telah berhasil disimpan pada draft konfigurasi cloud. Instalasi menangkap `npm ci`, setup database, typecheck, unit test, dan build; startup menjelaskan pemulihan database, proses development/produksi, health check, host LAN/HTTPS, serta perintah pengujian. Tidak diperlukan domain egress khusus atau kredensial layanan berbayar. Secret lokal tidak ditulis dalam instruksi.

Penyimpanan draft tidak menerapkan atau menerbitkan konfigurasi. Pengguna perlu meninjau dan menyimpan di pengaturan lingkungan, lalu **Publish**. Pemulihan pada cloud task baru belum diuji. Database memiliki backup privat dalam checkout agar tidak bergantung sepenuhnya pada pemulihan volume Docker.

## Batas yang belum diverifikasi atau belum dibuat

- Karakter/arena adalah aset prosedural orisinal; belum ada model GLB profesional setara gambar referensi. Dukungan pemuatan GLB dan crossfade tersedia sebagai jalur penggantian aset.
- Target 30/60 FPS belum dibenchmark pada HP/GPU fisik. Browser uji memakai rendering perangkat lunak, sehingga durasi E2E tidak menunjukkan performa perangkat pengguna.
- Bonus opsional **Super Pull**, Redis/multi-instance, pengujian beban besar, audit keamanan independen, dan deployment publik belum dilakukan.
- HTTPS/WSS dan konektivitas HP melalui LAN/domain dijelaskan, tetapi belum diuji dengan perangkat jaringan eksternal yang nyata.
- Audit dependensi nol tidak sama dengan audit keamanan independen. Beberapa dependensi transitif menampilkan pemberitahuan deprecation saat instalasi, dan R3F/Three menampilkan deprecation Clock/shadow API; tidak menjadi kesalahan build/runtime kritis pada pengujian ini.
- Soal awal adalah contoh edukasi, bukan materi lomba yang telah disahkan penanggung jawab medis.

Data pertandingan uji dibersihkan setelah verifikasi; lima paket, 25 soal contoh, delapan karakter, serta admin lokal tetap tersedia. Lihat [README.md](README.md) untuk menjalankan, masuk admin, bermain enam browser, deployment, backup, dan batas versi.

## Paket peluncur lokal

- Docker image dibangun dari instalasi npm baru dan production build berhasil di Linux.
- Pengujian cloud memakai proxy, sertifikat CA melalui BuildKit secret, dan pemetaan DNS khusus cloud pada Dockerfile sementara. Pengaturan cloud tidak dimasukkan ke paket pengguna.
- Compose dengan PostgreSQL baru mencapai status healthy; halaman utama dan API health HTTP 200, login admin baru HTTP 200 dengan session cookie.
- Restart container berhasil; akun admin dan soal awal tetap tersimpan tanpa pembuatan admin ulang.
- Generator konfigurasi diuji dua kali dan tidak mengganti password yang sudah dibuat.
- Peluncur PowerShell/Windows dan macOS belum diuji pada OS aslinya. Docker Desktop dan internet diperlukan untuk instalasi pertama; paket ini bukan EXE offline.


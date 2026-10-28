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

## Gedung RSUD AL-MULK — 27 Oktober 2026

- Hospital Battle memakai model 3D yang mengacu pada arsitektur referensi: menara kaca biru di kiri, fasad putih dengan papan nama merah di tengah, panel oranye dan kisi putih di kanan, jendela klinik, kanopi serta tulisan IGD/IGD 24 JAM. Langit dan cahaya sore melengkapi arena; pohon ditata agar gedung terlihat.
- Tekstur kaca, panel, kisi, papan nama dan langit dibuat secara lokal, tanpa unduhan aset tambahan. Tekstur dibersihkan saat komponen dilepas; mode LOW menurunkan resolusi tekstur gedung.
- Sebelum sinkronisasi, production build dan tes Playwright navigasi arena lulus. Perubahan kemudian digabungkan ke GitHub terbaru (a28978e), mempertahankan kamera lebar, pemilihan karakter dan kontrol tim. `npx next build apps/web` beserta pemeriksaan TypeScript frontend lulus pada hasil gabungan; desktop 1440 px, ponsel 390 px dan pergantian tema diperiksa ulang tanpa page error atau overflow horizontal.
- `npm run build` lengkap pada versi gabungan terhenti saat Prisma mencoba mengunduh engine native: server unduhan mengembalikan HTTP 403 dari lingkungan cloud. Backend versi gabungan tidak dijalankan ulang; database lokal tidak dimigrasikan. Hasil frontend tidak membuktikan startup/database Windows.
- `Hospital-RSUD-AL-MULK.zip` merupakan patch tampilan untuk game yang sudah terpasang: empat file komponen arena dan petunjuk pemasangan. ZIP diverifikasi isinya sesuai source. Paket ini tidak mengganti launcher, konfigurasi maupun database instalasi lama.
- Perubahan hanya pada lingkungan visual; database, scoring, audio dan mekanisme update tidak berubah. Gedung merupakan adaptasi kartun 3D, bukan render fotorealistik.

## Character Gallery dan Team Selection — 28 Oktober 2026

- Galeri publik `/characters` dan galeri admin menggunakan komponen bersama: preview 3D interaktif, enam kartu per halaman, sepuluh hero, profil atribut tetap, konfirmasi pilihan, dan preferensi browser. Potret transparan dirender dari model 3D prosedural yang sama; tidak menggunakan screenshot referensi sebagai halaman statis.
- Dua pengendali mengatur tiga slot masing-masing. Lawan hanya dapat dilihat. Pergantian hero memerlukan konfirmasi, mempertahankan nama slot, dan terkunci setelah mulai. Edit nama tim/slot selama soal aktif disinkronkan tanpa mengganti identitas, jawaban, skor, fase, atau deadline. Reconnect mengirim identitas saja agar snapshot lokal lama tidak menimpa komposisi server.
- Startup menambahkan hero registry yang belum ada dengan `update: {}`; tes memeriksa metadata lama tidak ditimpa. Tidak ada migrasi schema, penghapusan kuis, atau perubahan rumus skor.
- `npm test`: **66 lulus**, lima tes integrasi opsional tidak diaktifkan. Termasuk validasi slot/nama, kepemilikan Socket.IO, join bersamaan, pencabutan sesi, rename aktif, pelestarian hasil jawaban, dan penambahan hero tanpa overwrite.
- Lima skenario Playwright lulus: login ulang admin, audio, galeri/pagination/atribut/mobile, navigasi arena, dan pertandingan lengkap dengan **dua browser pengendali** (satu desktop, satu ponsel), host serta display. Uji pertandingan memeriksa batal/konfirmasi hero, nama tetap, kedua tim Ready, rename setelah jawaban masuk, reload di lobby/soal aktif, serta nama pada hasil/display. Uji pertama menemukan HUD ponsel melebar dan mengganggu klik jawaban; layout diperbaiki dan skenario pertandingan lulus saat diulang.
- `npx next build apps/web` dan TypeScript berhasil. Galeri serta Team Selection diperiksa pada desktop dan viewport ponsel 390 px; semua thumbnail termuat, tidak ada page error atau overflow horizontal. Mode reduced motion diperiksa pada preview galeri.
- Pengujian API memakai database SQLite terpisah `.data/qa/character-selection.db`, Prisma JavaScript query compiler dan adapter libSQL resmi. Engine native Prisma belum dapat diunduh dari cloud (HTTP 403 pada pemeriksaan sebelumnya); tipe/client dihasilkan secara offline dari schema yang sama untuk QA. `.env` dan database game pengguna tidak dipakai atau diubah. Konfigurasi runtime QA tidak masuk GitHub/ZIP.
- Windows asli dan FPS GPU laptop/ponsel fisik belum diuji. Model tetap aset prosedural orisinal; integrasi GLB/GLTF tersedia melalui registry. Patch source ditujukan pada instalasi versi dua pengendali yang sudah berjalan.

## Penyesuaian model hero — 28 Oktober 2026

- Geometri karakter dalam game diperhalus: wajah/mata lebih sederhana, tunik dan bahu menyatu, tangan/sepatu membulat, serta pencahayaan preview lebih lembut. Animasi prosedural dan genggaman tali tetap dipakai. Sepuluh potret dirender ulang dari model final.
- Build frontend/TypeScript, 66 unit test (5 tes opsional dilewati), serta tes browser galeri desktop/ponsel lulus. Tampilan galeri dan arena diperiksa di Chromium software rendering tanpa page error. Data pengguna dan schema tidak digunakan dalam pemeriksaan visual.
- Satu contoh dokter diekspor dari geometri game, diimpor dan dibuka ulang di Blender 4.3.2: 62 mesh, 63 material, 16.476 vertex dan tidak ada tekstur eksternal yang hilang. File Blender merupakan satu pose statis tanpa armature, belum otomatis tersinkron ke game. Model adalah adaptasi prosedural, belum setara sculpt referensi.

## Tema halaman utama — 28 Oktober 2026

- Halaman utama memakai palet navy, hijau–biru, tombol kuning dan judul Manrope miring yang selaras dengan galeri karakter. Pilihan arena memakai status aksesibel, menu ponsel tertutup tidak masuk urutan fokus, dan jumlah hero mengikuti registry.
- Production build frontend/TypeScript dan tes browser navigasi arena/room lulus. Pemeriksaan Chromium desktop dan ponsel 390/320 px memverifikasi tampilan, pergantian tema, suara, menu, tidak ada page error serta tidak ada overflow horizontal. Pengujian memakai Chromium software rendering di cloud.

## Dokter Blender beranimasi — 29 Oktober 2026

- Satu hero, Dr. Arga (`doctor-m`), kini memakai GLB yang dibuat langsung di Blender dari mesh orisinal. File `.blend` mempunyai 23 bone dan sembilan action: idle, ready, rope-ready, pulling, struggling, sliding, falling, victory, defeat. Sembilan hero lain memakai model prosedural sebelumnya.
- GLB sekitar 2,29 MB, 60.048 triangle dan 68 mesh. File Blender dibuka ulang dan divalidasi; generator reproducible tersedia di `scripts/blender/create_doctor_hero.py`. Video 6 detik pada `design/Doctor-Hero-Animation.mp4` dirender dari GLB menggunakan Three AnimationMixer, bukan ilustrasi bergerak.
- Loader memakai skeleton, mixer dan salinan material per instance, crossfade dan material TeamAccent. Pose reduced motion tetap dievaluasi. Cache geometri bersama tidak dihapus saat satu instance dilepas.
- `npm test`: **69 lulus**, lima tes integrasi opsional tidak diaktifkan. Tiga tes aset memverifikasi rig/clip/skala, gerakan joint dan independensi clone, serta genggaman pada loop ready/pull dalam toleransi 0,03 unit. Validasi Blender menemukan drift grip kurang dari 0,005 unit.
- `next build --webpack` serta TypeScript berhasil. Tiga skenario Playwright lulus (2,4 menit) pada build production baru dan database QA terpisah: galeri/pagination/mobile, pertandingan lengkap dua pengendali sampai hasil, dan navigasi beranda. Galeri dan arena diperiksa tanpa page error. Thumbnail dokter dibuat ulang dari GLB yang sama.
- Model adalah versi pertama yang mengacu pada referensi, bukan salinan 100%. FPS perangkat fisik dan Windows asli belum diuji. Memodifikasi file Blender memerlukan ekspor GLB sebelum perubahan masuk ke game.

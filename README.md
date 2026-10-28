> **Paket lokal dengan peluncur:** baca `BACA-DULU.txt`. Setelah Docker Desktop aktif, ekstrak ZIP lalu klik `MULAI-WINDOWS.bat` (Windows) atau `MULAI-MAC.command` (macOS). Pemasangan pertama memerlukan internet. Kredensial dibuat di `AKUN-ADMIN.txt`; jangan bagikan file tersebut.

# Medical Tug of War

Pembaruan galeri dan pemilihan dua tim: lihat [CHARACTER-DESIGN.md](CHARACTER-DESIGN.md). Galeri publik ada di `/characters`; sepuluh hero menggunakan registry bersama, preview 3D, dan pemilihan dengan konfirmasi.

**Healthcare Heroes Quiz Battle** — permainan kuis tarik tambang 3D untuk dua tim tenaga kesehatan, masing-masing tiga pemain. Antarmuka utama menggunakan Bahasa Indonesia.

## Mulai di komputer lokal

Prasyarat: **Node.js 24 LTS**, npm 11+, Docker dengan Compose, browser modern.

```sh
npm ci
npm run setup:local
npm run dev
```

Frontend menggunakan **port 3000**, API/Socket.IO **4001**, PostgreSQL **127.0.0.1:5432**. Next.js meneruskan `/api`, `/uploads`, dan `/socket.io` ke server terpisah, sehingga browser menggunakan satu origin. Tidak memerlukan layanan berbayar.

`setup:local` membuat `.env` privat jika belum ada, menyiapkan PostgreSQL, menghasilkan Prisma Client, menerapkan migrasi, memasukkan lima paket/25 soal/delapan karakter, serta membuat admin pertama. Pengulangan setup mempertahankan akun dan perubahan bank soal.

### Memperbarui dari GitHub

Tutup game dengan **Ctrl+C**, lalu klik **UPDATE-GAME.bat** pada folder game. Updater mengambil commit terbaru dari `yanmedrsudalmulk-67/OPTIMUS-V.3`, branch `codex/game-local-launcher`. Git tidak perlu dipasang. Setelah selesai, buka shortcut game; dependensi dan build diperbarui oleh peluncur bila diperlukan.

Untuk instalasi lama yang belum memiliki tombol update: unduh **Pasang-Updater.zip**, ekstrak ke folder sementara, lalu salin `UPDATE-GAME.bat` dan folder `launcher` ke **folder game yang sudah ada**, sejajar dengan `package.json` dan `medical.db`. Gabungkan folder launcher. Paket kecil ini tidak memuat database atau akun.

- Database lokal (termasuk lokasi `DATABASE_URL` kustom), `.env`, `AKUN-ADMIN.txt`, uploads, Node portabel, dan dependensi tidak diganti oleh updater.
- **Kode yang diedit di Antigravity akan diganti versi GitHub.** Semua source yang akan diganti serta database, konfigurasi, akun, dan uploads dicadangkan lebih dahulu ke `.data/update-backups/TANGGAL-ID`. File tambahan lokal tidak dihapus.
- Unduhan harus lengkap dan lolos hash Git sebelum source diubah. Updater menolak saat game berjalan. Game dan updater memakai lock bersama.
- Kegagalan penulisan memulihkan source lama. Jika proses terputus mendadak, jalankan updater lagi untuk pemulihan sebelum memulai game.
- Untuk memulihkan versi lama secara manual, tutup game dan salin isi `source` dari backup ke akar game. Backup database ada di `local-data/database`; nama/lokasi aslinya dicatat di `INFO.json`. Pulihkan database hanya jika diperlukan, dengan semua proses game berhenti. Simpan backup secara pribadi karena memuat data akun.
- Repository publik tidak membutuhkan token. Untuk repository privat atau batas akses GitHub, updater Windows dapat meminta token secara tersembunyi dengan izin baca **Contents** pada repository ini. Token hanya digunakan dalam proses updater, tidak disimpan ke file. Variabel `GITHUB_TOKEN` / `GH_TOKEN` juga didukung. Jangan kirim token ke chat atau commit GitHub.

Terminal lintas platform: `npm run update:game`. Perubahan pada laptop tidak diunggah otomatis ke GitHub; tombol ini hanya mengambil pembaruan.

### Masuk sebagai admin

Buka `/admin/login`. Nama pengguna awal `admin`; kata sandi acak disimpan pada `ADMIN_PASSWORD` dalam `.env` yang diabaikan Git. Baca melalui editor lokal, atau tentukan kata sandi sendiri dengan prompt terminal:

```sh
read -r -s -p 'Kata sandi admin baru (minimal 12 karakter): ' MEDICAL_ADMIN_PASSWORD
echo
ADMIN_USERNAME=admin ADMIN_PASSWORD="$MEDICAL_ADMIN_PASSWORD" ADMIN_REPLACE=true npm run admin:create
unset MEDICAL_ADMIN_PASSWORD
```

Perintah tersebut merotasi kata sandi dan mencabut sesi lama. Untuk admin baru, pilih nama pengguna berbeda tanpa `ADMIN_REPLACE=true`. Perubahan kata sandi melalui halaman akun juga mengharuskan login kembali. Kata sandi disimpan sebagai hash bcrypt.

### Database

Lihat `.env.example` untuk variabel. Untuk PostgreSQL eksternal, isi `DATABASE_URL` lalu jalankan `npm run db:setup`; Compose hanya diperlukan untuk database lokal.

```sh
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:validate
```

Prisma memakai query compiler JavaScript dan adapter PostgreSQL resmi; runtime tidak membutuhkan unduhan engine native. SQL dalam `packages/database/prisma/migrations` sesuai dengan schema Prisma. Runner migrasi memakai transaksi, advisory lock, dan SHA-256 untuk menolak perubahan migrasi yang telah diterapkan. Gunakan **`npm run db:migrate`**; `prisma migrate deploy` pada Prisma 6 mempunyai ketidakcocokan deserialisasi tipe katalog `name` melalui adapter migrasi WASM. Validasi schema, client generation, dan schema-to-SQL diff tetap tersedia melalui Prisma.

## Memainkan pertandingan

1. Login admin. Kelola paket dan pertanyaan di **Bank soal** / **Paket soal**.
2. Pilih **Pertandingan baru**, isi nama/tim, paket, jumlah soal, durasi, dan arena. Soal serta pengaturan disalin menjadi snapshot.
3. Pada kontrol host, atur **Alamat server yang dapat diakses HP** ke IP LAN/domain yang benar. Bagikan QR atau room code enam karakter.
4. Dua browser/perangkat membuka `/join/KODE`, masing-masing memilih Team Green atau Team Blue. Setiap pengendali mengatur tiga slot hero, mengedit nama, lalu mengonfirmasi tim dan Ready. Komposisi lawan ditampilkan dalam mode baca saja.
5. Buka `/display/KODE` pada layar proyektor. Host menekan **START BATTLE** setelah kedua pengendali terhubung dan READY.
6. Setiap pengendali menjawab sekali untuk seluruh tim. Jawaban benar menjadi power; server menghitung tarikan dan pemenang. Nama tetap dapat diubah saat pertandingan; pergantian hero terkunci setelah mulai.

Host dapat mengunci lobby, memindahkan/mengeluarkan pemain, pause/resume, melanjutkan fase, mengakhiri, dan reset. Reset/akhiri meminta konfirmasi. Restart server memulihkan pertandingan aktif dalam kondisi **pause**; token pemain memulihkan slot lama dan host dapat melanjutkan.

### HP dalam jaringan lokal

Contoh `.env`, ganti dengan IP LAN komputer yang dapat dijangkau peserta:

```dotenv
WEB_ORIGIN=http://192.168.1.10:3000
PUBLIC_APP_URL=http://192.168.1.10:3000
```

Restart frontend/server setelah perubahan. Izinkan port 3000 pada firewall LAN bila diperlukan. HP dan komputer harus berada pada jaringan yang saling terhubung. `localhost` pada HP merujuk HP itu sendiri dan tidak cocok untuk undangan. Halaman host dapat mengubah alamat QR langsung. PostgreSQL tidak perlu dibuka untuk perangkat peserta.

## Fitur

- Session cookie HttpOnly/SameSite/expiry, bcrypt, autentikasi REST dan setiap aksi host, validasi Zod, rate limit, upload gambar dengan batas ukuran/jenis.
- Dashboard, paket/soal CRUD, aktif/nonaktif, urutan, duplikasi/pindah paket, gambar, penjelasan/durasi/poin, pratinjau.
- Impor **CSV/XLSX** dengan validasi header/baris dan preview sebelum simpan, template/ekspor. Formula ditolak. Batas file 5 MB, 1.000 baris, ZIP terurai 20 MB. Format XLS lama tidak didukung.
- Room/QR, enam slot, karakter, READY, reconnect, lobby, kontrol host, pengaturan, riwayat/detail dan leaderboard berdasarkan ID pemain.
- Socket.IO server-authoritative: deadline server, satu jawaban final per pemain/soal, transaksi/unique constraint, snapshot, penolakan aksi ganda/terlambat. Kunci jawaban tidak dikirim sebelum reveal.
- Scoring standar: benar 10 power, salah/kosong 0. `delta = (powerB - powerA) × multiplier`; posisi negatif menguntungkan A. Batas default ±100; jika soal habis, posisi menentukan pemenang/seri.
- Bonus kecepatan/combo deterministik opsional (default mati), sudden death dengan cadangan soal terbatas dan hasil seri jika cadangan habis.
- Arena 3D: enam slot hero tenaga kesehatan dari sepuluh pilihan karakter, termasuk dokter bedah dan radiografer; animasi sendi/ekspresi, tali bertekstur, label, dua tema, kualitas grafis, debu/konfeti, fallback WebGL.
- Arena rumah sakit mengacu pada gedung RSUD AL-MULK: menara kaca biru, fasad putih/oranye, kisi dekoratif, kanopi IGD dan papan nama merah, dengan langit sore. Penonton anak-anak melambai/bertepuk tangan; mode LOW mengurangi jumlah penonton dan resolusi tekstur gedung.
- Musik pertandingan instrumental orisinal 128 BPM (melodi, bass, akor, drum) dengan efek sorak/tepuk tangan sintetis saat mulai, menarik, dan menang. Aktifkan ikon speaker pada preview; pertandingan baru mengaktifkan opsi musik, pilihan pertandingan lama tetap dihormati.
- HP portrait, dashboard responsif, display fullscreen, audio/musik sintetis orisinal dengan mute dan volume; browser membutuhkan interaksi sebelum audio dimulai.

## Struktur dan teknologi

```text
apps/web/app/                 Next.js App Router, publik/admin/pemain/display
apps/web/components/admin/    Dashboard, bank soal, host, pengaturan
apps/web/components/game/     Join, lobby, kuis, display, pemulihan sesi
apps/web/components/arena/    Model prosedural, arena, animasi, adapter GLB
apps/web/lib/                 API, socket, audio, spreadsheet
apps/realtime-server/src/     Express, auth, routes, layanan game, sockets
packages/shared/src/          Domain, karakter, pengaturan bersama
packages/database/            Prisma schema, SQL migrations, seed, client
packages/game-engine/src/     Scoring dan kemenangan deterministik
scripts/                      Setup, migrasi, admin, backup
tests/                        Unit, integrasi PostgreSQL, restart, browser E2E
```

Next.js 16, React 19, TypeScript, Three.js/R3F/Drei, Lucide, CSS responsif, Express, Socket.IO, PostgreSQL 16, Prisma 6 dengan adapter pg, Zod, ExcelJS, Vitest, dan Playwright. UI memakai komponen CSS lokal.

## Pengujian dan build

```sh
npm run lint
npm test
RUN_INTEGRATION=1 npm test -- tests/backend.integration.test.ts
RUN_RESTART=1 npm test -- tests/restart.integration.test.ts
npm run test:e2e
npm run build
npm start
```

Lint memeriksa TypeScript seluruh proyek. E2E membutuhkan frontend/API aktif dan akun `.env`; menggunakan enam konteks browser independen. Chromium sistem default `/usr/bin/chromium`, dapat diganti dengan `CHROMIUM_PATH`. Jangan menjalankan pengujian integrasi/E2E terhadap database produksi. Hentikan development sebelum build/start produksi. Hasil aktual tersedia di [VALIDATION.md](VALIDATION.md).

## VPS

1. Pasang Node.js 24, Docker/Compose, serta reverse proxy TLS.
2. Jalankan `npm ci`, konfigurasi `.env`, kemudian `npm run setup:local`.
3. Isi `WEB_ORIGIN` / `PUBLIC_APP_URL` dengan domain HTTPS, set `COOKIE_SECURE=true`. Jangan mengekspos database/password melalui `NEXT_PUBLIC_*`.
4. Jalankan `npm run build` dan `npm start` melalui process manager/systemd. Satu instance API didukung saat ini.
5. Proxy trafik ke 3000 dengan dukungan upgrade WebSocket dan timeout Socket.IO; tutup akses publik ke 4001/5432. Jika realtime memakai origin lain, set `NEXT_PUBLIC_REALTIME_URL` sebelum build dan izinkan origin frontend di API.
6. Gunakan HTTPS/WSS, persist volume PostgreSQL/folder upload, dan buat backup berkala. Jangan mempublikasikan server development.

## Backup

```sh
npm run db:backup
```

Backup berada di `.data/database-snapshot.sql`, berizin privat dan diabaikan Git. File memuat bank soal, jawaban, sesi/hash admin, dan hasil; simpan secara aman. Cadangkan juga `apps/realtime-server/uploads` untuk gambar. `setup:local` memulihkan snapshot ketika database kosong; database yang sudah berisi tabel tidak ditimpa. Pemulihan manual ke database kosong:

```sh
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U medical -d medical < .data/database-snapshot.sql
```

Sesuaikan user/database jika berbeda. Database eksternal dicadangkan menggunakan `pg_dump` pada layanan tersebut.

## Batas dan peningkatan

Karakter adalah aset prosedural berfungsi, **belum sculpt/rig profesional setara gambar referensi**. Desain/aset karakter referensi tidak disalin. `AnimatedGLTF.tsx` mendukung GLB berlisensi dan AnimationMixer/crossfade; belum ada GLB profesional yang disertakan. Tahap berikutnya: model artis, rig/IK tangan-tali, tekstur/animasi profesi, dan profiling GPU perangkat target. Target 30/60 FPS belum dibenchmark pada perangkat fisik.

**Super Pull** belum diimplementasikan. Belum ada Redis/multi-instance, pengujian beban besar, audit keamanan independen, deployment publik, atau verifikasi pemulihan snapshot pada cloud task baru. Soal contoh perlu ditinjau penanggung jawab medis sebelum perlombaan resmi.

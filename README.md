# Medical Tug of War

**Healthcare Heroes Quiz Battle** — permainan kuis tarik tambang 3D untuk dua tim tenaga kesehatan, masing-masing tiga pemain. Antarmuka utama menggunakan Bahasa Indonesia.

## Mulai di komputer lokal

**Windows:** ekstrak ZIP, lalu klik dua kali `MULAI-WINDOWS.bat`. Peluncur menyiapkan Node.js 24 portabel bila diperlukan, memasang dependensi, membuat SQLite dan shortcut **Medical Tug of War** di Desktop, lalu membuka browser. Internet diperlukan saat pemasangan pertama. Tidak membutuhkan Docker atau server database. Setelah itu gunakan shortcut Desktop; folder game harus tetap pada lokasi yang sama.

**macOS/Linux atau terminal Antigravity:** pasang Node.js 24, lalu:

```sh
npm ci
npm run setup:local
npm run local
```

Frontend menggunakan **port 3005**; API/Socket.IO tetap **4001** secara internal. Seluruh tabel kuis, admin, sesi, room, jawaban, skor, dan pengaturan disimpan di satu file **`medical.db` pada akar folder game**. Next.js meneruskan `/api`, `/uploads`, dan `/socket.io` ke server terpisah, sehingga browser menggunakan satu origin. Tidak memerlukan layanan berbayar.

`setup:local` membuat `.env` privat jika belum ada, menyiapkan SQLite, menghasilkan Prisma Client, menerapkan migrasi, memasukkan lima paket/25 soal/delapan karakter, serta membuat admin pertama. Pengulangan setup mempertahankan akun dan perubahan bank soal.

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

`DATABASE_URL=file:./medical.db` menunjuk satu file lokal relatif terhadap akar proyek. Prisma memakai adapter SQLite/libSQL lokal; tidak ada koneksi Turso/server eksternal. File dibuat otomatis oleh setup. Gambar unggahan tetap berupa file di `apps/realtime-server/uploads`.

Gunakan `npm run db:migrate` untuk menjalankan SQL SQLite dalam transaksi dengan pemeriksaan checksum. Jangan gunakan migrasi PostgreSQL lama pada file SQLite. Default JSON pada SQL hasil Prisma diff dikutip sebagai teks SQLite. SQLite dapat membuat jurnal sementara selama transaksi; setelah transaksi selesai data tetap pada `medical.db`.

Akun tersedia di `AKUN-ADMIN.txt`. File database dan kredensial tidak disertakan pada GitHub/ZIP; instalasi baru membuat akun dan soal contoh sendiri. Untuk memindahkan data lokal antar folder/komputer, hentikan game dahulu lalu salin `medical.db`, `.env`, dan folder uploads. Jangan menimpa file database lama dengan database kosong.

## Memainkan pertandingan

1. Login admin. Kelola paket dan pertanyaan di **Bank soal** / **Paket soal**.
2. Pilih **Pertandingan baru**, isi nama/tim, paket, jumlah soal, durasi, dan arena. Soal serta pengaturan disalin menjadi snapshot.
3. Pada kontrol host, atur **Alamat server yang dapat diakses HP** ke IP LAN/domain yang benar. Bagikan QR atau room code enam karakter.
4. Enam browser/perangkat membuka `/join/KODE`, mengisi nama, memilih tim/karakter, lalu **Saya siap bertanding**. Maksimal tiga pemain per tim. Gunakan browser/konteks privat terpisah untuk identitas independen.
5. Buka `/display/KODE` pada layar proyektor. Host menekan **START BATTLE** setelah enam pemain terhubung dan READY.
6. Pemain menjawab melalui HP. Jawaban benar menjadi power; server menghitung tarikan dan pemenang. Ronde, jawaban, kontribusi, serta hasil tersimpan di SQLite.

Host dapat mengunci lobby, memindahkan/mengeluarkan pemain, pause/resume, melanjutkan fase, mengakhiri, dan reset. Reset/akhiri meminta konfirmasi. Restart server memulihkan pertandingan aktif dalam kondisi **pause**; token pemain memulihkan slot lama dan host dapat melanjutkan.

### HP dalam jaringan lokal

Contoh `.env`, ganti dengan IP LAN komputer yang dapat dijangkau peserta:

```dotenv
WEB_ORIGIN=http://localhost:3005,http://127.0.0.1:3005,http://192.168.1.10:3005
PUBLIC_APP_URL=http://192.168.1.10:3005
```

Restart frontend/server setelah perubahan. Izinkan port 3005 pada firewall LAN bila diperlukan. HP dan komputer harus berada pada jaringan yang saling terhubung. `localhost` pada HP merujuk HP itu sendiri dan tidak cocok untuk undangan. Halaman host dapat mengubah alamat QR langsung. File database tidak perlu diakses perangkat peserta.

## Fitur

- Session cookie HttpOnly/SameSite/expiry, bcrypt, autentikasi REST dan setiap aksi host, validasi Zod, rate limit, upload gambar dengan batas ukuran/jenis.
- Dashboard, paket/soal CRUD, aktif/nonaktif, urutan, duplikasi/pindah paket, gambar, penjelasan/durasi/poin, pratinjau.
- Impor **CSV/XLSX** dengan validasi header/baris dan preview sebelum simpan, template/ekspor. Formula ditolak. Batas file 5 MB, 1.000 baris, ZIP terurai 20 MB. Format XLS lama tidak didukung.
- Room/QR, enam slot, karakter, READY, reconnect, lobby, kontrol host, pengaturan, riwayat/detail dan leaderboard berdasarkan ID pemain.
- Socket.IO server-authoritative: deadline server, satu jawaban final per pemain/soal, transaksi/unique constraint, snapshot, penolakan aksi ganda/terlambat. Kunci jawaban tidak dikirim sebelum reveal.
- Scoring standar: benar 10 power, salah/kosong 0. `delta = (powerB - powerA) × multiplier`; posisi negatif menguntungkan A. Batas default ±100; jika soal habis, posisi menentukan pemenang/seri.
- Bonus kecepatan/combo deterministik opsional (default mati), sudden death dengan cadangan soal terbatas dan hasil seri jika cadangan habis.
- Arena 3D nyata: enam karakter tenaga kesehatan, delapan profesi, animasi sendi/ekspresi, tali bertekstur, label, dua tema, kualitas grafis, debu/konfeti, fallback WebGL.
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
tests/                        Unit, integrasi SQLite, restart, browser E2E
```

Next.js 16, React 19, TypeScript, Three.js/R3F/Drei, Lucide, CSS responsif, Express, Socket.IO, SQLite lokal, Prisma 6 dengan adapter libSQL, Zod, ExcelJS, Vitest, dan Playwright. UI memakai komponen CSS lokal.

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

1. Pasang Node.js 24 serta reverse proxy TLS.
2. Jalankan `npm ci`, konfigurasi `.env`, kemudian `npm run setup:local`.
3. Isi `WEB_ORIGIN` / `PUBLIC_APP_URL` dengan domain HTTPS, set `COOKIE_SECURE=true`. Jangan mengekspos database/password melalui `NEXT_PUBLIC_*`.
4. Jalankan `npm run build` dan `npm start` melalui process manager/systemd. Satu instance API didukung saat ini.
5. Proxy trafik ke 3005 dengan dukungan upgrade WebSocket dan timeout Socket.IO; tutup akses publik ke 4001. Jika realtime memakai origin lain, set `NEXT_PUBLIC_REALTIME_URL` sebelum build dan izinkan origin frontend di API.
6. Gunakan HTTPS/WSS, persist file medical.db/folder upload, dan buat backup berkala. Jangan mempublikasikan server development.

## Backup

```sh
npm run db:backup
```

Backup konsisten dibuat melalui API backup SQLite pada `.data/medical-TANGGAL.db`. File memuat data privat, sesi/hash admin, bank soal, dan hasil. Cadangkan juga `.env` dan `apps/realtime-server/uploads`. Untuk memulihkan, hentikan game, simpan salinan database saat ini, lalu salin backup menjadi `medical.db` sebelum memulai kembali.

Peluncur Windows menggunakan PowerShell dan WScript untuk membuat shortcut pada Desktop pengguna (termasuk Desktop yang diarahkan ke OneDrive). Lingkungan cloud tidak dapat membuat shortcut langsung pada komputer pengguna. Peluncur belum diuji langsung pada Windows; backend dan alur game diuji di Linux.

## Batas dan peningkatan

Karakter adalah aset prosedural berfungsi, **belum sculpt/rig profesional setara gambar referensi**. Desain/aset karakter referensi tidak disalin. `AnimatedGLTF.tsx` mendukung GLB berlisensi dan AnimationMixer/crossfade; belum ada GLB profesional yang disertakan. Tahap berikutnya: model artis, rig/IK tangan-tali, tekstur/animasi profesi, dan profiling GPU perangkat target. Target 30/60 FPS belum dibenchmark pada perangkat fisik.

**Super Pull** belum diimplementasikan. Belum ada Redis/multi-instance, pengujian beban besar, audit keamanan independen, deployment publik, atau verifikasi pemulihan snapshot pada cloud task baru. Soal contoh perlu ditinjau penanggung jawab medis sebelum perlombaan resmi.

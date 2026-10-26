# Validasi versi SQLite

26 Oktober 2026 — Node.js 24.19.0, Prisma 6.19.3, SQLite/libSQL lokal, Next.js 16.4.3. Pengujian dijalankan di Linux cloud.

- ZIP diekstrak ke folder baru yang namanya mengandung spasi, tanpa .env/database/dependensi. `npm ci`, `setup:local`, dan validasi schema berhasil; file medical.db serta akun baru dibuat otomatis.
- `npm ci`: instalasi bersih berhasil. Adapter PostgreSQL dan dependensi pg sudah dihapus.
- `npm run typecheck`: lulus.
- `npm run build`: production build seluruh route berhasil.
- `RUN_INTEGRATION=1 RUN_RESTART=1 npm test`: **47 tes lulus**, mencakup scoring, spreadsheet, auth, kapasitas enam pemain, snapshot, jawaban unik, pause/resume, deadline, skor, riwayat, serta restart proses API dua kali menggunakan file SQLite terpisah.
- `npm run test:e2e`: **4 tes browser lulus** pada port **3005**: login ulang admin, audio, pertandingan enam browser independen dengan arena 3D, serta navigasi mobile.
- Peluncur Node menjalankan instalasi, setup SQLite baru, build, dan server pada port 3005 tanpa Docker.
- Setup berulang mempertahankan data. Data cloud sebelumnya diekspor privat lalu dimasukkan ke SQLite secara transaksional: 1 admin, 19 sesi, 5 paket, 25 soal, 8 karakter, dan pengaturan; sebelumnya tidak ada pertandingan tersimpan. Database PostgreSQL lama tidak dihapus.
- Backup SQLite dibuat dengan API backup; `PRAGMA integrity_check` menghasilkan `ok` dan 25 soal terverifikasi.
- `npm audit --audit-level=low`: **0 kerentanan**.

## Batas verifikasi

Peluncur PowerShell, unduhan Node.js portabel, dan pembuatan shortcut Desktop belum diuji pada Windows asli. Shortcut dibuat pada komputer pengguna ketika `MULAI-WINDOWS.bat` dijalankan; cloud tidak mempunyai akses ke Desktop pengguna. Windows x64 didukung dependensi; Windows ARM membutuhkan emulasi x64. Node portabel diverifikasi dengan SHA-256 resmi sebelum diekstrak.

Pemasangan pertama membutuhkan internet. Database dan kredensial privat tidak masuk ZIP/GitHub. Instalasi baru membuat data contoh dan akun baru; data pengguna tersimpan di medical.db, gambar unggahan tetap pada folder uploads. SQLite dapat memakai file jurnal sementara saat transaksi berlangsung.

Uji browser memakai Chromium software rendering. FPS perangkat fisik, LAN/HTTPS publik, beban besar, dan beberapa instance API belum diuji. Karakter adalah model prosedural; aset profesional dan fitur Super Pull belum disertakan.

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

## Updater GitHub

- `npm run test:updater`: 10 tes lulus. Memeriksa database SQLite tetap identik, kredensial/uploads tetap ada, backup source hasil edit lokal, rollback kegagalan tulis, pemulihan update terputus, perlindungan path/database kustom, penolakan symlink, lock proses, commit yang dipatok, verifikasi hash Git, serta kegagalan unduhan.
- Perintah updater benar-benar menolak saat aplikasi aktif pada port 3005 dan saat lock aplikasi dipegang, tanpa mengganti source/data. Peluncur dengan lock baru berhasil membuka game.
- Seluruh 95 file source diterapkan pada instalasi SQLite hasil ekstrak sebelumnya menggunakan payload lokal; medical.db, .env, dan AKUN-ADMIN.txt identik byte demi byte. Setup sesudah update berhasil dan mempertahankan 25 soal.
- Pengujian unduhan memakai respons GitHub simulasi. Akses langsung API GitHub dari cloud ini dibatasi proxy (HTTP 403); alur download langsung dari laptop dan PowerShell Windows belum terverifikasi.
- Updater tidak menjalankan migrasi atau mengganti database. Migrasi versi aplikasi dilakukan oleh setup saat game dibuka lagi, setelah backup updater tersedia.

## Penyempurnaan visual dan musik — 27 Oktober 2026

- Karakter: mata/iris/highlight lebih jelas, pipi dan senyum lembut, quiff berlapis, jas panjang dengan lapel/kancing/kantong/dasi, bahan serta pencahayaan lebih lembut. Tube geometry dicache dan dibersihkan saat unmount. Tetap model prosedural, belum identik dengan render referensi pengguna.
- Arena: rumah sakit dengan papan nama lokal, dekorasi, 14 penonton anak-anak (8 pada LOW), animasi melambai/bertepuk tangan/bounce, serta framing kamera lebih dekat. Crowd menggunakan instancing dan geometri lebih ringan pada LOW.
- Audio: instrumental orisinal 128 BPM, bass/akor/drum/perkusi, efek sorak dan tepuk tangan sintetis. Musik pertandingan baru aktif secara default; pengaturan tersimpan tidak ditimpa. Preview tetap memerlukan klik tombol speaker.
- Production build + TypeScript lulus. `npm test`: 42 lulus; lima tes integrasi opsional tidak diaktifkan pada pemeriksaan visual ini (hasil integrasi SQLite sebelumnya tetap tercatat di atas).
- Empat tes Playwright lulus (2,7 menit), termasuk enam browser pemain, kontrol admin, audio/perkusi/sorak dan penghentian semua sumber suara, serta navigasi mobile.
- Screenshot desktop dan ponsel 390 px diperiksa: tidak ada page error atau overflow horizontal. Framing preview kemudian dilonggarkan agar rambut utuh, dan segmen geometri penonton latar dikurangi; build dan inspeksi visual diperbarui untuk penyesuaian ini.
- Browser cloud memakai software rendering; FPS laptop/HP fisik belum diukur. Efek sorak disintesis, bukan rekaman suara anak-anak.

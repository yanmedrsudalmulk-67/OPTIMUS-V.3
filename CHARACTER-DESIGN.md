# Character Gallery & Team Selection

Galeri publik tersedia di `/characters` dan menu **Galeri karakter**. Galeri admin memakai komponen yang sama. Tampilan terdiri dari preview 3D yang dapat diputar, profil hero, empat atribut presentasi, dan enam kartu per halaman. Sepuluh hero tersedia; tombol halaman berikutnya membuka empat hero lainnya.

Memilih kartu mengubah preview. **PILIH KARAKTER** mengonfirmasi pilihan. Dalam layar tim, menutup galeri membatalkan pilihan yang belum dikonfirmasi. Dari galeri publik, pilihan disimpan sebagai preferensi browser dan diterapkan ke slot pertama ketika bergabung dengan tim yang masih memakai komposisi bawaan. Nama slot tetap dipertahankan.

## Dua pengendali

- Satu pengendali untuk Team Green dan satu untuk Team Blue, masing-masing mengatur tiga hero. Tim lawan terlihat dalam mode baca saja.
- Pada `/join/KODE` dan `/lobby/KODE`, pilih slot, gunakan **GANTI KARAKTER** atau carousel, lalu konfirmasi. **TIM SAYA SIAP** menyatakan kesiapan; admin tetap memulai pertandingan.
- Pergantian hero sebelum pertandingan membatalkan Ready tim tersebut. Nama pemain tidak otomatis diganti dengan nama hero.
- Setelah pertandingan dimulai, **Edit nama tim & hero** hanya membuka pengubahan nama. Hero terkunci, tetapi nama tim dan setiap slot tetap dapat diperbarui.
- Server memvalidasi kepemilikan melalui token sesi. Nama tim dibatasi 40 karakter dan nama slot 30 karakter. Perubahan diteruskan ke lawan, host, arena, dan hasil melalui Socket.IO.
- Edit nama tidak mengganti ID, jawaban yang sudah dikirim, skor, posisi tali, fase, atau batas waktu soal. Reload memulihkan identitas pengendali dan mengambil komposisi terbaru dari server.

## Registry dan aset

Sumber definisi adalah `packages/shared/src/index.ts`: `CHARACTERS`, `CHARACTER_REGISTRY`, dan `getCharacterDefinition`. ID lama tetap tersedia; `surgeon` dan `radiographer` ditambahkan. Untuk menambah hero, tambahkan definisi unik dengan nama, profesi, deskripsi, warna, atribut, thumbnail, preview, serta konfigurasi animasi.

`care`, `teamwork`, `knowledge`, dan `resilience` adalah nilai tetap untuk profil visual. Engine skor tidak membaca atribut ini; semua profesi mengikuti aturan kuis yang sama. Hero yang sama dapat digunakan kedua tim.

Potret WebP di `apps/web/public/heroes` merupakan render transparan dari model prosedural orisinal yang juga dipakai preview dan arena. Kartu menggunakan potret tersimpan agar galeri tidak membuka banyak konteks WebGL sekaligus. Preview utama tetap 3D dengan napas, kedipan, pose siap, pencahayaan tepi, bayangan lembut, dan kontrol drag/swipe. Preferensi reduced motion dihormati.

Model prosedural merupakan aset sementara yang berfungsi, bukan sculpt profesional setara ilustrasi referensi. Untuk memakai GLB/GLTF berlisensi, isi `modelPath` pada definisi registry, atur `animationConfig.scale`, dan sediakan thumbnail yang cocok. `AnimatedGLTF.tsx` memuat model, mengkloning skeleton, dan memilih/crossfade clip animasi yang sesuai. Posisi tangan pada tali tetap memerlukan rig/animasi model yang sesuai; metadata database saja tidak otomatis mengganti registry frontend.

Model dalam game telah diperhalus dengan bentuk wajah dan mata yang lebih sederhana, tunik dan lengan yang tersambung, tangan serta sepatu yang membulat, dan pencahayaan preview yang lebih lembut. Sepuluh potret dibuat ulang dari geometri terbaru.

`design/Doctor-Hero.blend` adalah contoh dokter yang diekspor dari geometri game dan dapat diedit di Blender 4.3 atau lebih baru. File ini berisi satu pose statis tanpa armature/animasi; mengubahnya tidak otomatis mengubah game. `design/BACA-MODEL-BLENDER.txt` menjelaskan integrasi GLB dan rig, dan `Blender-Hero-Dokter.zip` menyediakan file beserta pratinjau. Penyesuaian gaya ini merupakan pendekatan terhadap referensi, bukan model sculpt identik dengan gambar.

Versi beranimasi yang baru adalah `design/Doctor-Hero-Rigged.blend`, dibuat langsung di Blender. **Dr. Arga (`doctor-m`)** sekarang menggunakan `/models/doctor-hero.glb` di preview dan arena. Rig berisi 23 bone dan sembilan clip (`idle`, `ready`, `rope-ready`, `pulling`, `struggling`, `sliding`, `falling`, `victory`, `defeat`); sembilan hero lain masih memakai renderer prosedural. Galeri publik menampilkan Dr. Arga pertama kali agar model ini mudah dicoba.

Source pembuat model tersedia di `scripts/blender/create_doctor_hero.py`. File Blender, GLB, video gerakan dan petunjuk disediakan dalam `Blender-Dokter-Beranimasi.zip`. Panduan action dan ekspor ada di `design/BACA-DOKTER-BERANIMASI.txt`. Edit Blender membutuhkan ekspor GLB sebelum tampak di game. Model dan animasi adalah adaptasi orisinal terhadap referensi, belum merupakan salinan identik.

## Data lokal dan pemasangan

Perubahan ini tidak mengubah schema database atau memasukkan database contoh ke instalasi pengguna. Startup API menambahkan definisi hero yang belum ada menggunakan upsert dengan pembaruan kosong; metadata karakter yang sudah tersimpan tetap dipertahankan. Bank soal, akun, dan riwayat tidak dihapus.

Tutup game, jalankan `UPDATE-GAME.bat` pada instalasi GitHub yang sudah memakai sistem dua pengendali, lalu buka shortcut game kembali. Pengguna server production menjalankan build sebelum `npm start`; peluncur development memuat source terbaru saat dibuka. Jika tampilan lama masih tersimpan di browser, tekan Ctrl+F5.

`Character-Gallery-Team-Selection.zip` adalah patch source untuk versi dua pengendali, bukan instalasi game baru. Ekstrak, gabungkan folder `apps` dan `packages` ke folder game yang berisi `package.json`, dan ganti file yang sama. ZIP tidak memuat `.env`, `medical.db`, akun, atau unggahan. Jangan gunakan patch ini untuk versi lama yang masih memakai enam perangkat independen.

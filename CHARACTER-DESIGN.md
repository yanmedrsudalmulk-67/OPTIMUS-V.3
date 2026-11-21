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

Potret WebP di `apps/web/public/heroes` merupakan render transparan dari model 3D orisinal yang juga dipakai preview dan arena. Kartu menggunakan potret tersimpan agar galeri tidak membuka banyak konteks WebGL sekaligus. Preview utama tetap 3D dengan napas, kedipan, pose hidup, pencahayaan studio lembut, bayangan kontak, dan kontrol drag/swipe. Preferensi reduced motion dihormati.

Seluruh sepuluh hero (termasuk **Dr. Arga (`doctor-m`)**) kini menggunakan renderer 3D **Soft Clay-Vinyl** terpadu (`VinylHeroCharacter` di `apps/web/components/arena/Character.tsx` serta modul `apps/web/components/arena/character/*`) di preview dan arena. Setiap karakter memakai geometri sculpt halus dengan proporsi vinyl profesional, subsurface skin shading hangat dengan perona pipi vertex-color, anggota tubuh tersambung tanpa sambungan bola kaku (`THREE.SkinnedMesh`), solver Inverse Kinematics (IK) analitik dua tulang pada lengan dan kaki, serta sintesis gerak organik 12 Prinsip Animasi di seluruh delapan state (`idle`, `ready`, `pulling`, `struggling`, `sliding`, `falling`, `victory`, `defeat`) termasuk genggaman tali (`holdRope`). Kesepuluh potret transparan `.webp` di `apps/web/public/heroes` dirender ulang langsung dari model 3D terbaru.

Dukungan model eksternal GLB/GLTF tetap dipertahankan melalui `AnimatedGLTF.tsx` apabila properti `modelPath` diisi pada definisi `CHARACTER_REGISTRY` (beserta aset contoh `/models/doctor-hero.glb` dan `scripts/blender/create_doctor_hero.py`).

## Data lokal dan pemasangan

Perubahan ini tidak mengubah schema database atau memasukkan database contoh ke instalasi pengguna. Startup API menambahkan definisi hero yang belum ada menggunakan upsert dengan pembaruan kosong; metadata karakter yang sudah tersimpan tetap dipertahankan. Bank soal, akun, dan riwayat tidak dihapus.

Tutup game, jalankan `UPDATE-GAME.bat` pada instalasi GitHub yang sudah memakai sistem dua pengendali, lalu buka shortcut game kembali. Pengguna server production menjalankan build sebelum `npm start`; peluncur development memuat source terbaru saat dibuka. Jika tampilan lama masih tersimpan di browser, tekan Ctrl+F5.

`Character-Gallery-Team-Selection.zip` adalah patch source untuk versi dua pengendali, bukan instalasi game baru. Ekstrak, gabungkan folder `apps` dan `packages` ke folder game yang berisi `package.json`, dan ganti file yang sama. ZIP tidak memuat `.env`, `medical.db`, akun, atau unggahan. Jangan gunakan patch ini untuk versi lama yang masih memakai enam perangkat independen.

# Preview perawat Alya

Preview desain terpisah untuk ditinjau sebelum dipasang ke aplikasi. Gambar diam menjadi acuan visual; gerakan napas, kepala, dan kedipan dibuat sebagai interpretasi untuk contoh animasi. Model ini mengacu pada referensi: rambut cokelat dengan cepol berantakan dan helai lepas, mata besar, wajah berbintik, senyum lembut, kardigan hijau longgar di atas kaus putih, serta tangan menyilang.

Ekstrak paket preview ke folder terpisah, lalu buka gambar PNG atau video MP4 dari folder tersebut. Melihat preview ini tidak memerlukan pemasangan ke game.

- `Nurse-Alya-Preview.png`: gambar hasil render Blender.
- `Nurse-Alya-Animation.mp4`: contoh gerakan model 3D, termasuk napas, kedipan dan gerakan kepala ringan.
- `Nurse-Alya-Preview.blend`: sumber yang dapat diedit dengan Blender 4.3 atau lebih baru.
- `nurse-alya-preview.glb`: model dengan rig dan animasi untuk pemeriksaan preview.

Gerakan merupakan interpretasi untuk preview karena gambar referensi tidak menunjukkan urutan animasi. Integrasi ke galeri, pemilihan tim dan animasi pertandingan belum dilakukan. Hero perawat yang sudah ada dalam game tetap menggunakan model sebelumnya.

Source pembuat model tersedia di `scripts/blender/create_nurse_preview.py` pada repository dan di folder `scripts/blender/` dalam paket ZIP. Generator menyimpan hasil ke `design/previews/nurse-alya/` di folder tempat perintah dijalankan. Jalankan dari akar repository menggunakan Blender; perintah generator menimpa berkas hasil preview, sehingga simpan edit manual dengan nama berbeda.

```sh
blender -b --factory-startup --python scripts/blender/create_nurse_preview.py
```

Branch khusus preview: `codex/preview-perawat-alya`. Updater game menggunakan branch `codex/game-local-launcher`.

Validasi 31 Oktober 2026: sumber dibuka ulang di Blender 4.3.2, rig 57 bone, empat clip sekitar delapan detik, dengan kelopak yang menutup sementara bentuk iris tetap utuh, tanpa tekstur eksternal yang hilang. Ekspor GLB berhasil dimuat di browser dan menunjukkan gerakan joint; render video memeriksa tekstur yang tertanam dalam file. Bentuk ini merupakan versi pertama untuk review visual, bukan klaim kesamaan 100% atau aset pertandingan yang telah diintegrasikan.

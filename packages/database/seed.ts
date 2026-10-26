import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from './client';
import { CHARACTERS, DEFAULT_SETTINGS } from '../shared/src';

type SeedQuestion = [
  text: string,
  options: [string, string, string, string],
  correctAnswer: number,
  explanation: string,
];
const packages: { id: string; name: string; description: string; questions: SeedQuestion[] }[] = [
  {
    id: 'package-ppi',
    name: 'Pencegahan dan Pengendalian Infeksi',
    description:
      'Kebersihan tangan, kewaspadaan standar, dan pencegahan infeksi di fasilitas kesehatan.',
    questions: [
      [
        'Berapa jumlah momen kebersihan tangan dalam pedoman Five Moments WHO?',
        ['Tiga', 'Empat', 'Lima', 'Enam'],
        2,
        'WHO menetapkan lima momen: sebelum menyentuh pasien, sebelum tindakan aseptik, setelah risiko cairan tubuh, setelah menyentuh pasien, dan setelah menyentuh lingkungan pasien.',
      ],
      [
        'Kapan kebersihan tangan wajib dilakukan saat menggunakan sarung tangan?',
        [
          'Hanya saat sarung tangan robek',
          'Sebelum memakai dan setelah melepas sarung tangan',
          'Tidak perlu jika memakai dua lapis',
          'Hanya pada akhir giliran kerja',
        ],
        1,
        'Sarung tangan tidak menggantikan kebersihan tangan. Bersihkan tangan sebelum memakai dan sesudah melepasnya.',
      ],
      [
        'Berapa durasi menggosok tangan dengan handrub berbasis alkohol menurut WHO?',
        ['5–10 detik', '10–15 detik', '20–30 detik', '60–90 detik'],
        2,
        'Prosedur handrub berlangsung sekitar 20–30 detik hingga tangan kering.',
      ],
      [
        'Apa tindakan yang benar bila tangan tampak kotor?',
        [
          'Cukup dilap dengan tisu kering',
          'Cuci dengan sabun dan air mengalir',
          'Langsung memakai sarung tangan',
          'Hanya menyemprot pakaian dengan disinfektan',
        ],
        1,
        'Tangan yang tampak kotor harus dicuci menggunakan sabun dan air mengalir.',
      ],
      [
        'Bagaimana membuang jarum bekas pakai dengan aman?',
        [
          'Menutup ulang jarum dengan dua tangan',
          'Mematahkan jarum sebelum dibuang',
          'Langsung memasukkan ke wadah benda tajam tahan tusuk',
          'Membuangnya ke kantong sampah biasa',
        ],
        2,
        'Jarum bekas segera dibuang ke safety box tahan tusuk; hindari recapping dan manipulasi yang tidak perlu.',
      ],
    ],
  },
  {
    id: 'package-safety',
    name: 'Keselamatan Pasien',
    description:
      'Identifikasi pasien, komunikasi efektif, keamanan obat, dan pencegahan risiko jatuh.',
    questions: [
      [
        'Berapa minimal identitas pasien yang digunakan sebelum memberikan obat?',
        ['Satu identitas', 'Dua identitas', 'Nomor kamar saja', 'Warna pakaian'],
        1,
        'Gunakan minimal dua identitas, misalnya nama lengkap dan tanggal lahir atau nomor rekam medis; nomor kamar bukan identitas pasien.',
      ],
      [
        'Apa kepanjangan SBAR dalam komunikasi klinis?',
        [
          'Situation, Background, Assessment, Recommendation',
          'Safety, Balance, Action, Recovery',
          'Screening, Bed, Admission, Referral',
          'Status, Basic, Alert, Result',
        ],
        0,
        'SBAR membantu menyampaikan situasi, latar belakang, penilaian, serta rekomendasi secara terstruktur.',
      ],
      [
        'Apa langkah utama sebelum memberikan obat kepada pasien dengan riwayat alergi?',
        [
          'Mengabaikan alergi bila dosis kecil',
          'Memverifikasi alergi dan memastikan obat aman sesuai instruksi',
          'Memberikan obat lebih cepat',
          'Mencampur semua obat sekaligus',
        ],
        1,
        'Verifikasi alergi dan instruksi pengobatan, serta komunikasikan potensi risiko sebelum pemberian obat.',
      ],
      [
        'Apa tujuan penandaan lokasi operasi?',
        [
          'Mempercepat administrasi saja',
          'Mencegah salah pasien, salah prosedur, dan salah sisi operasi',
          'Menggantikan informed consent',
          'Menggantikan time-out',
        ],
        1,
        'Penandaan lokasi merupakan bagian verifikasi keselamatan operasi dan tidak menggantikan persetujuan maupun time-out.',
      ],
      [
        'Apa tindakan tepat untuk pasien berisiko jatuh?',
        [
          'Membiarkan lantai basah',
          'Meninggikan tempat tidur tanpa penilaian',
          'Menerapkan intervensi sesuai penilaian risiko dan memberi edukasi',
          'Menganjurkan pasien berjalan sendiri dalam gelap',
        ],
        2,
        'Intervensi disesuaikan dengan hasil penilaian risiko, termasuk lingkungan aman, bantuan mobilisasi, serta edukasi pasien dan keluarga.',
      ],
    ],
  },
  {
    id: 'package-quality',
    name: 'Mutu Pelayanan Rumah Sakit',
    description:
      'Perbaikan mutu berkelanjutan, indikator, pengalaman pasien, dan pelaporan insiden.',
    questions: [
      [
        'Apa urutan siklus PDSA untuk perbaikan mutu?',
        [
          'Plan, Do, Study, Act',
          'Prepare, Deliver, Save, Archive',
          'Prevent, Diagnose, Supply, Assess',
          'Plan, Decide, Stop, Approve',
        ],
        0,
        'PDSA berarti merencanakan, mencoba perubahan, mempelajari hasil, lalu bertindak berdasarkan pembelajaran tersebut.',
      ],
      [
        'Apa tujuan utama indikator mutu pelayanan?',
        [
          'Menghitung jumlah kursi tunggu',
          'Mengukur kinerja dan mendukung perbaikan pelayanan',
          'Menggantikan penilaian klinis',
          'Menghapus kebutuhan evaluasi',
        ],
        1,
        'Indikator menyediakan ukuran terdefinisi untuk menilai kinerja dan mengevaluasi upaya perbaikan.',
      ],
      [
        'Bagaimana budaya keselamatan sebaiknya merespons laporan insiden?',
        [
          'Mencari orang untuk dipermalukan',
          'Mendorong pelaporan dan pembelajaran yang adil',
          'Menyembunyikan semua kejadian',
          'Melarang pelaporan kejadian nyaris cedera',
        ],
        1,
        'Budaya keselamatan yang adil mendorong pelaporan dan analisis sistem sambil mempertahankan akuntabilitas yang sesuai.',
      ],
      [
        'Apa yang dimaksud RCA dalam evaluasi insiden?',
        [
          'Rapid Cost Approval',
          'Root Cause Analysis',
          'Room Capacity Audit',
          'Routine Cleaning Activity',
        ],
        1,
        'Root Cause Analysis adalah pendekatan terstruktur untuk mengidentifikasi faktor penyebab dan menyusun tindakan pencegahan kejadian berulang.',
      ],
      [
        'Mengapa umpan balik pasien perlu ditindaklanjuti?',
        [
          'Hanya untuk promosi',
          'Untuk memahami pengalaman pasien dan memperbaiki pelayanan',
          'Untuk mengabaikan data klinis',
          'Agar semua keluhan dihapus',
        ],
        1,
        'Umpan balik pasien membantu menemukan kebutuhan, hambatan, dan peluang perbaikan kualitas pelayanan.',
      ],
    ],
  },
  {
    id: 'package-general',
    name: 'Pengetahuan Umum Kesehatan',
    description: 'Dasar kesehatan, pencegahan penyakit, dan kebiasaan hidup sehat.',
    questions: [
      [
        'Berapa rekomendasi minimal aktivitas fisik aerobik intensitas sedang per minggu untuk orang dewasa menurut WHO?',
        ['15 menit', '30 menit', '150 menit', '900 menit'],
        2,
        'WHO merekomendasikan setidaknya 150–300 menit aktivitas aerobik intensitas sedang per minggu untuk orang dewasa, disesuaikan dengan kondisi kesehatannya.',
      ],
      [
        'Apa fungsi utama sel darah merah?',
        [
          'Mengangkut oksigen',
          'Membuat insulin',
          'Menghasilkan empedu',
          'Menghasilkan enzim pencernaan',
        ],
        0,
        'Hemoglobin di sel darah merah membawa oksigen dari paru ke jaringan tubuh.',
      ],
      [
        'Penyakit apa yang disebabkan oleh infeksi Mycobacterium tuberculosis?',
        ['Demam berdarah', 'Tuberkulosis', 'Malaria', 'Campak'],
        1,
        'Tuberkulosis disebabkan oleh bakteri Mycobacterium tuberculosis dan paling sering menyerang paru.',
      ],
      [
        'Apa fungsi utama imunisasi?',
        [
          'Menggantikan makanan bergizi',
          'Membantu tubuh membangun perlindungan terhadap penyakit tertentu',
          'Mengobati semua infeksi aktif',
          'Menggantikan kebersihan tangan',
        ],
        1,
        'Imunisasi membantu sistem imun mengenali patogen dan melindungi terhadap penyakit tertentu.',
      ],
      [
        'Apa kebiasaan yang membantu mencegah hipertensi?',
        [
          'Merokok setiap hari',
          'Mengonsumsi garam berlebihan',
          'Aktivitas fisik teratur dan pola makan seimbang',
          'Menghindari seluruh sayuran',
        ],
        2,
        'Aktivitas fisik, berat badan sehat, pembatasan garam, dan pola makan seimbang membantu mengurangi risiko hipertensi.',
      ],
    ],
  },
  {
    id: 'package-final',
    name: 'Grand Final',
    description: 'Tantangan gabungan keselamatan pasien, infeksi, dan mutu untuk babak penentuan.',
    questions: [
      [
        'Kapan time-out keselamatan operasi dilakukan?',
        [
          'Setelah pasien pulang',
          'Segera sebelum memulai tindakan insisi atau prosedur',
          'Hanya saat rapat bulanan',
          'Setelah semua alat disimpan',
        ],
        1,
        'Time-out dilakukan bersama tim segera sebelum insisi/prosedur untuk memverifikasi pasien, prosedur, dan lokasi yang benar.',
      ],
      [
        'Apa yang paling tepat saat menerima instruksi obat secara verbal?',
        [
          'Mengingat tanpa mencatat',
          'Mencatat, membaca kembali, dan memperoleh konfirmasi sesuai kebijakan',
          'Menebak nama obat yang mirip',
          'Meneruskan tanpa verifikasi',
        ],
        1,
        'Proses tulis, baca kembali, dan konfirmasi membantu mencegah kesalahan komunikasi instruksi verbal.',
      ],
      [
        'Mengapa antibiotik tidak boleh digunakan sembarangan?',
        [
          'Karena semua antibiotik adalah vitamin',
          'Karena penggunaan tidak tepat dapat mendorong resistansi antimikroba',
          'Karena antibiotik hanya untuk nyeri otot',
          'Karena tidak pernah memiliki efek samping',
        ],
        1,
        'Penggunaan antibiotik harus berdasarkan indikasi dan resep yang tepat untuk membatasi resistansi dan efek merugikan.',
      ],
      [
        'Apa langkah awal ketika menemukan potensi bahaya di lingkungan pelayanan?',
        [
          'Mengabaikan sampai terjadi cedera',
          'Mengamankan situasi sesuai kewenangan dan melaporkan melalui mekanisme yang berlaku',
          'Mengunggah identitas pasien ke media sosial',
          'Memindahkan bahaya ke ruang lain',
        ],
        1,
        'Prioritaskan keselamatan segera sesuai kewenangan, kemudian laporkan risiko melalui mekanisme fasilitas untuk tindak lanjut.',
      ],
      [
        'Apa prinsip utama kerahasiaan rekam medis?',
        [
          'Data bebas dibagikan kepada siapa pun',
          'Data hanya diakses atau dibagikan sesuai kewenangan dan kebutuhan yang sah',
          'Password boleh digunakan bersama',
          'Identitas pasien boleh dipublikasikan tanpa dasar',
        ],
        1,
        'Akses dan pengungkapan data pasien harus memiliki kewenangan dan dasar yang sah, serta dibatasi pada kebutuhan yang sesuai.',
      ],
    ],
  },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const item of packages) {
      await tx.questionPackage.upsert({
        where: { id: item.id },
        update: {},
        create: { id: item.id, name: item.name, description: item.description },
      });
      for (const [index, [text, options, correctAnswer, explanation]] of item.questions.entries()) {
        await tx.question.upsert({
          where: { id: `${item.id}-q${index + 1}` },
          update: {},
          create: {
            id: `${item.id}-q${index + 1}`,
            packageId: item.id,
            text,
            options,
            correctAnswer,
            explanation,
            duration: 20,
            points: 100,
            active: true,
            sortOrder: index,
          },
        });
      }
    }
    for (const character of CHARACTERS) {
      await tx.character.upsert({
        where: { id: character.id },
        update: {},
        create: {
          id: character.id,
          name: character.name,
          profession: character.profession,
          animationConfig: {
            procedural: true,
            color: character.color,
            accessory: character.accessory,
            gltfClips: {
              idle: 'Idle',
              ready: 'Ready',
              pulling: 'Pulling',
              struggling: 'Struggling',
              sliding: 'Sliding',
              falling: 'Falling',
              victory: 'Victory',
              defeat: 'Defeat',
            },
          },
        },
      });
    }
    await tx.gameSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default', value: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue },
    });
  });
  console.log(
    'Seed selesai: 5 paket, 25 soal contoh, 8 karakter, dan pengaturan default. Data yang sudah diedit dipertahankan.',
  );
  console.log(
    'Soal contoh bersifat edukatif; tinjau kembali sebelum digunakan dalam kompetisi resmi.',
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Seed gagal.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

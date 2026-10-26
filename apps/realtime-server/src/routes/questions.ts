import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { prisma } from '../../../../packages/database/client';
import { questionSchema, packageSchema, errorMessage } from '../validation';
export const questionsRouter = Router();
questionsRouter.get('/packages', async (_req, res) =>
  res.json(
    await prisma.questionPackage.findMany({
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
  ),
);
questionsRouter.post('/packages', async (req, res) =>
  res
    .status(201)
    .json(await prisma.questionPackage.create({ data: packageSchema.parse(req.body) })),
);
questionsRouter.patch('/packages/:id', async (req, res) =>
  res.json(
    await prisma.questionPackage.update({
      where: { id: String(req.params.id) },
      data: packageSchema.partial().parse(req.body),
    }),
  ),
);
questionsRouter.delete('/packages/:id', async (req, res) => {
  await prisma.questionPackage.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
questionsRouter.post('/questions', async (req, res) =>
  res.status(201).json(await prisma.question.create({ data: questionSchema.parse(req.body) })),
);
questionsRouter.patch('/questions/:id', async (req, res) =>
  res.json(
    await prisma.question.update({
      where: { id: String(req.params.id) },
      data: questionSchema.partial().parse(req.body),
    }),
  ),
);
questionsRouter.delete('/questions/:id', async (req, res) => {
  await prisma.question.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
questionsRouter.post('/questions/:id/duplicate', async (req, res) => {
  const q = await prisma.question.findUniqueOrThrow({ where: { id: String(req.params.id) } });
  const { id, createdAt, updatedAt, ...copy } = q;
  res
    .status(201)
    .json(
      await prisma.question.create({
        data: {
          ...copy,
          options: q.options as string[],
          text: copy.text + ' (salinan)',
          sortOrder: copy.sortOrder + 1,
        },
      }),
    );
});
const columns = [
  'package',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
  'duration',
  'points',
];
async function spreadsheet(
  res: any,
  rows: Record<string, unknown>[],
  name: string,
  format: unknown,
) {
  const safe = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v,
      ]),
    ),
  );
  const xlsx = format === 'xlsx';
  res.setHeader('Content-Disposition', `attachment; filename="${name}.${xlsx ? 'xlsx' : 'csv'}"`);
  res.type(xlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
  if (xlsx) {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Soal');
    sheet.addRow(columns);
    sheet.getRow(1).font = { bold: true };
    for (const row of safe) sheet.addRow(columns.map((column) => row[column] ?? ''));
    sheet.columns.forEach((column) => (column.width = 25));
    res.send(Buffer.from(await book.xlsx.writeBuffer()));
  } else {
    const quote = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    res.send(
      '\uFEFF' +
        [
          columns.map(quote).join(','),
          ...safe.map((row) => columns.map((column) => quote(row[column])).join(',')),
        ].join('\r\n'),
    );
  }
}
questionsRouter.get('/questions/template', async (req, res) =>
  spreadsheet(
    res,
    [
      {
        package: 'Pencegahan dan Pengendalian Infeksi',
        question: 'Berapa jumlah Five Moments Hand Hygiene WHO?',
        option_a: 'Tiga',
        option_b: 'Empat',
        option_c: 'Lima',
        option_d: 'Enam',
        correct_answer: 'C',
        explanation: 'WHO menetapkan lima momen kebersihan tangan.',
        duration: 20,
        points: 100,
      },
    ],
    'template-soal',
    req.query.format,
  ),
);
questionsRouter.get('/questions/export', async (req, res) => {
  const qs = await prisma.question.findMany({
    where: req.query.packageId ? { packageId: String(req.query.packageId) } : undefined,
    include: { package: true },
    orderBy: { sortOrder: 'asc' },
  });
  await spreadsheet(
    res,
    qs.map((q) => ({
      package: q.package.name,
      question: q.text,
      option_a: (q.options as string[])[0],
      option_b: (q.options as string[])[1],
      option_c: (q.options as string[])[2],
      option_d: (q.options as string[])[3],
      correct_answer: 'ABCD'[q.correctAnswer],
      explanation: q.explanation,
      duration: q.duration,
      points: q.points,
    })),
    'bank-soal',
    req.query.format,
  );
});
questionsRouter.post('/questions/import', async (req, res) => {
  if (!Array.isArray(req.body.rows) || req.body.rows.length > 1000) {
    res.status(400).json({ error: 'Maksimal 1.000 baris per impor' });
    return;
  }
  const packages = await prisma.questionPackage.findMany();
  const valid: any[] = [];
  const errors: { row: number; error: string }[] = [];
  for (let i = 0; i < req.body.rows.length; i++) {
    const row = req.body.rows[i];
    try {
      const pack = packages.find(
        (p) =>
          p.name.toLowerCase() ===
            String(row.package || '')
              .trim()
              .toLowerCase() || p.id === row.package,
      );
      if (!pack) throw new Error('Paket tidak ditemukan; buat paket terlebih dahulu');
      const correct = 'ABCD'.indexOf(
        String(row.correct_answer || '')
          .toUpperCase()
          .trim(),
      );
      const data = questionSchema.parse({
        packageId: pack.id,
        text: row.question,
        options: [row.option_a, row.option_b, row.option_c, row.option_d],
        correctAnswer: correct,
        explanation: String(row.explanation || ''),
        duration: Number(row.duration || 20),
        points: Number(row.points || 100),
        active: true,
        sortOrder: i,
      });
      valid.push(data);
    } catch (e) {
      errors.push({ row: i + 2, error: errorMessage(e) });
    }
  }
  let imported = 0;
  if (req.body.commit === true && errors.length === 0) {
    await prisma.$transaction(valid.map((data) => prisma.question.create({ data })));
    imported = valid.length;
  }
  res.json({ valid, errors, imported });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 2,
    headerPairs: 100,
    fieldNameSize: 50,
  },
  fileFilter: (_req, file, cb) =>
    cb(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)),
});
questionsRouter.post('/uploads', upload.single('image'), async (req, res) => {
  const f = req.file;
  if (!f) {
    res.status(400).json({ error: 'Pilih gambar PNG, JPEG, atau WebP (maksimal 3 MB)' });
    return;
  }
  const b = f.buffer;
  const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  if (!png && !jpg && !webp) {
    res.status(400).json({ error: 'Isi file bukan gambar yang didukung' });
    return;
  }
  const ext = png ? 'png' : jpg ? 'jpg' : 'webp';
  const dir = path.resolve('apps/realtime-server/uploads');
  await fs.mkdir(dir, { recursive: true });
  const filename = crypto.randomUUID() + '.' + ext;
  await fs.writeFile(path.join(dir, filename), b, { flag: 'wx' });
  res.status(201).json({ url: '/uploads/' + filename });
});

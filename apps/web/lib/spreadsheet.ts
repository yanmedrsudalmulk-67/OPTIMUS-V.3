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
] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;

// XLSX is a ZIP container. Reject oversized expanded archives before a parser
// allocates their XML documents; legacy XLS and ZIP64 are intentionally unsupported.
function validateArchive(buffer: ArrayBuffer) {
  const data = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--)
    if (data.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error('File Excel tidak valid. Gunakan format .xlsx.');
  const count = data.getUint16(eocd + 10, true);
  const directory = data.getUint32(eocd + 16, true);
  if (count === 65535 || count > 512 || directory >= eocd)
    throw new Error('Struktur file Excel terlalu kompleks.');
  let offset = directory,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > eocd || data.getUint32(offset, true) !== 0x02014b50)
      throw new Error('Arsip Excel tidak valid.');
    const size = data.getUint32(offset + 24, true);
    total += size;
    if (size === 0xffffffff || total > MAX_EXPANDED_BYTES)
      throw new Error('Isi file Excel terlalu besar (maksimal 20 MB setelah diekstrak).');
    offset +=
      46 +
      data.getUint16(offset + 28, true) +
      data.getUint16(offset + 30, true) +
      data.getUint16(offset + 32, true);
  }
}
function records(table: unknown[][]): Record<string, unknown>[] {
  if (table.length < 2) throw new Error('File tidak berisi data pertanyaan.');
  const header = table[0].map((v) =>
    String(v ?? '')
      .trim()
      .toLowerCase(),
  );
  if (
    header.length !== columns.length ||
    columns.some((c) => !header.includes(c)) ||
    new Set(header).size !== header.length
  )
    throw new Error('Kolom tidak sesuai template. Unduh template Excel / CSV dari aplikasi.');
  const rows = table.slice(1).filter((row) => row.some((v) => String(v ?? '').trim() !== ''));
  if (rows.length > 1000) throw new Error('Maksimal 1.000 soal setiap impor.');
  return rows.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? ''])),
  );
}
export async function readQuestionRows(file: File): Promise<Record<string, unknown>[]> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Ukuran file maksimal 5 MB.');
  if (file.name.toLowerCase().endsWith('.csv')) {
    const { parse } = await import('csv-parse/browser/esm/sync');
    const table = parse(await file.text(), {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 10000,
      columns: false,
      relax_column_count: false,
    }) as unknown[][];
    return records(table);
  }
  if (!file.name.toLowerCase().endsWith('.xlsx'))
    throw new Error('Gunakan file .xlsx atau .csv. Format .xls lama tidak didukung.');
  const buffer = await file.arrayBuffer();
  validateArchive(buffer);
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('File tidak memiliki lembar kerja.');
  if (sheet.rowCount > 1001) throw new Error('Maksimal 1.000 soal setiap impor.');
  const table: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: unknown[] = [];
    for (let index = 1; index <= Math.max(columns.length, row.cellCount); index++) {
      const cell = row.getCell(index);
      const value = cell.value;
      if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value))
        throw new Error(
          `Baris ${row.number}: formula Excel tidak diperbolehkan. Gunakan nilai teks atau angka.`,
        );
      values.push(typeof value === 'number' ? value : cell.text);
    }
    table.push(values);
  });
  return records(table);
}

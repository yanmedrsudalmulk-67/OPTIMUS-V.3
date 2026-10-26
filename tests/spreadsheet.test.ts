import { describe, expect, test } from 'vitest';
import ExcelJS from 'exceljs';
import { readQuestionRows } from '../apps/web/lib/spreadsheet';
const headers = [
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
const row = ['PPI', 'Apa jawabannya?', 'A', 'B', 'C', 'D', 'B', 'Penjelasan', '20', '100'];
const csv = (rows: string[][]) =>
  rows.map((r) => r.map((v) => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\r\n');
async function excel(formula = false) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Soal');
  sheet.addRow(headers);
  sheet.addRow(row);
  if (formula) sheet.getCell('B2').value = { formula: '1+1', result: 2 };
  const buffer = await book.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

describe('validated spreadsheet reader', () => {
  test('reads UTF-8 CSV and preserves quoted commas/newlines', async () => {
    const data = [...row];
    data[1] = 'Apa, bagaimana?\nPertanyaan kedua';
    const rows = await readQuestionRows(new File(['\uFEFF' + csv([headers, data])], 'soal.csv'));
    expect(rows).toHaveLength(1);
    expect(rows[0].question).toBe(data[1]);
    expect(rows[0].correct_answer).toBe('B');
  });
  test('rejects incorrect or duplicate column headers', async () => {
    await expect(
      readQuestionRows(new File([csv([['question', ...headers.slice(1)], row])], 'soal.csv')),
    ).rejects.toThrow('Kolom');
  });
  test('rejects more than one thousand data rows', async () => {
    await expect(
      readQuestionRows(
        new File([csv([headers, ...Array.from({ length: 1001 }, () => row)])], 'soal.csv'),
      ),
    ).rejects.toThrow('1.000');
  });
  test('rejects oversized input before parsing', async () => {
    await expect(
      readQuestionRows(new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'soal.csv')),
    ).rejects.toThrow('5 MB');
  });
  test('rejects unsupported legacy XLS input', async () => {
    await expect(readQuestionRows(new File(['legacy'], 'soal.xls'))).rejects.toThrow('.xls');
  });
  test('reads a real XLSX workbook', async () => {
    const rows = await readQuestionRows(new File([await excel()], 'soal.xlsx'));
    expect(rows).toHaveLength(1);
    expect(rows[0].question).toBe('Apa jawabannya?');
  });
  test('rejects formulas rather than evaluating or accepting cached results', async () => {
    await expect(readQuestionRows(new File([await excel(true)], 'soal.xlsx'))).rejects.toThrow(
      'formula',
    );
  });
  test('rejects non-ZIP masquerading as XLSX', async () => {
    await expect(readQuestionRows(new File(['not an archive'], 'soal.xlsx'))).rejects.toThrow(
      'tidak valid',
    );
  });
  test('rejects expanded XML size exceeding safety limit', async () => {
    const bytes = await excel();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < bytes.length - 46; i++)
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 21 * 1024 * 1024, true);
        break;
      }
    await expect(readQuestionRows(new File([bytes], 'soal.xlsx'))).rejects.toThrow('20 MB');
  });
});

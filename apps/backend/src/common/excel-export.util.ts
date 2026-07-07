import * as XLSX from 'xlsx';

export interface ExcelColumn<T> {
  header: string;
  value: (row: T) => string | number | Date | null | undefined;
}

export interface ExcelSheet<T> {
  name: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}

function sheetToAoa<T>(columns: ExcelColumn<T>[], rows: T[]): (string | number | Date)[][] {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) => columns.map((c) => c.value(row) ?? ''));
  return [headers, ...data];
}

export function parseExcelRows(buffer: Buffer): Record<string, string | number | undefined>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: undefined });
}

export function buildExcelBuffer<T>(sheetName: string, columns: ExcelColumn<T>[], rows: T[]): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildMultiSheetExcelBuffer([{ name: sheetName, columns, rows }] as ExcelSheet<any>[]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultiSheetExcelBuffer(sheets: ExcelSheet<any>[]): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheetToAoa(sheet.columns, sheet.rows));
    // Excel sheet names are capped at 31 characters.
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

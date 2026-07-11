import * as XLSX from 'xlsx';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const DISCOUNT_KEYWORD = 'ส่วนลด';
const CREDIT_NOTE_KEYWORD = 'ใบลดหนี้';
const INCOME_CATEGORY_KEYWORD = 'รับเงิน';
const GENERIC_METHODS = new Set(['เงินสด', 'โอน', 'โอนเงิน', 'บัตรเครดิต', 'เช็ค', 'แคชเชียร์เช็ค']);

export interface ParsedBillGroup {
  date: Date | null;
  house: string;
  category: string;
  amount: number;
  descriptions: string[];
  method: string | null;
  sheetName: string;
  sourceRow: number;
}

export interface ParsedInvoiceRow {
  date: Date | null;
  house: string;
  description: string;
  amount: number;
  sheetName: string;
  sourceRow: number;
}

export interface ParseIssue {
  sheet: string;
  row: number;
  reason: string;
}

export interface ParsedLedger {
  bills: ParsedBillGroup[];
  invoices: ParsedInvoiceRow[];
  skipped: ParseIssue[];
  errors: ParseIssue[];
}

export type SupplierInvoiceType = 'MATERIAL' | 'LABOR';

export interface ParsedSupplierInvoice {
  type: SupplierInvoiceType;
  invoiceDate: Date;
  supplierName: string;
  taxId: string | null;
  invoiceNumber: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  sourceSheet: string;
  sourceRow: number;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function toDate(value: unknown): Date | null {
  return value instanceof Date ? value : null;
}

export function resolveHouseInfo(houseRaw: string): { key: string; name: string; type: 'HOUSE' | 'OVERHEAD' } {
  const trimmed = houseRaw.trim();
  if (!trimmed || trimmed === 'หลังโครงการ') {
    return { key: 'หลังโครงการ', name: 'ค่าใช้จ่ายส่วนกลางโครงการ (นำเข้าจาก Excel)', type: 'OVERHEAD' };
  }
  if (trimmed.includes(',')) {
    return { key: trimmed, name: `ค่าใช้จ่ายร่วม ${trimmed} (นำเข้าจาก Excel)`, type: 'OVERHEAD' };
  }
  return { key: trimmed, name: `บ้านเลขที่ ${trimmed} (นำเข้าจาก Excel)`, type: 'HOUSE' };
}

export function resolveExpenseContactName(method: string | null): string {
  const trimmed = method?.trim();
  if (trimmed && !GENERIC_METHODS.has(trimmed)) return trimmed;
  return 'ผู้จำหน่าย/ผู้รับเหมา (ไม่ระบุชื่อ, นำเข้าจาก Excel)';
}

export function resolveIncomeContactName(desc: string): string {
  const match = desc.match(/ลูกค้า\s*(คุณ[^\s]+(?:\s[^\s]+){0,2})/);
  if (match) return match[1];
  return 'ลูกค้า (นำเข้าจาก Excel)';
}

/**
 * Parses every sheet in the workbook that looks like the real, full-detail
 * "บัญชีรายรับ-รายจ่าย" ledger (has วันที่/รับเข้า/จ่ายออก/VAT 7%/Total
 * columns). Sheets with a different shape (e.g. ค่าของ/ค่าแรง
 * supplier-invoice registers, or an older partial/superseded ledger tab
 * that only has the first few columns) are silently skipped so their
 * totals are never double-counted.
 *
 * Discount rows are recorded as negative รับเข้า in the source file even
 * though they reduce cost, not revenue — detected by the "ส่วนลด" keyword
 * and netted into the same-day/house/category expense group instead of
 * being imported as negative income. A "ใบลดหนี้" (credit note) row is
 * recorded as a *positive* รับเข้า even though it also reduces cost, not
 * revenue — it's netted the same way as a discount.
 */
export function parseLedgerWorkbook(buffer: Buffer): ParsedLedger {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const result: ParsedLedger = { bills: [], invoices: [], skipped: [], errors: [] };
  const seenZeroDateSignatures = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    if (aoa.length === 0) continue;

    let headerRowIdx = -1;
    const colIndex: Record<string, number> = {};
    for (let i = 0; i < Math.min(aoa.length, 5); i++) {
      const row = (aoa[i] as unknown[]).map((c) => String(c ?? '').trim());
      if (
        row.includes('วันที่') &&
        row.includes('รับเข้า') &&
        row.includes('จ่ายออก') &&
        row.includes('VAT 7%') &&
        row.includes('Total')
      ) {
        headerRowIdx = i;
        row.forEach((h, idx) => {
          if (h) colIndex[h] = idx;
        });
        break;
      }
    }
    if (headerRowIdx === -1) continue;

    let currentGroup: ParsedBillGroup | null = null;
    let currentKey = '';
    const flush = () => {
      if (!currentGroup) return;
      if (currentGroup.amount > 0.01) {
        result.bills.push(currentGroup);
      } else if (currentGroup.amount < -0.01) {
        result.errors.push({
          sheet: sheetName,
          row: currentGroup.sourceRow,
          reason: `ยอดสุทธิติดลบ (${currentGroup.amount.toFixed(2)}) หลังหักส่วนลด ต้องตรวจสอบเอง: ${currentGroup.descriptions.join('; ')}`,
        });
      }
      currentGroup = null;
      currentKey = '';
    };

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const row = aoa[r] as unknown[];
      const rowNum = r + 1;
      if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;

      const get = (name: string) => (colIndex[name] !== undefined ? row[colIndex[name]] : null);
      const date = toDate(get('วันที่'));
      const category = String(get('หมวด') ?? '').trim();
      const house = String(get('หลัง') ?? '').trim();
      const description = String(get('รายรับ-รายจ่าย') ?? '').trim();
      const rec = toNumber(get('รับเข้า'));
      const pay = toNumber(get('จ่ายออก'));
      const methodRaw = get('ชำระแบบ');
      const method = methodRaw ? String(methodRaw).trim() : null;
      const dateRaw = get('วันที่');

      if (!house && !description && rec === null && pay === null) continue;
      // A "TOTAL" summary row at the bottom of the sheet (วันที่ holds the
      // literal text "TOTAL" instead of a date) — not a real transaction.
      if (typeof dateRaw === 'string' && dateRaw.trim().length > 0) continue;

      const isDiscountAdjustment = rec !== null && rec < 0 && description.includes(DISCOUNT_KEYWORD);
      const isCreditNoteAdjustment =
        rec !== null &&
        rec > 0 &&
        (description.includes(CREDIT_NOTE_KEYWORD) || method === CREDIT_NOTE_KEYWORD);
      const isStandaloneIncome =
        rec !== null &&
        rec > 0 &&
        !isCreditNoteAdjustment &&
        house.length > 0 &&
        (!category || category === INCOME_CATEGORY_KEYWORD);

      if (isStandaloneIncome) {
        flush();
        const sig = `${house}|${description}|${rec}`;
        if (!date && seenZeroDateSignatures.has(sig)) {
          result.skipped.push({
            sheet: sheetName,
            row: rowNum,
            reason: 'รายการซ้ำไม่มีวันที่ (พบรายการเดียวกันแล้วในชีทก่อนหน้า)',
          });
          continue;
        }
        if (!date) seenZeroDateSignatures.add(sig);
        result.invoices.push({ date, house, description, amount: rec!, sheetName, sourceRow: rowNum });
        continue;
      }

      if (pay !== null || isDiscountAdjustment || isCreditNoteAdjustment) {
        const delta = isDiscountAdjustment || isCreditNoteAdjustment ? -Math.abs(rec!) : pay!;
        const key = `${date ? date.toISOString() : 'nodate'}|${house}|${category}`;
        if (currentGroup && currentKey === key) {
          currentGroup.amount = round2(currentGroup.amount + delta);
          currentGroup.descriptions.push(description);
        } else {
          flush();
          currentKey = key;
          currentGroup = {
            date,
            house,
            category,
            amount: round2(delta),
            descriptions: [description],
            method,
            sheetName,
            sourceRow: rowNum,
          };
        }
        continue;
      }
      // row has neither a usable รับเข้า nor จ่ายออก value (e.g. a stray note) — skip silently
    }
    flush();
  }

  return result;
}

function sheetInvoiceType(sheetName: string): SupplierInvoiceType | null {
  if (sheetName.startsWith('ค่าของ')) return 'MATERIAL';
  if (sheetName.startsWith('ค่าแรง')) return 'LABOR';
  return null;
}

/**
 * Parses the ค่าของ/ค่าแรง supplier-invoice-register sheets — a separate,
 * cleaner labor-vs-material split than the free-text หมวด categories in the
 * main ledger. These are imported as read-only SupplierInvoiceRecord rows for
 * cost-breakdown reporting only, never as Bills, since the same cash flow is
 * already captured via the main ledger import in parseLedgerWorkbook.
 */
export function parseSupplierInvoices(buffer: Buffer): { invoices: ParsedSupplierInvoice[]; skipped: ParseIssue[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const invoices: ParsedSupplierInvoice[] = [];
  const skipped: ParseIssue[] = [];

  for (const sheetName of workbook.SheetNames) {
    const type = sheetInvoiceType(sheetName);
    if (!type) continue;

    const sheet = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    if (aoa.length === 0) continue;

    const header = (aoa[0] as unknown[]).map((c) => String(c ?? '').trim());
    const colIndex: Record<string, number> = {};
    header.forEach((h, idx) => {
      if (h) colIndex[h] = idx;
    });
    const vatKey = header.find((h) => h.toLowerCase().startsWith('vat'));

    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] as unknown[];
      const rowNum = r + 1;
      if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;

      const get = (name: string) => (colIndex[name] !== undefined ? row[colIndex[name]] : null);
      const invoiceDate = toDate(get('วันที่'));
      const supplierName = String(get('Supplier') ?? '').trim();
      const subtotal = toNumber(get('มูลค่า'));
      const taxAmount = toNumber(vatKey ? row[colIndex[vatKey]] : null) ?? 0;
      const totalAmount = toNumber(get('มูลค่ารวม')) ?? subtotal;

      if (!invoiceDate || !supplierName || subtotal === null || totalAmount === null) {
        skipped.push({
          sheet: sheetName,
          row: rowNum,
          reason: 'ข้อมูลไม่ครบ (ต้องมีวันที่, Supplier, มูลค่า) ข้ามแถวนี้',
        });
        continue;
      }

      const taxIdRaw = get('Tax ID');
      const invoiceNoRaw = get('Invoice No.');

      invoices.push({
        type,
        invoiceDate,
        supplierName,
        taxId: taxIdRaw ? String(taxIdRaw).trim() : null,
        invoiceNumber: invoiceNoRaw ? String(invoiceNoRaw).trim() : null,
        subtotal: round2(subtotal),
        taxAmount: round2(taxAmount),
        totalAmount: round2(totalAmount),
        sourceSheet: sheetName,
        sourceRow: rowNum,
      });
    }
  }

  return { invoices, skipped };
}

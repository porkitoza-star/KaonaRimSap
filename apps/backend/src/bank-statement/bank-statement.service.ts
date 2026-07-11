import { Injectable, UnprocessableEntityException } from '@nestjs/common';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

export type TransactionDirection = 'CREDIT' | 'DEBIT' | 'UNKNOWN';

export interface ParsedTransaction {
  page: number;
  rawLine: string;
  date: string | null;
  description: string;
  amount: number;
  direction: TransactionDirection;
  balance: number | null;
}

export interface BankStatementParseResult {
  pageCount: number;
  transactionCount: number;
  totalCredit: number;
  totalDebit: number;
  transactions: ParsedTransaction[];
  unparsedLines: { page: number; text: string }[];
}

// Matches dd/mm/yy, dd-mm-yyyy, dd.mm.yyyy at the start of a line.
const DATE_RE = /^(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/;
// Matches money-like tokens: 1,234.56 / -1,234.56 / 1234.56
const AMOUNT_RE = /-?[\d,]+\.\d{2}/g;
const CREDIT_KEYWORDS = ['ฝาก', 'รับโอน', 'เงินเดือน', 'โอนเข้า', 'ดอกเบี้ยรับ', 'CREDIT', 'DEPOSIT'];
const DEBIT_KEYWORDS = ['ถอน', 'หัก', 'จ่าย', 'โอนออก', 'ค่าธรรมเนียม', 'ATM', 'DEBIT', 'WITHDRAW'];

function toNumber(token: string): number {
  return Number(token.replace(/,/g, ''));
}

function groupIntoRows(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  const Y_TOLERANCE = 2.5;
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= Y_TOLERANCE);
    if (row) row.push(item);
    else rows.push([item]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

function rowToLine(row: TextItem[]): string {
  let line = '';
  let prevEnd = -Infinity;
  for (const item of row) {
    if (line && item.x - prevEnd > 4) line += ' ';
    line += item.str;
    prevEnd = item.x + item.str.length * 4; // rough width estimate
  }
  return line.replace(/\s+/g, ' ').trim();
}

function classifyDirection(line: string, amount: number, delta: number | null): TransactionDirection {
  const upper = line.toUpperCase();
  if (CREDIT_KEYWORDS.some((k) => upper.includes(k.toUpperCase()))) return 'CREDIT';
  if (DEBIT_KEYWORDS.some((k) => upper.includes(k.toUpperCase()))) return 'DEBIT';
  if (delta !== null) {
    if (Math.abs(delta - amount) < 0.02) return 'CREDIT';
    if (Math.abs(delta + amount) < 0.02) return 'DEBIT';
  }
  return 'UNKNOWN';
}

@Injectable()
export class BankStatementService {
  /**
   * Best-effort parser for password-protected bank statement PDFs. Bank
   * statement layouts vary a lot between banks, so this doesn't assume a
   * specific column layout — it reconstructs each printed row from the
   * PDF's text positions, finds a leading date, then reads the trailing
   * two money-like numbers on the row as (amount, running balance).
   * Direction (money in vs. out) is inferred primarily from the change in
   * the running balance row-to-row, which works regardless of the bank's
   * own wording, with common Thai/English keywords as a fallback.
   */
  async parsePdf(buffer: Buffer, password?: string): Promise<BankStatementParseResult> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    let doc;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        password: password || undefined,
        useSystemFonts: true,
      });
      doc = await loadingTask.promise;
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'PasswordException') {
        throw new UnprocessableEntityException({
          requiresPassword: true,
          message: password
            ? 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
            : 'ไฟล์ PDF นี้มีการเข้ารหัส กรุณาใส่รหัสผ่านเพื่อเปิดไฟล์',
        });
      }
      throw new UnprocessableEntityException('ไม่สามารถอ่านไฟล์ PDF นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ PDF ที่ถูกต้อง');
    }

    const transactions: ParsedTransaction[] = [];
    const unparsedLines: { page: number; text: string }[] = [];
    let runningBalance: number | null = null;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items: TextItem[] = content.items
        .map((it) => {
          const item = it as { str?: string; transform?: number[] };
          return { str: item.str ?? '', x: item.transform?.[4] ?? 0, y: item.transform?.[5] ?? 0 };
        })
        .filter((it) => it.str.trim().length > 0);

      const rows = groupIntoRows(items);
      for (const row of rows) {
        const line = rowToLine(row);
        const dateMatch = line.match(DATE_RE);
        if (!dateMatch) continue;

        const amounts = line.match(AMOUNT_RE);
        if (!amounts || amounts.length === 0) {
          unparsedLines.push({ page: pageNum, text: line });
          continue;
        }

        // A row with only one money-like number (e.g. "ยอดยกมา 10,000.00")
        // is a running/opening balance line, not a transaction — seed the
        // running balance from it and move on instead of misreading that
        // number as a transaction amount.
        if (amounts.length === 1) {
          runningBalance = toNumber(amounts[0]);
          continue;
        }

        const balance = toNumber(amounts[amounts.length - 1]);
        const amountToken = amounts[amounts.length - 2];
        const amount = Math.abs(toNumber(amountToken));

        const delta = runningBalance !== null ? round2(balance - runningBalance) : null;
        const direction = classifyDirection(line, amount, delta);

        const description = line
          .replace(DATE_RE, '')
          .replace(AMOUNT_RE, '')
          .replace(/\s+/g, ' ')
          .trim();

        transactions.push({
          page: pageNum,
          rawLine: line,
          date: dateMatch[1],
          description: description || line,
          amount: round2(amount),
          direction,
          balance,
        });

        runningBalance = balance;
      }
    }

    const totalCredit = round2(
      transactions.filter((t) => t.direction === 'CREDIT').reduce((sum, t) => sum + t.amount, 0),
    );
    const totalDebit = round2(
      transactions.filter((t) => t.direction === 'DEBIT').reduce((sum, t) => sum + t.amount, 0),
    );

    return {
      pageCount: doc.numPages,
      transactionCount: transactions.length,
      totalCredit,
      totalDebit,
      transactions,
      unparsedLines,
    };
  }
}

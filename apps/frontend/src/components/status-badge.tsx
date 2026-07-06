const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'แบบร่าง',
  SENT: 'ออกแล้ว',
  CONFIRMED: 'ยืนยันแล้ว',
  PARTIALLY_PAID: 'จ่ายบางส่วน',
  PAID: 'จ่ายครบแล้ว',
  OVERDUE: 'เกินกำหนด',
  VOID: 'ยกเลิก',
  PENDING_REVIEW: 'รอตรวจสอบ',
  REJECTED: 'ปฏิเสธ',
  PENDING_CFO_APPROVAL: 'รอ CFO อนุมัติ',
  PENDING_CEO_APPROVAL: 'รอ CEO อนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  COMPLETED: 'เสร็จสมบูรณ์',
};

// Fixed status palette per project dataviz guidelines: good/warning/critical/neutral, never reused for identity.
const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-gray-100 text-gray-700',
  PENDING_REVIEW: 'bg-[#fab219]/15 text-[#946600]',
  PENDING_CFO_APPROVAL: 'bg-[#fab219]/15 text-[#946600]',
  PENDING_CEO_APPROVAL: 'bg-[#fab219]/15 text-[#946600]',
  PARTIALLY_PAID: 'bg-[#fab219]/15 text-[#946600]',
  APPROVED: 'bg-[#0ca30c]/15 text-[#0a7a0a]',
  PAID: 'bg-[#0ca30c]/15 text-[#0a7a0a]',
  COMPLETED: 'bg-[#0ca30c]/15 text-[#0a7a0a]',
  OVERDUE: 'bg-[#d03b3b]/15 text-[#a02f2f]',
  VOID: 'bg-[#d03b3b]/15 text-[#a02f2f]',
  REJECTED: 'bg-[#d03b3b]/15 text-[#a02f2f]',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export type CostCenterType = 'PROJECT' | 'HOUSE' | 'OVERHEAD';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type ContactType = 'CUSTOMER' | 'SUPPLIER' | 'CONTRACTOR' | 'BOTH';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type BillStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type DocumentStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
export type PaymentStatus =
  | 'PENDING_CFO_APPROVAL'
  | 'PENDING_CEO_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';
export type PaymentDirection = 'PAY' | 'RECEIVE';

export interface CostCenter {
  id: string;
  name: string;
  type: CostCenterType;
  parentId: string | null;
  isActive: boolean;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isActive: boolean;
}

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface InvoiceLine {
  id: string;
  description: string;
  amount: string;
  costCenterId: string;
  accountId: string;
}

export interface Invoice {
  id: string;
  number: string;
  contactId: string;
  contact?: Contact;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  vatAmount: string;
  totalAmount: string;
  status: InvoiceStatus;
  lines?: InvoiceLine[];
}

export interface BillLine {
  id: string;
  description: string;
  amount: string;
  costCenterId: string;
  accountId: string;
}

export interface Bill {
  id: string;
  number: string;
  contactId: string;
  contact?: Contact;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  vatAmount: string;
  whtAmount: string;
  totalAmount: string;
  status: BillStatus;
  lines?: BillLine[];
}

export interface DocumentRecord {
  id: string;
  fileUrl: string;
  fileType: string;
  ocrRawJson: {
    documentNumber?: string;
    issueDate?: string;
    contactName?: string;
    taxId?: string;
    subtotal?: number;
    vatAmount?: number;
    totalAmount?: number;
  } | null;
  status: DocumentStatus;
  notes: string | null;
  createdAt: string;
}

export interface PaymentAllocation {
  id: string;
  billId: string | null;
  invoiceId: string | null;
  amount: string;
  bill?: Bill;
  invoice?: Invoice;
}

export interface PaymentApproval {
  id: string;
  level: number;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId: string | null;
}

export interface Payment {
  id: string;
  direction: PaymentDirection;
  amount: string;
  method: string | null;
  status: PaymentStatus;
  paymentDate: string | null;
  proposedById: string;
  proposedBy?: { name: string };
  allocations: PaymentAllocation[];
  approvals: PaymentApproval[];
}

export interface WhtCertificate {
  id: string;
  certType: 'PND3' | 'PND53';
  certNumber: string;
  billId: string | null;
  incomeTypeCode: string;
  baseAmount: string;
  whtRate: string;
  whtAmount: string;
  issueDate: string;
  bill?: Bill;
}

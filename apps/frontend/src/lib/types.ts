export type CostCenterType = 'PROJECT' | 'HOUSE' | 'OVERHEAD';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type ContactType = 'CUSTOMER' | 'SUPPLIER' | 'CONTRACTOR' | 'BOTH';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type BillStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type DocumentStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
export type DocumentCategory =
  | 'BILL'
  | 'BOQ'
  | 'PERMIT'
  | 'BLUEPRINT'
  | 'PURCHASE_ORDER'
  | 'PHOTO'
  | 'OTHER';
export type PaymentStatus =
  | 'PENDING_CFO_APPROVAL'
  | 'PENDING_CEO_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';
export type PaymentDirection = 'PAY' | 'RECEIVE';
export type Role = 'CEO' | 'CFO' | 'ACCOUNTANT' | 'PROJECT_MANAGER' | 'VIEWER';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

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
  workCategory?: string | null;
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

export interface OcrBillData {
  documentNumber?: string;
  issueDate?: string;
  contactName?: string;
  taxId?: string;
  subtotal?: number;
  vatAmount?: number;
  totalAmount?: number;
}

export interface OcrBoqItem {
  category?: string;
  name: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

export interface OcrBoqData {
  items: OcrBoqItem[];
}

export interface DocumentRecord {
  id: string;
  fileUrl: string;
  fileType: string;
  category: DocumentCategory;
  ocrRawJson: (OcrBillData & Partial<OcrBoqData>) | null;
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

export type StockTransactionType = 'RECEIVE' | 'USE' | 'ADJUST';

export interface StockTransaction {
  id: string;
  materialItemId: string;
  type: StockTransactionType;
  quantity: string;
  transactionDate: string;
  notes: string | null;
  createdBy?: { name: string };
  createdAt: string;
}

export interface MaterialItem {
  id: string;
  costCenterId: string;
  costCenter?: CostCenter;
  category: string;
  name: string;
  unit: string;
  plannedQuantity: string;
  reorderThreshold: string;
  notes: string | null;
  currentStock: number;
  transactions?: StockTransaction[];
}

export type HouseTemplateType = 'SINGLE_STORY' | 'TWO_STORY';

export interface ConstructionPhase {
  id: string;
  costCenterId: string;
  sequence: number;
  category: string;
  name: string;
  contractValue: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  percentComplete: number;
  notes: string | null;
}

export interface ValueCurvePoint {
  month: string;
  value: number;
  cumulativeValue: number;
  cumulativePercent: number;
}

export interface ConstructionPhasesSummary {
  overallPercent: number;
  allComplete: boolean;
  leadTimeDays: number | null;
  plannedLeadTimeDays: number | null;
  totalContractValue: number;
  monthlyPlan: ValueCurvePoint[];
  monthlyActual: ValueCurvePoint[];
}

export interface GanttTableRow {
  phaseId: string;
  sequence: number;
  category: string;
  name: string;
  contractValue: number;
  percentOfTotal: number;
  percentComplete: number;
  valueByMonth: Record<string, number>;
}

export interface GanttCashFlowPoint {
  month: string;
  cumulativeIncome: number;
  cumulativeCost: number;
  net: number;
}

export interface GanttCumulativePoint {
  month: string;
  value: number;
  percent: number;
}

export interface GanttTable {
  months: string[];
  rows: GanttTableRow[];
  cumulativeValue: GanttCumulativePoint[];
  cashFlow: GanttCashFlowPoint[];
}

export interface ConstructionPhasesResponse {
  phases: ConstructionPhase[];
  summary: ConstructionPhasesSummary;
  ganttTable: GanttTable;
}

export interface PaymentMilestone {
  id: string;
  costCenterId: string;
  sequence: number;
  name: string;
  amount: number;
  plannedDate: string | null;
  actualPaidDate: string | null;
  notes: string | null;
}

export interface PaymentMilestonesSummary {
  totalAmount: number;
  totalReceived: number;
  totalPending: number;
}

export interface PaymentMilestonesResponse {
  milestones: PaymentMilestone[];
  summary: PaymentMilestonesSummary;
}

export interface BoqTemplateSummary {
  id: string;
  name: string;
  description: string;
  baseAreaSqm: number;
  itemCount: number;
  categorySubtotals: { category: string; amount: number }[];
  totalAmount: number;
}

export interface BoqTemplateItemDetail {
  category: string;
  seq: number;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  amount?: number;
}

export interface BoqTemplatePreview {
  templateId: string;
  baseAreaSqm: number;
  targetAreaSqm: number;
  scaleRatio: number;
  items: BoqTemplateItemDetail[];
  categorySubtotals: { category: string; amount: number }[];
  totalAmount: number;
}

export interface BoqTemplateApplyResult {
  createdCount: number;
  totalAmount: number;
}

export type FeasibilityCostCategory = 'LAND' | 'CONSTRUCTION' | 'INFRASTRUCTURE' | 'OVERHEAD' | 'FINANCING';

export interface FeasibilityCostItem {
  id?: string;
  category: FeasibilityCostCategory;
  name: string;
  amount: number;
  notes?: string | null;
}

export interface FeasibilitySummary {
  totalLand: number;
  totalConstruction: number;
  totalInfrastructure: number;
  totalOverhead: number;
  totalFinancing: number;
  totalCost: number;
  totalRevenue: number;
  grossProfit: number;
  ebit: number;
  ebt: number;
  netProfit: number;
  rosPercent: number;
  roiPercent: number;
  roePercent: number | null;
  costPerUnit: number;
  profitPerUnit: number;
  fixedCost: number;
  variableCostPerUnit: number;
  contributionMarginPerUnit: number;
  breakEvenUnits: number | null;
  grossMarginPercent: number;
}

export type EstimatorGrade = 'STANDARD' | 'HIGH' | 'LUXURY' | 'PREMIUM';
export type EstimatorRoofType = 'GABLE' | 'HIP' | 'MONO_PITCH' | 'FLAT';
export type EstimatorFloors = 1 | 2 | 3;

export interface EstimateScenarioInput {
  areaSqm: number;
  floors: EstimatorFloors;
  grade: EstimatorGrade;
  roofType: EstimatorRoofType;
  houseCount?: number;
  sellingPricePerUnit?: number;
  landCost?: number;
  infrastructureCost?: number;
  overheadCost?: number;
  financingCost?: number;
  corporateTaxRatePercent?: number;
}

export interface CostEstimatorCategoryAmount {
  category: string;
  amount: number;
}

export interface CostEstimatorPhasePreview {
  sequence: number;
  category: string;
  name: string;
  estimatedValue: number;
}

export interface CostEstimatorScenario {
  inputs: {
    areaSqm: number;
    floors: EstimatorFloors;
    grade: EstimatorGrade;
    roofType: EstimatorRoofType;
    houseCount: number;
    sellingPricePerUnit: number;
  };
  rateCard: {
    baseRatePerSqm: number;
    gradeMultiplier: number;
    roofMultiplier: number;
    ratePerSqm: number;
  };
  boq: {
    constructionCostPerUnit: number;
    categoryBreakdown: CostEstimatorCategoryAmount[];
    totalConstructionCost: number;
  };
  timeline: {
    estimatedDurationMonths: number;
    phases: CostEstimatorPhasePreview[];
  };
  feasibility: {
    totalRevenue: number;
    directCost: number;
    totalCost: number;
    grossProfit: number;
    operatingProfit: number;
    ebt: number;
    netProfit: number;
    fixedCost: number;
    variableCostPerUnit: number;
    contributionMarginPerUnit: number;
    breakEvenUnits: number | null;
    grossMarginPercent: number;
  };
}

export interface CostEstimatorApplyResult {
  scenario: CostEstimatorScenario;
  boq: { createdCount: number; totalAmount: number };
  phasesCreated: number;
  phasesSkipped: boolean;
  feasibility: unknown;
}

export type DashboardGranularity = 'day' | 'month' | 'year';

export interface IncomeExpensePeriod {
  period: string;
  income: number;
  expense: number;
  net: number;
}

export interface WorkCategoryExpense {
  category: string;
  amount: number;
}

export interface IncomeExpenseSummary {
  granularity: DashboardGranularity;
  series: IncomeExpensePeriod[];
  byWorkCategory: WorkCategoryExpense[];
  totalIncome: number;
  totalExpense: number;
}

export interface LaborMaterialPeriod {
  period: string;
  labor: number;
  material: number;
}

export interface LaborMaterialSummary {
  granularity: DashboardGranularity;
  series: LaborMaterialPeriod[];
  totalLabor: number;
  totalMaterial: number;
  totalLaborFromLedgerKeywords: number;
}

export interface ProjectFeasibility {
  houseCount: number;
  sellingPricePerUnit: number;
  equityAmount: number | null;
  corporateTaxRatePercent: number;
  notes?: string | null;
  costItems: FeasibilityCostItem[];
  summary: FeasibilitySummary;
}

export interface LedgerImportIssue {
  sheet: string;
  row: number;
  reason: string;
}

export interface LedgerImportPreview {
  billCount: number;
  invoiceCount: number;
  totalBillAmount: number;
  totalInvoiceAmount: number;
  costCentersToCreate: { name: string; type: CostCenterType }[];
  skippedCount: number;
  errorCount: number;
  skipped: LedgerImportIssue[];
  errors: LedgerImportIssue[];
  sampleBills: {
    date: string | null;
    house: string;
    category: string;
    amount: number;
    description: string;
  }[];
  sampleInvoices: {
    date: string | null;
    house: string;
    amount: number;
    description: string;
  }[];
  materialInvoiceCount: number;
  laborInvoiceCount: number;
  totalMaterialAmount: number;
  totalLaborAmount: number;
  supplierInvoiceSkippedCount: number;
}

export interface LedgerImportCommitResult {
  createdBills: number;
  createdInvoices: number;
  duplicateBills: number;
  duplicateInvoices: number;
  costCentersCreated: number;
  contactsCreated: number;
  skipped: number;
  createdSupplierInvoices: number;
  duplicateSupplierInvoices: number;
  errors: { context: string; reason: string }[];
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

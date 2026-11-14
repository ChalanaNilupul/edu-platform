import type { ClassStatus } from './classes';

export const BILLING_PERIODS = ['MONTHLY', 'ONE_TIME'] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const billingPeriodLabels: Record<BillingPeriod, string> = {
  MONTHLY: 'Monthly',
  ONE_TIME: 'One-time',
};

export const FEE_PLAN_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export type FeePlanStatus = (typeof FEE_PLAN_STATUSES)[number];

export const feePlanStatusLabels: Record<FeePlanStatus, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

export const feePlanStatusClasses: Record<FeePlanStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

export const FEE_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'VOID'] as const;

export type FeeStatus = (typeof FEE_STATUSES)[number];

export const feeStatusLabels: Record<FeeStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  VOID: 'Void',
};

export const feeStatusClasses: Record<FeeStatus, string> = {
  UNPAID: 'bg-amber-50 text-amber-700',
  PARTIAL: 'bg-blue-50 text-blue-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  VOID: 'bg-slate-100 text-slate-500',
};

export const PAYMENT_METHODS = ['CASH', 'BANK'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK: 'Bank transfer',
};

export type FeePlanRecord = {
  id: string;
  classId: string | null;
  name: string;
  description: string | null;
  amount: string;
  billingPeriod: BillingPeriod;
  dueDay: number;
  status: FeePlanStatus;
  createdAt: string;
  updatedAt: string;
  class: { id: string; name: string; status: ClassStatus } | null;
};

export type StudentFeeRecord = {
  id: string;
  studentId: string;
  feePlanId: string | null;
  classId: string | null;
  description: string;
  amount: string;
  paidAmount: string;
  balance: string;
  status: FeeStatus;
  periodMonth: string | null;
  dueDate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    studentCode: string | null;
    firstName: string;
    lastName: string | null;
    status: string;
  };
  class: { id: string; name: string } | null;
  feePlan: { id: string; name: string } | null;
  paymentCount: number;
};

export type PaymentRecord = {
  id: string;
  studentFeeId: string;
  receiptNo: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
  recordedBy: { membershipId: string; name: string } | null;
};

export type StudentFeeDetail = StudentFeeRecord & { payments: PaymentRecord[] };

export type ReceiptDetail = {
  receiptNo: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  note: string | null;
  recordedAt: string;
  recordedBy: string | null;
  workspace: { id: string; name: string; currency: string };
  student: { id: string; name: string; studentCode: string | null };
  class: { id: string; name: string } | null;
  fee: {
    id: string;
    description: string;
    amount: string;
    paidAmount: string;
    balance: string;
    status: FeeStatus;
    periodMonth: string | null;
    dueDate: string;
  };
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type FinanceOverview = {
  month: string;
  currency: string;
  billed: string;
  collected: string;
  outstanding: string;
  overdue: number;
  counts: { unpaid: number; partial: number; paid: number; void: number };
};

export type FinanceReportClass = {
  id: string | null;
  name: string;
  studentCount: number;
  billed: string;
  collected: string;
  outstanding: string;
};

export type FinanceReportPayment = {
  id: string;
  receiptNo: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  student: { id: string; name: string; studentCode: string | null };
  fee: { id: string; description: string; periodMonth: string | null };
  class: { id: string; name: string } | null;
};

export type FinanceReport = {
  month: string;
  currency: string;
  totals: { billed: string; collected: string; outstanding: string; overdue: number };
  classes: FinanceReportClass[];
  payments: FinanceReportPayment[];
};

export type FeeGenerationResult = {
  planId: string;
  period: string;
  periodLabel: string;
  totalStudents: number;
  created: number;
  skipped: number;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatMoney(value: string, currency: string) {
  const [whole = '0', fraction = ''] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${currency} ${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

export function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  const name = MONTH_NAMES[(month ?? 1) - 1] ?? '';

  return `${name} ${year ?? ''}`.trim();
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function currentMonthValue() {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function todayValue() {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isValidMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

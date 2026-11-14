import { BadRequestException, NotFoundException } from '@nestjs/common';

import { FeeStatus, Prisma, WorkspaceRole } from '../generated/prisma/client.js';

export const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

// Matches DECIMAL(12,2): up to ten integer digits and two decimals.
export const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

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

export function parseAmount(value: string, field = 'amount'): Prisma.Decimal {
  if (!MONEY_PATTERN.test(value)) {
    throw new BadRequestException(`${field} must be a number with up to 2 decimals`);
  }

  const amount = new Prisma.Decimal(value);

  if (amount.lte(0)) {
    throw new BadRequestException(`${field} must be greater than zero`);
  }

  return amount;
}

export function money(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}

export const RECEIPT_COUNTER_KEY = 'payment_receipt';

export function formatReceiptNumber(value: number): string {
  return `RCPT-${String(value).padStart(6, '0')}`;
}

export function balance(amount: Prisma.Decimal, paidAmount: Prisma.Decimal): Prisma.Decimal {
  return amount.minus(paidAmount);
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseCalendarDate(value: string, field = 'date'): Date {
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? Number.NaN;
  const month = parts[1] ?? Number.NaN;
  const day = parts[2] ?? Number.NaN;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${field} must be a real calendar date`);
  }

  return date;
}

export function parseMonth(value: string): Date {
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? Number.NaN;
  const month = parts[1] ?? Number.NaN;

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    throw new BadRequestException('month must be a real YYYY-MM month');
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

export function utcToday(): Date {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function currentMonthStart(): Date {
  const today = utcToday();

  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
}

export function nextMonthStart(month: Date): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
}

export function monthLabel(month: Date): string {
  return `${MONTH_NAMES[month.getUTCMonth()] ?? ''} ${month.getUTCFullYear()}`;
}

export function formatMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export const feePlanSelect = {
  id: true,
  classId: true,
  name: true,
  description: true,
  amount: true,
  billingPeriod: true,
  dueDay: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { id: true, name: true, status: true } },
} satisfies Prisma.FeePlanSelect;

export const studentFeeSelect = {
  id: true,
  studentId: true,
  feePlanId: true,
  classId: true,
  description: true,
  amount: true,
  paidAmount: true,
  status: true,
  periodMonth: true,
  dueDate: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      studentCode: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  },
  class: { select: { id: true, name: true } },
  feePlan: { select: { id: true, name: true } },
  _count: { select: { payments: true } },
} satisfies Prisma.StudentFeeSelect;

export const paymentSelect = {
  id: true,
  studentFeeId: true,
  receiptNumber: true,
  amount: true,
  method: true,
  paidAt: true,
  reference: true,
  note: true,
  createdAt: true,
  recordedBy: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

export const receiptSelect = {
  id: true,
  receiptNumber: true,
  amount: true,
  method: true,
  paidAt: true,
  reference: true,
  note: true,
  createdAt: true,
  recordedBy: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  studentFee: {
    select: {
      id: true,
      description: true,
      amount: true,
      paidAmount: true,
      status: true,
      periodMonth: true,
      dueDate: true,
      student: {
        select: {
          id: true,
          studentCode: true,
          firstName: true,
          lastName: true,
        },
      },
      class: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

export const studentFeeDetailSelect = {
  ...studentFeeSelect,
  payments: {
    select: paymentSelect,
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.StudentFeeSelect;

export type FeePlanRow = Prisma.FeePlanGetPayload<{ select: typeof feePlanSelect }>;
export type StudentFeeRow = Prisma.StudentFeeGetPayload<{ select: typeof studentFeeSelect }>;
export type StudentFeeDetailRow = Prisma.StudentFeeGetPayload<{
  select: typeof studentFeeDetailSelect;
}>;
export type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;
export type ReceiptRow = Prisma.PaymentGetPayload<{ select: typeof receiptSelect }>;

export function toFeePlanView(row: FeePlanRow) {
  return {
    ...row,
    amount: money(row.amount),
  };
}

export function toStudentFeeView(row: StudentFeeRow) {
  const { _count, ...fee } = row;

  return {
    ...fee,
    amount: money(row.amount),
    paidAmount: money(row.paidAmount),
    balance: money(balance(row.amount, row.paidAmount)),
    periodMonth: row.periodMonth ? formatMonth(row.periodMonth) : null,
    dueDate: formatCalendarDate(row.dueDate),
    paymentCount: _count.payments,
  };
}

export function toStudentFeeDetailView(row: StudentFeeDetailRow) {
  return {
    ...toStudentFeeView(row),
    payments: row.payments.map(toPaymentView),
  };
}

export function toPaymentView(row: PaymentRow) {
  const recordedBy = row.recordedBy
    ? {
        membershipId: row.recordedBy.id,
        name: `${row.recordedBy.user.firstName} ${row.recordedBy.user.lastName ?? ''}`.trim(),
      }
    : null;

  return {
    id: row.id,
    studentFeeId: row.studentFeeId,
    receiptNo: formatReceiptNumber(row.receiptNumber),
    amount: money(row.amount),
    method: row.method,
    paidAt: formatCalendarDate(row.paidAt),
    reference: row.reference,
    note: row.note,
    createdAt: row.createdAt,
    recordedBy,
  };
}

export function toReceiptView(
  row: ReceiptRow,
  workspace: { id: string; name: string; currency: string },
) {
  const fee = row.studentFee;
  const studentName = [fee.student.firstName, fee.student.lastName].filter(Boolean).join(' ');
  const recordedBy = row.recordedBy
    ? `${row.recordedBy.user.firstName} ${row.recordedBy.user.lastName ?? ''}`.trim()
    : null;

  return {
    receiptNo: formatReceiptNumber(row.receiptNumber),
    amount: money(row.amount),
    method: row.method,
    paidAt: formatCalendarDate(row.paidAt),
    reference: row.reference,
    note: row.note,
    recordedAt: row.createdAt,
    recordedBy,
    workspace,
    student: {
      id: fee.student.id,
      name: studentName,
      studentCode: fee.student.studentCode,
    },
    class: fee.class,
    fee: {
      id: fee.id,
      description: fee.description,
      amount: money(fee.amount),
      paidAmount: money(fee.paidAmount),
      balance: money(balance(fee.amount, fee.paidAmount)),
      status: fee.status,
      periodMonth: fee.periodMonth ? formatMonth(fee.periodMonth) : null,
      dueDate: formatCalendarDate(fee.dueDate),
    },
  };
}

// Drawn inside the payment transaction so a rolled-back payment also rolls back
// the increment. Numbers are never reused, even after a payment is deleted.
export async function allocateReceiptNumber(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<number> {
  const counter = await tx.workspaceCounter.upsert({
    where: { workspaceId_key: { workspaceId, key: RECEIPT_COUNTER_KEY } },
    create: { workspaceId, key: RECEIPT_COUNTER_KEY, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return counter.value;
}

// Payments are the ledger; the fee row only caches their total so lists and
// filters stay cheap. Recalculate inside the same transaction as any change.
export async function recalculateFeeTotals(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  feeId: string,
): Promise<Prisma.Decimal> {
  const fee = await tx.studentFee.findFirst({
    where: { id: feeId, workspaceId },
    select: { id: true, amount: true, status: true },
  });

  if (!fee) {
    throw new NotFoundException('Fee record not found');
  }

  const totals = await tx.payment.aggregate({
    where: { workspaceId, studentFeeId: feeId },
    _sum: { amount: true },
  });

  const paid = totals._sum.amount ?? new Prisma.Decimal(0);
  const status =
    fee.status === FeeStatus.VOID
      ? FeeStatus.VOID
      : paid.gte(fee.amount)
        ? FeeStatus.PAID
        : paid.gt(0)
          ? FeeStatus.PARTIAL
          : FeeStatus.UNPAID;

  await tx.studentFee.update({
    where: { id: feeId },
    data: { paidAmount: paid, status },
  });

  return paid;
}

'use client';

import { Download } from 'lucide-react';

import { monthLabel, paymentMethodLabels, type FinanceReport } from '@/lib/finance';

function escapeCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50';

export function ReportExportButtons({ report }: { report: FinanceReport }) {
  const currencyLabel = `(${report.currency})`;

  const classRows = [
    [
      'Class',
      'Students billed',
      `Billed ${currencyLabel}`,
      `Collected ${currencyLabel}`,
      `Outstanding ${currencyLabel}`,
    ],
    ...report.classes.map((row) => [
      row.name,
      String(row.studentCount),
      row.billed,
      row.collected,
      row.outstanding,
    ]),
    [
      'Total',
      String(report.classes.reduce((sum, row) => sum + row.studentCount, 0)),
      report.totals.billed,
      report.totals.collected,
      report.totals.outstanding,
    ],
  ];

  const paymentRows = [
    [
      'Receipt',
      'Paid on',
      'Student',
      'Student code',
      'Class',
      'Fee',
      'Period',
      `Amount ${currencyLabel}`,
      'Method',
      'Reference',
    ],
    ...report.payments.map((payment) => [
      payment.receiptNo,
      payment.paidAt,
      payment.student.name,
      payment.student.studentCode ?? '',
      payment.class?.name ?? '',
      payment.fee.description,
      payment.fee.periodMonth ? monthLabel(payment.fee.periodMonth) : 'One-time',
      payment.amount,
      paymentMethodLabels[payment.method],
      payment.reference ?? '',
    ]),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => downloadCsv(`finance-classes-${report.month}.csv`, classRows)}
        className={buttonClass}
      >
        <Download size={15} />
        Classes CSV
      </button>

      <button
        type="button"
        onClick={() => downloadCsv(`finance-receipts-${report.month}.csv`, paymentRows)}
        className={buttonClass}
      >
        <Download size={15} />
        Receipts CSV
      </button>
    </div>
  );
}

export const instant = false;

import Link from 'next/link';
import { ArrowLeft, CalendarDays, Receipt, Wallet } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { ReportExportButtons } from '@/components/report-export-buttons';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import {
  formatMoney,
  isValidMonth,
  monthLabel,
  paymentMethodLabels,
  type FinanceReport,
} from '@/lib/finance';
import { canManageFinance, getWorkspaceSession } from '@/lib/workspace-session';

type FinanceReportPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function FinanceReportPage({ params, searchParams }: FinanceReportPageProps) {
  const { workspaceId } = await params;
  const queryParams = await searchParams;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell
        user={user}
        activePage="Finance"
        studentsHref={`/workspaces/${workspaceId}/students`}
      >
        <WorkspaceAccessNotice />
      </DashboardShell>
    );
  }

  if (!canManageFinance(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Finance"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="Finance is restricted"
          message="Only owners, administrators and branch managers can view finance reports."
        />
      </DashboardShell>
    );
  }

  const requestedMonth = readParam(queryParams.month);
  const month = isValidMonth(requestedMonth) ? requestedMonth : '';
  const query = month ? `?month=${month}` : '';

  const response = await fetch(
    `${apiUrl}/workspaces/${workspace.id}/finance/reports/monthly${query}`,
    { headers, cache: 'no-store' },
  );

  if (!response.ok) {
    throw new Error('Unable to load the finance report.');
  }

  const report = (await response.json()) as FinanceReport;
  const currency = report.currency;
  const monthName = monthLabel(report.month);

  const summaryCards = [
    {
      label: `Billed in ${monthName}`,
      value: formatMoney(report.totals.billed, currency),
      hint: 'Active fee records for this month',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: `Collected in ${monthName}`,
      value: formatMoney(report.totals.collected, currency),
      hint: 'Cash and bank payments received',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Outstanding',
      value: formatMoney(report.totals.outstanding, currency),
      hint: 'Current balance across all fee records',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Overdue fees',
      value: String(report.totals.overdue),
      hint: 'Past due date with a balance',
      color: 'bg-red-50 text-red-600',
    },
  ];

  return (
    <DashboardShell
      user={user}
      activePage="Finance"
      studentsHref={`/workspaces/${workspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/finance`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to finance
        </Link>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">{workspace.name}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Monthly finance report
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Billing, collections and outstanding balances per class for {monthName}. All amounts
              in {currency}.
            </p>
          </div>

          <form method="get" className="flex items-end gap-2">
            <div>
              <label
                htmlFor="report-month"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Report month
              </label>
              <input
                id="report-month"
                type="month"
                name="month"
                defaultValue={month || report.month}
                className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}
              >
                <Wallet size={20} />
              </div>
            </div>

            <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Collections by class</h2>
            <p className="mt-1 text-sm text-slate-500">
              Billed counts this month&apos;s fees. Collected counts payments received this month.
              Outstanding is the current balance.
            </p>
          </div>

          <ReportExportButtons report={report} />
        </div>

        {report.classes.length === 0 ? (
          <div className="mt-6 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <CalendarDays size={28} className="text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              Nothing billed for {monthName}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Generate fee records from a plan to populate this report.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Students billed</th>
                  <th className="px-3 py-3">Billed</th>
                  <th className="px-3 py-3">Collected</th>
                  <th className="px-3 py-3">Outstanding</th>
                </tr>
              </thead>

              <tbody>
                {report.classes.map((row) => (
                  <tr key={row.id ?? 'no-class'} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-3 py-3 text-slate-700">{row.studentCount}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {formatMoney(row.billed, currency)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {formatMoney(row.collected, currency)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {formatMoney(row.outstanding, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
                  <td className="px-3 py-3">Total</td>
                  <td className="px-3 py-3">
                    {report.classes.reduce((sum, row) => sum + row.studentCount, 0)}
                  </td>
                  <td className="px-3 py-3">{formatMoney(report.totals.billed, currency)}</td>
                  <td className="px-3 py-3">{formatMoney(report.totals.collected, currency)}</td>
                  <td className="px-3 py-3">{formatMoney(report.totals.outstanding, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Receipts issued in {monthName}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every payment recorded this month, newest first.
          </p>
        </div>

        {report.payments.length === 0 ? (
          <div className="mt-6 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <Receipt size={28} className="text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">No payments this month</p>
            <p className="mt-1 text-xs text-slate-500">
              Record a payment on a fee record to issue a receipt.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Receipt</th>
                  <th className="px-3 py-3">Paid on</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Fee</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Method</th>
                </tr>
              </thead>

              <tbody>
                {report.payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <Link
                        href={`/workspaces/${workspace.id}/finance/receipts/${payment.id}`}
                        className="font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        {payment.receiptNo}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{payment.paidAt}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {payment.student.name}
                      {payment.student.studentCode ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {payment.student.studentCode}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <Link
                        href={`/workspaces/${workspace.id}/finance/fees/${payment.fee.id}`}
                        className="transition hover:text-blue-600"
                      >
                        {payment.fee.description}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {payment.fee.periodMonth ? monthLabel(payment.fee.periodMonth) : 'One-time'}
                        {payment.class ? ` · ${payment.class.name}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {formatMoney(payment.amount, currency)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {paymentMethodLabels[payment.method]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

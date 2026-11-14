export const instant = false;

import Link from 'next/link';
import { ArrowLeft, Receipt } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { FeeActions } from '@/components/fee-actions';
import { PaymentActions } from '@/components/payment-actions';
import { RecordPaymentForm } from '@/components/record-payment-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import {
  feeStatusClasses,
  feeStatusLabels,
  formatMoney,
  monthLabel,
  paymentMethodLabels,
  type StudentFeeDetail,
} from '@/lib/finance';
import { canManageFinance, getWorkspaceSession } from '@/lib/workspace-session';

type FeeDetailPageProps = {
  params: Promise<{ workspaceId: string; feeId: string }>;
};

export default async function FeeDetailPage({ params }: FeeDetailPageProps) {
  const { workspaceId, feeId } = await params;
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
          message="Only owners, administrators and branch managers can view fee records."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(`${apiUrl}/workspaces/${workspace.id}/finance/fees/${feeId}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Finance"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Fee record not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This record may have been removed or the link is incorrect.
          </p>
          <Link
            href={`/workspaces/${workspace.id}/finance`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to finance
          </Link>
        </section>
      </DashboardShell>
    );
  }

  if (!response.ok) {
    throw new Error('Unable to load the fee record.');
  }

  const fee = (await response.json()) as StudentFeeDetail;
  const currency = workspace.currency;
  const studentName = [fee.student.firstName, fee.student.lastName].filter(Boolean).join(' ');

  const facts = [
    { label: 'Amount', value: formatMoney(fee.amount, currency) },
    { label: 'Paid', value: formatMoney(fee.paidAmount, currency) },
    { label: 'Balance', value: formatMoney(fee.balance, currency) },
    { label: 'Due date', value: fee.dueDate },
    { label: 'Period', value: fee.periodMonth ? monthLabel(fee.periodMonth) : 'One-time charge' },
    { label: 'Plan', value: fee.feePlan?.name ?? 'Manual record' },
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">{workspace.name}</p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {fee.description}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              <Link
                href={`/workspaces/${workspace.id}/students/${fee.student.id}`}
                className="font-semibold text-blue-600 transition hover:text-blue-700"
              >
                {studentName}
              </Link>
              {fee.student.studentCode ? ` · ${fee.student.studentCode}` : ''}
              {fee.class ? ` · ${fee.class.name}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${feeStatusClasses[fee.status]}`}
            >
              {feeStatusLabels[fee.status]}
            </span>

            <FeeActions
              workspaceId={workspace.id}
              feeId={fee.id}
              description={fee.description}
              status={fee.status}
              paymentCount={fee.payments.length}
            />
          </div>
        </div>
      </div>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3 xl:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {fact.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{fact.value}</p>
          </div>
        ))}
      </section>

      {fee.note ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          {fee.note}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-3">
          <h2 className="text-lg font-bold text-slate-900">Payment history</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every cash and bank payment recorded against this fee.
          </p>

          {fee.payments.length === 0 ? (
            <div className="mt-6 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
              <Receipt size={28} className="text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">No payments yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Record a payment to start tracking the balance.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3">Paid on</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-3 py-3">Recorded by</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>

                <tbody>
                  {fee.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-slate-100">
                      <td className="px-3 py-3 text-slate-700">{payment.paidAt}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {formatMoney(payment.amount, currency)}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {paymentMethodLabels[payment.method]}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {payment.reference ?? '—'}
                        {payment.note ? (
                          <p className="mt-0.5 text-xs text-slate-500">{payment.note}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {payment.recordedBy?.name ?? 'System'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <PaymentActions
                          workspaceId={workspace.id}
                          feeId={fee.id}
                          paymentId={payment.id}
                          amount={formatMoney(payment.amount, currency)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Record a payment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Payments update the cached balance in the same transaction.
          </p>

          <div className="mt-5">
            {fee.status === 'VOID' ? (
              <RecordPaymentForm
                workspaceId={workspace.id}
                feeId={fee.id}
                currency={currency}
                outstanding={fee.balance}
                disabled
              />
            ) : fee.balance === '0.00' ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                This fee is fully paid. Delete a payment to reopen the balance.
              </p>
            ) : (
              <RecordPaymentForm
                workspaceId={workspace.id}
                feeId={fee.id}
                currency={currency}
                outstanding={fee.balance}
              />
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

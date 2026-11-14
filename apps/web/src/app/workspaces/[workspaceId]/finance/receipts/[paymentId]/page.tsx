export const instant = false;

import Link from 'next/link';
import { ArrowLeft, FileWarning } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { PrintReceiptButton } from '@/components/print-receipt-button';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import { formatMoney, monthLabel, paymentMethodLabels, type ReceiptDetail } from '@/lib/finance';
import { canManageFinance, getWorkspaceSession } from '@/lib/workspace-session';

type ReceiptPageProps = {
  params: Promise<{ workspaceId: string; paymentId: string }>;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Colombo',
  });
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { workspaceId, paymentId } = await params;
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
          message="Only owners, administrators and branch managers can view receipts."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(
    `${apiUrl}/workspaces/${workspace.id}/finance/payments/${paymentId}/receipt`,
    {
      headers,
      cache: 'no-store',
    },
  );

  if (response.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Finance"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <FileWarning size={28} className="text-slate-400" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">Receipt not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This payment may have been deleted, or the link is incorrect.
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
    throw new Error('Unable to load the receipt.');
  }

  const receipt = (await response.json()) as ReceiptDetail;
  const currency = receipt.workspace.currency;

  const facts = [
    { label: 'Paid on', value: receipt.paidAt },
    { label: 'Method', value: paymentMethodLabels[receipt.method] },
    { label: 'Recorded by', value: receipt.recordedBy ?? 'System' },
    { label: 'Reference', value: receipt.reference ?? '—' },
  ];

  const feeFacts = [
    { label: 'Fee total', value: formatMoney(receipt.fee.amount, currency) },
    { label: 'Paid to date', value: formatMoney(receipt.fee.paidAmount, currency) },
    { label: 'Current balance', value: formatMoney(receipt.fee.balance, currency) },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/workspaces/${workspace.id}/finance/fees/${receipt.fee.id}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
            >
              <ArrowLeft size={16} />
              Back to fee record
            </Link>
            <Link
              href={`/workspaces/${workspace.id}/finance`}
              className="text-sm font-medium text-slate-500 transition hover:text-blue-600"
            >
              Finance
            </Link>
          </div>

          <PrintReceiptButton />
        </div>

        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                {receipt.workspace.name}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Payment receipt
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {receipt.class ? `${receipt.class.name} · ` : ''}
                {receipt.fee.description}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Receipt number
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">{receipt.receiptNo}</p>
              <p className="mt-1 text-xs text-slate-500">
                Issued {formatTimestamp(receipt.recordedAt)}
              </p>
            </div>
          </header>

          <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Student
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">{receipt.student.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {receipt.student.studentCode
                  ? `Student code ${receipt.student.studentCode}`
                  : 'No student code'}
              </p>
              <p className="text-sm text-slate-500">
                {receipt.class?.name ?? 'Not assigned to a class'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fee</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {receipt.fee.description}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {receipt.fee.periodMonth ? monthLabel(receipt.fee.periodMonth) : 'One-time charge'}
              </p>
              <p className="text-sm text-slate-500">Due {receipt.fee.dueDate}</p>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 border-b border-slate-200 py-6 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {fact.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{fact.value}</p>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-4 border-b border-slate-200 py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Amount received
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                {formatMoney(receipt.amount, currency)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:text-right">
              {feeFacts.map((fact) => (
                <div key={fact.label}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {fact.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{fact.value}</p>
                </div>
              ))}
            </div>
          </section>

          {receipt.note ? (
            <p className="border-b border-slate-200 py-4 text-sm text-slate-600">{receipt.note}</p>
          ) : null}

          <footer className="pt-6 text-xs text-slate-500">
            <p>
              This receipt confirms the payment recorded above against the student fee. The balance
              shown is the current balance of that fee record.
            </p>
            <p className="mt-2">Keep this receipt for your records.</p>
          </footer>
        </article>
      </div>
    </main>
  );
}

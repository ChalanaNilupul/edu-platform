export const instant = false;

import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Wallet,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { FeePlanActions } from '@/components/fee-plan-actions';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { ClassListResponse } from '@/lib/classes';
import {
  FEE_STATUSES,
  billingPeriodLabels,
  feePlanStatusClasses,
  feePlanStatusLabels,
  feeStatusClasses,
  feeStatusLabels,
  formatMoney,
  isValidMonth,
  monthLabel,
  type FeePlanRecord,
  type FeeStatus,
  type FinanceOverview,
  type PaginatedResponse,
  type StudentFeeRecord,
} from '@/lib/finance';
import { canManageFinance, getWorkspaceSession } from '@/lib/workspace-session';

const PAGE_SIZE = 20;

type FinancePageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseFeeStatus(value: string): FeeStatus | '' {
  return (FEE_STATUSES as readonly string[]).includes(value) ? (value as FeeStatus) : '';
}

export default async function FinancePage({ params, searchParams }: FinancePageProps) {
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
          message="Only owners, administrators and branch managers can view fee plans, fee records and payments."
        />
      </DashboardShell>
    );
  }

  const currentWorkspace = workspace;
  const search = readParam(queryParams.search);
  const status = parseFeeStatus(readParam(queryParams.status));
  const month = isValidMonth(readParam(queryParams.month)) ? readParam(queryParams.month) : '';
  const planId = readParam(queryParams.planId);
  const classId = readParam(queryParams.classId);
  const rawPage = Number(readParam(queryParams.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const feeParams = new URLSearchParams();

  if (search) {
    feeParams.set('search', search);
  }

  if (status) {
    feeParams.set('status', status);
  }

  if (month) {
    feeParams.set('month', month);
  }

  if (planId) {
    feeParams.set('planId', planId);
  }

  if (classId) {
    feeParams.set('classId', classId);
  }

  feeParams.set('page', String(page));
  feeParams.set('pageSize', String(PAGE_SIZE));

  const overviewParams = new URLSearchParams();

  if (month) {
    overviewParams.set('month', month);
  }

  const [overviewResponse, plansResponse, classesResponse, feesResponse] = await Promise.all([
    fetch(
      `${apiUrl}/workspaces/${currentWorkspace.id}/finance/overview${
        overviewParams.size > 0 ? `?${overviewParams.toString()}` : ''
      }`,
      { headers, cache: 'no-store' },
    ),
    fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/finance/plans?pageSize=100`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/classes?pageSize=100`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/finance/fees?${feeParams.toString()}`, {
      headers,
      cache: 'no-store',
    }),
  ]);

  if (!overviewResponse.ok || !plansResponse.ok || !classesResponse.ok || !feesResponse.ok) {
    throw new Error('Unable to load the finance records.');
  }

  const overview = (await overviewResponse.json()) as FinanceOverview;
  const plans = (await plansResponse.json()) as PaginatedResponse<FeePlanRecord>;
  const classes = (await classesResponse.json()) as ClassListResponse;
  const fees = (await feesResponse.json()) as PaginatedResponse<StudentFeeRecord>;

  const currency = overview.currency;

  function feesHref(targetPage: number) {
    const next = new URLSearchParams();

    if (search) {
      next.set('search', search);
    }

    if (status) {
      next.set('status', status);
    }

    if (month) {
      next.set('month', month);
    }

    if (planId) {
      next.set('planId', planId);
    }

    if (classId) {
      next.set('classId', classId);
    }

    if (targetPage > 1) {
      next.set('page', String(targetPage));
    }

    const suffix = next.toString();

    return `/workspaces/${currentWorkspace.id}/finance${suffix ? `?${suffix}` : ''}`;
  }

  const firstItem = fees.total === 0 ? 0 : (fees.page - 1) * fees.pageSize + 1;
  const lastItem = Math.min(fees.page * fees.pageSize, fees.total);
  const hasPrevious = fees.page > 1;
  const hasNext = fees.page < fees.totalPages;

  const summaryCards = [
    {
      label: `Billed in ${monthLabel(overview.month)}`,
      value: formatMoney(overview.billed, currency),
      hint: 'Active fee records for this month',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: `Collected in ${monthLabel(overview.month)}`,
      value: formatMoney(overview.collected, currency),
      hint: 'Cash and bank payments received',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Outstanding',
      value: formatMoney(overview.outstanding, currency),
      hint: 'Unpaid or partially paid balances',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Overdue fees',
      value: String(overview.overdue),
      hint: 'Past due date with a balance',
      color: 'bg-red-50 text-red-600',
    },
  ];

  return (
    <DashboardShell
      user={user}
      activePage="Finance"
      studentsHref={`/workspaces/${currentWorkspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href="/workspaces"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to workspaces
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">Finance management</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Finance
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Fee plans, student balances and payments for {currentWorkspace.name}. All amounts in{' '}
          {currency}.
        </p>

        <Link
          href={`/workspaces/${currentWorkspace.id}/finance/reports`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <BarChart3 size={16} />
          Monthly report
        </Link>
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

      <section className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-xs font-medium text-slate-600 shadow-sm">
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
          Unpaid {overview.counts.unpaid}
        </span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
          Partial {overview.counts.partial}
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
          Paid {overview.counts.paid}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
          Void {overview.counts.void}
        </span>

        <form method="get" className="ml-auto flex items-center gap-2">
          <label htmlFor="overview-month" className="text-slate-500">
            Summary month
          </label>
          <input
            id="overview-month"
            type="month"
            name="month"
            defaultValue={month || overview.month}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fee plans</h2>
            <p className="mt-1 text-sm text-slate-500">
              Generate monthly records for every actively enrolled student.
            </p>
          </div>

          <Link
            href={`/workspaces/${currentWorkspace.id}/finance/plans/new`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus size={16} />
            New plan
          </Link>
        </div>

        {plans.items.length === 0 ? (
          <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <FileText size={30} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No fee plans yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create a plan to bill a class or the whole workspace each month.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Applies to</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Schedule</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {plans.items.map((plan) => (
                  <tr
                    key={plan.id}
                    className="border-t border-slate-100 align-top transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-900">{plan.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {plan.description ?? 'No description'}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {plan.class ? plan.class.name : 'All active classes'}
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-900">
                      {formatMoney(plan.amount, currency)}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      <p>{billingPeriodLabels[plan.billingPeriod]}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {plan.billingPeriod === 'MONTHLY'
                          ? `Due day ${plan.dueDay}`
                          : 'One-time charge'}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${feePlanStatusClasses[plan.status]}`}
                      >
                        {feePlanStatusLabels[plan.status]}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            href={`/workspaces/${currentWorkspace.id}/finance/plans/${plan.id}/edit`}
                            className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/workspaces/${currentWorkspace.id}/finance?planId=${plan.id}`}
                            className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                          >
                            View fees
                          </Link>
                        </div>

                        <FeePlanActions
                          workspaceId={currentWorkspace.id}
                          planId={plan.id}
                          planName={plan.name}
                          status={plan.status}
                          billingPeriod={plan.billingPeriod}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fee records</h2>
            <p className="mt-1 text-sm text-slate-500">
              Every generated or manual fee with its current balance.
            </p>
          </div>

          <Link
            href={`/workspaces/${currentWorkspace.id}/finance/fees/new`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Plus size={16} />
            New fee record
          </Link>
        </div>

        {/* <form method="get" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <div className="relative lg:col-span-2">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search student name or code"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All statuses</option>
            {FEE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {feeStatusLabels[option]}
              </option>
            ))}
          </select>

          <select
            name="planId"
            defaultValue={planId}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All plans</option>
            {plans.items.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>

          <select
            name="classId"
            defaultValue={classId}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All classes</option>
            {classes.items.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row xl:col-span-3">
            <input
              type="month"
              name="month"
              defaultValue={month}
              aria-label="Billing month"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Apply
            </button>
          </div>
        </form> */}

        <form
          method="get"
          className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12"
        >
          {/* Search */}
          <div className="relative min-w-0 sm:col-span-2 xl:col-span-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search student name or code"
              className="w-full min-w-0 rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Status */}
          <select
            name="status"
            defaultValue={status}
            className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 xl:col-span-2"
          >
            <option value="">All statuses</option>
            {FEE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {feeStatusLabels[option]}
              </option>
            ))}
          </select>

          {/* Plan */}
          <select
            name="planId"
            defaultValue={planId}
            className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 xl:col-span-2"
          >
            <option value="">All plans</option>
            {plans.items.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>

          {/* Class */}
          <select
            name="classId"
            defaultValue={classId}
            className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 xl:col-span-2"
          >
            <option value="">All classes</option>
            {classes.items.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>

          {/* Month + Apply */}
          <div className="flex min-w-0 gap-2 sm:col-span-2 xl:col-span-3">
            <input
              type="month"
              name="month"
              defaultValue={month}
              aria-label="Billing month"
              className="w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Apply
            </button>
          </div>
        </form>

        {fees.items.length === 0 ? (
          <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <AlertCircle size={30} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No fee records found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search || status || month || planId || classId
                ? 'Try a different search or clear the filters.'
                : 'Generate fees from a monthly plan or add a manual record.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Fee</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Paid</th>
                  <th className="px-3 py-3">Balance</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>

              <tbody>
                {fees.items.map((fee) => (
                  <tr
                    key={fee.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-900">
                        {[fee.student.firstName, fee.student.lastName].filter(Boolean).join(' ')}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fee.student.studentCode ?? 'No code'}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-slate-800">{fee.description}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fee.periodMonth ? monthLabel(fee.periodMonth) : 'One-time'}
                        {fee.class ? ` · ${fee.class.name}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-700">{fee.dueDate}</td>
                    <td className="px-3 py-4 font-semibold text-slate-900">
                      {formatMoney(fee.amount, currency)}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {formatMoney(fee.paidAmount, currency)}
                      <span className="ml-1 text-xs text-slate-400">
                        ({fee.paymentCount} {fee.paymentCount === 1 ? 'payment' : 'payments'})
                      </span>
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-900">
                      {formatMoney(fee.balance, currency)}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${feeStatusClasses[fee.status]}`}
                      >
                        {feeStatusLabels[fee.status]}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <Link
                        href={`/workspaces/${currentWorkspace.id}/finance/fees/${fee.id}`}
                        className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {firstItem}–{lastItem} of {fees.total}
          </p>

          <div className="flex items-center gap-2">
            {hasPrevious ? (
              <Link
                href={feesHref(fees.page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-2 text-slate-300">
                <ChevronLeft size={16} />
                Previous
              </span>
            )}

            <span className="px-2 text-xs font-medium text-slate-500">
              Page {fees.page} of {Math.max(fees.totalPages, 1)}
            </span>

            {hasNext ? (
              <Link
                href={feesHref(fees.page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Next
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-2 text-slate-300">
                Next
                <ChevronRight size={16} />
              </span>
            )}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

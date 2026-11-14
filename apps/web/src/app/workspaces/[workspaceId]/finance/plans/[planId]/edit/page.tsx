export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { FeePlanForm } from '@/components/fee-plan-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { ClassListResponse } from '@/lib/classes';
import type { FeePlanRecord } from '@/lib/finance';
import { canManageFinance, getWorkspaceSession } from '@/lib/workspace-session';

type EditFeePlanPageProps = {
  params: Promise<{ workspaceId: string; planId: string }>;
};

export default async function EditFeePlanPage({ params }: EditFeePlanPageProps) {
  const { workspaceId, planId } = await params;
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
          message="Only owners, administrators and branch managers can edit fee plans."
        />
      </DashboardShell>
    );
  }

  const [planResponse, classesResponse] = await Promise.all([
    fetch(`${apiUrl}/workspaces/${workspace.id}/finance/plans/${planId}`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/workspaces/${workspace.id}/classes?pageSize=100`, {
      headers,
      cache: 'no-store',
    }),
  ]);

  if (planResponse.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Finance"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Fee plan not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This plan may have been deleted or the link is incorrect.
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

  if (!planResponse.ok || !classesResponse.ok) {
    throw new Error('Unable to load the fee plan.');
  }

  const plan = (await planResponse.json()) as FeePlanRecord;
  const classes = (await classesResponse.json()) as ClassListResponse;

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

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Edit {plan.name}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Changes apply to future generations only; existing fee records keep their amounts.
        </p>
      </div>

      <FeePlanForm
        workspaceId={workspace.id}
        currency={workspace.currency}
        classes={classes.items}
        initial={plan}
      />
    </DashboardShell>
  );
}

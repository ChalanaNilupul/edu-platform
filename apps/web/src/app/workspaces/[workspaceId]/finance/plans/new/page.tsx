export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { FeePlanForm } from '@/components/fee-plan-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { ClassListResponse } from '@/lib/classes';
import { canManageFinance, getWorkspaceSession } from '@/lib/workspace-session';

type NewFeePlanPageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function NewFeePlanPage({ params }: NewFeePlanPageProps) {
  const { workspaceId } = await params;
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
          message="Only owners, administrators and branch managers can create fee plans."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(`${apiUrl}/workspaces/${workspace.id}/classes?pageSize=100`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to load the classes.');
  }

  const classes = (await response.json()) as ClassListResponse;

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
          New fee plan
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Plans define the recurring amount and due date for a class or the whole workspace.
        </p>
      </div>

      <FeePlanForm
        workspaceId={workspace.id}
        currency={workspace.currency}
        classes={classes.items}
      />
    </DashboardShell>
  );
}

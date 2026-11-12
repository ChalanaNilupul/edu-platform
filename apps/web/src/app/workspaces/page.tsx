export const instant = false;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceManager } from '@/components/workspace-manager';

export default async function WorkspacesPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('edu_session')?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: {
      Cookie: `edu_session=${sessionToken}`,
    },
    cache: 'no-store',
  });

  if (response.status === 401) {
    redirect('/login');
  }

  if (!response.ok) {
    throw new Error('Unable to verify your EduPlatform session.');
  }

  const data = await response.json();

  return (
    <DashboardShell
      user={data.user}
      activePage="Workspaces"
      studentsHref={
        data.activeWorkspaceId ? `/workspaces/${data.activeWorkspaceId}/students` : undefined
      }
    >
      <div className="mb-8">
        <p className="text-sm font-medium text-blue-600">Workspace management</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Your workspaces
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Create and manage your teaching or institute workspaces. You can switch between workspaces
          whenever you need.
        </p>
      </div>

      <WorkspaceManager initialActiveWorkspaceId={data.activeWorkspaceId} />
    </DashboardShell>
  );
}

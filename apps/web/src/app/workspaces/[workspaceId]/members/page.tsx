export const instant = false;

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { MembersManager } from '@/components/members-manager';
import type { Invitation, Member } from '@/components/members-manager';

type WorkspaceRole = 'OWNER' | 'ADMIN' | 'BRANCH_MANAGER' | 'TEACHER' | 'STUDENT' | 'PARENT';

type SessionUser = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  emailVerifiedAt: string | null;
};

type WorkspaceResponse = {
  id: string;
  name: string;
  type: 'TEACHER' | 'INSTITUTE';
  role: WorkspaceRole;
};

type MembersPageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceMembersPage({ params }: MembersPageProps) {
  const { workspaceId } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('edu_session')?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const headers = { Cookie: `edu_session=${sessionToken}` };

  const [sessionResponse, workspaceResponse] = await Promise.all([
    fetch(`${apiUrl}/auth/me`, { headers, cache: 'no-store' }),
    fetch(`${apiUrl}/workspaces/${workspaceId}`, { headers, cache: 'no-store' }),
  ]);

  if (sessionResponse.status === 401) {
    redirect('/login');
  }

  if (!sessionResponse.ok) {
    throw new Error('Unable to verify your EduPlatform session.');
  }

  const session = (await sessionResponse.json()) as { user: SessionUser };

  if (workspaceResponse.status === 403) {
    return (
      <DashboardShell
        user={session.user}
        activePage="Workspaces"
        studentsHref={`/workspaces/${workspaceId}/students`}
      >
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="flex items-center gap-2 font-semibold text-amber-800">
            <ShieldAlert size={20} />
            You do not have access to this workspace
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Ask a workspace administrator to invite you, or switch to a workspace you belong to.
          </p>
          <Link
            href="/workspaces"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            <ArrowLeft size={16} />
            Back to workspaces
          </Link>
        </section>
      </DashboardShell>
    );
  }

  if (workspaceResponse.status === 404) {
    return (
      <DashboardShell
        user={session.user}
        activePage="Workspaces"
        studentsHref={`/workspaces/${workspaceId}/students`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Workspace not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This workspace may have been deleted or the link is incorrect.
          </p>
          <Link
            href="/workspaces"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to workspaces
          </Link>
        </section>
      </DashboardShell>
    );
  }

  if (!workspaceResponse.ok) {
    throw new Error('Unable to load the workspace.');
  }

  const workspace = (await workspaceResponse.json()) as WorkspaceResponse;
  const canManage = workspace.role === 'OWNER' || workspace.role === 'ADMIN';

  let initialMembers: Member[] = [];
  let initialInvitations: Invitation[] = [];

  if (canManage) {
    const [membersResponse, invitationsResponse] = await Promise.all([
      fetch(`${apiUrl}/workspaces/${workspace.id}/members`, { headers, cache: 'no-store' }),
      fetch(`${apiUrl}/workspaces/${workspace.id}/invitations`, { headers, cache: 'no-store' }),
    ]);

    if (!membersResponse.ok || !invitationsResponse.ok) {
      throw new Error('Unable to load workspace members.');
    }

    initialMembers = (await membersResponse.json()) as Member[];
    initialInvitations = (await invitationsResponse.json()) as Invitation[];
  }

  return (
    <DashboardShell
      user={session.user}
      activePage="Workspaces"
      studentsHref={`/workspaces/${workspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href="/workspaces"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to workspaces
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">Workspace members</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {workspace.name}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Invite people, assign roles and keep access to this workspace under control.
        </p>
      </div>

      {canManage ? (
        <MembersManager
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          actorRole={workspace.role}
          currentUserId={session.user.id}
          initialMembers={initialMembers}
          initialInvitations={initialInvitations}
        />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="font-semibold text-slate-900">You have read-only access</p>
          <p className="mt-2 text-sm text-slate-500">
            Only workspace owners and administrators can manage members and invitations.
          </p>
        </section>
      )}
    </DashboardShell>
  );
}

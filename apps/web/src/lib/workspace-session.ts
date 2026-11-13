import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'BRANCH_MANAGER' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  emailVerifiedAt: string | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  type: 'TEACHER' | 'INSTITUTE';
  role: WorkspaceRole;
};

export type WorkspaceSession = {
  apiUrl: string;
  headers: { Cookie: string };
  user: SessionUser;
  workspace: WorkspaceSummary | null;
  workspaceStatus: number;
};

export async function getWorkspaceSession(workspaceId: string): Promise<WorkspaceSession> {
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

  const workspace = workspaceResponse.ok
    ? ((await workspaceResponse.json()) as WorkspaceSummary)
    : null;

  return {
    apiUrl,
    headers,
    user: session.user,
    workspace,
    workspaceStatus: workspaceResponse.status,
  };
}

export function canManageStudents(role: WorkspaceRole) {
  return role === 'OWNER' || role === 'ADMIN' || role === 'BRANCH_MANAGER';
}

export function canViewStudents(role: WorkspaceRole) {
  return canManageStudents(role) || role === 'TEACHER';
}

export function canManageClasses(role: WorkspaceRole) {
  return canManageStudents(role);
}

export function canViewClasses(role: WorkspaceRole) {
  return canViewStudents(role);
}

export function canManageTeachers(role: WorkspaceRole) {
  return canManageStudents(role);
}

export function canViewTeachers(role: WorkspaceRole) {
  return canViewStudents(role);
}

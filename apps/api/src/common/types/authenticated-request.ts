import type { MembershipStatus, WorkspaceRole } from '../../generated/prisma/client.js';

export type AuthenticatedUser = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  emailVerifiedAt: Date | null;
};

export type WorkspaceMembershipContext = {
  id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
};

export type AuthenticatedRequest = {
  user?: AuthenticatedUser;
  sessionId?: string;
  activeWorkspaceId?: string | null;
  workspaceMembership?: WorkspaceMembershipContext;
  cookies?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  params: Record<string, string>;
};

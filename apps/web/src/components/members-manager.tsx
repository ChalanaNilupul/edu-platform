'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type WorkspaceRole = 'OWNER' | 'ADMIN' | 'BRANCH_MANAGER' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type Member = {
  id: string;
  role: WorkspaceRole;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
};

export type Invitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'PENDING';
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    id: string;
    firstName: string;
    lastName: string | null;
  };
};

type MembersManagerProps = {
  workspaceId: string;
  workspaceName: string;
  actorRole: WorkspaceRole;
  currentUserId: string;
  initialMembers: Member[];
  initialInvitations: Invitation[];
};

const roleLabels: Record<WorkspaceRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch manager',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

const assignableRoles: WorkspaceRole[] = [
  'ADMIN',
  'BRANCH_MANAGER',
  'TEACHER',
  'STUDENT',
  'PARENT',
];

function initials(firstName: string, lastName: string | null) {
  return `${firstName[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

export function MembersManager({
  workspaceId,
  workspaceName,
  actorRole,
  currentUserId,
  initialMembers,
  initialInvitations,
}: MembersManagerProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('TEACHER');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isOwner = actorRole === 'OWNER';

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setError('');
    setNotice('');

    try {
      const invitation = await apiFetch<Invitation>(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      setInvitations((current) => [invitation, ...current]);
      setInviteEmail('');
      setNotice(`Invitation sent to ${invitation.email}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to send the invitation.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: Member, role: WorkspaceRole) {
    setBusyId(member.id);
    setError('');
    setNotice('');

    try {
      const updated = await apiFetch<{ id: string; role: WorkspaceRole }>(
        `/workspaces/${workspaceId}/members/${member.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        },
      );

      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, role: updated.role } : item)),
      );
      setNotice(`${member.user.firstName} is now ${roleLabels[updated.role].toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update the member role.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(member: Member) {
    if (!window.confirm(`Remove ${member.user.firstName} from ${workspaceName}?`)) {
      return;
    }

    setBusyId(member.id);
    setError('');
    setNotice('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/members/${member.id}`, { method: 'DELETE' });

      setMembers((current) => current.filter((item) => item.id !== member.id));
      setNotice(`${member.user.firstName} was removed from the workspace.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to remove the member.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(invitation: Invitation) {
    setBusyId(invitation.id);
    setError('');
    setNotice('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/invitations/${invitation.id}`, {
        method: 'DELETE',
      });

      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setNotice(`Invitation for ${invitation.email} was revoked.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to revoke the invitation.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <UserPlus size={21} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Invite a member</h2>
            <p className="mt-1 text-sm text-slate-500">
              Send an email invitation to join {workspaceName}.
            </p>
          </div>
        </div>

        <form onSubmit={handleInvite} className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <div>
            <label htmlFor="invite-email" className="sr-only">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="new.member@example.com"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="invite-role" className="sr-only">
              Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {assignableRoles
                .filter((role) => role !== 'ADMIN' || isOwner)
                .map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {inviting && <Loader2 size={16} className="animate-spin" />}
            {inviting ? 'Sending...' : 'Send invite'}
          </button>
        </form>
      </section>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {notice && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Mail size={21} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pending invitations</h2>
              <p className="mt-1 text-sm text-slate-500">
                Invitations that have not been accepted yet.
              </p>
            </div>
          </div>
        </div>

        {invitations.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No pending invitations.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-100">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{invitation.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {roleLabels[invitation.role]} · expires{' '}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRevoke(invitation)}
                  disabled={busyId === invitation.id}
                  className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {busyId === invitation.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Users size={21} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Members</h2>
            <p className="mt-1 text-sm text-slate-500">
              {members.length} people in this workspace.
            </p>
          </div>
        </div>

        <ul className="mt-6 divide-y divide-slate-100">
          {members.map((member) => {
            const fullName = [member.user.firstName, member.user.lastName]
              .filter(Boolean)
              .join(' ');
            const isOwnerMember = member.role === 'OWNER';
            const isSelf = member.user.id === currentUserId;
            const canChangeRole = isOwner && !isOwnerMember && !isSelf;
            const canRemove = !isOwnerMember && !isSelf;

            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {initials(member.user.firstName, member.user.lastName)}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {fullName}
                      {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{member.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isOwnerMember && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <ShieldCheck size={13} />
                      Owner
                    </span>
                  )}

                  {canChangeRole ? (
                    <select
                      aria-label={`Role for ${fullName}`}
                      value={member.role}
                      disabled={busyId === member.id}
                      onChange={(event) =>
                        void handleRoleChange(member, event.target.value as WorkspaceRole)
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    !isOwnerMember && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {roleLabels[member.role]}
                      </span>
                    )
                  )}

                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(member)}
                      disabled={busyId === member.id}
                      aria-label={`Remove ${fullName}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {busyId === member.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

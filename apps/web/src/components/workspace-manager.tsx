'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';

type WorkspaceRole = 'OWNER' | 'ADMIN' | 'BRANCH_MANAGER' | 'TEACHER' | 'STUDENT' | 'PARENT';

type Workspace = {
  id: string;
  name: string;
  type: 'TEACHER' | 'INSTITUTE';
  createdAt: string;
  membershipId: string;
  role: WorkspaceRole;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type WorkspaceManagerProps = {
  initialActiveWorkspaceId: string | null;
};

export function WorkspaceManager({ initialActiveWorkspaceId }: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    initialActiveWorkspaceId,
  );
  const [name, setName] = useState('');
  const [type, setType] = useState<'TEACHER' | 'INSTITUTE'>('TEACHER');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadWorkspaces() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/workspaces`, {
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load workspaces.');
      }

      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workspaces.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeWorkspaces() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_URL}/workspaces`, {
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load workspaces.');
        }

        if (!cancelled) {
          setWorkspaces(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load workspaces.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initializeWorkspaces();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/workspaces`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Unable to create workspace.',
        );
      }

      setWorkspaces((current) => [...current, data]);
      setActiveWorkspaceId(data.activeWorkspaceId);
      setName('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create workspace.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitch(workspaceId: string) {
    setSwitchingId(workspaceId);
    setError('');

    try {
      const response = await fetch(`${API_URL}/workspaces/${workspaceId}/switch`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to switch workspace.');
      }

      setActiveWorkspaceId(data.activeWorkspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to switch workspace.');
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Your workspaces</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your tuition classes and educational institutes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus size={17} />
          Create workspace
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-workspace-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6">
              <h2 id="create-workspace-title" className="text-xl font-bold text-slate-900">
                Create a workspace
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Set up a space for your teaching activities or institute.
              </p>
            </div>

            <form onSubmit={handleCreate}>
              <div>
                <label
                  htmlFor="workspace-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Workspace name
                </label>
                <input
                  id="workspace-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. My Tuition Academy"
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <fieldset className="mt-5">
                <legend className="mb-3 text-sm font-medium text-slate-700">Workspace type</legend>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setType('TEACHER')}
                    className={`rounded-xl border p-4 text-left transition ${
                      type === 'TEACHER'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <GraduationCap className="mb-2 text-blue-600" size={24} />
                    <span className="block text-sm font-semibold text-slate-900">Teacher</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Independent teacher or tuition classes.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('INSTITUTE')}
                    className={`rounded-xl border p-4 text-left transition ${
                      type === 'INSTITUTE'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Building2 className="mb-2 text-blue-600" size={24} />
                    <span className="block text-sm font-semibold text-slate-900">Institute</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Institute with staff and branches.
                    </span>
                  </button>
                </div>
              </fieldset>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError('');
                  }}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || name.trim().length < 2}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'Creating...' : 'Create workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading your workspaces...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <Building2 className="mx-auto text-slate-400" size={36} />
            <h3 className="mt-3 font-semibold text-slate-800">No workspaces yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Create your first workspace to start managing your educational operations.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {workspaces.map((workspace) => {
              const active = activeWorkspaceId === workspace.id;
              const Icon = workspace.type === 'TEACHER' ? GraduationCap : Building2;

              return (
                <div
                  key={workspace.id}
                  className={`rounded-xl border p-5 transition ${
                    active ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Icon size={23} />
                    </div>

                    {active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={13} />
                        Active
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 font-semibold text-slate-900">{workspace.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {workspace.type === 'TEACHER' ? 'Teacher workspace' : 'Institute workspace'}
                  </p>

                  <button
                    type="button"
                    disabled={active || switchingId !== null}
                    onClick={() => void handleSwitch(workspace.id)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {switchingId === workspace.id ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Switching...
                      </>
                    ) : active ? (
                      'Currently active'
                    ) : (
                      'Switch to workspace'
                    )}
                  </button>

                  {(workspace.role === 'OWNER' || workspace.role === 'ADMIN') && (
                    <Link
                      href={`/workspaces/${workspace.id}/members`}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      <Users size={16} />
                      Manage members
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void loadWorkspaces()}
        disabled={loading}
        className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-blue-600 disabled:opacity-50"
      >
        <RefreshCw size={14} />
        Refresh workspaces
      </button>
    </section>
  );
}

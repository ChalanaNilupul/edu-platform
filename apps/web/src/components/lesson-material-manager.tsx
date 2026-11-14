'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  MATERIAL_KINDS,
  materialKindClasses,
  materialKindLabels,
  type LessonMaterialRecord,
  type MaterialKind,
} from '@/lib/lessons';

type LessonMaterialsProps = {
  workspaceId: string;
  lessonId: string;
  canWrite: boolean;
  materials: LessonMaterialRecord[];
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const kindIcons = {
  PDF: FileText,
  VIDEO: Video,
  LINK: Link2,
} satisfies Record<MaterialKind, typeof FileText>;

export function LessonMaterials({
  workspaceId,
  lessonId,
  canWrite,
  materials,
}: LessonMaterialsProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<MaterialKind>('PDF');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setKind('PDF');
    setUrl('');
    setDescription('');
    setError('');
  }

  function startEdit(material: LessonMaterialRecord) {
    setEditingId(material.id);
    setTitle(material.title);
    setKind(material.kind);
    setUrl(material.url);
    setDescription(material.description ?? '');
    setError('');
    setFormOpen(true);
  }

  async function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const body = {
      title,
      kind,
      url,
      ...(description.trim() ? { description } : { description: null }),
    };

    try {
      if (editingId) {
        await apiFetch(`/workspaces/${workspaceId}/materials/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/workspaces/${workspaceId}/lessons/${lessonId}/materials`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      resetForm();
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the material.');
    } finally {
      setSaving(false);
    }
  }

  async function removeMaterial(material: LessonMaterialRecord) {
    if (!window.confirm(`Remove "${material.title}" from this lesson?`)) {
      return;
    }

    setBusyId(material.id);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/materials/${material.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to remove the material.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Materials</h2>
          <p className="mt-1 text-sm text-slate-500">
            PDFs, videos and links students can open for this lesson.
          </p>
        </div>

        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              if (formOpen) {
                resetForm();
              }

              setFormOpen((open) => !open);
            }}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {formOpen ? <X size={16} /> : <Plus size={16} />}
            {formOpen ? 'Close' : 'Add material'}
          </button>
        ) : null}
      </div>

      {formOpen && canWrite ? (
        <form
          onSubmit={saveMaterial}
          className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2"
        >
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={150}
              placeholder="Fractions worksheet"
              className={inputClass}
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type
            </span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as MaterialKind)}
              className={inputClass}
            >
              {MATERIAL_KINDS.map((value) => (
                <option key={value} value={value}>
                  {materialKindLabels[value]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              URL
            </span>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              maxLength={1000}
              placeholder="https://example.com/worksheet.pdf"
              className={inputClass}
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Optional context for students"
              className={inputClass}
            />
          </label>

          {error ? (
            <p className="flex items-start gap-1 text-sm text-red-600 sm:col-span-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 sm:col-span-2">
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setFormOpen(false);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {editingId ? 'Save changes' : 'Add material'}
            </button>
          </div>
        </form>
      ) : null}

      {materials.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          <FileText size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <p>No materials yet. Add a PDF, video or link for this lesson.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {materials.map((material) => {
            const Icon = kindIcons[material.kind];

            return (
              <li
                key={material.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${materialKindClasses[material.kind]}`}
                  >
                    <Icon size={12} />
                    {materialKindLabels[material.kind]}
                  </span>

                  <div className="min-w-0">
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all text-sm font-semibold text-blue-700 hover:underline"
                    >
                      {material.title}
                      <ExternalLink size={12} className="shrink-0" />
                    </a>
                    {material.description ? (
                      <p className="mt-0.5 text-xs text-slate-500">{material.description}</p>
                    ) : null}
                  </div>
                </div>

                {canWrite ? (
                  <div className="flex shrink-0 items-center gap-3 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => startEdit(material)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMaterial(material)}
                      disabled={busyId !== null}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === material.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_REQUIRED_COLUMN,
  IMPORT_SUPPORTED_COLUMNS,
  importDuplicateReasonLabels,
  importRowStatusClasses,
  importRowStatusLabels,
  type ImportResult,
  type ImportValidationReport,
} from '@/lib/student-import';

type StudentImportProps = {
  workspaceId: string;
};

type BusyState = 'reading' | 'validating' | 'importing' | null;

const MAX_PREVIEW_ROWS = 200;

export function StudentImport({ workspaceId }: StudentImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<ImportValidationReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<BusyState>(null);

  const canImport = report !== null && report.validRows > 0 && report.invalidRows === 0;
  const isBusy = busy !== null;

  async function validate(text: string) {
    setBusy('validating');
    setReport(null);

    try {
      const data = await apiFetch<ImportValidationReport>(
        `/workspaces/${workspaceId}/students/import/validate`,
        { method: 'POST', body: JSON.stringify({ csv: text }) },
      );

      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to validate the file.');
    } finally {
      setBusy(null);
    }
  }

  async function readFile(file: File) {
    setFileName(file.name);
    setCsv('');
    setReport(null);
    setResult(null);
    setError('');

    if (file.size > IMPORT_MAX_FILE_BYTES) {
      setError(
        `The file is larger than ${IMPORT_MAX_FILE_BYTES.toLocaleString('en-US')} bytes. Split it into smaller files.`,
      );
      return;
    }

    setBusy('reading');

    try {
      const text = await file.text();

      if (text.trim().length === 0) {
        setError('The selected file is empty.');
        setBusy(null);
        return;
      }

      setCsv(text);
      await validate(text);
    } catch {
      setError('Unable to read the selected file. Save it as a CSV and try again.');
      setBusy(null);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void readFile(file);
    }
  }

  async function runImport() {
    if (!csv || !canImport) {
      return;
    }

    setBusy('importing');
    setError('');

    try {
      const data = await apiFetch<ImportResult>(`/workspaces/${workspaceId}/students/import`, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });

      setResult(data);
      setReport(null);
      setCsv('');
      setFileName('');

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to import the students.');
    } finally {
      setBusy(null);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`${IMPORT_SUPPORTED_COLUMNS.join(',')}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'student-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const previewRows = report ? report.rows.slice(0, MAX_PREVIEW_ROWS) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <FileSpreadsheet size={18} className="text-blue-600" />
              Choose a CSV file
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The first row must be a header. <code className="text-slate-700">first_name</code> is
              required; every other column is optional. Up to{' '}
              {IMPORT_MAX_ROWS.toLocaleString('en-US')} rows per file.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Download size={16} />
            Download template
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            id="student-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            disabled={isBusy}
            className="sr-only"
          />

          <label
            htmlFor="student-csv"
            className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 ${
              isBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer'
            }`}
          >
            {busy === 'reading' || busy === 'validating' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {busy === 'reading'
              ? 'Reading file...'
              : busy === 'validating'
                ? 'Checking file...'
                : 'Select CSV file'}
          </label>

          <p className="text-sm text-slate-500">{fileName || 'No file selected yet'}</p>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Supported columns:{' '}
          {IMPORT_SUPPORTED_COLUMNS.map((column) => (
            <span key={column}>
              <code
                className={column === IMPORT_REQUIRED_COLUMN ? 'text-slate-900' : 'text-slate-600'}
              >
                {column}
              </code>
              {column === IMPORT_SUPPORTED_COLUMNS.at(-1) ? '' : ', '}
            </span>
          ))}
          . Status and gender use their uppercase names (for example{' '}
          <code className="text-slate-600">ACTIVE</code>,{' '}
          <code className="text-slate-600">MALE</code>
          ). Blank cells are left empty.
        </p>

        {error ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </section>

      {report ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900">Preview</h2>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                {report.validRows} ready
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                {report.duplicateRows} duplicate
              </span>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                {report.invalidRows} invalid
              </span>
            </div>
          </div>

          {report.invalidRows > 0 ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              Fix the invalid rows in your file and select it again. Nothing has been imported yet.
            </p>
          ) : (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              {report.validRows} row{report.validRows === 1 ? '' : 's'} will be created.
              {report.duplicateRows > 0
                ? ' Duplicate student codes are skipped; existing students are never changed.'
                : ''}
            </p>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Line</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Student code</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Problems</th>
                </tr>
              </thead>

              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.line} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3 text-slate-500">{row.line}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {row.firstName ?? <span className="text-slate-400">Missing name</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.studentCode ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${importRowStatusClasses[row.status]}`}
                      >
                        {importRowStatusLabels[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {row.errors.length > 0 ? row.errors.join(' ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.rows.length > previewRows.length ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing the first {MAX_PREVIEW_ROWS} of {report.rows.length} rows.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {report.invalidRows > 0
                ? 'Import is blocked until every row is valid.'
                : 'This action cannot be undone from this page.'}
            </p>

            <button
              type="button"
              onClick={runImport}
              disabled={!canImport || isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'importing' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {busy === 'importing' ? 'Importing...' : `Import ${report.validRows} students`}
            </button>
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-900">
            <CheckCircle2 size={18} />
            Import finished
          </h2>

          <p className="mt-2 text-sm text-emerald-800">
            Imported {result.imported} student{result.imported === 1 ? '' : 's'}.
            {result.skipped > 0
              ? ` Skipped ${result.skipped} row${result.skipped === 1 ? '' : 's'}.`
              : ''}
          </p>

          {result.duplicates.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-emerald-200 bg-white">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3">Line</th>
                    <th className="px-3 py-3">Student code</th>
                    <th className="px-3 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.duplicates.map((duplicate) => (
                    <tr
                      key={`${duplicate.line}-${duplicate.studentCode}`}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-3 text-slate-500">{duplicate.line}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {duplicate.studentCode || '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {importDuplicateReasonLabels[duplicate.reason]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/workspaces/${workspaceId}/students`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              View students
            </Link>

            <button
              type="button"
              onClick={() => setResult(null)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              Import another file
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

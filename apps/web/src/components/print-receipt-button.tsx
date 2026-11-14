'use client';

import { Printer } from 'lucide-react';

export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
    >
      <Printer size={16} />
      Print receipt
    </button>
  );
}

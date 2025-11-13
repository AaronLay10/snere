"use client";

import clsx from 'clsx';

const COLORS: Record<string, string> = {
  online: 'bg-paragon-success/20 text-paragon-success border-paragon-success/40',
  offline: 'bg-paragon-danger/20 text-paragon-danger border-paragon-danger/40',
  degraded: 'bg-paragon-warning/20 text-paragon-warning border-paragon-warning/40',
  unknown: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  healthy: 'bg-paragon-success/20 text-paragon-success border-paragon-success/40',
  unreachable: 'bg-paragon-danger/20 text-paragon-danger border-paragon-danger/40'
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide border rounded-full',
        COLORS[status] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
      )}
    >
      {status}
    </span>
  );
}

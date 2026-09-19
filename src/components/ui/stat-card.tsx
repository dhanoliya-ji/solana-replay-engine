import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  tone = 'default',
  detail
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'success' | 'danger' | 'accent' | 'warn';
  detail?: ReactNode;
}) {
  const toneClass = {
    default: 'from-slate-700/10 to-slate-700/0 text-slate-100',
    success: 'from-success/15 to-success/0 text-success',
    danger: 'from-danger/15 to-danger/0 text-danger',
    accent: 'from-accent/15 to-accent/0 text-accent',
    warn: 'from-warn/15 to-warn/0 text-warn'
  }[tone];

  return (
    <div className={cn('rounded-2xl border border-line/70 bg-gradient-to-br p-4', toneClass)}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      {detail ? <div className="mt-2 text-sm text-slate-400">{detail}</div> : null}
    </div>
  );
}

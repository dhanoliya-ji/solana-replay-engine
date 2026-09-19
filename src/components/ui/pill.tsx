import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Pill({
  children,
  tone = 'slate'
}: {
  children: ReactNode;
  tone?: 'slate' | 'accent' | 'success' | 'warn' | 'danger';
}) {
  const toneClass = {
    slate: 'border-slate-700/80 bg-slate-900/60 text-slate-200',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    success: 'border-success/30 bg-success/10 text-success',
    warn: 'border-warn/30 bg-warn/10 text-warn',
    danger: 'border-danger/30 bg-danger/10 text-danger'
  }[tone];

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', toneClass)}>{children}</span>;
}

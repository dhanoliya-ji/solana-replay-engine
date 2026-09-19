import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({
  children,
  className,
  contentClassName,
  title,
  subtitle,
  actions
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-line/80 bg-panel/90 shadow-glow backdrop-blur', className)}>
      {(title || subtitle || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div>
            {title ? <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      )}
      <div className={cn('p-5', contentClassName)}>{children}</div>
    </section>
  );
}

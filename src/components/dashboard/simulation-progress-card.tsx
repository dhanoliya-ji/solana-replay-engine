import type { SimulationJobState } from '@/types/domain';
import { Panel } from '@/components/ui/panel';
import { shortAddress } from '@/lib/utils';

export function SimulationProgressCard({ job }: { job: SimulationJobState | null }) {
  const percent = job && job.progress.total > 0 ? Math.min(100, (job.progress.processed / job.progress.total) * 100) : 0;

  return (
    <Panel title="Simulation Execution" subtitle="Background polling keeps the dashboard updated while the local simulation engine runs.">
      {job ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <div>Status: <span className="font-semibold text-slate-100">{job.status}</span></div>
            <div>{job.progress.processed} / {job.progress.total || '--'} tokens</div>
            {job.progress.mint ? <div>Current: <span className="font-mono text-xs text-slate-400">{shortAddress(job.progress.mint, 6, 6)}</span></div> : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-900">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
          {job.error ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{job.error}</div> : null}
          {job.payload ? <pre className="overflow-x-auto rounded-xl border border-line/70 bg-slate-950/50 p-4 text-xs text-slate-300">{job.payload.logText}</pre> : null}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No simulation job yet. Load data, configure the strategy, and run the local engine to view progress here.
        </p>
      )}
    </Panel>
  );
}

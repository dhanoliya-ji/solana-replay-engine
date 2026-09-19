import type {
  ComparisonSummary,
  DistributionKind,
  SimulationRunPayload,
  TokenComparisonRow
} from '@/types/domain';
import { formatNumber, formatSol } from '@/lib/utils';

export function MetricsGrid({
  summary,
  simulation,
  rows,
  onOpenDistribution,
  onOpenComparison
}: {
  summary: ComparisonSummary | null;
  simulation: SimulationRunPayload | null;
  rows: TokenComparisonRow[];
  onOpenDistribution: (kind: DistributionKind) => void;
  onOpenComparison: () => void;
}) {
  const sharedRows = rows.filter((row) => row.shared);
  const sharedTargetPnl = sharedRows.reduce((sum, row) => sum + row.targetPnLSol, 0);
  const sharedSimulationPnl = sharedRows.reduce((sum, row) => sum + row.simulationPnLSol, 0);
  const trackedUniverse = summary ? summary.sharedAssets + summary.targetOnlyAssets : 0;
  const copyAlignment =
    trackedUniverse > 0 && summary ? (summary.sharedAssets / trackedUniverse) * 100 : 0;
  const positionMatch =
    summary && Math.max(summary.targetPositionCount, summary.simulatedPositionCount) > 0
      ? (summary.sharedAssets /
          Math.max(summary.targetPositionCount, summary.simulatedPositionCount)) *
        100
      : 0;

  const cardClassName =
    'rounded-[16px] border border-[#1b2333] bg-[#0a1019]/95 px-3 py-2.5 shadow-[0_12px_36px_rgba(2,8,23,0.3)]';
  const statGridClassName =
    'mt-2.5 grid grid-cols-3 gap-2 border-t border-[#171d29] pt-1.5 text-[11px] text-slate-500';
  const pnlColorClass = (value: number | null | undefined) =>
    value != null && value < 0 ? 'text-[#ff665d]' : 'text-[#4ade80]';

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1.05fr]">
      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7a8bab]">
              Copy Strategy
            </div>
            <div className="mt-0.5 text-sm text-slate-400">My execution</div>
          </div>
          <button
            type="button"
            onClick={() => onOpenDistribution('simulated')}
            className="text-xs font-medium text-[#9fa8ff] hover:text-white"
          >
            Distribution
          </button>
        </div>

        <div className={`mt-2 text-4xl font-semibold tracking-tight ${pnlColorClass(summary?.simulatedPnLSol)}`}>
          {formatSol(summary?.simulatedPnLSol, 4)}
        </div>
        <div className="mt-0.5 text-sm text-slate-500">Net simulated PnL</div>

        <div className={statGridClassName}>
          <div>
            <div>Win rate</div>
            <div className="mt-1 text-sm font-semibold text-[#f87171]">
              {simulation ? `${simulation.summary.winRate}%` : '0.0%'}
            </div>
          </div>
          <div>
            <div>Trades</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">
              {simulation ? simulation.summary.sellCount : 0}
            </div>
          </div>
          <div>
            <div>Positions</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">
              {summary?.simulatedPositionCount ?? 0}
            </div>
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f6b26b]">
              Source Wallet
            </div>
            <div className="mt-0.5 text-sm text-slate-400">Target performance</div>
          </div>
          <button
            type="button"
            onClick={() => onOpenDistribution('target')}
            className="text-xs font-medium text-[#9fa8ff] hover:text-white"
          >
            Distribution
          </button>
        </div>

        <div className={`mt-2 text-4xl font-semibold tracking-tight ${pnlColorClass(summary?.targetPnLSol)}`}>
          {formatSol(summary?.targetPnLSol, 4)}
        </div>
        <div className="mt-0.5 text-sm text-slate-500">Observed wallet PnL</div>

        <div className={statGridClassName}>
          <div>
            <div>Win rate</div>
            <div className="mt-1 text-sm font-semibold text-[#f87171]">
              {summary ? `${formatNumber(summary.targetWinRate, 1)}%` : '0.0%'}
            </div>
          </div>
          <div>
            <div>Trades</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">
              {summary?.totalTargetTrades ?? 0}
            </div>
          </div>
          <div>
            <div>Positions</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">
              {summary?.targetPositionCount ?? 0}
            </div>
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c8b6ff]">
              Execution Quality
            </div>
            <div className="mt-0.5 text-sm text-slate-400">Copy alignment</div>
          </div>
          <button
            type="button"
            onClick={onOpenComparison}
            className="text-xs font-medium text-[#9fa8ff] hover:text-white"
          >
            Compare
          </button>
        </div>

        <div className="mt-2 grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Position match</span>
            <span className="font-semibold text-slate-100">{formatNumber(positionMatch, 0)}%</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Copy alignment</span>
            <span className="font-semibold text-slate-100">{formatNumber(copyAlignment, 0)}%</span>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-[#171d29] pt-1.5 text-[11px] text-slate-500">
          <div>
            <div>My shared PnL</div>
            <div className={`mt-1 text-sm font-semibold ${pnlColorClass(sharedSimulationPnl)}`}>
              {formatSol(sharedSimulationPnl, 4)}
            </div>
          </div>
          <div>
            <div>Target shared PnL</div>
            <div className={`mt-1 text-sm font-semibold ${pnlColorClass(sharedTargetPnl)}`}>
              {formatSol(sharedTargetPnl, 4)}
            </div>
          </div>
          <div>
            <div>Missed assets</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">
              {summary?.missedAssets ?? 0}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

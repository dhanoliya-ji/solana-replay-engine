"use client";

import type { DistributionKind, TokenComparisonRow } from '@/types/domain';
import { buildDistribution } from '@/lib/analytics/distribution';
import { formatNumber, formatSol } from '@/lib/utils';

function bucketDotClass(index: number) {
  const classes = [
    'bg-[#5ef07f]',
    'bg-[#76f38b]',
    'bg-[#8ef79b]',
    'bg-[#a6f7ac]',
    'bg-[#bbf9bc]',
    'bg-[#d4ffd4]',
    'bg-[#f1fff1]',
    'bg-[#ffb1b1]',
    'bg-[#ff7369]',
    'bg-[#ff4b43]'
  ];
  return classes[index] ?? classes[classes.length - 1];
}

function getSummary(rows: TokenComparisonRow[], kind: 'simulated' | 'target') {
  const relevant = rows.filter((row) =>
    kind === 'simulated' ? row.hasSimulationActivity : row.hasTargetActivity
  );
  const totalPnl = relevant.reduce(
    (sum, row) => sum + (kind === 'simulated' ? row.simulationPnLSol : row.targetPnLSol),
    0
  );
  const profit = relevant
    .filter((row) => (kind === 'simulated' ? row.simulationPnLSol : row.targetPnLSol) > 0)
    .reduce(
      (sum, row) => sum + (kind === 'simulated' ? row.simulationPnLSol : row.targetPnLSol),
      0
    );
  const loss = relevant
    .filter((row) => (kind === 'simulated' ? row.simulationPnLSol : row.targetPnLSol) < 0)
    .reduce(
      (sum, row) => sum + (kind === 'simulated' ? row.simulationPnLSol : row.targetPnLSol),
      0
    );
  const wins = relevant.filter(
    (row) => (kind === 'simulated' ? row.simulationPnLSol : row.targetPnLSol) > 0
  ).length;
  const winRate = relevant.length ? (wins / relevant.length) * 100 : 0;
  return {
    tokenCount: relevant.length,
    totalPnl,
    profit,
    loss,
    winRate
  };
}

function SummaryPill({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-[#1d4125] bg-[#0d1c12] text-[#53e177]'
      : tone === 'negative'
        ? 'border-[#4a1b1b] bg-[#1d0f0f] text-[#ff665d]'
        : 'border-[#2a3244] bg-[#111826] text-slate-300';
  return (
    <div className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      <span className="mr-1 text-slate-500">{label}:</span>
      {value}
    </div>
  );
}

export function DistributionModal({
  kind,
  rows,
  onClose
}: {
  kind: DistributionKind | null;
  rows: TokenComparisonRow[];
  onClose: () => void;
}) {
  if (!kind) return null;

  const simBuckets = buildDistribution(rows, 'simulated');
  const targetBuckets = buildDistribution(rows, 'target');
  const simSummary = getSummary(rows, 'simulated');
  const targetSummary = getSummary(rows, 'target');

  const renderBuckets = (
    title: string,
    buckets: ReturnType<typeof buildDistribution>,
    summary: ReturnType<typeof getSummary>
  ) => {
    const totalCount = Math.max(1, summary.tokenCount);

    return (
      <div className="rounded-[18px] border border-[#1f2736] bg-[#161d28] p-4 shadow-[0_18px_40px_rgba(2,8,23,0.35)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[30px] font-semibold leading-none tracking-tight text-slate-100">
              Distribution (Token {summary.tokenCount})
            </h3>
            <div className="mt-2 text-sm text-slate-500">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-slate-500 transition hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <SummaryPill label="Total" value={formatSol(summary.totalPnl, 4)} tone="negative" />
          <SummaryPill label="Profit" value={formatSol(summary.profit, 2)} tone="positive" />
          <SummaryPill label="Loss" value={formatSol(summary.loss, 2)} tone="negative" />
          <SummaryPill
            label="Win Rate"
            value={`${formatNumber(summary.winRate, 1)}%`}
            tone="neutral"
          />
        </div>

        <div className="mb-3 grid grid-cols-[1fr_130px_120px] gap-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <div> </div>
          <div className="text-right">PnL (SOL)</div>
          <div className="text-right">Count / %</div>
        </div>

        <div className="space-y-1.5">
          {buckets.map((bucket, index) => (
            <div
              key={`${title}-${bucket.label}`}
              className="grid grid-cols-[1fr_130px_120px] items-center gap-3 rounded-lg px-1 py-1.5 text-sm"
            >
              <div className="flex items-center gap-3 text-slate-300">
                <span className={`h-3 w-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.12)] ${bucketDotClass(index)}`} />
                <span>{bucket.label}</span>
              </div>
              <div
                className={`text-right font-semibold ${
                  bucket.pnlContribution < 0 ? 'text-[#ff665d]' : 'text-[#53e177]'
                }`}
              >
                {formatSol(bucket.pnlContribution, 2)}
              </div>
              <div
                className={`text-right font-semibold ${
                  bucket.pnlContribution < 0 ? 'text-[#ff665d]' : 'text-[#53e177]'
                }`}
              >
                {bucket.tokenCount} ({formatNumber(bucket.percentOfTotal, 2)}%)
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-md bg-[#0f1621]">
          <div className="flex h-[18px] w-full">
            {buckets.map((bucket, index) => (
              <div
                key={`bar-${title}-${bucket.label}`}
                className={bucketDotClass(index)}
                style={{ width: `${(bucket.tokenCount / totalCount) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-[#1f2736] bg-[#111722] p-5 shadow-[0_40px_120px_rgba(2,8,23,0.6)]">
        <div className={`grid gap-6 ${kind === 'side-by-side' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          {(kind === 'simulated' || kind === 'side-by-side') &&
            renderBuckets('Simulated outcomes', simBuckets, simSummary)}
          {(kind === 'target' || kind === 'side-by-side') &&
            renderBuckets('Target outcomes', targetBuckets, targetSummary)}
        </div>
      </div>
    </div>
  );
}

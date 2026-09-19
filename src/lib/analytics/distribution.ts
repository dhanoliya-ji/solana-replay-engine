import type { DistributionBucket, TokenComparisonRow } from '@/types/domain';

const DEFINITIONS = [
  { label: '>500%', min: 500, max: null },
  { label: '200%~500%', min: 200, max: 500 },
  { label: '150%~200%', min: 150, max: 200 },
  { label: '100%~150%', min: 100, max: 150 },
  { label: '50%~100%', min: 50, max: 100 },
  { label: '25%~50%', min: 25, max: 50 },
  { label: '0%~25%', min: 0, max: 25 },
  { label: '-25%~-0%', min: -25, max: 0 },
  { label: '-50%~-25%', min: -50, max: -25 },
  { label: '< -50%', min: Number.NEGATIVE_INFINITY, max: -50 },
];

function pickMetric(row: TokenComparisonRow, kind: 'simulated' | 'target') {
  return kind === 'simulated'
    ? { pct: row.simulationReturnPct, pnl: row.simulationPnLSol, include: row.hasSimulationActivity }
    : { pct: row.targetReturnPct, pnl: row.targetPnLSol, include: row.hasTargetActivity };
}

export function buildDistribution(rows: TokenComparisonRow[], kind: 'simulated' | 'target'): DistributionBucket[] {
  const relevant = rows.filter((row) => pickMetric(row, kind).include && pickMetric(row, kind).pct != null);
  const total = relevant.length || 1;

  return DEFINITIONS.map((definition) => {
    const matched = relevant.filter((row) => {
      const metric = pickMetric(row, kind).pct ?? 0;
      if (definition.max == null) return metric >= definition.min;
      return metric >= definition.min && metric < definition.max;
    });
    return {
      label: definition.label,
      min: definition.min,
      max: definition.max,
      tokenCount: matched.length,
      percentOfTotal: (matched.length / total) * 100,
      pnlContribution: matched.reduce((sum, row) => sum + pickMetric(row, kind).pnl, 0)
    };
  });
}

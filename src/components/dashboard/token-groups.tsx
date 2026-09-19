import type { TokenComparisonRow, TokenGroup } from '@/types/domain';

const GROUPS: Array<{ key: TokenGroup; label: string }> = [
  { key: 'all', label: 'All assets' },
  { key: 'simulated', label: 'Simulated positions' },
  { key: 'target', label: 'Target positions' },
  { key: 'shared', label: 'Shared assets' },
  { key: 'missed', label: 'Missed assets' },
  { key: 'only-simulated', label: 'Only simulated' },
  { key: 'only-target', label: 'Only target' }
];

export function TokenGroups({
  rows,
  value,
  onChange
}: {
  rows: TokenComparisonRow[];
  value: TokenGroup;
  onChange: (group: TokenGroup) => void;
}) {
  const counts = {
    all: rows.length,
    simulated: rows.filter((row) => row.hasSimulationActivity).length,
    target: rows.filter((row) => row.hasTargetActivity).length,
    shared: rows.filter((row) => row.shared).length,
    missed: rows.filter((row) => row.missed).length,
    'only-simulated': rows.filter((row) => row.onlySimulated).length,
    'only-target': rows.filter((row) => row.onlyTarget).length
  } satisfies Record<TokenGroup, number>;

  return (
    <div className="flex flex-wrap gap-2">
      {GROUPS.map((group) => (
        <button
          type="button"
          key={group.key}
          onClick={() => onChange(group.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${value === group.key ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-slate-900/60 text-slate-300'}`}
        >
          {group.label} <span className="ml-1 text-slate-500">{counts[group.key]}</span>
        </button>
      ))}
    </div>
  );
}

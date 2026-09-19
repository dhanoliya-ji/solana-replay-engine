import type { SimulationSettings } from '@/types/domain';
import { Panel } from '@/components/ui/panel';

const FIELD_LABELS: Array<{ key: keyof SimulationSettings; label: string; step?: string; placeholder?: string }> = [
  { key: 'buyAmount', label: 'Buy amount (SOL)', step: '0.1' },
  { key: 'minMcSol', label: 'Min market cap (SOL)', step: '1' },
  { key: 'maxMcSol', label: 'Max market cap (SOL)', step: '1' },
  { key: 'takeProfitPercent', label: 'Take profit %', step: '1' },
  { key: 'stopLossPercent', label: 'Stop loss %', step: '1' },
  { key: 'trailingStopPercent', label: 'Trailing stop %', step: '1' },
  { key: 'trailingMinProfitPercent', label: 'Trailing activation threshold %', step: '1' },
  { key: 'maxHoldSeconds', label: 'Max hold time (sec)', step: '1' },
  { key: 'breakEvenProfitPercent', label: 'Break-even activation %', step: '1' },
  { key: 'breakEvenDrawdownPercent', label: 'Break-even drawdown %', step: '1' },
  { key: 'momentumFailSeconds', label: 'Momentum fail timeout (sec)', step: '1' },
  { key: 'momentumFailProfitPercent', label: 'Momentum fail PnL %', step: '1' },
  { key: 'maxHolderPercent', label: 'Max holder concentration %', step: '1' },
  { key: 'maxTop3HolderPercent', label: 'Top 3 concentration %', step: '1' }
];

export function StrategyPanel({
  settings,
  onChange,
  onRun,
  runDisabled,
  running
}: {
  settings: SimulationSettings;
  onChange: <K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => void;
  onRun: () => void;
  runDisabled: boolean;
  running: boolean;
}) {
  return (
    <Panel
      title="Strategy Settings"
      subtitle="Fields are aligned with the local copy-trading strategy module in simulation/strategies."
      actions={
        <button
          type="button"
          onClick={onRun}
          disabled={runDisabled || running}
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'Running simulation...' : 'Run simulation'}
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Source wallet to copy</span>
          <input
            value={settings.targetWallet}
            onChange={(event) => onChange('targetWallet', event.target.value)}
            placeholder="Wallet to mirror"
            className="w-full rounded-xl border border-line bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {FIELD_LABELS.map((field) => (
            <label key={field.key} className="block text-sm text-slate-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">{field.label}</span>
              <input
                type="number"
                step={field.step ?? '1'}
                value={settings[field.key] ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onChange(field.key, value === '' ? null as SimulationSettings[typeof field.key] : Number(value) as SimulationSettings[typeof field.key]);
                }}
                className="w-full rounded-xl border border-line bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
      </div>
    </Panel>
  );
}

import type { TokenComparisonRow } from '@/types/domain';
import { Panel } from '@/components/ui/panel';
import { formatInteger, formatPercent, formatSol, shortAddress } from '@/lib/utils';

export function TokenTable({
  rows,
  selectedMint,
  onSelect
}: {
  rows: TokenComparisonRow[];
  selectedMint: string | null;
  onSelect: (mint: string) => void;
}) {
  return (
    <Panel title="Token Exploration" subtitle="Grouped assets compare target-wallet behavior against the simulated copy-trading run.">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="pb-3 pr-4">Token</th>
                <th className="pb-3 pr-4">Target PnL</th>
                <th className="pb-3 pr-4">Sim PnL</th>
                <th className="pb-3 pr-4">Target Return</th>
                <th className="pb-3 pr-4">Sim Return</th>
                <th className="pb-3 pr-4">Target Trades</th>
                <th className="pb-3 pr-4">Sim Trades</th>
                <th className="pb-3">Current MC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.mint}
                  onClick={() => onSelect(row.mint)}
                  className={`cursor-pointer border-t border-line/60 transition hover:bg-slate-900/40 ${selectedMint === row.mint ? 'bg-accent/5' : ''}`}
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-100">{shortAddress(row.mint, 6, 6)}</div>
                    <div className="text-xs text-slate-500">{row.shared ? 'shared' : row.onlyTarget ? 'target-only' : row.onlySimulated ? 'sim-only' : 'market'}</div>
                  </td>
                  <td className={`py-3 pr-4 ${row.targetPnLSol >= 0 ? 'text-success' : 'text-danger'}`}>{formatSol(row.targetPnLSol)}</td>
                  <td className={`py-3 pr-4 ${row.simulationPnLSol >= 0 ? 'text-success' : 'text-danger'}`}>{formatSol(row.simulationPnLSol)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatPercent(row.targetReturnPct)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatPercent(row.simulationReturnPct)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatInteger(row.targetTradeCount)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatInteger(row.simulationTradeCount)}</td>
                  <td className="py-3 text-slate-300">{row.currentMcSol != null ? `${formatInteger(row.currentMcSol)} SOL` : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-slate-400">
          No assets match this filter yet. Try a different wallet filter, load a dataset, or run a simulation.
        </p>
      )}
    </Panel>
  );
}

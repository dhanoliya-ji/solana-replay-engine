import type {
  ActivityRow,
  NormalizedToken,
  SimulationRunPayload
} from '@/types/domain';
import { Pill } from '@/components/ui/pill';
import { shortAddress, toSol, toTokenUnits } from '@/lib/utils';

export function buildActivityRows(token: NormalizedToken | null, analysisWallets: string[], simulation: SimulationRunPayload | null) {
  if (!token) return [] as ActivityRow[];
  const walletSet = new Set(analysisWallets);
  const traderPositions = new Map<
    string,
    { tokenUnits: number; costSol: number; lastEntryTimestamp: number | null }
  >();

  const marketRows = token.trades.map((trade) => {
    const tokenUnits = toTokenUnits(trade.tokenAmount);
    const solAmount = toSol(trade.solAmount);
    const priceSol = tokenUnits > 0 ? solAmount / tokenUnits : null;
    const liquiditySol = trade.reserves?.virtualSolReserves
      ? Number(trade.reserves.virtualSolReserves) / 1e9
      : null;
    const key = trade.trader ?? `unknown-${trade.id}`;
    const position = traderPositions.get(key) ?? {
      tokenUnits: 0,
      costSol: 0,
      lastEntryTimestamp: null
    };
    let pnlSol: number | null = null;
    let returnPct: number | null = null;
    let holdingDurationSec: number | null = null;

    if (trade.type === 'BUY' || trade.type === 'SWAP') {
      position.tokenUnits += tokenUnits;
      position.costSol += solAmount;
      position.lastEntryTimestamp = trade.timestamp ?? position.lastEntryTimestamp;
      traderPositions.set(key, position);
    } else if (trade.type === 'SELL' && tokenUnits > 0 && position.tokenUnits > 0) {
      const avgCostPerToken = position.costSol / position.tokenUnits;
      const realizedCost = avgCostPerToken * tokenUnits;
      pnlSol = solAmount - realizedCost;
      returnPct = realizedCost > 0 ? (pnlSol / realizedCost) * 100 : null;
      holdingDurationSec =
        trade.timestamp != null && position.lastEntryTimestamp != null
          ? (trade.timestamp - position.lastEntryTimestamp) / 1000
          : null;
      position.tokenUnits = Math.max(0, position.tokenUnits - tokenUnits);
      position.costSol = Math.max(0, position.costSol - realizedCost);
      traderPositions.set(key, position);
    }

    return {
      id: trade.id,
      mint: token.mint,
      source: trade.trader && walletSet.has(trade.trader) ? 'target' as const : 'market' as const,
      type: trade.type,
      trader: trade.trader,
      timestamp: trade.timestamp,
      slot: trade.slot,
      tokenAmount: trade.tokenAmount,
      solAmount: trade.solAmount,
      mc: trade.mc,
      detail:
        trade.trader && walletSet.has(trade.trader)
          ? `Tracked wallet ${shortAddress(trade.trader, 5, 5)} ${trade.type.toLowerCase()} activity`
          : 'General market trade',
      priceSol,
      volumeSol: solAmount,
      liquiditySol,
      pnlSol,
      returnPct,
      holdingDurationSec,
      profitable: pnlSol == null ? null : pnlSol >= 0
    } satisfies ActivityRow;
  });

  const simulatedRows = [...(simulation?.buyTrades ?? []), ...(simulation?.sellTrades ?? [])]
    .filter((trade) => trade.mint === token.mint)
    .map((trade, index) => {
      const pairedBuy = (simulation?.buyTrades ?? []).find((buyTrade) => buyTrade.mint === trade.mint);
      const solAmount = toSol(trade.solAmount);
      const buySol = pairedBuy ? toSol(pairedBuy.solAmount) : null;
      const returnPct =
        trade.pnl != null && buySol != null && buySol > 0 ? (trade.pnl / buySol) * 100 : null;
      const holdingDurationSec =
        trade.timestamp != null && pairedBuy?.timestamp != null
          ? (trade.timestamp - pairedBuy.timestamp) / 1000
          : null;

      return {
        id: `${trade.mint}-${trade.type}-${index}`,
        mint: token.mint,
        source: 'simulated' as const,
        type: trade.type,
        trader: null,
        timestamp: trade.timestamp,
        slot: trade.executedAtSlot ?? trade.slot ?? null,
        tokenAmount: '0',
        solAmount: trade.solAmount,
        mc: trade.mc,
        detail: trade.reason ?? 'Simulated fill',
        priceSol: null,
        volumeSol: solAmount,
        liquiditySol: null,
        pnlSol: trade.pnl ?? null,
        returnPct,
        holdingDurationSec,
        profitable: trade.pnl == null ? null : trade.pnl >= 0
      } satisfies ActivityRow;
    });

  return [...marketRows, ...simulatedRows].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

export function ActivityTape({
  rows,
  onSelect
}: {
  rows: ActivityRow[];
  onSelect: (row: ActivityRow) => void;
}) {
  return (
    <section className="flex h-full self-stretch min-h-[500px] flex-col overflow-hidden rounded-[18px] border border-[#1b2333] bg-[#0a1019]/95 shadow-[0_12px_36px_rgba(2,8,23,0.3)] xl:h-[520px] xl:min-h-0">
      <div className="flex items-start justify-between gap-4 border-b border-[#171d29] px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7a8bab]">
            Market Tape
          </div>
          <h2 className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-slate-100">
            Recent activity
          </h2>
        </div>
        <div className="flex h-7 min-w-[28px] items-center justify-center rounded-full border border-[#20283b] bg-[#0d1320] px-2 text-xs font-semibold text-slate-400">
          {rows.length}
        </div>
      </div>

      {rows.length ? (
        <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {rows.slice(0, 80).map((row) => (
            <button
              type="button"
              key={row.id}
              onClick={() => onSelect(row)}
              className="flex w-full items-start justify-between gap-2.5 rounded-lg border border-[#20283b] bg-[#0d1320] px-2.5 py-2 text-left transition hover:border-[#41537a]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Pill
                    tone={
                      row.type === 'BUY'
                        ? 'success'
                        : row.type === 'SELL'
                          ? 'danger'
                          : 'warn'
                    }
                  >
                    {row.type}
                  </Pill>
                  <span className="truncate text-[13px] text-slate-300">
                    {row.trader ? row.trader : row.source === 'simulated' ? 'Sim engine' : 'Market'}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  slot: {row.slot ?? '--'}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base font-semibold leading-none text-slate-100">
                  {toSol(row.solAmount).toFixed(4)}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">SOL</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#20283b] bg-[#10172a] text-lg text-[#8b5cf6]">
            ↕
          </div>
          <div className="mt-5 text-2xl font-semibold text-slate-100">No asset selected</div>
          <p className="mt-3 max-w-[260px] text-base text-slate-500">
            Choose a token to view its order flow.
          </p>
        </div>
      )}
    </section>
  );
}

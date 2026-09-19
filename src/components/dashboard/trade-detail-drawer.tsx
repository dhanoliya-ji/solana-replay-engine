"use client";

import type { ActivityRow } from '@/types/domain';
import { Pill } from '@/components/ui/pill';
import { formatNumber, formatTimestamp, shortAddress, toSol } from '@/lib/utils';

export function TradeDetailDrawer({
  activity,
  onClose
}: {
  activity: ActivityRow | null;
  onClose: () => void;
}) {
  return (
    <div className={`fixed right-0 top-0 z-40 h-full w-full max-w-md border-l border-line bg-panel shadow-2xl transition-transform duration-200 ${activity ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Trade detail</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{activity?.type ?? 'No trade selected'}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border border-line bg-slate-950/70 px-3 py-2 text-sm text-slate-300">Close</button>
      </div>
      <div className="space-y-4 p-5 text-sm text-slate-300">
        {activity ? (
          <>
            <div className="flex items-center gap-2">
              <Pill tone={activity.source === 'simulated' ? 'success' : activity.source === 'target' ? 'warn' : 'slate'}>{activity.source}</Pill>
              <Pill tone={activity.type === 'SELL' ? 'danger' : 'accent'}>{activity.type}</Pill>
            </div>
            <div className="rounded-2xl border border-line/70 bg-slate-950/50 p-4">
              <div className="flex justify-between gap-4"><span className="text-slate-500">Token</span><span>{shortAddress(activity.mint, 8, 8)}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Trader</span><span>{activity.trader ? shortAddress(activity.trader, 8, 8) : 'Simulator / N.A.'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Timestamp</span><span>{formatTimestamp(activity.timestamp)}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Slot</span><span>{activity.slot ?? '--'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Execution price</span><span>{activity.priceSol != null ? `${formatNumber(activity.priceSol, 6)} SOL` : '--'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">SOL amount</span><span>{toSol(activity.solAmount).toFixed(6)} SOL</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Token amount</span><span>{activity.tokenAmount}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">MC</span><span>{activity.mc ? `${(Number(activity.mc) / 1e9).toFixed(2)} SOL` : '--'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Liquidity</span><span>{activity.liquiditySol != null ? `${formatNumber(activity.liquiditySol, 2)} SOL` : 'Unavailable'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">PnL</span><span>{activity.pnlSol != null ? `${activity.pnlSol >= 0 ? '+' : ''}${formatNumber(activity.pnlSol, 4)} SOL` : 'Unavailable'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Return</span><span>{activity.returnPct != null ? `${activity.returnPct >= 0 ? '+' : ''}${formatNumber(activity.returnPct, 2)}%` : 'Unavailable'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Holding duration</span><span>{activity.holdingDurationSec != null ? `${formatNumber(activity.holdingDurationSec, 1)}s` : 'Unavailable'}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="text-slate-500">Transaction</span><span>{activity.signature ? shortAddress(activity.signature, 8, 8) : 'Unavailable in dataset'}</span></div>
            </div>
            <div className="rounded-2xl border border-line/70 bg-slate-950/50 p-4 text-slate-400">{activity.detail}</div>
          </>
        ) : (
          <p className="text-slate-400">Select a marker or activity row to inspect trade details.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from 'react';
import type { ActivityRow } from '@/types/domain';
import { Panel } from '@/components/ui/panel';
import { formatNumber, formatTimestamp, shortAddress, toSol } from '@/lib/utils';

type TradeFilter = 'all' | 'buy' | 'sell' | 'profitable' | 'losing';
type SortKey = 'time' | 'price' | 'sol' | 'mc' | 'pnl';

export function TradeTablePanel({
  rows,
  selectedActivityId,
  onSelect
}: {
  rows: ActivityRow[];
  selectedActivityId: string | null;
  onSelect: (row: ActivityRow) => void;
}) {
  const [filter, setFilter] = useState<TradeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredRows = useMemo(() => {
    const next = rows.filter((row) => {
      if (filter === 'buy') return row.type === 'BUY' || row.type === 'SWAP';
      if (filter === 'sell') return row.type === 'SELL';
      if (filter === 'profitable') return row.profitable === true;
      if (filter === 'losing') return row.profitable === false;
      return true;
    });

    const direction = sortDir === 'asc' ? 1 : -1;
    next.sort((a, b) => {
      const valueA =
        sortKey === 'time'
          ? a.timestamp ?? 0
          : sortKey === 'price'
            ? a.priceSol ?? -Infinity
            : sortKey === 'sol'
              ? toSol(a.solAmount)
              : sortKey === 'mc'
                ? a.mc
                  ? Number(a.mc) / 1e9
                  : -Infinity
                : a.pnlSol ?? -Infinity;
      const valueB =
        sortKey === 'time'
          ? b.timestamp ?? 0
          : sortKey === 'price'
            ? b.priceSol ?? -Infinity
            : sortKey === 'sol'
              ? toSol(b.solAmount)
              : sortKey === 'mc'
                ? b.mc
                  ? Number(b.mc) / 1e9
                  : -Infinity
                : b.pnlSol ?? -Infinity;
      return valueA > valueB ? direction : valueA < valueB ? -direction : 0;
    });
    return next;
  }, [filter, rows, sortDir, sortKey]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === 'time' ? 'desc' : 'asc');
  }

  return (
    <Panel
      className="flex flex-col xl:h-[430px]"
      contentClassName="flex-1 min-h-0 p-0"
      title="Trade Table"
      subtitle="Synchronized trade list for the currently selected token."
      actions={
        <div className="flex flex-wrap gap-2">
          {(['all', 'buy', 'sell', 'profitable', 'losing'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                filter === value
                  ? 'border-[#3b4460] bg-[#151d2e] text-white'
                  : 'border-[#222b3c] bg-[#101621] text-slate-400'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      }
    >
      {filteredRows.length ? (
        <div className="h-full min-h-0 overflow-auto px-5 pb-5 pt-4">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#0b111b] text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort('time')}>Time</th>
                <th className="pb-3 pr-4">Side</th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort('price')}>Price</th>
                <th className="pb-3 pr-4">Token amount</th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort('sol')}>SOL amount</th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort('mc')}>Market cap</th>
                <th className="pb-3 pr-4">Wallet</th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort('pnl')}>PnL</th>
                <th className="pb-3">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row)}
                  className={`cursor-pointer border-t border-line/60 transition hover:bg-slate-900/40 ${
                    selectedActivityId === row.id ? 'bg-accent/5' : ''
                  }`}
                >
                  <td className="py-3 pr-4 text-slate-300">{formatTimestamp(row.timestamp)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        row.type === 'SELL'
                          ? 'bg-danger/10 text-danger'
                          : row.type === 'SWAP'
                            ? 'bg-warn/10 text-warn'
                            : 'bg-success/10 text-success'
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">
                    {row.priceSol != null ? formatNumber(row.priceSol, 6) : '--'}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{row.tokenAmount}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatNumber(toSol(row.solAmount), 4)}</td>
                  <td className="py-3 pr-4 text-slate-300">
                    {row.mc ? `${formatNumber(Number(row.mc) / 1e9, 2)} SOL` : '--'}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">
                    {row.trader ? shortAddress(row.trader, 6, 6) : 'Simulator'}
                  </td>
                  <td className={`py-3 pr-4 ${row.pnlSol != null && row.pnlSol < 0 ? 'text-danger' : 'text-success'}`}>
                    {row.pnlSol != null ? `${row.pnlSol >= 0 ? '+' : ''}${formatNumber(row.pnlSol, 4)}` : '--'}
                  </td>
                  <td className="py-3 text-slate-400">
                    {row.signature ? shortAddress(row.signature, 6, 6) : 'Unavailable'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex h-full min-h-0 items-center px-5 pb-5 pt-4">
          <p className="text-sm text-slate-400">No trades match the current table filter.</p>
        </div>
      )}
    </Panel>
  );
}

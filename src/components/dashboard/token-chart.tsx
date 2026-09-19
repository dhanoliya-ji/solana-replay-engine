"use client";

import { useMemo, useState } from 'react';
import type { ActivityRow, NormalizedToken, SimulationRunPayload } from '@/types/domain';
import {
  buildCandlestickSeries,
  type ChartMetric,
  getSimulationTradesForMint
} from '@/lib/chart/series';
import { TradingviewCandlestickChart } from '@/components/dashboard/tradingview-candlestick-chart';
import { formatTimestamp, shortAddress, toSol } from '@/lib/utils';

const INTERVALS = [
  { label: '1s', value: 1_000 },
  { label: '5s', value: 5_000 },
  { label: '15s', value: 15_000 },
  { label: '30s', value: 30_000 },
  { label: '1m', value: 60_000 }
] as const;

const LEGEND = [
  { label: 'Target Buy', color: '#84cc16' },
  { label: 'Target Sell', color: '#f87171' },
  { label: 'My Buy', color: '#60a5fa' },
  { label: 'My Sell', color: '#8b5cf6' }
] as const;

function BarsGlyph() {
  return (
    <div className="flex items-end gap-1">
      <span className="h-4 w-1.5 rounded-full bg-[#4f46e5]" />
      <span className="h-7 w-1.5 rounded-full bg-[#3b82f6]" />
      <span className="h-10 w-1.5 rounded-full bg-[#06b6d4]" />
      <span className="h-6 w-1.5 rounded-full bg-[#8b5cf6]" />
    </div>
  );
}

const CHART_WRAPPER =
  'flex flex-col overflow-hidden rounded-[18px] border border-[#1b2333] bg-[#0a1019]/95 shadow-[0_12px_36px_rgba(2,8,23,0.3)] xl:h-[520px]';

export function TokenChart({
  token,
  analysisWallets,
  simulation,
  onSelectActivity
}: {
  token: NormalizedToken | null;
  analysisWallets: string[];
  simulation: SimulationRunPayload | null;
  onSelectActivity: (activity: ActivityRow) => void;
}) {
  const [metric, setMetric] = useState<ChartMetric>('mc');
  const [intervalMs, setIntervalMs] = useState<number>(1_000);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const walletSet = useMemo(() => new Set(analysisWallets), [analysisWallets]);

  const simulationTrades = useMemo(
    () => (token ? getSimulationTradesForMint(simulation, token.mint) : []),
    [simulation, token]
  );
  const candles = useMemo(
    () => (token ? buildCandlestickSeries(token, metric, intervalMs) : []),
    [intervalMs, metric, token]
  );

  const markers = useMemo(() => {
    if (!token) return [];
    const targetMarkers = token.trades
      .filter((trade) => trade.trader && walletSet.has(trade.trader))
      .map((trade) => ({
        source: 'target' as const,
        id: trade.id,
        type: trade.type,
        timestamp: trade.timestamp,
        slot: trade.slot,
        value:
          metric === 'price'
            ? Number(trade.tokenAmount) > 0
              ? toSol(trade.solAmount) / Number(trade.tokenAmount)
              : 0
            : metric === 'liquidity'
              ? trade.reserves?.virtualSolReserves
                ? Number(trade.reserves.virtualSolReserves) / 1e9
                : 0
              : trade.mc
              ? Number(trade.mc) / 1e9
              : 0,
        detail: `${trade.type} by tracked wallet ${shortAddress(trade.trader, 5, 5)}`,
        trader: trade.trader,
        tokenAmount: trade.tokenAmount,
        solAmount: trade.solAmount,
        mc: trade.mc,
        activity: {
          id: trade.id,
          mint: token.mint,
          source: 'target' as const,
          type: trade.type,
          trader: trade.trader,
          timestamp: trade.timestamp,
          slot: trade.slot,
          tokenAmount: trade.tokenAmount,
          solAmount: trade.solAmount,
          mc: trade.mc,
          detail: `${trade.type} by tracked wallet ${shortAddress(trade.trader, 5, 5)}`
        }
      }));

    const simMarkers = simulationTrades.map((trade, index) => ({
      source: 'simulated' as const,
      id: `${trade.mint}-${trade.type}-${index}`,
      type: trade.type,
      timestamp: trade.timestamp,
      slot: trade.executedAtSlot ?? trade.slot ?? null,
      value:
        metric === 'price'
          ? 0
          : trade.mc
            ? Number(trade.mc) / 1e9
            : 0,
      detail: trade.reason ?? `${trade.type} from simulator`,
      trader: null,
      tokenAmount: '0',
      solAmount: trade.solAmount,
      mc: trade.mc,
      activity: {
        id: `${trade.mint}-${trade.type}-${index}`,
        mint: trade.mint,
        source: 'simulated' as const,
        type: trade.type,
        trader: null,
        timestamp: trade.timestamp,
        slot: trade.executedAtSlot ?? trade.slot ?? null,
        tokenAmount: '0',
        solAmount: trade.solAmount,
        mc: trade.mc,
        detail: trade.reason ?? `${trade.type} from simulator`
      }
    }));

    return [...targetMarkers, ...simMarkers];
  }, [metric, simulationTrades, token, walletSet]);

  const latestTimestamp = token?.trades[token.trades.length - 1]?.timestamp ?? null;
  const tokenLabel = 'Market overview';
  const tokenMintLabel = token ? shortAddress(token.mint, 8, 8) : 'Select an asset to inspect market activity';

  return (
    <section className={CHART_WRAPPER}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#171d29] px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1a2240] text-sm font-semibold text-[#a5b4fc]">
            {token ? token.mint[0]?.toUpperCase() : 'M'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[28px] font-semibold leading-none tracking-tight text-slate-100">
                {tokenLabel}
              </h2>
              {token ? (
                <span className="rounded-md border border-[#21522f] bg-[#11321b] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4ade80]">
                  Live
                </span>
              ) : null}
            </div>
            <div className="mt-2 inline-flex rounded-md bg-[#101621] px-2.5 py-1 text-sm text-slate-500">
              {tokenMintLabel}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[#222b3c] bg-[#101621] p-1">
            {([
              ['mc', 'Market cap'],
              ['liquidity', 'Liquidity']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMetric(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  metric === value
                    ? 'bg-[#24314d] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowMarkers((current) => !current)}
            className="rounded-xl border border-[#222b3c] bg-[#101621] px-3 py-2 text-xs font-semibold text-slate-300"
          >
            {showMarkers ? 'Hide markers' : 'Show markers'}
          </button>
          <button
            type="button"
            onClick={() => setShowVolume((current) => !current)}
            className="rounded-xl border border-[#222b3c] bg-[#101621] px-3 py-2 text-xs font-semibold text-slate-300"
          >
            {showVolume ? 'Hide volume' : 'Show volume'}
          </button>
        </div>
      </div>

      <div className="border-b border-[#171d29] px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Interval
          </span>
          {INTERVALS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setIntervalMs(item.value)}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                intervalMs === item.value
                  ? 'border-[#2c8f45] bg-[#2e9b47] text-white'
                  : 'border-[#222b3c] bg-[#101621] text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        <TradingviewCandlestickChart
          candles={candles}
          markers={markers}
          onSelectActivity={onSelectActivity}
          view={metric === 'price' ? 'price' : 'mc'}
          showVolume={showVolume}
          showMarkers={showMarkers}
        />
        {!token ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <BarsGlyph />
            <div className="mt-6 text-[40px] font-semibold leading-none tracking-tight text-slate-100">
              Your market canvas is ready
            </div>
            <p className="mt-4 max-w-[540px] text-lg text-slate-500">
              Import token data and choose an asset to explore entries, exits, and strategy
              performance.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#171d29] px-4 py-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-5">
          {LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div>
          {token
            ? `Latest event ${formatTimestamp(latestTimestamp)}`
            : 'Select a token to begin replay'}
        </div>
      </div>
    </section>
  );
}

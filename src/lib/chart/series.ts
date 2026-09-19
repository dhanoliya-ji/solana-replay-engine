import type {
  ChartCandle,
  ChartPoint,
  NormalizedTrade,
  NormalizedToken,
  SimulationRunPayload
} from '@/types/domain';
import { toSol, toTokenUnits } from '@/lib/utils';

export type ChartMetric = 'price' | 'mc' | 'liquidity';

function getTradeMetricValue(trade: NormalizedTrade, metric: ChartMetric) {
  const mcSol = trade.mc ? Number(trade.mc) / 1e9 : null;
  const priceSol =
    toTokenUnits(trade.tokenAmount) > 0
      ? toSol(trade.solAmount) / toTokenUnits(trade.tokenAmount)
      : null;
  const liquiditySol = trade.reserves?.virtualSolReserves
    ? Number(trade.reserves.virtualSolReserves) / 1e9
    : null;

  if (metric === 'mc') return { value: mcSol, mcSol, priceSol, liquiditySol };
  if (metric === 'liquidity') return { value: liquiditySol, mcSol, priceSol, liquiditySol };
  return { value: priceSol, mcSol, priceSol, liquiditySol };
}

function buildRawSeries(token: NormalizedToken, metric: ChartMetric): ChartPoint[] {
  return token.trades.map((trade, index) => {
    const { value, mcSol, priceSol } = getTradeMetricValue(trade, metric);
    return {
      index,
      timestamp: trade.timestamp,
      slot: trade.slot,
      value: value ?? Number.NaN,
      mcSol,
      priceSol,
      label: trade.timestamp ? new Date(trade.timestamp).toLocaleTimeString() : `Trade ${index + 1}`
    } satisfies ChartPoint;
  });
}

export function buildChartSeries(
  token: NormalizedToken,
  metric: ChartMetric,
  intervalMs: number | null
): ChartPoint[] {
  const raw = buildRawSeries(token, metric);

  if (!intervalMs || raw.length <= 2) return raw;

  const sampled: ChartPoint[] = [];
  let currentBucket = Number.NEGATIVE_INFINITY;
  let latestPoint: ChartPoint | null = null;

  for (const point of raw) {
    const ts = point.timestamp ?? point.index * intervalMs;
    const bucket = Math.floor(ts / intervalMs);
    if (bucket !== currentBucket) {
      if (latestPoint) sampled.push(latestPoint);
      currentBucket = bucket;
    }
    latestPoint = point;
  }

  if (latestPoint) sampled.push(latestPoint);
  return sampled;
}

export function buildCandlestickSeries(
  token: NormalizedToken,
  metric: ChartMetric,
  intervalMs: number
): ChartCandle[] {
  const raw = buildRawSeries(token, metric).filter((point) => Number.isFinite(point.value));
  if (!raw.length) return [];

  const buckets = new Map<number, Array<{ point: ChartPoint; trade: NormalizedTrade }>>();

  for (const point of raw) {
    const sourceTs = point.timestamp ?? point.index * intervalMs;
    const bucketStart = Math.floor(sourceTs / intervalMs) * intervalMs;
    const trade = token.trades[point.index];
    if (!trade) continue;
    const existing = buckets.get(bucketStart);
    const row = { point, trade };
    if (existing) existing.push(row);
    else buckets.set(bucketStart, [row]);
  }

  const sortedBucketStarts = [...buckets.keys()].sort((a, b) => a - b);
  let previousClose: number | null = null;

  const candles = sortedBucketStarts.map((bucketStart, index) => {
    const rows = buckets.get(bucketStart) ?? [];
    const ordered = [...rows].sort((a, b) => {
      const tsA = a.point.timestamp ?? 0;
      const tsB = b.point.timestamp ?? 0;
      if (tsA !== tsB) return tsA - tsB;
      return (a.point.slot ?? 0) - (b.point.slot ?? 0);
    });
    const values = ordered.map((row) => row.point.value);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const open = previousClose ?? first.point.value;
    const close = last.point.value;
    const high = Math.max(open, ...values);
    const low = Math.min(open, ...values);
    const volume = ordered.reduce((sum, row) => sum + toSol(row.trade.solAmount), 0);
    const buyVolume = ordered
      .filter((row) => row.trade.type === 'BUY' || row.trade.type === 'SWAP')
      .reduce((sum, row) => sum + toSol(row.trade.solAmount), 0);
    const sellVolume = ordered
      .filter((row) => row.trade.type === 'SELL')
      .reduce((sum, row) => sum + toSol(row.trade.solAmount), 0);
    const buyTradeCount = ordered.filter(
      (row) => row.trade.type === 'BUY' || row.trade.type === 'SWAP'
    ).length;
    const sellTradeCount = ordered.filter((row) => row.trade.type === 'SELL').length;
    previousClose = close;

    return {
      index,
      bucketStart,
      bucketEnd: bucketStart + intervalMs,
      timestamp: last.point.timestamp ?? bucketStart,
      open,
      high,
      low,
      close,
      slot: last.point.slot,
      tradeCount: ordered.length,
      label: new Date(bucketStart).toLocaleTimeString(),
      volume,
      buyVolume,
      sellVolume,
      buyTradeCount,
      sellTradeCount
    } satisfies ChartCandle;
  });

  if (candles.length === 1) {
    return [
      {
        ...candles[0],
        high: Math.max(candles[0].open, candles[0].high, candles[0].close),
        low: Math.min(candles[0].open, candles[0].low, candles[0].close)
      }
    ];
  }

  return candles;
}

export function getSimulationTradesForMint(simulation: SimulationRunPayload | null, mint: string) {
  if (!simulation) return [];
  return [...simulation.buyTrades, ...simulation.sellTrades].filter((trade) => trade.mint === mint);
}

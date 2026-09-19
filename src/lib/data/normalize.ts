import type { NormalizedDataset, NormalizedToken, NormalizedTrade, DatasetShape } from '@/types/domain';

type JsonRecord = Record<string, unknown>;

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dataset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function maybeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function maybeString(value: unknown) {
  return value == null ? null : String(value);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function normalizeTrade(input: unknown, mint: string, index: number): NormalizedTrade {
  const raw = asRecord(input);
  const reserves = asRecord(raw.reserves);
  return {
    id: `${mint}-${raw.slot ?? 'slot'}-${raw.timestamp ?? 'ts'}-${index}-${raw.type ?? 'NA'}`,
    type: raw.type === 'SELL' ? 'SELL' : raw.type === 'SWAP' ? 'SWAP' : 'BUY',
    mint: maybeString(raw.mint) ?? mint,
    trader: maybeString(raw.trader),
    tokenAmount: maybeString(raw.tokenAmount) ?? '0',
    solAmount: maybeString(raw.solAmount) ?? '0',
    mc: maybeString(raw.mc),
    traderHolding: maybeString(raw.traderHolding),
    totalHolding: maybeString(raw.totalHolding),
    reserves: Object.keys(reserves).length
      ? {
          virtualTokenReserves: maybeString(reserves.virtualTokenReserves),
          virtualSolReserves: maybeString(reserves.virtualSolReserves),
          mc: maybeString(reserves.mc)
        }
      : null,
    slot: maybeNumber(raw.slot),
    timestamp: maybeNumber(raw.timestamp),
    isSimulated: Boolean(raw.isMyTrade || raw.isSimulated)
  };
}

function normalizeToken(input: unknown, fallbackMint: string): NormalizedToken {
  const raw = asRecord(input);
  const mint = maybeString(raw.mint) ?? fallbackMint;
  const tradesRaw = Array.isArray(raw.trades) ? raw.trades : [];
  const trades = tradesRaw.map((trade, index) => normalizeTrade(trade, mint, index));
  trades.sort((a: NormalizedTrade, b: NormalizedTrade) => {
    const tsA = a.timestamp ?? 0;
    const tsB = b.timestamp ?? 0;
    if (tsA !== tsB) return tsA - tsB;
    return (a.slot ?? 0) - (b.slot ?? 0);
  });
  const curveState = asRecord(raw.curveState);
  return {
    mint,
    creator: maybeString(raw.creator),
    createdAt: maybeNumber(raw.createdAt),
    createSlot: maybeNumber(raw.createSlot),
    mc: maybeString(raw.mc),
    totalHolding: maybeString(raw.totalHolding),
    traderCount: maybeNumber(raw.traderCount),
    buyCount: maybeNumber(raw.buyCount),
    sellCount: maybeNumber(raw.sellCount),
    slotGapBuyCount: maybeNumber(raw.slotGapBuyCount),
    lastBuySlot: maybeNumber(raw.lastBuySlot),
    lastSellSlot: maybeNumber(raw.lastSellSlot),
    firstSlotHolding: maybeString(raw.firstSlotHolding),
    firstSlotBuyAmount: maybeString(raw.firstSlotBuyAmount),
    firstSlotTraders: Array.isArray(raw.firstSlotTraders) ? raw.firstSlotTraders.map((value: unknown) => String(value)) : [],
    allHolders: Array.isArray(raw.allHolders)
      ? raw.allHolders
          .map((holder) => asRecord(holder))
          .filter((holder) => holder.trader != null)
          .map((holder) => ({ trader: String(holder.trader), amount: maybeString(holder.amount) ?? '0' }))
      : [],
    curveState: Object.keys(curveState).length
      ? {
          virtualTokenReserves: maybeString(curveState.virtualTokenReserves),
          virtualSolReserves: maybeString(curveState.virtualSolReserves),
          mc: maybeString(curveState.mc)
        }
      : null,
    trades
  };
}

export function normalizeDataset(input: unknown, source: { kind: 'local' | 'upload'; label: string; fileName?: string }): NormalizedDataset {
  const shape: DatasetShape = Array.isArray(input) ? 'array' : 'mint-keyed';
  const rawTokens = Array.isArray(input)
    ? input.map((token, index) => normalizeToken(token, `token-${index}`))
    : Object.entries((input ?? {}) as Record<string, unknown>).map(([mint, token]) => normalizeToken(token, mint));

  const tokens = rawTokens.filter((token) => token.mint).sort((a, b) => {
    const tsA = a.createdAt ?? a.trades[0]?.timestamp ?? 0;
    const tsB = b.createdAt ?? b.trades[0]?.timestamp ?? 0;
    if (tsA !== tsB) return tsA - tsB;
    return a.mint.localeCompare(b.mint);
  });

  const wallets = new Set<string>();
  let tradeCount = 0;
  let minTimestamp: number | null = null;
  let maxTimestamp: number | null = null;

  for (const token of tokens) {
    tradeCount += token.trades.length;
    for (const trade of token.trades) {
      if (trade.trader) wallets.add(trade.trader);
      if (trade.timestamp != null) {
        minTimestamp = minTimestamp == null ? trade.timestamp : Math.min(minTimestamp, trade.timestamp);
        maxTimestamp = maxTimestamp == null ? trade.timestamp : Math.max(maxTimestamp, trade.timestamp);
      }
    }
  }

  return {
    id: makeId(),
    sourceKind: source.kind,
    sourceLabel: source.label,
    sourceFileName: source.fileName,
    loadedAt: new Date().toISOString(),
    shape,
    tokenCount: tokens.length,
    tradeCount,
    uniqueWalletCount: wallets.size,
    minTimestamp,
    maxTimestamp,
    tokens
  };
}

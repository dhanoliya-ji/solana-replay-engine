export type TradeType = 'BUY' | 'SELL' | 'SWAP';

export interface ReserveSnapshot {
  virtualTokenReserves?: string | null;
  virtualSolReserves?: string | null;
  mc?: string | null;
}

export interface NormalizedTrade {
  id: string;
  type: TradeType;
  mint: string;
  trader: string | null;
  tokenAmount: string;
  solAmount: string;
  mc: string | null;
  traderHolding: string | null;
  totalHolding: string | null;
  reserves?: ReserveSnapshot | null;
  slot: number | null;
  timestamp: number | null;
  isSimulated?: boolean;
}

export interface NormalizedToken {
  mint: string;
  creator: string | null;
  createdAt: number | null;
  createSlot: number | null;
  mc: string | null;
  totalHolding: string | null;
  traderCount: number | null;
  buyCount: number | null;
  sellCount: number | null;
  slotGapBuyCount: number | null;
  lastBuySlot: number | null;
  lastSellSlot: number | null;
  firstSlotHolding: string | null;
  firstSlotBuyAmount: string | null;
  firstSlotTraders: string[];
  allHolders: Array<{ trader: string; amount: string }>;
  curveState?: ReserveSnapshot | null;
  trades: NormalizedTrade[];
}

export type DatasetShape = 'mint-keyed' | 'array';
export type DatasetSourceKind = 'local' | 'upload';

export interface NormalizedDataset {
  id: string;
  sourceKind: DatasetSourceKind;
  sourceLabel: string;
  sourceFileName?: string;
  loadedAt: string;
  shape: DatasetShape;
  tokenCount: number;
  tradeCount: number;
  uniqueWalletCount: number;
  minTimestamp: number | null;
  maxTimestamp: number | null;
  tokens: NormalizedToken[];
}

export interface LocalDataFile {
  name: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface SimulationSettings {
  targetWallet: string;
  buyAmount: number;
  minMcSol: number | null;
  maxMcSol: number | null;
  takeProfitPercent: number | null;
  stopLossPercent: number | null;
  trailingStopPercent: number | null;
  trailingMinProfitPercent: number | null;
  maxHoldSeconds: number | null;
  breakEvenProfitPercent: number | null;
  breakEvenDrawdownPercent: number | null;
  maxHolderPercent: number | null;
  maxTop3HolderPercent: number | null;
  momentumFailSeconds: number | null;
  momentumFailProfitPercent: number | null;
}

export interface SimulationSummary {
  totalPnL: number;
  winCount: number;
  sellCount: number;
  buyCount: number;
  winRate: string;
  avgPnlPerTrade: number;
  elapsedSeconds: number;
  tokenCount: number;
  buyAmountSol: number;
  targetWallet: string;
  topWinners: Array<{ mint: string; pnl: number; multiplier: number }>;
  topLosers: Array<{ mint: string; pnl: number; multiplier: number }>;
}

export interface SimulationTrade {
  type: TradeType;
  mint: string;
  amount?: number;
  mc: string | null;
  solAmount: string;
  timestamp: number | null;
  slot?: number | null;
  executedAtSlot?: number | null;
  reason?: string;
  pnl?: number;
}

export interface SimulationRunPayload {
  summary: SimulationSummary;
  buyTrades: SimulationTrade[];
  sellTrades: SimulationTrade[];
  myTradesForUi: SimulationTrade[];
  logText: string;
}

export interface SimulationProgress {
  processed: number;
  total: number;
  mint?: string;
}

export interface SimulationJobState {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  progress: SimulationProgress;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  payload?: SimulationRunPayload;
}

export type WalletFilter = 'all' | string;
export type TokenGroup = 'all' | 'simulated' | 'target' | 'shared' | 'missed' | 'only-simulated' | 'only-target';
export type DistributionKind = 'simulated' | 'target' | 'side-by-side';

export interface TokenComparisonRow {
  mint: string;
  creator: string | null;
  currentMcSol: number | null;
  latestTimestamp: number | null;
  totalTrades: number;
  targetTradeCount: number;
  targetBuyCount: number;
  targetSellCount: number;
  targetSpentSol: number;
  targetReceivedSol: number;
  targetNetTokens: number;
  targetPnLSol: number;
  targetReturnPct: number | null;
  simulationTradeCount: number;
  simulationBuyCount: number;
  simulationSellCount: number;
  simulationSpentSol: number;
  simulationReceivedSol: number;
  simulationPnLSol: number;
  simulationReturnPct: number | null;
  hasTargetActivity: boolean;
  hasSimulationActivity: boolean;
  shared: boolean;
  missed: boolean;
  onlySimulated: boolean;
  onlyTarget: boolean;
}

export interface ComparisonSummary {
  simulatedPnLSol: number;
  targetPnLSol: number;
  simulatedWinRate: number;
  targetWinRate: number;
  sharedAssets: number;
  targetOnlyAssets: number;
  simulatedOnlyAssets: number;
  missedAssets: number;
  targetPositionCount: number;
  simulatedPositionCount: number;
  totalTargetTrades: number;
  totalSimulationTrades: number;
  missedOpportunityPnL: number;
}

export interface DistributionBucket {
  label: string;
  min: number;
  max: number | null;
  tokenCount: number;
  percentOfTotal: number;
  pnlContribution: number;
}

export interface ActivityRow {
  id: string;
  mint: string;
  source: 'market' | 'target' | 'simulated';
  type: TradeType;
  trader: string | null;
  timestamp: number | null;
  slot: number | null;
  tokenAmount: string;
  solAmount: string;
  mc: string | null;
  detail: string;
  priceSol?: number | null;
  volumeSol?: number | null;
  liquiditySol?: number | null;
  pnlSol?: number | null;
  returnPct?: number | null;
  holdingDurationSec?: number | null;
  signature?: string | null;
  profitable?: boolean | null;
}

export interface ChartPoint {
  index: number;
  timestamp: number | null;
  slot: number | null;
  value: number;
  mcSol: number | null;
  priceSol: number | null;
  label: string;
}

export interface ChartCandle {
  index: number;
  bucketStart: number;
  bucketEnd: number;
  timestamp: number | null;
  open: number;
  high: number;
  low: number;
  close: number;
  slot: number | null;
  tradeCount: number;
  label: string;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  buyTradeCount: number;
  sellTradeCount: number;
}

/**
 * ============================================================================
 * LIVE SOLANA MONITORING & DRY-RUN SIMULATION TYPES
 * ============================================================================
 * PROBLEM ADDRESSED:
 * The original system only supported offline/historical replay of static JSON files.
 * There were no TypeScript contracts for real-time Solana RPC/WebSocket streaming,
 * live position tracking in dry-run mode, or real-time simulation metrics.
 *
 * WHAT WAS FIXED & ADDED:
 * 1. LiveMonitorStatus: Tracks real-time connection state ('idle' | 'connecting' | 'active' | 'error' | 'stopped').
 * 2. LiveTradeEvent: Represents real-time transaction payloads streamed from Solana RPC / WebSocket.
 * 3. LivePosition: Represents open positions maintained in dry-run memory (entry MC, peak MC, current profit %).
 * 4. LiveClosedTrade: Represents completed dry-run simulated trades with realized PnL.
 * 5. LiveMonitorState: Complete snapshot of live system performance (total PnL, win rate, logs, RPC stats).
 * 6. LiveMonitorSettings: Configuration parameters combining copy-trading strategy thresholds and RPC endpoints.
 * ============================================================================
 */

export type LiveMonitorStatus = 'idle' | 'connecting' | 'active' | 'error' | 'stopped';

export interface LiveTradeEvent {
  id: string;
  mint: string;
  trader: string;
  type: TradeType;
  tokenAmount: string;
  solAmount: string;
  mc: string;
  slot: number;
  timestamp: number;
  signature?: string;
  source: 'solana-rpc' | 'solana-websocket' | 'pumpportal' | 'fallback-stream';
}

export interface LivePosition {
  mint: string;
  buyPriceSol: number;
  buyMcSol: number;
  buySlot: number;
  buyTimestamp: number;
  maxMcSol: number;
  solAmount: number;
  tokenAmount: string;
  currentMcSol: number;
  currentProfitPct: number;
  targetWallet: string;
  entryTxSignature?: string;
}

export interface LiveClosedTrade {
  id: string;
  mint: string;
  buyTimestamp: number;
  sellTimestamp: number;
  buyMcSol: number;
  sellMcSol: number;
  solInvested: number;
  solReturned: number;
  pnlSol: number;
  pnlPercent: number;
  exitReason: string;
  holdingDurationSec: number;
}

export interface LiveMonitorSettings extends SimulationSettings {
  rpcEndpoint: string;
  useFallbackFeed: boolean;
  pollIntervalMs: number;
}

export interface LiveMonitorLogMessage {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: Record<string, unknown>;
}

export interface LiveMonitorState {
  status: LiveMonitorStatus;
  targetWallet: string;
  rpcEndpoint: string;
  activePositions: LivePosition[];
  closedTrades: LiveClosedTrade[];
  totalPnLSol: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  tradesProcessedCount: number;
  eventsProcessedCount: number;
  lastUpdatedTimestamp: number;
  startedTimestamp: number | null;
  logs: LiveMonitorLogMessage[];
  errorMessage: string | null;
  isDryRun: boolean;
}


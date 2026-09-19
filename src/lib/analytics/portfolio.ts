import type {
  ComparisonSummary,
  NormalizedDataset,
  SimulationRunPayload,
  TokenComparisonRow,
  TokenGroup
} from '@/types/domain';
import { toSol, toTokenUnits } from '@/lib/utils';

function returnPct(spent: number, pnl: number) {
  if (!(spent > 0)) return null;
  return (pnl / spent) * 100;
}

export function buildComparison(dataset: NormalizedDataset, analysisWallets: string[], simulation: SimulationRunPayload | null) {
  const walletSet = new Set(analysisWallets.filter(Boolean));
  const simTradesByMint = new Map<string, Array<{ type: string; solAmount: string; pnl?: number }>>();

  for (const trade of [...(simulation?.buyTrades ?? []), ...(simulation?.sellTrades ?? [])]) {
    const rows = simTradesByMint.get(trade.mint) ?? [];
    rows.push({ type: trade.type, solAmount: trade.solAmount, pnl: trade.pnl });
    simTradesByMint.set(trade.mint, rows);
  }

  const rows: TokenComparisonRow[] = dataset.tokens.map((token) => {
    const targetTrades = walletSet.size
      ? token.trades.filter((trade) => trade.trader && walletSet.has(trade.trader))
      : [];

    let targetSpentSol = 0;
    let targetReceivedSol = 0;
    let targetNetTokens = 0;
    let targetBuyCount = 0;
    let targetSellCount = 0;

    for (const trade of targetTrades) {
      const sol = toSol(trade.solAmount);
      const tokenUnits = toTokenUnits(trade.tokenAmount);
      if (trade.type === 'SELL') {
        targetReceivedSol += sol;
        targetNetTokens -= tokenUnits;
        targetSellCount += 1;
      } else {
        targetSpentSol += sol;
        targetNetTokens += tokenUnits;
        targetBuyCount += 1;
      }
    }

    const lastTrade = token.trades[token.trades.length - 1];
    const latestTimestamp = lastTrade?.timestamp ?? token.createdAt ?? null;
    const latestPriceSol = lastTrade && toTokenUnits(lastTrade.tokenAmount) > 0
      ? toSol(lastTrade.solAmount) / toTokenUnits(lastTrade.tokenAmount)
      : 0;
    const markToMarket = targetNetTokens > 0 ? targetNetTokens * latestPriceSol : 0;
    const targetPnLSol = targetReceivedSol + markToMarket - targetSpentSol;

    const simRows = simTradesByMint.get(token.mint) ?? [];
    let simulationSpentSol = 0;
    let simulationReceivedSol = 0;
    let simulationBuyCount = 0;
    let simulationSellCount = 0;

    for (const trade of simRows) {
      const sol = toSol(trade.solAmount);
      if (trade.type === 'SELL') {
        simulationReceivedSol += sol;
        simulationSellCount += 1;
      } else {
        simulationSpentSol += sol;
        simulationBuyCount += 1;
      }
    }

    const simulationPnLSol = simulationReceivedSol - simulationSpentSol;
    const hasTargetActivity = targetTrades.length > 0;
    const hasSimulationActivity = simRows.length > 0;
    const onlyTarget = hasTargetActivity && !hasSimulationActivity;
    const missed = onlyTarget && targetPnLSol > 0;

    return {
      mint: token.mint,
      creator: token.creator,
      currentMcSol: lastTrade?.mc ? Number(lastTrade.mc) / 1e9 : token.curveState?.mc ? Number(token.curveState.mc) / 1e9 : null,
      latestTimestamp,
      totalTrades: token.trades.length,
      targetTradeCount: targetTrades.length,
      targetBuyCount,
      targetSellCount,
      targetSpentSol,
      targetReceivedSol,
      targetNetTokens,
      targetPnLSol,
      targetReturnPct: returnPct(targetSpentSol, targetPnLSol),
      simulationTradeCount: simRows.length,
      simulationBuyCount,
      simulationSellCount,
      simulationSpentSol,
      simulationReceivedSol,
      simulationPnLSol,
      simulationReturnPct: returnPct(simulationSpentSol, simulationPnLSol),
      hasTargetActivity,
      hasSimulationActivity,
      shared: hasTargetActivity && hasSimulationActivity,
      missed,
      onlySimulated: hasSimulationActivity && !hasTargetActivity,
      onlyTarget
    };
  });

  const targetRows = rows.filter((row) => row.hasTargetActivity);
  const simRows = rows.filter((row) => row.hasSimulationActivity);
  const targetWins = targetRows.filter((row) => row.targetPnLSol > 0).length;
  const simWins = simRows.filter((row) => row.simulationPnLSol > 0).length;

  const summary: ComparisonSummary = {
    simulatedPnLSol: simRows.reduce((sum, row) => sum + row.simulationPnLSol, 0),
    targetPnLSol: targetRows.reduce((sum, row) => sum + row.targetPnLSol, 0),
    simulatedWinRate: simRows.length ? (simWins / simRows.length) * 100 : 0,
    targetWinRate: targetRows.length ? (targetWins / targetRows.length) * 100 : 0,
    sharedAssets: rows.filter((row) => row.shared).length,
    targetOnlyAssets: rows.filter((row) => row.onlyTarget).length,
    simulatedOnlyAssets: rows.filter((row) => row.onlySimulated).length,
    missedAssets: rows.filter((row) => row.missed).length,
    targetPositionCount: rows.filter((row) => row.targetNetTokens > 0).length,
    simulatedPositionCount: rows.filter((row) => row.simulationTradeCount > 0).length,
    totalTargetTrades: rows.reduce((sum, row) => sum + row.targetTradeCount, 0),
    totalSimulationTrades: rows.reduce((sum, row) => sum + row.simulationTradeCount, 0),
    missedOpportunityPnL: rows.filter((row) => row.missed).reduce((sum, row) => sum + row.targetPnLSol, 0)
  };

  rows.sort((a, b) => {
    const signalA = Math.abs(a.simulationPnLSol) + Math.abs(a.targetPnLSol) + a.totalTrades / 100;
    const signalB = Math.abs(b.simulationPnLSol) + Math.abs(b.targetPnLSol) + b.totalTrades / 100;
    return signalB - signalA;
  });

  return { rows, summary };
}

export function filterRowsByGroup(rows: TokenComparisonRow[], group: TokenGroup) {
  switch (group) {
    case 'simulated':
      return rows.filter((row) => row.hasSimulationActivity);
    case 'target':
      return rows.filter((row) => row.hasTargetActivity);
    case 'shared':
      return rows.filter((row) => row.shared);
    case 'missed':
      return rows.filter((row) => row.missed);
    case 'only-simulated':
      return rows.filter((row) => row.onlySimulated);
    case 'only-target':
      return rows.filter((row) => row.onlyTarget);
    case 'all':
    default:
      return rows;
  }
}

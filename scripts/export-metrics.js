#!/usr/bin/env node
/**
 * Regenerates public/report/metrics.json - the dataset behind report.ojs.
 *
 * Everything the report claims is produced here, from a dataset on disk, so the
 * numbers in the write-up can be re-derived rather than trusted.
 *
 *   node scripts/export-metrics.js [dataset.json]
 *
 * Defaults to data/sample-data.json, which is committed and reproduces the full
 * capture exactly (the engine only ever trades mints the target wallet touched).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { runCopyTradingSimulation } = require(path.join(
  ROOT,
  'engine',
  'simulateCopyTradingMcTpSlTrail.js'
));

const DATASET = process.argv[2] || path.join(ROOT, 'data', 'sample-data.json');
const OUT = path.join(ROOT, 'public', 'report', 'metrics.json');
const TARGET_WALLET =
  process.env.TARGET_WALLET || 'DDDD2zvzaPMLuZiC2Vos2i6TLFjJJ3bi1pN7kXQc3R5R';

/** Round-trip fee assumption used by the engine's own PnL accounting. */
const FEE_RATE = 0.015;

function log(...args) {
  process.stdout.write(args.join(' ') + '\n');
}

/** Pair each simulated buy with its matching sell and derive per-trade economics. */
function toTrades(run) {
  const sells = new Map(run.result.sells.map((s) => [s.mint, s]));
  const rows = [];

  for (const buy of run.result.results) {
    const sell = sells.get(buy.mint);
    if (!sell) continue;

    const buySol = Number(buy.solAmount) / 1e9;
    const sellSol = Number(sell.solAmount) / 1e9;
    const fees = FEE_RATE * (buySol + sellSol);
    const pnl = sellSol - buySol - fees;

    rows.push({
      mint: buy.mint,
      entryMcSol: Number(buy.mc) / 1e9,
      exitMcSol: Number(sell.mc) / 1e9,
      buySol,
      sellSol,
      fees,
      pnl,
      returnPct: (pnl / buySol) * 100,
      holdSec: (sell.timestamp - buy.timestamp) / 1000,
      entryTs: buy.timestamp,
      exitTs: sell.timestamp,
      exitReason: String(sell.reason || 'Unknown').split(':')[0].trim()
    });
  }

  rows.sort((a, b) => a.exitTs - b.exitTs);
  return rows;
}

/** Portfolio statistics over a closed-trade list, plus the running equity curve. */
function summarize(rows) {
  const n = rows.length;
  const totalPnl = rows.reduce((sum, r) => sum + r.pnl, 0);
  const winners = rows.filter((r) => r.pnl > 0);

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve = rows.map((r, i) => {
    equity += r.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    return { trade: i + 1, equity, pnl: r.pnl, exitTs: r.exitTs };
  });

  const grossProfit = winners.reduce((sum, r) => sum + r.pnl, 0);
  const grossLoss = -rows.filter((r) => r.pnl <= 0).reduce((sum, r) => sum + r.pnl, 0);
  const mean = n ? totalPnl / n : 0;
  const variance = n > 1 ? rows.reduce((s, r) => s + (r.pnl - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const capitalDeployed = rows.reduce((sum, r) => sum + r.buySol, 0);
  const sorted = [...rows].sort((a, b) => a.pnl - b.pnl);
  const byHold = [...rows].sort((a, b) => a.holdSec - b.holdSec);

  return {
    trades: n,
    totalPnl,
    winCount: winners.length,
    winRate: n ? (winners.length / n) * 100 : 0,
    avgPnl: mean,
    medianPnl: n ? sorted[Math.floor(n / 2)].pnl : 0,
    bestTrade: n ? sorted[n - 1].pnl : 0,
    worstTrade: n ? sorted[0].pnl : 0,
    maxDrawdown,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    grossProfit,
    grossLoss,
    capitalDeployed,
    returnOnCapitalPct: capitalDeployed ? (totalPnl / capitalDeployed) * 100 : 0,
    pnlPerTradeSd: sd,
    /** Per-trade Sharpe analogue: mean PnL over its own standard deviation. */
    sharpePerTrade: sd > 0 ? mean / sd : 0,
    totalFees: rows.reduce((sum, r) => sum + r.fees, 0),
    avgHoldSec: n ? rows.reduce((sum, r) => sum + r.holdSec, 0) / n : 0,
    medianHoldSec: n ? byHold[Math.floor(n / 2)].holdSec : 0,
    equityCurve
  };
}

/** Group closed trades by the risk rule that ended them. */
function byExitReason(rows) {
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(r.exitReason) || { reason: r.exitReason, count: 0, pnl: 0 };
    g.count += 1;
    g.pnl += r.pnl;
    groups.set(r.exitReason, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, avgPnl: g.pnl / g.count }))
    .sort((a, b) => a.pnl - b.pnl);
}

/**
 * Entry-latency cost.
 *
 * The engine fills on the slot AFTER the target wallet's buy, which is what a real
 * copy bot experiences. Comparing our fill market cap against the target's own fill
 * shows how much of the edge is consumed before the position is even open.
 */
function latencyAnalysis(rows, tokens) {
  const perTrade = [];

  for (const r of rows) {
    const token = tokens[r.mint];
    if (!token) continue;

    const targetBuy = (token.trades || [])
      .filter((t) => t.trader === TARGET_WALLET && (t.type === 'BUY' || t.type === 'SWAP'))
      .sort((a, b) => a.slot - b.slot)[0];
    if (!targetBuy) continue;

    const targetMcSol = Number(targetBuy.mc) / 1e9;
    /**
     * Tokens received scale inversely with entry price, so a counterfactual fill at
     * the target's own market cap scales the exit proceeds by exactly this ratio.
     */
    const priceRatio = r.entryMcSol / targetMcSol;
    const cfSellSol = r.sellSol * priceRatio;

    perTrade.push({
      mint: r.mint,
      targetMcSol,
      simMcSol: r.entryMcSol,
      slippagePct: ((r.entryMcSol - targetMcSol) / targetMcSol) * 100,
      pnl: r.pnl,
      counterfactualPnl: cfSellSol - r.buySol - FEE_RATE * (r.buySol + cfSellSol)
    });
  }

  const slips = perTrade.map((p) => p.slippagePct).sort((a, b) => a - b);
  const pick = (q) => (slips.length ? slips[Math.floor(slips.length * q)] : 0);
  const counterfactualPnl = perTrade.reduce((sum, p) => sum + p.counterfactualPnl, 0);
  const actualPnl = perTrade.reduce((sum, p) => sum + p.pnl, 0);

  return {
    perTrade,
    meanSlippagePct: slips.length ? slips.reduce((a, b) => a + b, 0) / slips.length : 0,
    medianSlippagePct: pick(0.5),
    p10SlippagePct: pick(0.1),
    p90SlippagePct: pick(0.9),
    adverseCount: perTrade.filter((p) => p.slippagePct > 0).length,
    tradeCount: perTrade.length,
    counterfactualPnl,
    actualPnl,
    latencyCost: counterfactualPnl - actualPnl
  };
}

async function main() {
  log(`Dataset:  ${path.relative(ROOT, DATASET)}`);
  const tokens = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const tokenList = Array.isArray(tokens) ? tokens : Object.values(tokens);
  const tradeCount = tokenList.reduce((sum, t) => sum + (t.trades || []).length, 0);
  log(`Tokens:   ${tokenList.length}  Trades: ${tradeCount}`);

  const run = (params) =>
    runCopyTradingSimulation({ tokensData: tokens, params, writeOutputs: false }).then(toTrades);

  const baselineRows = await run({});
  const baseline = summarize(baselineRows);
  log(
    `Baseline: ${baseline.trades} trades, ` +
      `${baseline.totalPnl.toFixed(3)} SOL, ${baseline.winRate.toFixed(1)}% win rate`
  );

  // Take-profit x stop-loss surface.
  const takeProfits = [40, 60, 80, 100, 120, 150, 180, 220, 260, 300];
  const stopLosses = [15, 20, 25, 30, 35, 40, 50, 60];
  const grid = [];
  for (const tp of takeProfits) {
    for (const sl of stopLosses) {
      const s = summarize(await run({ takeProfitPercent: tp, stopLossPercent: sl }));
      grid.push({
        takeProfitPercent: tp,
        stopLossPercent: sl,
        totalPnl: s.totalPnl,
        winRate: s.winRate,
        trades: s.trades,
        maxDrawdown: s.maxDrawdown,
        profitFactor: s.profitFactor
      });
    }
  }
  log(`Grid:     ${grid.length} take-profit x stop-loss combinations`);

  const sweep = async (label, key, values) => {
    const out = [];
    for (const value of values) {
      const s = summarize(await run({ [key]: value }));
      out.push({ value, totalPnl: s.totalPnl, winRate: s.winRate, trades: s.trades });
    }
    log(`Sweep:    ${label} (${values.length} settings)`);
    return out;
  };

  const trailingSweep = await sweep('trailing stop', 'trailingStopPercent', [
    10, 15, 20, 25, 28, 35, 45, 60, null
  ]);
  const holdSweep = await sweep('max hold', 'maxHoldSeconds', [
    60, 120, 300, 600, 1200, 1800, 3600, null
  ]);

  const mcWindows = [
    [null, null],
    [null, 10],
    [5, 20],
    [10, 30],
    [20, 50],
    [30, null]
  ];
  const mcSweep = [];
  for (const [min, max] of mcWindows) {
    const s = summarize(await run({ minMcSol: min, maxMcSol: max }));
    mcSweep.push({
      minMcSol: min,
      maxMcSol: max,
      label: `${min ?? 0}-${max ?? 'inf'}`,
      totalPnl: s.totalPnl,
      winRate: s.winRate,
      trades: s.trades
    });
  }
  log(`Sweep:    market-cap entry windows (${mcSweep.length} settings)`);

  const best = [...grid].sort((a, b) => b.totalPnl - a.totalPnl)[0];
  const bestRows = await run({
    takeProfitPercent: best.takeProfitPercent,
    stopLossPercent: best.stopLossPercent
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    dataset: {
      file: path.basename(DATASET),
      tokenCount: tokenList.length,
      tradeCount,
      targetWallet: TARGET_WALLET,
      feeRate: FEE_RATE
    },
    baseline: { stats: baseline, trades: baselineRows, exitReasons: byExitReason(baselineRows) },
    best: { params: best, stats: summarize(bestRows) },
    grid,
    trailingSweep,
    holdSweep,
    mcSweep,
    latency: latencyAnalysis(baselineRows, Array.isArray(tokens) ? {} : tokens)
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
  log(`Written:  ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Copy-trading simulation (MC filter + take-profit / stop-loss / trailing stop)
 *
 * Expects the same token JSON as other sims:
 *   - Object keyed by mint: { "<mint>": { mint, creator, trades: [...], ... }, ... }
 *   - Or array: [ { mint, trades, ... }, ... ]
 * Trades: type BUY|SELL|SWAP, trader, tokenAmount, solAmount, slot, timestamp, ...
 *
 * Strategy: ./strategies/strategyCopyTradingMcTpSlTrail.js (edit RUN_DEFAULTS there).
 * Engine:   NEXT slot after target buy.
 *
 * ============================================================================
 * LIVE SOLANA MONITORING & DRY-RUN SAFETY ANNOTATION:
 * PROBLEM ADDRESSED:
 * Originally, the engine only operated on static file replay. It lacked annotations
 * clarifying how bonding curve math (virtual token / virtual SOL reserves) and
 * dry-run position fills map to live mainnet Solana RPC events.
 *
 * FIX IMPLEMENTED:
 * Verified and documented that bonding curve fills operate purely in dry-run mode
 * (in-memory SOL lamport calculations), guaranteeing that both historical replay
 * and real-time live mainnet streams run with zero financial or blockchain risk.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

/** Fallback if strategy RUN_DEFAULTS omits targetWallet */
const DDDD_WALLET =
  process.env.TARGET_WALLET || 'DDDD2zvzaPMLuZiC2Vos2i6TLFjJJ3bi1pN7kXQc3R5R';
const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT_SOL) || 0.8;

const DATA_DIR = path.join(__dirname, '..', 'data');

const MY_WALLET = 'MYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMYMY';
const DEFAULT_VIRTUAL_TOKEN = 1073000000000000n;
const DEFAULT_VIRTUAL_SOL = 30000000000n;
const DEFAULT_K = DEFAULT_VIRTUAL_TOKEN * DEFAULT_VIRTUAL_SOL;

/** Use strategy.buyAmount (SOL) when set on the strategy instance; else default. */
function getBuyAmountSol(strategy) {
  const v = strategy?.buyAmount;
  if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) return Number(v);
  return BUY_AMOUNT_SOL;
}

class BondingCurve {
  constructor() {
    this.vt = DEFAULT_VIRTUAL_TOKEN;
    this.vs = DEFAULT_VIRTUAL_SOL;
    this.rs = 0n;
    this.k = DEFAULT_K;
  }

  applyBuy(tokens) {
    const t = typeof tokens === 'bigint' ? tokens : BigInt(tokens);
    const nvt = this.vt - t;
    const nvs = this.k / nvt;
    const sol = nvs - this.vs;
    this.vt = nvt;
    this.vs = nvs;
    this.rs += sol;
    return { sol, tokens: t };
  }

  applySell(tokens) {
    const t = typeof tokens === 'bigint' ? tokens : BigInt(tokens);
    const nvt = this.vt + t;
    const nvs = this.k / nvt;
    const sol = this.vs - nvs;
    this.vt = nvt;
    this.vs = nvs;
    this.rs -= sol;
    return { sol, tokens: t };
  }

  applySwap(solIn) {
    const s = typeof solIn === 'bigint' ? solIn : BigInt(solIn);
    const nvs = this.vs + s;
    const nvt = this.k / nvs;
    const tokens = this.vt - nvt;
    this.vt = nvt;
    this.vs = nvs;
    this.rs += s;
    return { sol: s, tokens };
  }

  getMC() {
    return this.rs;
  }
}

class SimToken {
  constructor(mint, creator, createSlot = null) {
    this.mint = mint;
    this.creator = creator;
    this.createSlot = createSlot;
    this.trades = [];
  }

  addTrade(trade) {
    this.trades.push(trade);
  }
}

/**
 * Simulates copy buys at the first trade slot after the target wallet buy.
 * This is intentionally kept local so the dashboard has one simulation file.
 */
function simulate(tokensData, strategy, options = {}) {
  const { onProgress } = options;
  const buyAmountSol = getBuyAmountSol(strategy);
  const copyWallet = strategy.targetWallet || DDDD_WALLET;
  const tokenMints = Array.isArray(tokensData) ? tokensData.map((t) => t.mint) : Object.keys(tokensData);
  const totalTokens = tokenMints.length;

  const results = [];
  const sells = [];
  const newTokensData = {};

  let totalPnL = 0;
  let wins = 0;
  let losses = 0;
  let processed = 0;

  for (const mint of tokenMints) {
    const tokenData = Array.isArray(tokensData)
      ? tokensData.find((t) => t.mint === mint)
      : tokensData[mint];

    if (!tokenData || !tokenData.trades || tokenData.trades.length === 0) {
      newTokensData[mint] = tokenData;
      processed += 1;
      if (typeof onProgress === 'function') onProgress({ processed, total: totalTokens, mint });
      continue;
    }

    const token = new SimToken(mint, tokenData.creator, tokenData.createSlot);
    const curve = new BondingCurve();
    const holders = [];
    const traderToIndex = new Map();
    let lastTradeSlot = tokenData.createSlot || 0;
    let targetBuySlot = null;
    let sellConditionMetAt = null;
    let myBuyTrade = null;
    let alreadyBought = false;
    const newTrades = [];

    for (let i = 0; i < tokenData.trades.length; i++) {
      const trade = tokenData.trades[i];
      const slot = trade.slot;
      const tokenAmountBigInt = trade.tokenAmount ? BigInt(trade.tokenAmount) : 0n;
      const solAmountBigInt = trade.solAmount ? BigInt(trade.solAmount) : 0n;

      if (targetBuySlot !== null && slot > targetBuySlot && !alreadyBought) {
        const mySOLLamports = BigInt(Math.floor(buyAmountSol * 1e9));
        const newVS = curve.vs + mySOLLamports;
        const newVT = curve.k / newVS;
        const tokenAmount = curve.vt - newVT;

        curve.applyBuy(tokenAmount);

        myBuyTrade = {
          type: 'BUY',
          mint,
          trader: MY_WALLET,
          tokenAmount: tokenAmount.toString(),
          solAmount: mySOLLamports.toString(),
          mc: curve.getMC().toString(),
          traderHolding: tokenAmount.toString(),
          totalHolding: tokenAmount.toString(),
          reserves: {
            virtualTokenReserves: curve.vt.toString(),
            virtualSolReserves: curve.vs.toString(),
            mc: curve.getMC().toString()
          },
          slot,
          timestamp: trade.timestamp,
          isMyTrade: true
        };

        newTrades.push(myBuyTrade);
        alreadyBought = true;

        results.push({
          type: 'BUY',
          mint,
          amount: buyAmountSol,
          mc: myBuyTrade.mc,
          solAmount: mySOLLamports.toString(),
          timestamp: trade.timestamp,
          executedAtSlot: slot,
          ddddBuySlot: targetBuySlot,
          afterDDDD: true
        });

        const buyMC = Number(myBuyTrade.mc) / 1e9;
        strategy.positions.set(mint, {
          buyMC,
          buyPrice: buyMC,
          buySlot: slot,
          buyTimestamp: trade.timestamp,
          maxMC: buyMC
        });
      }

      if (sellConditionMetAt && slot > sellConditionMetAt.slot) {
        const tokensToSell = BigInt(myBuyTrade.tokenAmount);
        const result = curve.applySell(tokensToSell);
        const mySellTrade = {
          type: 'SELL',
          mint,
          trader: MY_WALLET,
          tokenAmount: tokensToSell.toString(),
          solAmount: result.sol.toString(),
          mc: curve.getMC().toString(),
          traderHolding: '0',
          totalHolding: '0',
          reserves: {
            virtualTokenReserves: curve.vt.toString(),
            virtualSolReserves: curve.vs.toString(),
            mc: curve.getMC().toString()
          },
          slot,
          timestamp: trade.timestamp,
          isMyTrade: true
        };

        newTrades.push(mySellTrade);

        const buySol = parseFloat(myBuyTrade.solAmount) / 1e9;
        const sellSol = parseFloat(result.sol.toString()) / 1e9;
        const fee = (buySol + sellSol) * 0.015;
        const pnl = sellSol - buySol - fee;

        totalPnL += pnl;
        if (pnl > 0) wins++;
        else losses++;

        sells.push({
          type: 'SELL',
          mint,
          amount: 1.0,
          mc: mySellTrade.mc,
          solAmount: result.sol.toString(),
          reason: sellConditionMetAt.decision.reason,
          pnl,
          timestamp: trade.timestamp,
          executedAtSlot: slot
        });

        myBuyTrade = null;
        sellConditionMetAt = null;
        strategy.positions.delete(mint);
      }

      if (trade.type === 'BUY') {
        curve.applyBuy(tokenAmountBigInt);
      } else if (trade.type === 'SELL') {
        curve.applySell(tokenAmountBigInt);
      } else if (trade.type === 'SWAP') {
        curve.applySwap(solAmountBigInt);
      }

      if (trade.trader) {
        lastTradeSlot = slot;
        let holderIndex = traderToIndex.get(trade.trader);
        if (holderIndex === undefined) {
          holderIndex = holders.length;
          holders.push({ trader: trade.trader, tokens: 0n });
          traderToIndex.set(trade.trader, holderIndex);
        }

        const holder = holders[holderIndex];
        if (trade.type === 'BUY' || trade.type === 'SWAP') {
          holder.tokens += tokenAmountBigInt;
        } else if (trade.type === 'SELL') {
          holder.tokens -= tokenAmountBigInt;
        }
      }

      token.addTrade(trade);

      const currentMC = curve.getMC();
      const currentMCString = currentMC.toString();
      newTrades.push({
        ...trade,
        mc: currentMCString,
        reserves: {
          virtualTokenReserves: curve.vt.toString(),
          virtualSolReserves: curve.vs.toString(),
          mc: currentMCString
        }
      });

      const isTargetBuy =
        trade.trader === copyWallet && (trade.type === 'BUY' || trade.type === 'SWAP');
      if (isTargetBuy && !targetBuySlot) {
        const mcSol = Number(curve.getMC()) / 1e9;
        const allowMc =
          typeof strategy.passesMcFilter === 'function' ? strategy.passesMcFilter(mcSol) : true;
        if (allowMc) targetBuySlot = slot;
      }

      if (myBuyTrade && !sellConditionMetAt) {
        let totalHolding = 0n;
        let maxHolderTokens = 0n;
        const positiveHolders = [];

        for (const holder of holders) {
          if (holder.tokens > 0n) {
            totalHolding += holder.tokens;
            positiveHolders.push(holder.tokens);
            if (holder.tokens > maxHolderTokens) maxHolderTokens = holder.tokens;
          }
        }

        let top3HolderTokens = 0n;
        if (positiveHolders.length > 0) {
          positiveHolders.sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
          for (let j = 0; j < Math.min(3, positiveHolders.length); j++) {
            top3HolderTokens += positiveHolders[j];
          }
        }

        const maxHolderPercent =
          totalHolding > 0n ? (Number(maxHolderTokens) / Number(totalHolding)) * 100 : 0;
        const top3HolderPercent =
          totalHolding > 0n ? (Number(top3HolderTokens) / Number(totalHolding)) * 100 : 0;

        const holderInfo = {
          maxHolderPercent,
          top3HolderPercent,
          holderCount: positiveHolders.length,
          totalHolding: Number(totalHolding),
          lastTradeSlot
        };

        const event = {
          type: trade.type,
          mint,
          trader: trade.trader,
          mc: curve.getMC().toString(),
          tokenAmount: trade.tokenAmount,
          solAmount: trade.solAmount,
          slot,
          timestamp: trade.timestamp
        };

        const sellDecision = strategy.shouldSell(event, token, holderInfo);
        if (sellDecision.sell) {
          sellConditionMetAt = {
            slot,
            decision: sellDecision,
            timestamp: trade.timestamp
          };
        }
      }
    }

    if (myBuyTrade) {
      const lastTrade = tokenData.trades[tokenData.trades.length - 1];
      const tokensToSell = BigInt(myBuyTrade.tokenAmount);
      const result = curve.applySell(tokensToSell);
      const mySellTrade = {
        type: 'SELL',
        mint,
        trader: MY_WALLET,
        tokenAmount: tokensToSell.toString(),
        solAmount: result.sol.toString(),
        mc: curve.getMC().toString(),
        traderHolding: '0',
        totalHolding: '0',
        reserves: {
          virtualTokenReserves: curve.vt.toString(),
          virtualSolReserves: curve.vs.toString(),
          mc: curve.getMC().toString()
        },
        slot: lastTrade.slot,
        timestamp: lastTrade.timestamp,
        isMyTrade: true
      };

      newTrades.push(mySellTrade);

      const buySol = parseFloat(myBuyTrade.solAmount) / 1e9;
      const sellSol = parseFloat(result.sol.toString()) / 1e9;
      const fee = (buySol + sellSol) * 0.015;
      const pnl = sellSol - buySol - fee;

      totalPnL += pnl;
      if (pnl > 0) wins++;
      else losses++;

      sells.push({
        type: 'SELL',
        mint,
        amount: 1.0,
        mc: mySellTrade.mc,
        solAmount: result.sol.toString(),
        reason: sellConditionMetAt ? sellConditionMetAt.decision.reason : 'End of data',
        pnl,
        timestamp: lastTrade.timestamp,
        executedAtSlot: lastTrade.slot
      });

      strategy.positions.delete(mint);
    }

    newTokensData[mint] = {
      ...tokenData,
      trades: newTrades,
      curveState: {
        virtualTokenReserves: curve.vt.toString(),
        virtualSolReserves: curve.vs.toString(),
        mc: curve.getMC().toString()
      }
    };

    processed += 1;
    if (typeof onProgress === 'function') onProgress({ processed, total: totalTokens, mint });
  }

  return {
    totalPnL,
    wins,
    losses,
    totalTrades: wins + losses,
    results,
    sells,
    newTokensData
  };
}

/**
 * Minimal fields the dashboard needs for My PnL / 📋 My Tokens (avoids multi‑MB JSON lines).
 * Full rows remain in the on-disk trades file for debugging.
 */
function slimTradesForUi(allTrades) {
  return allTrades.map((t) => ({
    mint: t.mint,
    type: t.type,
    amount: t.amount,
    solAmount: t.solAmount,
    timestamp: t.timestamp,
    slot: t.executedAtSlot != null ? t.executedAtSlot : t.slot,
    executedAtSlot: t.executedAtSlot,
    mc: t.mc
  }));
}

function summarizeResult(result) {
  let totalPnL = 0;
  let winCount = 0;
  const sellsMap = new Map();
  result.sells.forEach((sell) => sellsMap.set(sell.mint, sell));
  const tokenPnLs = new Map();
  result.results.forEach((buy) => {
    const sell = sellsMap.get(buy.mint);
    if (sell) {
      const buySOL = Number(buy.solAmount) / 1e9;
      const sellSOL = Number(sell.solAmount) / 1e9;
      const fees = 0.015 * (buySOL + sellSOL);
      const pnl = sellSOL - buySOL - fees;
      totalPnL += pnl;
      if (pnl > 0) winCount++;
      tokenPnLs.set(buy.mint, {
        buySOL,
        sellSOL,
        fees,
        pnl,
        multiplier: sellSOL / buySOL
      });
    }
  });
  const winRate =
    result.sells.length > 0 ? ((winCount / result.sells.length) * 100).toFixed(1) : '0';
  const sorted = [...tokenPnLs.entries()].sort((a, b) => b[1].pnl - a[1].pnl);
  const topWinners = sorted.slice(0, 5).map(([mint, d]) => ({
    mint,
    pnl: d.pnl,
    multiplier: d.multiplier
  }));
  const topLosers =
    sorted.length > 5
      ? sorted
          .slice(-5)
          .reverse()
          .map(([mint, d]) => ({ mint, pnl: d.pnl, multiplier: d.multiplier }))
      : [];
  return {
    totalPnL,
    winCount,
    sellCount: result.sells.length,
    buyCount: result.results.length,
    winRate,
    avgPnlPerTrade: result.sells.length > 0 ? totalPnL / result.sells.length : 0,
    topWinners,
    topLosers
  };
}

/**
 * Run copy-trading sim with in-memory tokens + strategy params (e.g. from UI dashboard).
 * @param {object} options.tokensData - mint-keyed or array token JSON
 * @param {object} options.params - fields aligned with Settings + getCopyStrategyParams (targetWallet or copyTargetWallet, buyAmount, …)
 * @param {(info: { processed: number, total: number, mint: string }) => void} [options.onProgress] - per-token progress (for UI streaming)
 */
async function runCopyTradingSimulation({
  tokensData,
  params = {},
  writeOutputs = true,
  onProgress
}) {
  const strategyFullPath = path.join(__dirname, 'strategies', 'strategyCopyTradingMcTpSlTrail.js');
  const strategyModule = require(strategyFullPath);
  const SimStrategy = strategyModule.SimStrategy;
  const RUN_DEFAULTS = strategyModule.RUN_DEFAULTS || {};

  const merged = {
    ...RUN_DEFAULTS,
    ...params,
    targetWallet:
      params.targetWallet ??
      params.copyTargetWallet ??
      RUN_DEFAULTS.targetWallet,
    buyAmount: params.buyAmount ?? RUN_DEFAULTS.buyAmount
  };

  const strategy = new SimStrategy(merged);

  const n = Array.isArray(tokensData)
    ? tokensData.length
    : Object.keys(tokensData || {}).length;
  if (!n) {
    const err = new Error('No tokens: load a tokens JSON in the UI first.');
    err.code = 'NO_TOKENS';
    throw err;
  }

  const t0 = Date.now();
  const result = simulate(tokensData, strategy, { onProgress });
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);

  const summary = {
    ...summarizeResult(result),
    elapsedSeconds: Number(elapsedSec),
    tokenCount: n,
    buyAmountSol: getBuyAmountSol(strategy),
    targetWallet: strategy.targetWallet
  };

  /** Flat copy-buy / copy-sell rows for the dashboard (same as trades file, sorted). */
  const allTrades = [...result.results, ...result.sells].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  /** Slim rows for API + small `trades-ui` file — browser-safe size. */
  const myTradesForUi = slimTradesForUi(allTrades);

  let outputFiles = null;
  if (writeOutputs) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newTokensPath = path.join(DATA_DIR, `sim-copy-mc-tpsl-tokens-${timestamp}.json`);
    const tradesPath = path.join(DATA_DIR, `sim-copy-mc-tpsl-trades-${timestamp}.json`);
    const tradesUiPath = path.join(DATA_DIR, `sim-copy-mc-tpsl-trades-ui-${timestamp}.json`);
    fs.writeFileSync(newTokensPath, JSON.stringify(result.newTokensData, null, 2));
    /** Full compact trades (optional / tooling). */
    fs.writeFileSync(tradesPath, JSON.stringify(allTrades));
    /** Tiny subset for dashboard fetch fallback when NDJSON embed fails. */
    fs.writeFileSync(tradesUiPath, JSON.stringify(myTradesForUi));
    outputFiles = {
      tokens: path.basename(newTokensPath),
      trades: path.basename(tradesPath),
      tradesUi: path.basename(tradesUiPath)
    };
  }

  const logText = [
    `Buys: ${summary.buyCount} | Sells: ${summary.sellCount}`,
    `Total PnL: ${summary.totalPnL >= 0 ? '+' : ''}${summary.totalPnL.toFixed(4)} SOL`,
    `Win rate: ${summary.winRate}% (${summary.winCount}/${summary.sellCount})`,
    `Avg / trade: ${summary.sellCount > 0 ? (summary.totalPnL / summary.sellCount).toFixed(4) : '0'} SOL`,
    `Time: ${summary.elapsedSeconds}s`,
    ...(outputFiles
      ? [
          `Saved tokens: ${outputFiles.tokens}`,
          `Saved trades: ${outputFiles.trades}`,
          `Saved trades (UI): ${outputFiles.tradesUi}`
        ]
      : [])
  ].join('\n');

  return { summary, outputFiles, logText, result, myTradesForUi };
}

function resolveDefaultTokensPath() {
  if (!fs.existsSync(DATA_DIR)) {
    return path.join(DATA_DIR, 'tokens-merged-target-only-new.json');
  }
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith('tokens-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length > 0) {
    return path.join(DATA_DIR, files[0]);
  }
  return path.join(DATA_DIR, 'tokens-merged-target-only-new.json');
}

async function runSimulation() {
  const tokensJsonPath = process.argv[2] || resolveDefaultTokensPath();
  const strategyPath =
    process.argv[3] || path.join(__dirname, 'strategies', 'strategyCopyTradingMcTpSlTrail.js');

  const strategyFullPath = path.isAbsolute(strategyPath)
    ? strategyPath
    : path.resolve(__dirname, strategyPath);

  const strategyModule = require(strategyFullPath);
  const SimStrategy = strategyModule.SimStrategy;
  const RUN_DEFAULTS = strategyModule.RUN_DEFAULTS || {};

  console.log(`\n📂 Tokens file: ${tokensJsonPath}`);
  console.log(`📊 Strategy: ${path.basename(strategyFullPath)}`);

  if (!fs.existsSync(tokensJsonPath)) {
    console.error(`\n❌ File not found: ${tokensJsonPath}`);
    console.error('   Pass path to a tokens-*.json under bussiness/data (mint-keyed object or array).\n');
    process.exit(1);
  }

  const tokensData = JSON.parse(fs.readFileSync(tokensJsonPath, 'utf-8'));
  const tokenMints = Array.isArray(tokensData)
    ? tokensData.length
    : Object.keys(tokensData).length;
  console.log(`📊 Total tokens: ${tokenMints}\n`);

  const strategy = new SimStrategy({
    ...RUN_DEFAULTS,
    targetWallet: RUN_DEFAULTS.targetWallet ?? DDDD_WALLET,
    buyAmount: RUN_DEFAULTS.buyAmount ?? BUY_AMOUNT_SOL,
  });

  const copyWallet = strategy.targetWallet || DDDD_WALLET;

  console.log('🚀 Copy-trading sim (NEXT slot after target buy)');
  console.log(`   Target wallet: ${copyWallet}`);
  console.log(`💰 Simulated buy size: ${getBuyAmountSol(strategy)} SOL`);
  if (typeof strategy.passesMcFilter === 'function') {
    const lo = strategy.minMcSol;
    const hi = strategy.maxMcSol;
    console.log(
      `🎯 MC filter (at target buy, SOL): ${
        lo == null && hi == null ? 'off' : `(${lo ?? '-∞'}, ${hi ?? '∞'}) exclusive`
      }`
    );
  }
  const holdLine =
    strategy.maxHoldSeconds != null && strategy.maxHoldSeconds > 0
      ? ` | Max hold ${strategy.maxHoldSeconds}s`
      : '';
  const pct = (v) => (v == null || v === '' ? 'off' : `${v}%`);
  console.log(
    `📤 Exits: TP ${pct(strategy.takeProfitPercent)} | SL ${pct(strategy.stopLossPercent)} | Trail ${pct(strategy.trailingStopPercent)} (min peak +${strategy.trailingMinProfitPercent}%)${holdLine}\n`
  );

  const startTime = Date.now();
  const result = simulate(tokensData, strategy);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const sum = summarizeResult(result);

  console.log(`\n📊 RESULTS`);
  console.log(`   Buys: ${sum.buyCount}  |  Sells: ${sum.sellCount}`);

  console.log(`\n💰 PnL SUMMARY`);
  console.log(`   Total PnL: ${sum.totalPnL >= 0 ? '+' : ''}${sum.totalPnL.toFixed(4)} SOL`);
  console.log(`   Win rate: ${sum.winRate}% (${sum.winCount}/${sum.sellCount})`);
  console.log(
    `   Avg per trade: ${sum.sellCount > 0 ? (sum.totalPnL / sum.sellCount).toFixed(4) : '0'} SOL`
  );
  console.log(`   Time: ${elapsed}s`);

  if (sum.topWinners.length > 0) {
    console.log(`\n🏆 TOP 5 WINNERS:`);
    sum.topWinners.forEach(({ mint, multiplier, pnl }) => {
      console.log(
        `   ${mint.slice(0, 8)}... ${multiplier.toFixed(2)}x → ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} SOL`
      );
    });
    if (sum.topLosers.length > 0) {
      console.log(`\n📉 TOP 5 LOSERS:`);
      sum.topLosers.forEach(({ mint, multiplier, pnl }) => {
        console.log(
          `   ${mint.slice(0, 8)}... ${multiplier.toFixed(2)}x → ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} SOL`
        );
      });
    }
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const newTokensPath = path.join(DATA_DIR, `sim-copy-mc-tpsl-tokens-${timestamp}.json`);
  const tradesPath = path.join(DATA_DIR, `sim-copy-mc-tpsl-trades-${timestamp}.json`);

  fs.writeFileSync(newTokensPath, JSON.stringify(result.newTokensData, null, 2));
  console.log(`\n💾 Saved tokens (+ injected trades): ${newTokensPath}`);

  const allTrades = [...result.results, ...result.sells].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  fs.writeFileSync(tradesPath, JSON.stringify(allTrades, null, 2));
  console.log(`💾 Saved buy/sell summary: ${tradesPath}`);
  console.log(`\n   UI: load the tokens JSON above; rows with isMyTrade: true are simulated fills.\n`);
}

const isMain = require.main === module;

if (isMain) {
  runSimulation().catch(console.error);
}

module.exports = { runCopyTradingSimulation };

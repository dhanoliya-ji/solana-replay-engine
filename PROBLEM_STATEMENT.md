# Problem statement and objectives

## 1. Context

On Solana, memecoins launched through bonding-curve platforms such as pump.fun trade
in an environment with three properties that make them unlike ordinary markets:

- **Price is a deterministic function of reserves.** A constant-product bonding curve
  means every fill's price can be reconstructed exactly from the reserve state at that
  slot. There is no order book and no hidden liquidity.
- **Every trade is public, attributed, and permanently recorded.** Each buy and sell
  carries the wallet that made it. Wallets that consistently profit are therefore
  identifiable by anyone willing to index the chain.
- **Positions resolve in seconds.** In the dataset used here the median position lives
  under twelve seconds.

Together these create an obvious-looking opportunity: find a wallet that makes money,
mirror its buys, and inherit its edge without reproducing its research. "Copy trading"
bots built on this premise are widely sold and widely deployed.

## 2. The problem

**The premise is almost never tested honestly.**

A copy-trading strategy is typically evaluated by replaying the target wallet's trades
and computing what those trades returned. That measures the *target's* performance, not
the copier's, and silently assumes something false: that the copier fills at the same
price as the wallet being copied.

They cannot. A copy bot must observe a transaction before it can react to one. That
observation costs at least one slot — roughly 400 ms — and on a bonding curve the
target's own buy has already moved the price within that slot, as have all the other
bots reacting to the same signal. The copier always buys into a curve the signal itself
has pushed.

The gap between those two things is not a rounding error, and it is not visible in any
backtest that ignores it. A strategy can look convincingly profitable on paper and lose
money in production **for reasons that have nothing to do with its strategy logic** —
which means the operator's natural response, tuning the risk parameters, cannot fix it.

The concrete problem this project addresses:

> Build a simulator that measures what a copy trader actually experiences — including
> the execution delay — and use it to determine whether copying a profitable Solana
> wallet is viable, and if not, precisely where the money goes.

## 3. Objectives

### O1 — Replay fills exactly, from recorded reserves

Reconstruct every fill from the constant-product invariant using the virtual token and
SOL reserves recorded at that slot, in `BigInt` arithmetic, rather than approximating
price from market-cap snapshots. A simulated result is only worth reading if the fills
are the ones the curve would actually have produced.

### O2 — Model execution delay as a first-class assumption

Enter on the slot *after* the target wallet's fill, never the same slot. The delay is a
property of the strategy being tested, not an inconvenience to be idealised away.

### O3 — Implement a layered exit model, not a single rule

Real risk management is several rules competing to close a position. Implement and
evaluate take-profit, stop-loss, trailing stop with a minimum activation peak,
break-even drawdown protection, maximum hold time, momentum failure, and holder
concentration limits — and attribute every exit to the rule that fired.

### O4 — Make the strategy question answerable, not assertable

Support sweeping the parameter space and re-running the complete replay per setting, so
claims about what does and does not help are measured across the whole grid rather than
argued from a single favourable configuration.

### O5 — Separate the target's performance from the copier's

Report simulated results against the target wallet's own results on the same tokens over
the same period — shared positions, missed positions, and positions taken alone — so the
two are never conflated.

### O6 — Provide an interactive surface over the replay

A dashboard for loading datasets, configuring the strategy, running the engine with
progress reporting, and inspecting individual tokens, trades, and distributions. The
analysis has to be explorable, not just summarised.

### O7 — Extend the same engine to live mainnet data, in dry run only

Run the identical risk model against a live Solana RPC feed, tracking positions and PnL
in memory. **No transaction is ever signed or broadcast and no key material is handled**
— the system must be incapable of spending, not merely configured not to.

### O8 — Make every published number reproducible

Ship a committed dataset and a script that regenerates the entire results report from
it, so no figure in the write-up is transcribed by hand.

## 4. Success criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Fills derived from bonding-curve reserves in exact integer arithmetic | Met |
| 2 | Entry delayed by one slot on every copied position | Met |
| 3 | Seven independent exit rules implemented and attributable | Met |
| 4 | Full parameter sweep (80-cell grid plus four axes) executes end to end | Met |
| 5 | Simulated vs target comparison available per token | Met |
| 6 | Live monitor runs against mainnet RPC with no signing path | Met |
| 7 | Committed sample reproduces full-capture results exactly | Met |
| 8 | Report regenerates from the repository with one command | Met |

## 5. Non-goals

- **Not a trading bot.** There is no execution path, no wallet integration, no key
  handling, and none is planned.
- **Not financial advice or a profitability claim.** The headline finding is negative.
- **Not a general backtesting framework.** It targets one venue's bonding-curve
  mechanics; generalising the fill model is out of scope.
- **Not a chain indexer.** Datasets are consumed as recorded JSON; capturing them is a
  separate concern.

## 6. Findings against the problem

Stated here in brief; derived in full, with charts, in the
[results report](public/report/report.ojs).

1. Mirroring the target wallet one slot late loses **5.93 SOL** across 68 round trips —
   a 25.0% win rate and a 0.31 profit factor.
2. **No** exit configuration tested is profitable. All 80 take-profit / stop-loss
   combinations lose, as does every trailing-stop and hold-time setting. The best cell
   still loses 2.59 SOL.
3. 67 of 68 entries fill *worse* than the wallet being copied, at a median of **13.5%**
   higher market cap.
4. The same 68 trades, entered at the target's own price, return **+2.40 SOL**. One slot
   of latency is worth **8.33 SOL** — roughly 5× the total fees paid.

The wallet's selection is genuinely profitable. Copying it is what destroys the edge.
This reframes copy trading from a strategy problem into an execution-latency problem,
and it is a conclusion that a backtest without O2 cannot reach.

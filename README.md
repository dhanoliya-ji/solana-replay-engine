# Solana Replay Engine

A replay-based copy-trading simulator for Solana bonding-curve tokens, with a Next.js
analysis dashboard and a live mainnet monitor that runs strictly in dry run.

It exists to answer one question honestly: **if you mirror a profitable pump.fun wallet
trade for trade, one slot behind, do you make money?**

On this dataset the answer is no — and the reason is not the strategy.

```
Baseline — 68 round trips mirroring a profitable wallet
  Total PnL       −5.930 SOL      Win rate         25.0%
  Profit factor    0.31           Max drawdown      5.93 SOL
  Median hold      11.7 s         Fees paid         1.57 SOL

The same 68 trades, entered at the target wallet's own price
  Total PnL       +2.402 SOL

  Cost of one slot of latency:   8.33 SOL
```

67 of 68 entries fill at a **worse** price than the wallet being copied, at a median of
13.5% higher market cap. All 80 take-profit / stop-loss combinations tested lose money. No
exit parameter recovers the gap.

**→ [Read the full analysis](report/analysis.ipynb)** — a Jupyter notebook with the equity
curve, per-trade breakdown, exit attribution, parameter heatmap and latency analysis. It
renders directly on GitHub; no setup required.

---

## Contents

- [The problem](#the-problem)
- [Objectives](#objectives)
- [Results](#results)
- [How it works](#how-it-works)
- [Quickstart](#quickstart)
- [Repository layout](#repository-layout)
- [Configuration](#configuration)
- [Safety](#safety)
- [Reproducibility](#reproducibility)
- [Limitations](#limitations)
- [License](#license)

---

## The problem

On Solana, memecoins launched through bonding-curve platforms such as pump.fun trade in an
environment with three unusual properties:

- **Price is a deterministic function of reserves.** A constant-product bonding curve means
  every fill's price can be reconstructed exactly from the reserve state at that slot. There
  is no order book and no hidden liquidity.
- **Every trade is public and attributed.** Each buy and sell carries the wallet that made
  it, so wallets that consistently profit are identifiable by anyone willing to index the
  chain.
- **Positions resolve in seconds.** In the dataset used here, the median position lives
  under twelve seconds.

Together these create an obvious-looking opportunity: find a wallet that makes money, mirror
its buys, and inherit its edge without reproducing its research. Copy-trading bots built on
this premise are widely sold and widely deployed.

### The premise is almost never tested honestly

A copy-trading strategy is typically evaluated by replaying the target wallet's trades and
computing what those trades returned. That measures the **target's** performance, not the
copier's, and silently assumes something false: that the copier fills at the same price as
the wallet being copied.

It cannot. A copy bot must observe a transaction before it can react to one. That
observation costs at least one slot — roughly 400 ms — and on a bonding curve the target's
own buy has already moved the price within that slot, as have all the other bots reacting to
the same public signal. The copier always buys into a curve that the signal itself has
pushed.

That gap is not a rounding error, and it is invisible to any backtest that ignores it. A
strategy can look convincingly profitable on paper and lose money in production **for
reasons that have nothing to do with its strategy logic** — which means the operator's
natural response, tuning the risk parameters, cannot fix it.

> **The problem this project addresses:** build a simulator that measures what a copy trader
> actually experiences, including the execution delay, and use it to determine whether
> copying a profitable Solana wallet is viable — and if not, precisely where the money goes.

## Objectives

| | Objective | Why it matters |
|---|---|---|
| **O1** | Replay fills exactly, from recorded reserves | A simulated result is only worth reading if the fills are the ones the curve would actually have produced. Uses `BigInt` arithmetic on the constant-product invariant, not market-cap approximations. |
| **O2** | Model execution delay as a first-class assumption | Entry lands on the slot *after* the target's fill, never the same slot. The delay is a property of the strategy, not an inconvenience to idealise away. |
| **O3** | Implement a layered exit model | Real risk management is several rules competing to close a position — and every exit must be attributable to the rule that fired. |
| **O4** | Make the strategy question answerable, not assertable | Sweep the parameter space by re-running the complete replay per setting, so "tuning doesn't help" is a measurement across the grid, not an argument from one favourable configuration. |
| **O5** | Separate the target's performance from the copier's | Report simulated results against the target wallet's own results on the same tokens — shared, missed and solo positions — so the two are never conflated. |
| **O6** | Provide an interactive surface over the replay | The analysis has to be explorable per token and per trade, not just summarised. |
| **O7** | Extend the same engine to live mainnet data, in dry run only | Validate the risk model against real-time data with **no signing path whatsoever**. |
| **O8** | Make every published number reproducible | Ship the dataset and a one-command regeneration path, so no figure is transcribed by hand. |

**Non-goals.** This is not a trading bot: there is no execution path, no wallet integration,
no key handling, and none is planned. It is not financial advice or a profitability claim —
the headline finding is negative. It is not a general backtesting framework; it targets one
venue's bonding-curve mechanics.

## Results

Derived in full, with charts, in **[`report/analysis.ipynb`](report/analysis.ipynb)**.

1. **Mirroring the wallet one slot late loses money** — −5.930 SOL over 68 round trips, a
   25.0% win rate and a 0.31 profit factor.
2. **Exit tuning does not rescue it.** All 80 take-profit / stop-loss combinations lose, as
   does every trailing-stop and hold-time setting tested. The best cell still loses
   −2.586 SOL; it wins only by widening the stop until positions have room to recover.
3. **The cost is at entry, not exit.** 67 of 68 fills are adverse, at a median 13.5% worse
   market cap, costing 8.33 SOL — roughly 5× the total fees paid.
4. **The same trades at the target's price make +2.402 SOL.** The wallet's selection is
   genuinely profitable; the copying is what destroys it.

Stop-loss fired on 38 of 68 exits and accounts for effectively the entire loss. Trailing
stop (+1.49 SOL over 15 exits) and take-profit (+1.12 SOL over 2) are both net positive —
the exit logic works on positions that survive long enough to use it.

**The conclusion is that this is an execution-latency problem, not a risk-parameter
problem.** Co-location, a direct transaction feed and priority fees are the levers that
matter. A copy strategy evaluated without modelling entry delay will look profitable and
fail in production.

## How it works

### The replay engine

[`engine/simulateCopyTradingMcTpSlTrail.js`](engine/simulateCopyTradingMcTpSlTrail.js) is
dependency-free CommonJS that runs under bare `node`. For each token it:

1. Walks the recorded trades in slot order, maintaining the bonding curve's virtual token
   and SOL reserves as `BigInt` values.
2. Detects a `BUY` or `SWAP` by the target wallet, and opens a simulated position on the
   **next** slot, priced off the reserves as they stand at that point.
3. Marks the position to market on every subsequent trade, tracking peak market cap,
   unrealised return and holding time.
4. Closes on whichever exit rule fires first, recording which one it was.
5. Charges 1.5% per side and reports realised PnL.

### The exit model

Defaults live in
[`engine/strategies/strategyCopyTradingMcTpSlTrail.js`](engine/strategies/strategyCopyTradingMcTpSlTrail.js)
and every one is overridable from the dashboard, the API, or the sweep script.

| Rule | Default | Fires when |
|---|---|---|
| Take profit | +180% | Unrealised gain reaches the target |
| Stop loss | −35% | Unrealised loss reaches the limit |
| Trailing stop | −28% from peak | Price falls this far from its peak, once the peak exceeded +45% |
| Break-even protection | peak +35%, give-back 22% | A winner surrenders most of its gain |
| Max hold | 1800 s | Position exceeds its time budget |
| Momentum failure | −12% after 240 s | Position has not developed |
| Holder concentration | top 55% / top-3 82% | Supply is dangerously concentrated |

Entry is additionally gated by an optional market-cap window (`minMcSol` / `maxMcSol`), off
by default because datasets vary by wallet.

### The dashboard

A Next.js 16 App Router application over the same engine:

- Load datasets from `data/` or by browser upload — both capture shapes (mint-keyed object
  and array) normalise to one internal format.
- Configure every strategy parameter and run the engine as a **background job** with
  progress streaming, so a 67 MB capture does not block a request or get re-posted from the
  browser.
- Compare simulated results against the target wallet's own results per token: shared,
  missed and solo positions.
- Inspect candlestick charts, an activity tape, per-trade detail and bucketed distributions.
- Track multiple analysis wallets in local storage, kept deliberately separate from the
  wallet being copied.

### The live monitor

[`src/lib/simulation/live-monitor.ts`](src/lib/simulation/live-monitor.ts) runs the identical
risk model against a live Solana mainnet RPC feed, tracking open positions, realised PnL,
win rate and a structured audit log in memory. See [Safety](#safety).

## Quickstart

Requires **Node.js 20+**.

```bash
git clone https://github.com/dhanoliya-ji/solana-replay-engine.git
cd solana-replay-engine
npm install
cp .env.example .env.local      # optional: change the wallet being copied

npm run dev                     # dashboard at http://localhost:3000
```

Run the engine without the dashboard:

```bash
npm run sim                     # replay data/sample-data.json, print a summary
npm run report:data             # re-derive every figure in the notebook
npm run report                  # re-execute report/analysis.ipynb (needs Jupyter)
```

`npm run report` needs Python with `jupyter`, `matplotlib` and `numpy`. The notebook is
committed **with its outputs**, so reading it requires nothing at all.

## Repository layout

```
engine/                      Replay engine — plain CommonJS, runs under bare node
  simulateCopyTradingMcTpSlTrail.js    Bonding curve, fills, position lifecycle
  strategies/                          Strategy parameters and exit rules

report/
  analysis.ipynb             The results notebook, committed with outputs
  metrics.json               Generated: everything the notebook plots

scripts/export-metrics.js    Re-runs the engine to regenerate metrics.json

src/
  app/api/                   Routes: dataset loading, simulation jobs, live monitor
  components/dashboard/      Workspace, charts, tables, panels
  lib/data/                  Local file loading and dataset normalisation
  lib/simulation/            Engine bridge, background job store, live monitor
  lib/analytics/             Target-vs-simulated comparison, distributions
  types/domain.ts            Shared domain contracts

data/sample-data.json        Committed dataset; reproduces the full capture exactly
```

The engine is deliberately kept outside `src/` and free of framework imports. It runs under
plain `node`, and the dashboard reaches it through a thin adapter
([`src/lib/simulation/bridge.ts`](src/lib/simulation/bridge.ts)) — so the analysis never
depends on the UI.

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `TARGET_WALLET` | `DDDD2zvz…3R5R` | The wallet whose fills are mirrored |
| `BUY_AMOUNT_SOL` | `0.8` | Simulated position size per entry |
| `SOLANA_RPC_ENDPOINT` | `api.mainnet-beta.solana.com` | Feed for the live monitor |

The public RPC endpoint is heavily rate limited; point `SOLANA_RPC_ENDPOINT` at your own
provider for sustained monitoring.

## Safety

The live monitor connects to Solana mainnet and reads real transactions. **It cannot
trade:**

- No transaction is ever constructed, signed, or broadcast.
- No private key, keypair file, or wallet adapter is imported anywhere in the codebase.
- Positions, fills and PnL are computed in memory from observed reserve state, through the
  same bonding-curve code path as historical replay.
- Only read-only RPC methods are used.

The system is *incapable* of spending, rather than merely configured not to.

## Reproducibility

`data/sample-data.json` ships with the repository: 68 tokens, 26,685 recorded trades. The
engine only ever trades mints the target wallet touched, so this sample reproduces the full
2,498-token capture **exactly** — −5.930169 SOL over 68 round trips, verified from a clean
clone.

To re-derive the report end to end:

```bash
npm run report:data    # engine → report/metrics.json
npm run report         # notebook re-executes against it
```

The notebook reads `metrics.json` at execution time and renders every number through it, so
prose, tables and charts always move together. The full 67 MB capture stays local and
gitignored; nothing published here depends on it.

## Limitations

These bound what the results mean. Every one of them makes the real outcome **worse** than
reported, not better:

- **One target wallet**, 68 tokens, 26,685 trades. The findings describe this sample, not
  pump.fun in general.
- **Fees are modelled at a flat 1.5% per side.** Priority fees, Jito tips and failed
  transactions are not modelled.
- **No competing-bot impact.** Other copiers reacting to the same signal would push the
  entry price further against us.
- **Fills assume the replayed reserves absorb the simulated size** with no market impact
  beyond the curve maths.
- **The zero-latency counterfactual is a bound, not a target.** It assumes a same-slot fill
  at the same price, which no observe-then-react bot achieves.

## License

MIT — see [LICENSE](LICENSE).

This is research tooling. It is not financial advice, and it does not claim a profitable
strategy; its headline finding is the opposite.

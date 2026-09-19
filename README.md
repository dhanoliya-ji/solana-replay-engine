# Solana Replay Engine

A replay-based copy-trading simulator for Solana bonding-curve tokens, with a Next.js
analysis dashboard and a live mainnet monitor that runs strictly in dry run.

It answers one question honestly: **if you mirror a profitable pump.fun wallet trade for
trade, one slot behind, do you make money?**

The answer, on this dataset, is no — and the reason is not the strategy.

```
Baseline, 68 round trips mirroring a profitable wallet
  Total PnL       −5.930 SOL        Win rate        25.0%
  Profit factor    0.31             Max drawdown     5.93 SOL
  Median hold      11.7 s           Fees paid        1.57 SOL

Same 68 trades, entered at the target wallet's own price
  Total PnL       +2.402 SOL

  Cost of one slot of latency:  8.33 SOL
```

67 of 68 entries fill at a **worse** price than the wallet being copied — a median of
13.5% higher market cap. No exit parameter recovers that. All 80 take-profit /
stop-loss combinations tested lose money.

📊 **[Read the full results report](public/report/report.ojs)** — an Observable
notebook with the equity curve, per-trade breakdown, exit attribution, parameter
heatmap and latency analysis. Run `npm run dev` and open
[`/report`](http://localhost:3000/report) to view it rendered.

📋 **[Problem statement and objectives](PROBLEM_STATEMENT.md)**

---

## Why this exists

Copy-trading backtests usually replay the target wallet's trades and report what those
trades returned. That measures the *target's* performance and quietly assumes the copier
fills at the same price — which is impossible, because a bot must see a transaction
before it can react to one.

On a bonding curve that assumption is not a rounding error. The target's own buy moves
the curve inside the slot you are still reacting to, and so does every other bot chasing
the same signal. This engine enters on the **slot after** the target's fill and prices
it off the actual reserves, so the number it reports is the one a copier would have
lived with.

## Quickstart

Requires **Node.js 20+**.

```bash
git clone https://github.com/<you>/solana-replay-engine.git
cd solana-replay-engine
npm install
cp .env.example .env.local     # optional: change the wallet being copied

npm run dev                    # dashboard at http://localhost:3000
                               # report    at http://localhost:3000/report
```

Run the engine headless, without the dashboard:

```bash
npm run sim                    # replay data/sample-data.json, print a summary
npm run report:data            # re-derive every figure in the report
```

`data/sample-data.json` ships with the repository: 68 tokens, 26,685 recorded trades.
The engine only ever trades mints the target wallet touched, so this sample reproduces
the full 2,498-token capture **exactly** — every number above and in the report is
reproducible from a fresh clone.

## What it does

**Replay engine** (`engine/`)
- Reconstructs every fill from the constant-product bonding curve using the virtual
  token and SOL reserves recorded at that slot, in `BigInt` arithmetic.
- Mirrors the target wallet's `BUY` and `SWAP` fills, entering on the next slot.
- Closes positions with seven competing exit rules and records which one fired.
- Accounts for fees at 1.5% per side.

**Dashboard** (`src/`)
- Load datasets from `data/` or by browser upload; both shapes (mint-keyed object and
  array) are normalised to one internal format.
- Configure every strategy parameter and run the engine as a background job with
  progress streaming.
- Compare simulated results against the target wallet's own results per token — shared,
  missed, and solo positions.
- Inspect candlestick charts, an activity tape, trade detail, and bucketed
  distributions.
- Track multiple analysis wallets, persisted in local storage and kept separate from the
  wallet being copied.

**Live monitor** (`src/lib/simulation/live-monitor.ts`)
- Runs the same risk model against a live Solana mainnet RPC feed.
- Tracks open positions, realised PnL, win rate and a structured log in memory.
- **Dry run only** — see [Safety](#safety).

## The exit model

A position is closed by whichever rule fires first. Defaults live in
[`engine/strategies/strategyCopyTradingMcTpSlTrail.js`](engine/strategies/strategyCopyTradingMcTpSlTrail.js)
and every one is overridable from the dashboard or the API.

| Rule | Default | Fires when |
|---|---|---|
| Take profit | +180% | Unrealised gain reaches the target |
| Stop loss | −35% | Unrealised loss reaches the limit |
| Trailing stop | −28% from peak | Price falls this far from its peak, once the peak exceeded +45% |
| Break-even protection | peak +35%, give-back 22% | A winner surrenders most of its gain |
| Max hold | 1800 s | Position exceeds its time budget |
| Momentum failure | −12% after 240 s | Position has not developed |
| Holder concentration | top 55% / top-3 82% | Supply is dangerously concentrated |

Entry is additionally gated by an optional market-cap window (`minMcSol` / `maxMcSol`),
off by default.

**What the measurements say about these rules:** stop-loss fired on 38 of 68 exits and
accounts for effectively the entire loss. Trailing stop (+1.49 SOL over 15 exits) and
take-profit (+1.12 SOL over 2) are both net positive. The exit logic works on positions
that survive long enough to use it; the damage is done at entry.

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

The live monitor connects to Solana mainnet and reads real transactions. It **cannot
trade**:

- No transaction is ever constructed, signed, or broadcast.
- No private key, keypair file, or wallet adapter is imported anywhere in the codebase.
- Positions, fills and PnL are computed in memory from observed reserve state, using the
  same bonding-curve code path as historical replay.

The system is incapable of spending, rather than merely configured not to. Read-only RPC
methods are the only ones used.

## Project structure

```
engine/                        Replay engine (CommonJS, runnable standalone)
  simulateCopyTradingMcTpSlTrail.js    Bonding curve, fills, position lifecycle
  strategies/                          Strategy parameters and exit rules

src/
  app/api/                     Routes: dataset loading, simulation jobs, live monitor
  components/dashboard/        Workspace, charts, tables, panels
  lib/data/                    Local file loading and dataset normalisation
  lib/simulation/              Engine bridge, job store, live monitor
  lib/analytics/               Target-vs-simulated comparison, distributions
  types/domain.ts              Shared domain contracts

scripts/export-metrics.js      Regenerates the report's dataset
public/report/                 Observable report (.ojs) + its runner page
data/sample-data.json          Committed dataset; reproduces the full capture
```

The engine is deliberately kept outside `src/` and free of framework imports: it runs
under plain `node`, and the dashboard loads it through a thin bridge
(`src/lib/simulation/bridge.ts`). The analysis does not depend on the UI.

## The report

[`public/report/report.ojs`](public/report/report.ojs) is an
[Observable](https://observablehq.com/) notebook — the analysis is live code, not
transcribed figures. Named cells hold data and helpers and render nothing; anonymous
cells are the prose and charts. `public/report/index.html` runs it with the Observable
runtime and Plot.

Because `.ojs` does not render on GitHub, view it served:

```bash
npm run dev            # then open http://localhost:3000/report
```

To re-derive it after changing the engine, the strategy, or the dataset:

```bash
npm run report:data    # rewrites public/report/metrics.json
```

The report reads that file at load time, so the charts and every number in the prose
update together. Nothing in it is hand-written.

## Milestones

| # | Milestone | What it unlocked |
|---|---|---|
| 1 | Bonding-curve fill model in exact integer arithmetic | Fills that match the curve instead of approximating from market-cap snapshots |
| 2 | Next-slot entry | The delay a copier actually pays became a measured quantity, not an assumption |
| 3 | Layered exit model with attribution | Every close is traceable to the rule that caused it |
| 4 | Dataset normalisation across both shapes | Mint-keyed and array captures load through one path |
| 5 | Next.js dashboard with background simulation jobs | 67 MB datasets run without blocking or re-posting to the server |
| 6 | Target-vs-simulated comparison | Copier performance separated from the wallet's own |
| 7 | Live mainnet monitor, dry run | The same risk model validated against real-time data with no execution path |
| 8 | Parameter sweeps over the full grid | "Tuning does not fix it" became a measurement across 80 cells, not an opinion |
| 9 | Latency counterfactual | Located the loss at entry and quantified it at 8.33 SOL |
| 10 | Reproducible report from a committed sample | Every published figure re-derivable with one command |

## Limitations

These bound what the results mean, and all of them make the real outcome worse rather
than better:

- **One target wallet**, 68 tokens, 26,685 trades. The findings describe this sample,
  not pump.fun in general.
- **Fees are flat 1.5% per side.** Priority fees, Jito tips and failed transactions are
  not modelled.
- **No competing-bot impact.** Other copiers reacting to the same signal would push the
  entry price further against us.
- **Fills assume the replayed reserves absorb the simulated size** with no impact beyond
  the curve maths.
- **The zero-latency counterfactual is a bound, not a target.** It assumes a same-slot
  fill at the same price, which no observe-then-react bot achieves.

## Development

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

## License

MIT — see [LICENSE](LICENSE).

This is research tooling. It is not financial advice, and it does not claim a profitable
strategy — its headline finding is the opposite.

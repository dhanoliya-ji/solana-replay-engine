/**
 * Copy-trading strategy (simulation)
 *
 * Buy: mirror target wallet BUY/SWAP only when MC (SOL) at their fill is inside the configured range.
 * Sell: layered risk model using stop loss, time stop, momentum failure, holder concentration,
 *       break-even protection, take profit, and trailing stop.
 *
 * MC is the bonding-curve market cap in SOL (same as Number(mcLamports) / 1e9 elsewhere).
 *
 * Usage:
 *   node simulation/simulateCopyTradingMcTpSlTrail.js <tokens.json> simulation/strategies/strategyCopyTradingMcTpSlTrail.js
 *
 * Edit RUN_DEFAULTS below (target wallet + thresholds), or pass a strategy module that exports RUN_DEFAULTS.
 */

/** Defaults merged by the dashboard copy-trading simulator when constructing SimStrategy. */
const RUN_DEFAULTS = {
  /** Wallet to copy. Override with TARGET_WALLET in .env.local (see .env.example). */
  targetWallet: process.env.TARGET_WALLET || 'DDDD2zvzaPMLuZiC2Vos2i6TLFjJJ3bi1pN7kXQc3R5R',
  /** Simulated buy size (SOL); engine reads strategy.buyAmount. Override with BUY_AMOUNT_SOL. */
  buyAmount: Number(process.env.BUY_AMOUNT_SOL) || 0.8,
  /** null / null = no MC filter. Keep broad by default because datasets vary by wallet. */
  minMcSol: null,
  maxMcSol: null,

  /**
   * Senior baseline exits. Dashboard values can override these.
   * These are intentionally risk-first defaults, not a claim of production alpha.
   */
  takeProfitPercent: 180,
  stopLossPercent: 35,
  trailingStopPercent: 28,
  /** Only apply trailing after peak was at least this much above entry (%) */
  trailingMinProfitPercent: 45,
  /** Exit after this many seconds in position (wall-clock from trade timestamps). null = no limit */
  maxHoldSeconds: 1800,

  /** If price runs then gives most of it back, exit before winner becomes loser. */
  breakEvenProfitPercent: 35,
  breakEvenDrawdownPercent: 22,

  /** Holder concentration risk controls from simulator holderInfo. */
  maxHolderPercent: 55,
  maxTop3HolderPercent: 82,

  /** Exit slow trades that do not develop after entry. */
  momentumFailSeconds: 240,
  momentumFailProfitPercent: -12,
};

function optionalNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveNumber(value, fallback = null) {
  const n = optionalNumber(value, fallback);
  return n != null && n > 0 ? n : fallback;
}

function formatPercent(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

class SimStrategy {
  constructor(options = {}) {
    /** Wallet to copy (BUY + SWAP buys) */
    this.targetWallet = options.targetWallet ?? null;

    /** SOL size for simulated buy. */
    this.buyAmount = positiveNumber(options.buyAmount, RUN_DEFAULTS.buyAmount);

    /** MC filter at target's buy (SOL). Exclusive: buy only if mc > minMcSol && mc < maxMcSol. Null = no bound on that side. */
    this.minMcSol = optionalNumber(options.minMcSol, RUN_DEFAULTS.minMcSol);
    this.maxMcSol = optionalNumber(options.maxMcSol, RUN_DEFAULTS.maxMcSol);

    /** Exit: profit % from entry; null = off */
    this.takeProfitPercent = positiveNumber(
      options.takeProfitPercent,
      RUN_DEFAULTS.takeProfitPercent
    );

    /** Exit: loss % from entry; null = off */
    this.stopLossPercent = positiveNumber(options.stopLossPercent, RUN_DEFAULTS.stopLossPercent);

    /** Trailing stop % from peak MC; null = off */
    this.trailingStopPercent = positiveNumber(
      options.trailingStopPercent,
      RUN_DEFAULTS.trailingStopPercent
    );

    /**
     * If > 0, trailing stop is only evaluated after peak profit % >= this value.
     * 0 = trail from first tick after entry.
     */
    this.trailingMinProfitPercent = positiveNumber(
      options.trailingMinProfitPercent,
      RUN_DEFAULTS.trailingMinProfitPercent
    );

    /**
     * Sell after this many seconds from entry (trade timestamps in ms). Null = off.
     * Legacy: maxHoldMinutes (minutes) is still accepted and converted to seconds.
     */
    let maxHoldSec =
      options.maxHoldSeconds != null && options.maxHoldSeconds !== ''
        ? optionalNumber(options.maxHoldSeconds)
        : null;
    if (
      (maxHoldSec == null || !Number.isFinite(maxHoldSec)) &&
      options.maxHoldMinutes != null &&
      Number(options.maxHoldMinutes) > 0
    ) {
      maxHoldSec = Number(options.maxHoldMinutes) * 60;
    }
    this.maxHoldSeconds =
      maxHoldSec != null && Number.isFinite(maxHoldSec) && maxHoldSec > 0
        ? maxHoldSec
        : RUN_DEFAULTS.maxHoldSeconds;

    this.breakEvenProfitPercent = positiveNumber(
      options.breakEvenProfitPercent,
      RUN_DEFAULTS.breakEvenProfitPercent
    );
    this.breakEvenDrawdownPercent = positiveNumber(
      options.breakEvenDrawdownPercent,
      RUN_DEFAULTS.breakEvenDrawdownPercent
    );
    this.maxHolderPercent = positiveNumber(options.maxHolderPercent, RUN_DEFAULTS.maxHolderPercent);
    this.maxTop3HolderPercent = positiveNumber(
      options.maxTop3HolderPercent,
      RUN_DEFAULTS.maxTop3HolderPercent
    );
    this.momentumFailSeconds = positiveNumber(
      options.momentumFailSeconds,
      RUN_DEFAULTS.momentumFailSeconds
    );
    this.momentumFailProfitPercent = optionalNumber(
      options.momentumFailProfitPercent,
      RUN_DEFAULTS.momentumFailProfitPercent
    );
    this.positions = new Map();
  }

  /**
   * Used by simulate when target buys: after their trade is applied, mcSol is pool MC in SOL.
   */
  passesMcFilter(mcSol) {
    if (this.minMcSol == null && this.maxMcSol == null) return true;
    const lo = this.minMcSol ?? -Infinity;
    const hi = this.maxMcSol ?? Infinity;
    return mcSol > lo && mcSol < hi;
  }

  shouldBuy(event, _token, trade) {
    if (!this.targetWallet) return { buy: false, reason: 'No targetWallet' };
    if (!trade?.trader) return { buy: false, reason: 'No trade' };
    const isTarget = trade.trader === this.targetWallet;
    const isBuySide = trade.type === 'BUY' || trade.type === 'SWAP';
    if (!isTarget || !isBuySide) return { buy: false, reason: 'Not target buy' };

    const mcSol = Number(event?.mc ?? 0) / 1e9;
    if (!this.passesMcFilter(mcSol)) {
      return { buy: false, reason: `MC ${mcSol.toFixed(4)} outside (${this.minMcSol}, ${this.maxMcSol})` };
    }
    return { buy: true, reason: 'Copy + MC filter OK' };
  }

  shouldSell(event, _token, holderInfo = {}) {
    if (!event?.mc) return { sell: false };
    if (!this.positions.has(event.mint)) return { sell: false };

    const position = this.positions.get(event.mint);
    const currentMC = Number(event.mc) / 1e9;
    if (!(currentMC > 0) || !(position.buyMC > 0)) {
      return { sell: false };
    }

    if (currentMC > position.maxMC) {
      position.maxMC = currentMC;
      this.positions.set(event.mint, position);
    }

    const profitPercent = ((currentMC / position.buyMC) - 1) * 100;
    const peak = position.maxMC;
    const ddFromPeakPercent = peak > 0 ? ((peak - currentMC) / peak) * 100 : 0;
    const peakProfitPercent = ((peak / position.buyMC) - 1) * 100;
    const heldSeconds = this._heldSeconds(event, position);

    if (this._isConcentrationRisk(holderInfo)) {
      return this._sell(
        event.mint,
        `Holder concentration risk: top holder ${holderInfo.maxHolderPercent.toFixed(1)}%, top3 ${holderInfo.top3HolderPercent.toFixed(1)}%`
      );
    }

    if (
      this.stopLossPercent != null &&
      this.stopLossPercent > 0 &&
      profitPercent <= -this.stopLossPercent
    ) {
      return this._sell(event.mint, `Stop loss: ${formatPercent(profitPercent)} (limit -${this.stopLossPercent}%)`);
    }

    if (
      this.momentumFailSeconds != null &&
      this.momentumFailProfitPercent != null &&
      heldSeconds != null &&
      heldSeconds >= this.momentumFailSeconds &&
      profitPercent <= this.momentumFailProfitPercent
    ) {
      return this._sell(
        event.mint,
        `Momentum failure: ${formatPercent(profitPercent)} after ${heldSeconds.toFixed(1)}s`
      );
    }

    if (
      this.maxHoldSeconds != null &&
      this.maxHoldSeconds > 0 &&
      heldSeconds != null
    ) {
      if (heldSeconds >= this.maxHoldSeconds) {
        return this._sell(
          event.mint,
          `Max hold: ${heldSeconds.toFixed(1)}s (limit ${this.maxHoldSeconds}s), PnL ${formatPercent(profitPercent)}`
        );
      }
    }

    if (
      this.breakEvenProfitPercent != null &&
      this.breakEvenDrawdownPercent != null &&
      peakProfitPercent >= this.breakEvenProfitPercent &&
      ddFromPeakPercent >= this.breakEvenDrawdownPercent &&
      profitPercent <= 8
    ) {
      return this._sell(
        event.mint,
        `Break-even protection: peak ${formatPercent(peakProfitPercent)}, now ${formatPercent(profitPercent)}`
      );
    }

    if (
      this.takeProfitPercent != null &&
      this.takeProfitPercent > 0 &&
      profitPercent >= this.takeProfitPercent
    ) {
      return this._sell(event.mint, `Take profit: ${formatPercent(profitPercent)} (target +${this.takeProfitPercent}%)`);
    }

    if (
      this.trailingStopPercent != null &&
      this.trailingStopPercent > 0 &&
      peakProfitPercent >= this.trailingMinProfitPercent &&
      ddFromPeakPercent >= this.trailingStopPercent
    ) {
      return this._sell(
        event.mint,
        `Trailing stop: -${ddFromPeakPercent.toFixed(2)}% from peak after ${formatPercent(peakProfitPercent)} peak`
      );
    }

    return { sell: false };
  }

  _heldSeconds(event, position) {
    if (event.timestamp == null || position.buyTimestamp == null) return null;
    const heldMs = Number(event.timestamp) - Number(position.buyTimestamp);
    return Number.isFinite(heldMs) && heldMs >= 0 ? heldMs / 1000 : null;
  }

  _isConcentrationRisk(holderInfo) {
    if (!holderInfo || holderInfo.holderCount == null || holderInfo.holderCount <= 1) return false;

    const maxHolderPercent = Number(holderInfo.maxHolderPercent);
    const top3HolderPercent = Number(holderInfo.top3HolderPercent);
    const holderRisk =
      this.maxHolderPercent != null &&
      Number.isFinite(maxHolderPercent) &&
      maxHolderPercent >= this.maxHolderPercent;
    const top3Risk =
      this.maxTop3HolderPercent != null &&
      Number.isFinite(top3HolderPercent) &&
      top3HolderPercent >= this.maxTop3HolderPercent;

    return holderRisk || top3Risk;
  }

  _sell(mint, reason) {
    this.positions.delete(mint);
    return { sell: true, percentage: 100, reason };
  }
}

module.exports = { RUN_DEFAULTS, SimStrategy };

import 'server-only';

import path from 'node:path';
import { readLocalDataFile } from '@/lib/data/server';
import type { NormalizedToken, SimulationRunPayload, SimulationSettings } from '@/types/domain';

interface SimulationExecutionResult {
  summary: SimulationRunPayload['summary'];
  result: {
    results: SimulationRunPayload['buyTrades'];
    sells: SimulationRunPayload['sellTrades'];
  };
  myTradesForUi: SimulationRunPayload['myTradesForUi'];
  logText: string;
}

function loadCjsModule<T>(modulePath: string): T {
  const dynamicRequire = eval('require') as NodeJS.Require;
  return dynamicRequire(modulePath) as T;
}

function getSimulationModule() {
  const simulationPath = path.join(process.cwd(), 'engine', 'simulateCopyTradingMcTpSlTrail.js');
  return loadCjsModule<{
    runCopyTradingSimulation: (options: {
      tokensData: unknown;
      params: Record<string, unknown>;
      writeOutputs?: boolean;
      onProgress?: (info: { processed: number; total: number; mint?: string }) => void;
    }) => Promise<SimulationExecutionResult>;
  }>(simulationPath);
}

function getStrategyModule() {
  const strategyPath = path.join(
    process.cwd(),
    'engine',
    'strategies',
    'strategyCopyTradingMcTpSlTrail.js'
  );
  return loadCjsModule<{ RUN_DEFAULTS?: Partial<SimulationSettings> }>(strategyPath);
}

export function getSimulationDefaults(): SimulationSettings {
  const defaults = getStrategyModule().RUN_DEFAULTS ?? {};
  return {
    targetWallet: String(defaults.targetWallet ?? ''),
    buyAmount: Number(defaults.buyAmount ?? 0.8),
    minMcSol: defaults.minMcSol ?? null,
    maxMcSol: defaults.maxMcSol ?? null,
    takeProfitPercent: defaults.takeProfitPercent ?? null,
    stopLossPercent: defaults.stopLossPercent ?? null,
    trailingStopPercent: defaults.trailingStopPercent ?? null,
    trailingMinProfitPercent: defaults.trailingMinProfitPercent ?? null,
    maxHoldSeconds: defaults.maxHoldSeconds ?? null,
    breakEvenProfitPercent: defaults.breakEvenProfitPercent ?? null,
    breakEvenDrawdownPercent: defaults.breakEvenDrawdownPercent ?? null,
    maxHolderPercent: defaults.maxHolderPercent ?? null,
    maxTop3HolderPercent: defaults.maxTop3HolderPercent ?? null,
    momentumFailSeconds: defaults.momentumFailSeconds ?? null,
    momentumFailProfitPercent: defaults.momentumFailProfitPercent ?? null
  };
}

export async function runSimulationBridge(options: {
  localFileName?: string;
  tokensData?: NormalizedToken[];
  params: SimulationSettings;
  onProgress?: (info: { processed: number; total: number; mint?: string }) => void;
}): Promise<SimulationRunPayload> {
  const tokensData = options.localFileName
    ? await readLocalDataFile(options.localFileName)
    : options.tokensData;

  if (!tokensData) {
    throw new Error('No tokens data supplied for simulation');
  }

  const { runCopyTradingSimulation } = getSimulationModule();
  const result = await runCopyTradingSimulation({
    tokensData,
    params: options.params as unknown as Record<string, unknown>,
    writeOutputs: false,
    onProgress: options.onProgress
  });

  return {
    summary: result.summary,
    buyTrades: result.result.results,
    sellTrades: result.result.sells,
    myTradesForUi: result.myTradesForUi,
    logText: result.logText
  };
}

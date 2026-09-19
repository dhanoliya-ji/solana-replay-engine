"use client";

import { useEffect, useMemo, useState } from 'react';
import { DataLoaderPanel } from '@/components/dashboard/data-loader-panel';
import { WalletManager } from '@/components/dashboard/wallet-manager';
import { StrategyPanel } from '@/components/dashboard/strategy-panel';
import { MetricsGrid } from '@/components/dashboard/metrics-grid';
import { SimulationProgressCard } from '@/components/dashboard/simulation-progress-card';
import { TokenGroups } from '@/components/dashboard/token-groups';
import { TokenChart } from '@/components/dashboard/token-chart';
import { ActivityTape, buildActivityRows } from '@/components/dashboard/activity-tape';
import { TradeTablePanel } from '@/components/dashboard/trade-table-panel';
import { DistributionModal } from '@/components/dashboard/distribution-modal';
import { TradeDetailDrawer } from '@/components/dashboard/trade-detail-drawer';
/**
 * PROBLEM ADDRESSED & FIX IMPLEMENTED:
 * Imported LiveMonitorPanel to render real-time Solana mainnet monitoring controls,
 * dry-run copy trading statistics, active open positions, and live transaction log streaming.
 */
import { LiveMonitorPanel } from '@/components/dashboard/live-monitor-panel';
import { Panel } from '@/components/ui/panel';
import { normalizeDataset } from '@/lib/data/normalize';
import { buildComparison, filterRowsByGroup } from '@/lib/analytics/portfolio';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type {
  ActivityRow,
  DistributionKind,
  LocalDataFile,
  NormalizedDataset,
  NormalizedToken,
  SimulationJobState,
  SimulationRunPayload,
  SimulationSettings,
  TokenGroup,
  WalletFilter
} from '@/types/domain';
import { formatInteger, formatTimestamp, shortAddress } from '@/lib/utils';

const FALLBACK_SETTINGS: SimulationSettings = {
  targetWallet: '',
  buyAmount: 0.8,
  minMcSol: null,
  maxMcSol: null,
  takeProfitPercent: 180,
  stopLossPercent: 35,
  trailingStopPercent: 28,
  trailingMinProfitPercent: 45,
  maxHoldSeconds: 1800,
  breakEvenProfitPercent: 35,
  breakEvenDrawdownPercent: 22,
  maxHolderPercent: 55,
  maxTop3HolderPercent: 82,
  momentumFailSeconds: 240,
  momentumFailProfitPercent: -12
};

type ControlPanel = 'data' | 'wallets' | 'strategy' | 'live' | null;

function toolbarButtonClass(active = false, accent = false) {
  if (active) {
    return 'rounded-xl border border-[#3b4460] bg-[#151d2e] px-4 py-2.5 text-sm font-medium text-white transition';
  }

  if (accent) {
    return 'rounded-xl border border-[#5f4bc4] bg-[#141426] px-4 py-2.5 text-sm font-medium text-[#d3c9ff] transition hover:border-[#7c67ea] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
  }

  return 'rounded-xl border border-[#222b3c] bg-[#101621] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-[#3b4460] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
}

export function TradingWorkspace() {
  const [localFiles, setLocalFiles] = useState<LocalDataFile[]>([]);
  const [selectedLocalFile, setSelectedLocalFile] = useState('');
  const [dataset, setDataset] = useState<NormalizedDataset | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [walletInput, setWalletInput] = useState('');
  const [analysisWallets, setAnalysisWallets] = useLocalStorage<string[]>('copy-sim-analysis-wallets', []);
  const [showMetrics, setShowMetrics] = useLocalStorage<boolean>('copy-sim-show-metrics', true);
  const [activeWalletFilter, setActiveWalletFilter] = useState<WalletFilter>('all');
  const [settings, setSettings] = useState<SimulationSettings>(FALLBACK_SETTINGS);
  const [simulationJob, setSimulationJob] = useState<SimulationJobState | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationRunPayload | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TokenGroup>('all');
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [distributionKind, setDistributionKind] = useState<DistributionKind | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow | null>(null);
  const [activeControlPanel, setActiveControlPanel] = useState<ControlPanel>(null);

  useEffect(() => {
    async function loadFiles() {
      const response = await fetch('/api/data/files');
      const json = await response.json();
      setLocalFiles(json.files ?? []);
      if (!selectedLocalFile && json.files?.length) {
        setSelectedLocalFile(json.files[0].name);
      }
    }

    async function loadDefaults() {
      const response = await fetch('/api/simulation/defaults');
      const json = await response.json();
      if (json.defaults) {
        setSettings((current) => ({ ...current, ...json.defaults }));
      }
    }

    void loadFiles();
    void loadDefaults();
  }, [selectedLocalFile]);

  useEffect(() => {
    if (!simulationJob || !['queued', 'running'].includes(simulationJob.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/simulation/jobs/${simulationJob.jobId}`);
      if (!response.ok) return;
      const json = await response.json();
      setSimulationJob(json.job ?? null);
      if (json.job?.payload) {
        setSimulationResult(json.job.payload);
      }
    }, 800);

    return () => window.clearInterval(timer);
  }, [simulationJob]);

  const activeAnalysisWallets = useMemo(() => {
    if (activeWalletFilter === 'all') return analysisWallets;
    return analysisWallets.filter((wallet) => wallet === activeWalletFilter);
  }, [activeWalletFilter, analysisWallets]);

  const comparison = useMemo(() => {
    if (!dataset) return null;
    return buildComparison(dataset, activeAnalysisWallets, simulationResult);
  }, [activeAnalysisWallets, dataset, simulationResult]);

  const filteredRows = useMemo(() => {
    return comparison ? filterRowsByGroup(comparison.rows, selectedGroup) : [];
  }, [comparison, selectedGroup]);

  const resolvedSelectedMint = useMemo(() => {
    if (!filteredRows.length) return null;
    return selectedMint && filteredRows.some((row) => row.mint === selectedMint)
      ? selectedMint
      : filteredRows[0].mint;
  }, [filteredRows, selectedMint]);

  const selectedToken = useMemo<NormalizedToken | null>(() => {
    if (!dataset || !resolvedSelectedMint) return null;
    return dataset.tokens.find((token) => token.mint === resolvedSelectedMint) ?? null;
  }, [dataset, resolvedSelectedMint]);

  const activityRows = useMemo(() => buildActivityRows(selectedToken, activeAnalysisWallets, simulationResult), [activeAnalysisWallets, selectedToken, simulationResult]);
  const tokenUniverseRows = comparison?.rows ?? [];
  const tokenSelectRows = filteredRows.length ? filteredRows : tokenUniverseRows;
  const walletToolbarLabel =
    activeWalletFilter === 'all' ? 'All wallets' : shortAddress(activeWalletFilter, 5, 5);
  const trackedRangeLabel = dataset
    ? `${formatInteger(dataset.tokenCount)} tokens · ${formatInteger(dataset.tradeCount)} trades`
    : 'Import data to unlock replay';
  const simulationProgressPct =
    simulationJob && simulationJob.progress.total > 0
      ? (simulationJob.progress.processed / simulationJob.progress.total) * 100
      : 0;

  async function handleLoadLocalFile() {
    if (!selectedLocalFile) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const response = await fetch(`/api/data/load?file=${encodeURIComponent(selectedLocalFile)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Failed to load dataset');
      setDataset(json.dataset);
      setSimulationJob(null);
      setSimulationResult(null);
      setSelectedGroup('all');
      setSelectedActivity(null);
      setActiveControlPanel(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to load dataset');
    } finally {
      setLoadingData(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const normalized = normalizeDataset(raw, { kind: 'upload', label: file.name });
      setDataset(normalized);
      setSimulationJob(null);
      setSimulationResult(null);
      setSelectedGroup('all');
      setSelectedActivity(null);
      setActiveControlPanel(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to parse uploaded JSON');
    } finally {
      event.target.value = '';
      setLoadingData(false);
    }
  }

  function addWallet() {
    const wallet = walletInput.trim();
    if (!wallet) return;
    setAnalysisWallets((current) => Array.from(new Set([...current, wallet])));
    setWalletInput('');
    setActiveWalletFilter('all');
  }

  function removeWallet(wallet: string) {
    setAnalysisWallets((current) => current.filter((value) => value !== wallet));
    if (activeWalletFilter === wallet) {
      setActiveWalletFilter('all');
    }
  }

  function updateSetting<K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function runSimulation() {
    if (!dataset) {
      setDataError('Load a local data file or upload a dataset before running the simulation.');
      return;
    }
    setDataError(null);
    const body = dataset.sourceKind === 'local' && dataset.sourceFileName
      ? { localFileName: dataset.sourceFileName, params: settings }
      : { tokensData: dataset.tokens, params: settings };

    const response = await fetch('/api/simulation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok) {
      setDataError(json.error ?? 'Failed to start simulation');
      return;
    }
    setSimulationJob(json.job);
    setSelectedActivity(null);
    setActiveControlPanel(null);
  }

  function toggleControlPanel(panel: Exclude<ControlPanel, null>) {
    setActiveControlPanel((current) => (current === panel ? null : panel));
  }

  return (
    <main className="min-h-screen bg-[#050912] px-3 py-3 text-slate-100 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-[1800px]">
        <div className="overflow-hidden rounded-[28px] border border-[#171d29] bg-[#070b13]/95 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
          <div className="border-b border-[#171d29] px-4 py-3">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#132344] shadow-[inset_0_0_0_1px_rgba(96,165,250,0.18)]">
                    <div className="flex items-end gap-1">
                      <span className="h-3 w-1 rounded-full bg-[#60a5fa]" />
                      <span className="h-5 w-1 rounded-full bg-[#8b5cf6]" />
                      <span className="h-4 w-1 rounded-full bg-[#06b6d4]" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tracking-tight text-slate-50">
                      QuantFlow
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      dataset ? 'bg-[#22c55e]' : 'bg-slate-500'
                    }`}
                  />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Dataset
                    </div>
                    <div className="text-base font-medium text-slate-200">
                      {dataset ? dataset.sourceLabel : 'Not loaded'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleControlPanel('data')}
                  className={toolbarButtonClass(activeControlPanel === 'data')}
                >
                  ↑ Import data
                </button>

                <input
                  value={walletInput}
                  onChange={(event) => setWalletInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addWallet();
                  }}
                  placeholder="Paste target wallet"
                  className="min-w-[250px] rounded-xl border border-[#6d4d21] bg-[#121018] px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#b6782d]"
                />

                <button
                  type="button"
                  onClick={addWallet}
                  className="rounded-xl border border-[#b6782d] bg-[#1e160f] px-4 py-2.5 text-sm font-semibold text-[#f6b26b] transition hover:text-white"
                >
                  Add
                </button>

                <button
                  type="button"
                  onClick={() => toggleControlPanel('wallets')}
                  className={toolbarButtonClass(activeControlPanel === 'wallets')}
                >
                  {walletToolbarLabel} • {analysisWallets.length}
                </button>

                <button
                  type="button"
                  onClick={() => toggleControlPanel('strategy')}
                  className={toolbarButtonClass(activeControlPanel === 'strategy', true)}
                >
                  Risk &amp; strategy
                </button>

                {/*
                  PROBLEM ADDRESSED & FIX IMPLEMENTED:
                  Added glowing 'Solana Live Monitor' toolbar toggle button to give users 1-click
                  access to real-time Solana mainnet monitoring and dry-run copy trading.
                */}
                <button
                  type="button"
                  onClick={() => toggleControlPanel('live')}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition flex items-center gap-2 ${
                    activeControlPanel === 'live'
                      ? 'border-emerald-500 bg-emerald-950/80 text-emerald-300 shadow-lg shadow-emerald-950/40'
                      : 'border-emerald-800/60 bg-[#0d1612] text-emerald-400 hover:border-emerald-600 hover:text-emerald-200'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Solana Live Monitor (Dry-Run)
                </button>

                <button
                  type="button"
                  onClick={runSimulation}
                  disabled={!dataset || !settings.targetWallet}
                  className="rounded-xl border border-[#20283b] bg-[#151a26] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-[#3b4460] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Run simulation
                </button>

                {activeControlPanel ? (
                  <button
                    type="button"
                    onClick={() => setActiveControlPanel(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#222b3c] bg-[#101621] text-slate-400 transition hover:text-white"
                    aria-label="Close controls"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {activeControlPanel ? (
            <div className="border-b border-[#171d29] px-3 py-3">
              {activeControlPanel === 'data' ? (
                <div>
                  <DataLoaderPanel
                    files={localFiles}
                    selectedFile={selectedLocalFile}
                    onSelectFile={setSelectedLocalFile}
                    onLoadFile={handleLoadLocalFile}
                    onUpload={handleUpload}
                    isLoading={loadingData}
                    dataset={dataset}
                    error={dataError}
                  />
                </div>
              ) : null}

              {activeControlPanel === 'wallets' ? (
                <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                  <WalletManager
                    wallets={analysisWallets}
                    walletInput={walletInput}
                    onWalletInput={setWalletInput}
                    onAddWallet={addWallet}
                    onRemoveWallet={removeWallet}
                    activeFilter={activeWalletFilter}
                    onFilterChange={setActiveWalletFilter}
                    sourceWallet={settings.targetWallet}
                    onCopySourceWallet={() => {
                      if (!settings.targetWallet) return;
                      setAnalysisWallets((current) =>
                        Array.from(new Set([...current, settings.targetWallet]))
                      );
                    }}
                  />
                  <Panel
                    title="Wallet Notes"
                    subtitle="Keep analysis wallets separate from the copy source wallet."
                  >
                    <div className="space-y-3 text-sm text-slate-400">
                      <div className="rounded-xl border border-[#20283b] bg-[#0d1320] px-4 py-3">
                        Source wallet for simulation:{' '}
                        <span className="font-medium text-slate-100">
                          {settings.targetWallet || 'Not set'}
                        </span>
                      </div>
                      <div className="rounded-xl border border-[#20283b] bg-[#0d1320] px-4 py-3">
                        Active wallet filter:{' '}
                        <span className="font-medium text-slate-100">{walletToolbarLabel}</span>
                      </div>
                      <div className="rounded-xl border border-dashed border-[#20283b] px-4 py-3">
                        Add any number of wallets for highlighting and target PnL comparison. The
                        simulation source remains independently configurable in the strategy panel.
                      </div>
                    </div>
                  </Panel>
                </div>
              ) : null}

              {activeControlPanel === 'strategy' ? (
                <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                  <StrategyPanel
                    settings={settings}
                    onChange={updateSetting}
                    onRun={runSimulation}
                    runDisabled={!dataset || !settings.targetWallet}
                    running={
                      simulationJob?.status === 'queued' || simulationJob?.status === 'running'
                    }
                  />
                  <SimulationProgressCard job={simulationJob} />
                </div>
              ) : null}

              {/*
                PROBLEM ADDRESSED & FIX IMPLEMENTED:
                Rendered LiveMonitorPanel component when 'live' control panel is active.
                Provides user real-time Solana mainnet monitoring, dry-run strategy execution,
                active position management, and live audit logging.
              */}
              {activeControlPanel === 'live' ? (
                <div>
                  <LiveMonitorPanel
                    settings={settings}
                    onUpdateSettings={updateSetting}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {dataError || (simulationJob && simulationJob.status !== 'completed') ? (
            <div className="border-b border-[#171d29] px-3 py-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[18px] border border-[#1b2333] bg-[#0a1019]/95 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Execution status
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">
                        {simulationJob
                          ? simulationJob.status === 'completed'
                            ? 'Simulation completed'
                            : simulationJob.status === 'error'
                              ? 'Simulation error'
                              : 'Simulation running'
                          : 'Ready'}
                      </div>
                    </div>
                    {simulationJob ? (
                      <div className="text-sm text-slate-400">
                        {simulationJob.progress.processed} / {simulationJob.progress.total || '--'}{' '}
                        tokens
                      </div>
                    ) : null}
                  </div>

                  {simulationJob ? (
                    <>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#111827]">
                        <div
                          className="h-full rounded-full bg-[#22c55e] transition-all"
                          style={{ width: `${Math.min(100, simulationProgressPct)}%` }}
                        />
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {simulationJob.progress.mint
                          ? `Current token ${shortAddress(simulationJob.progress.mint, 7, 7)}`
                          : simulationJob.payload?.logText || 'Waiting for progress...'}
                      </div>
                    </>
                  ) : null}

                  {dataError ? (
                    <div className="mt-4 rounded-xl border border-[#4c1d1d] bg-[#220f14] px-4 py-3 text-sm text-[#fca5a5]">
                      {dataError}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[18px] border border-[#1b2333] bg-[#0a1019]/95 px-4 py-4 text-sm text-slate-400">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Source wallet
                  </div>
                  <div className="mt-2 font-medium text-slate-100">
                    {settings.targetWallet || 'Set in strategy'}
                  </div>
                  <div className="mt-3">{trackedRangeLabel}</div>
                  <div className="mt-2">
                    {dataset
                      ? `Range ${formatTimestamp(dataset.minTimestamp)} to ${formatTimestamp(dataset.maxTimestamp)}`
                      : 'Load a local file or upload JSON to replay tokens.'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="px-3 pt-3">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowMetrics((current) => !current)}
                className="rounded-xl border border-[#222b3c] bg-[#101621] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-[#3b4460] hover:text-white"
              >
                {showMetrics ? 'Hide overview' : 'Show overview'}
              </button>
            </div>
          </div>

          {showMetrics ? (
            <div className="px-3 pb-3 pt-2">
              <MetricsGrid
                summary={comparison?.summary ?? null}
                simulation={simulationResult}
                rows={comparison?.rows ?? []}
                onOpenDistribution={setDistributionKind}
                onOpenComparison={() => setDistributionKind('side-by-side')}
              />
            </div>
          ) : null}

          <div className="border-y border-[#171d29] px-3 py-2.5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Token Universe
                </div>
                <TokenGroups
                  rows={comparison?.rows ?? []}
                  value={selectedGroup}
                  onChange={setSelectedGroup}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">{trackedRangeLabel}</span>
                <select
                  value={resolvedSelectedMint ?? ''}
                  onChange={(event) => setSelectedMint(event.target.value || null)}
                  className="min-w-[230px] rounded-xl border border-[#222b3c] bg-[#101621] px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#3b82f6]"
                >
                  <option value="">
                    {tokenSelectRows.length ? 'Select token' : 'Select token · 0'}
                  </option>
                  {tokenSelectRows.map((row) => (
                    <option key={row.mint} value={row.mint}>
                      {shortAddress(row.mint, 7, 7)} · {row.totalTrades} trades
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid items-stretch gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_400px]">
            <TokenChart
              token={selectedToken}
              analysisWallets={activeAnalysisWallets}
              simulation={simulationResult}
              onSelectActivity={setSelectedActivity}
            />
            <ActivityTape
              rows={activityRows}
              onSelect={setSelectedActivity}
            />
          </div>

          <div className="px-3 pb-3">
            <TradeTablePanel
              rows={activityRows}
              selectedActivityId={selectedActivity?.id ?? null}
              onSelect={setSelectedActivity}
            />
          </div>

        </div>
      </div>

      <DistributionModal kind={distributionKind} rows={comparison?.rows ?? []} onClose={() => setDistributionKind(null)} />
      <TradeDetailDrawer activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
    </main>
  );
}

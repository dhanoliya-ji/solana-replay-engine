import type { ChangeEvent } from 'react';
import type { LocalDataFile, NormalizedDataset } from '@/types/domain';
import { Panel } from '@/components/ui/panel';
import { formatInteger, formatTimestamp } from '@/lib/utils';

export function DataLoaderPanel({
  files,
  selectedFile,
  onSelectFile,
  onLoadFile,
  onUpload,
  isLoading,
  dataset,
  error
}: {
  files: LocalDataFile[];
  selectedFile: string;
  onSelectFile: (value: string) => void;
  onLoadFile: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  dataset: NormalizedDataset | null;
  error: string | null;
}) {
  return (
    <Panel
      title="Data Workflow"
      subtitle="Load the local token-history JSON under data/ or upload a dataset from the browser."
      actions={
        <button
          type="button"
          onClick={onLoadFile}
          disabled={!selectedFile || isLoading}
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Load local file'}
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Local files</span>
            <select
              value={selectedFile}
              onChange={(event) => onSelectFile(event.target.value)}
              className="w-full rounded-xl border border-line bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-accent"
            >
              <option value="">Select a file from data/</option>
              {files.map((file) => (
                <option key={file.name} value={file.name}>
                  {file.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-slate-950/40 px-6 py-8 text-center text-sm text-slate-400 transition hover:border-accent/40 hover:text-slate-200">
            <span className="font-medium text-slate-200">Upload JSON dataset</span>
            <span className="mt-1">Supports the same array-style or mint-keyed token schema.</span>
            <input type="file" accept="application/json,.json" onChange={onUpload} className="hidden" />
          </label>

          {error ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}
        </div>

        <div className="rounded-2xl border border-line/70 bg-panelSoft/60 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Loaded dataset</div>
          {dataset ? (
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between gap-4"><span>Source</span><span>{dataset.sourceLabel}</span></div>
              <div className="flex justify-between gap-4"><span>Shape</span><span>{dataset.shape}</span></div>
              <div className="flex justify-between gap-4"><span>Tokens</span><span>{formatInteger(dataset.tokenCount)}</span></div>
              <div className="flex justify-between gap-4"><span>Trades</span><span>{formatInteger(dataset.tradeCount)}</span></div>
              <div className="flex justify-between gap-4"><span>Wallets seen</span><span>{formatInteger(dataset.uniqueWalletCount)}</span></div>
              <div className="flex justify-between gap-4"><span>Window start</span><span>{formatTimestamp(dataset.minTimestamp)}</span></div>
              <div className="flex justify-between gap-4"><span>Window end</span><span>{formatTimestamp(dataset.maxTimestamp)}</span></div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              No dataset loaded yet. Choose a local file or upload one to unlock simulation and analytics.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

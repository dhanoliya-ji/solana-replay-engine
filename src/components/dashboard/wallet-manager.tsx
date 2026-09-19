import { Panel } from '@/components/ui/panel';
import { Pill } from '@/components/ui/pill';
import { shortAddress } from '@/lib/utils';

export function WalletManager({
  wallets,
  walletInput,
  onWalletInput,
  onAddWallet,
  onRemoveWallet,
  activeFilter,
  onFilterChange,
  sourceWallet,
  onCopySourceWallet
}: {
  wallets: string[];
  walletInput: string;
  onWalletInput: (value: string) => void;
  onAddWallet: () => void;
  onRemoveWallet: (wallet: string) => void;
  activeFilter: string;
  onFilterChange: (wallet: string) => void;
  sourceWallet: string;
  onCopySourceWallet: () => void;
}) {
  return (
    <Panel title="Wallet Workflow" subtitle="Analysis wallets are persisted locally and stay separate from the copy source wallet.">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={walletInput}
            onChange={(event) => onWalletInput(event.target.value)}
            placeholder="Add wallet address for analysis/highlighting"
            className="flex-1 rounded-xl border border-line bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={onAddWallet}
            className="rounded-xl border border-line bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 hover:border-accent/40"
          >
            Add wallet
          </button>
          <button
            type="button"
            onClick={onCopySourceWallet}
            className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-medium text-accent"
          >
            Use source wallet
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeFilter === 'all' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-slate-900/60 text-slate-300'}`}
          >
            All wallets
          </button>
          {wallets.map((wallet) => (
            <button
              type="button"
              key={wallet}
              onClick={() => onFilterChange(wallet)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeFilter === wallet ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-slate-900/60 text-slate-300'}`}
            >
              {shortAddress(wallet, 5, 5)}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {wallets.length ? (
            wallets.map((wallet) => (
              <div key={wallet} className="flex items-center justify-between rounded-xl border border-line/70 bg-slate-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Pill tone={wallet === sourceWallet ? 'accent' : 'slate'}>{wallet === sourceWallet ? 'Source' : 'Analysis'}</Pill>
                  <span className="text-sm text-slate-200">{wallet}</span>
                </div>
                <button type="button" onClick={() => onRemoveWallet(wallet)} className="text-sm text-slate-400 hover:text-danger">
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-line px-4 py-4 text-sm text-slate-400">
              Add at least one wallet to compare target behavior. The source wallet can still drive simulations independently.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

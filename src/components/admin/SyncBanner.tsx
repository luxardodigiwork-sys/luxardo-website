import type { SyncStatus } from '../../utils/contentSync';

/** Shown on admin editing pages until the first successful load from the server; saving is disabled meanwhile. */
export function SyncBanner({ status, retry }: { status: SyncStatus; retry: () => void }) {
  if (status === 'ready') return null;
  return (
    <div role="status" className="mb-6 border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm font-sans flex items-center justify-between gap-4">
      <span>
        {status === 'loading'
          ? 'Loading the latest published content... Saving is disabled until this finishes.'
          : 'Could not load the latest published content, so saving is disabled to avoid overwriting it.'}
      </span>
      {status === 'failed' && (
        <button type="button" onClick={retry} className="underline font-bold uppercase tracking-widest text-xs">Retry</button>
      )}
    </div>
  );
}

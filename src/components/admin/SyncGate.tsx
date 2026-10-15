import { useRef, type ReactNode } from 'react';
import { useSyncStatus } from '../../utils/contentSync';
import { SyncBanner } from './SyncBanner';

/**
 * Mounts an admin editing page only after the first successful load from the server, so the editor starts from fresh data
 * (no later remount is needed). Once mounted it is never removed again, so a later retry or refresh cannot erase unsaved edits.
 */
export function SyncGate({ children }: { children: ReactNode }) {
  const { status, retry } = useSyncStatus();
  const opened = useRef(false);
  if (status === 'ready') opened.current = true;
  if (!opened.current) return <div className="max-w-6xl mx-auto"><SyncBanner status={status} retry={retry} /></div>;
  return <>{children}</>;
}

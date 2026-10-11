import React from 'react';
import { CatalogueState } from '../utils/catalogueState';

/** Shared loading / error / empty placeholder for any storefront surface that lists products. */
export function CatalogueStatus({ state }: { state: CatalogueState }) {
  if (state === 'ready') return null;
  const text =
    state === 'loading'
      ? { title: 'Loading collection…', body: '' }
      : state === 'error'
        ? { title: 'We could not load our collection.', body: 'Please check your connection and try again shortly.' }
        : { title: 'Products coming soon', body: 'Our collection is being prepared. Please check back shortly.' };
  return (
    <div role="status" className="py-24 text-center">
      <p className="text-xl font-display">{text.title}</p>
      {text.body && <p className="mt-3 text-sm text-brand-secondary">{text.body}</p>}
    </div>
  );
}

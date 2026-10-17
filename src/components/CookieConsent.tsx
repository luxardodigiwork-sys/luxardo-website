import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getConsent, initAnalytics, isStaffPath, setConsent, track, trackingConfigured } from '../utils/analytics';

/** Cookie banner + route page-view tracker. Renders nothing unless GA4 / Meta Pixel IDs are configured. */
export default function CookieConsent() {
  const location = useLocation();
  const [choice, setChoice] = useState(getConsent());

  useEffect(() => { initAnalytics(); }, []);
  useEffect(() => {
    if (!isStaffPath(location.pathname)) track('page_view', { path: location.pathname });
  }, [location.pathname, choice]);

  if (!trackingConfigured() || choice !== null || isStaffPath(location.pathname)) return null;
  const decide = (granted: boolean) => { setConsent(granted); setChoice(granted ? 'granted' : 'denied'); };
  return (
    <div role="dialog" aria-label="Cookie preferences" className="fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-gray-200 shadow-lg px-4 py-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
        <p className="flex-1 text-gray-600">
          We use cookies to understand how the store is used and to show relevant offers. See our{' '}
          <Link to="/policies/privacy" className="underline">Privacy Policy</Link>.
        </p>
        <div className="flex gap-2">
          <button onClick={() => decide(false)} className="px-5 py-2 border border-gray-300 text-xs uppercase tracking-widest hover:border-black">Decline</button>
          <button onClick={() => decide(true)} className="px-5 py-2 bg-black text-white text-xs uppercase tracking-widest hover:bg-gray-800">Accept</button>
        </div>
      </div>
    </div>
  );
}
